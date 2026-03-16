# rehapiano/app/main.py
import argparse
import asyncio
import time
from typing import Dict
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv

# Find .env file in the streamer root directory (parent of app/)
_env_path = Path(__file__).parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
    print(f"[ENV] Loaded .env from {_env_path}")
else:
    # Try current working directory
    load_dotenv()

from serial.tools import list_ports

# HTTP server (FastAPI + Uvicorn)
import uvicorn
from .server import app as http_app, ws_manager, device_registry

# import SerialDeviceTask rovnako ako doteraz
try:
    from ..io.serial_port import SerialDeviceTask
except Exception:
    try:
        from .serial_port import SerialDeviceTask
    except Exception:
        from serial_port import SerialDeviceTask  # flat


from .state_store import upsert_port, remove_port, snapshot as state_snapshot

# Virtual device support
try:
    from ..io.virtual_device import VirtualDeviceManager, VIRTUAL_LEFT_PORT, VIRTUAL_RIGHT_PORT, VIRTUAL_FW
except ImportError:
    try:
        from .virtual_device import VirtualDeviceManager, VIRTUAL_LEFT_PORT, VIRTUAL_RIGHT_PORT, VIRTUAL_FW
    except ImportError:
        VirtualDeviceManager = None
        VIRTUAL_LEFT_PORT = "/virtual/left"
        VIRTUAL_RIGHT_PORT = "/virtual/right"
        VIRTUAL_FW = 231

async def open_device_task(
    port: str,
    baud: int,
    on_sample_cb,
    on_identifier_cb,
    buzz_on_start_args=None,
):
    """
    Otvorí SerialDeviceTask pre port a spraví prípadný BUZZ.
    Vráti inštanciu alebo None.
    """
    task = SerialDeviceTask(
        port=port,
        baudrate=baud,
        on_sample=on_sample_cb,
        on_identifier=on_identifier_cb,   # <-- použij priamo parameter, NIE make_on_identifier_cb()
    )
    try:
        await task.open()
    except Exception as e:
        print(f"[{port}] OPEN ERROR: {e}")
        return None

    # hneď po úspešnom pridaní tasku
    upsert_port(
        port,
        baud=baud,
        online=True,
        identified=False,
        uid=None, uid_dec=None, uid_hex=None, fw=None,
        hand="unknown", hand_code=None,
        last_seen=time.time(),
    )

    await asyncio.sleep(0.15)

    # po otvorení portu pošli IDENT len raz (plus 1 retry o chvíľu)
    try:
        await task.send_identifier_request()
    except Exception as e:
        print(f"[{port}] IDENT send error: {e}")

    # voliteľný BUZZ
    if buzz_on_start_args:
        try:
            finger, pwm, dur = buzz_on_start_args
            await task.send_haptic(finger, pwm, dur)
        except Exception as e:
            print(f"[{port}] BUZZ send error: {e}")

    return task


async def manage_ports_loop(
    scan_interval: float,
    identify_retry: float,
    baud: int,
    buzz_on_start_args,
    print_stream: bool,
    ):
    """
    Každých `scan_interval` s preskenuje USB porty:
      - nové porty otvorí,
      - zmiznuté porty zavrie,
      - kým nie je zariadenie identifikované, každých `identify_retry` s mu pošle RequestIdentifier.
    """
    device_tasks: Dict[str, SerialDeviceTask] = {}
    device_state: Dict[str, dict] = {}

    # spoločné callbacky
    async def on_sample_cb(sample: dict):
        # presný systémový čas
        sys_ts = time.time()             # epoch seconds (float), ~ms presnosť
        sys_mono = time.perf_counter()   # monotónny čas na delta výpočty

         # urč ruku podľa type (0x01=left, 0x81=right)
        t = sample.get("type")
        hand = "unknown"
        if t == 0x01:
            hand = "left"
        elif t == 0x81:
            hand = "right"

        # aktualizuj stav
        # pri každom sample: zariadenie je online
        upsert_port(
            sample.get("port"),
            online=True,
            last_seen=sys_ts,
            last_sample_ts=sample.get("ts"),
            hand=hand,
            hand_code=t,
        )

        st = state_snapshot().get(sample.get("port"), {})
        uid = st.get("uid")
        fw  = st.get("fw")
        uid_hex = st.get("uid_hex")
        uid_dec = st.get("uid_dec")

        # voliteľný stručný print do konzoly
        if print_stream:
            adc = sample.get("adc")
            imu = sample.get("imu")
            print(f"[{sample.get('port')}] t={sample.get('ts')}  adc={adc}  imu={imu}")

        await ws_manager.broadcast({
        "kind": "sample",
        "port": sample.get("port"),
        "ts": sample.get("ts"),
        "sys_ts": sys_ts,
        "sys_mono": sys_mono,
        "type": t,
        "adc": sample.get("adc"),
        "imu": sample.get("imu"),
        "uid": uid,
        "uid_hex": uid_hex,
        "uid_dec": uid_dec,
        "fw": fw,
        "hand": hand,
        "hand_code": t,
    })

    # on_identifier: označí port ako identifikovaný + pošle WS
    def make_on_identifier_cb(port: str):
        async def _cb(uid: int, fw: int):
            uid_hex = f"0x{uid:08X}"
            now = time.time()
            upsert_port(
                port,
                identified=True,
                uid=uid,
                uid_dec=uid,      # pre UI v dec
                uid_hex=uid_hex,  # pre UI v hex
                fw=fw,
                online=True,
                last_seen=now,
                last_identifier_ts=now,
            )
            # --- DOPLŇ: zosúľaď lokálne device_state, aby sa už neposielal retry ---
            st_local = device_state.get(port)
            if st_local is not None:
                st_local["identified"] = True
                st_local["last_ident_ts"] = now
            # Get hand info from state (determined from sample messages)
            st = state_snapshot().get(port, {})
            hand = st.get("hand", "unknown")
            hand_code = st.get("hand_code")
            print(f"[IDENTIFIER] {port}: UID={uid_hex} ({uid}) FW={fw} hand={hand}")
            await ws_manager.broadcast({
                "kind": "identifier",
                "port": port,
                "uid": uid,
                "uid_hex": uid_hex,
                "uid_dec": uid,
                "fw": fw,
                "hand": hand,
                "type": hand_code,
            })
        return _cb

    try:
        while True:
            # 1) aktuálne USB sériové porty (Mac/Linux/Windows budú mať v názve "usb"/"USB" pri USB-UART)
            ports = [
                p.device
                for p in list_ports.comports()
                if any(x in p.device.lower() for x in ("usb", "com", "acm"))
            ]# print(ports)
            # 2) otvor nové porty
            for port in ports:
                if port not in device_tasks:
                    
                    print(f"[DISCOVERY] NOVÝ port: {port} — otváram...")
                    device_state[port] = {
                        "identified": False,
                        "last_ident_ts": 0.0,
                        "uid": None,
                        "fw": None,
                    }
                    task = await open_device_task(
                        port,
                        baud,
                        on_sample_cb=on_sample_cb,
                        on_identifier_cb=make_on_identifier_cb(port),
                        buzz_on_start_args=buzz_on_start_args,
                    )
                    if task:
                        device_tasks[port] = task
                        device_registry.set(port, task)  # zaregistruj pre HTTP API
                        # oznám UI, že port je pridaný (hand je zatiaľ unknown, príde zo sample)
                        await ws_manager.broadcast({"kind": "device_added", "port": port, "hand": "unknown"})
                    else:
                        print(f"[DISCOVERY] {port}: neúspešné otvorenie")
                        device_state.pop(port, None)

            # 3) zavri porty, ktoré zmizli
            current = set(ports)
            for p in list(device_tasks.keys()):
                if p not in current:
                    print(f"[DISCOVERY] Port odpojený: {p} — zatváram...")
                    try:
                        await device_tasks[p].close()
                    except Exception as e:
                        print(f"[{p}] ERROR pri close: {e}")
                    device_tasks.pop(p, None)
                    device_registry.remove(p)      # odregistruj z HTTP API
                    device_state.pop(p, None)
                    st = state_snapshot().get(p, {})
                    hand = st.get("hand", "unknown")
                    upsert_port(p, online=False, last_seen=time.time())
                    await ws_manager.broadcast({"kind": "device_removed", "port": p, "hand": hand})

            # 4) IDENT retry kým nie je zariadenie identifikované
           # 4) IDENT retry kým nie je zariadenie identifikované
            now = time.time()
            for p, task in device_tasks.items():
                st_local = device_state.get(p)
                if not st_local:
                    continue

                # použijeme aj state_snapshot, aby sme sa neriadili len lokálnym dictom
                st_snap = state_snapshot().get(p, {})
                if st_snap.get("identified"):
                    continue

                if (now - st_local.get("last_ident_ts", 0.0)) >= identify_retry:
                    try:
                        await task.send_identifier_request()
                        st_local["last_ident_ts"] = time.time()
                        print(f"[{p}] IDENT request odoslaný")
                    except Exception as e:
                        print(f"[{p}] IDENT send error: {e}")

            if not device_tasks:
                print("[DISCOVERY] Žiadne otvorené zariadenia.")

            await asyncio.sleep(scan_interval)
    except asyncio.CancelledError:
        # cleanup pri ukončení
        for p, t in list(device_tasks.items()):
            try:
                await t.close()
            except Exception:
                pass
        raise


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--baud", type=int, default=1_000_000)
    p.add_argument("--print-stream", action="store_true")
    p.add_argument(
        "--scan-interval",
        type=float,
        default=2.0,
        help="Interval (s) pre skenovanie pripojených USB zariadení (default: 2.0)",
    )
    p.add_argument(
        "--identify-retry",
        type=float,
        default=3.0,
        help="Ako často skúšať IDENT, kým príde odpoveď (s)",
    )
    p.add_argument("--buzz-on-start", nargs=3, type=int, metavar=("FINGER", "PWM", "DUR_MS"))
    p.add_argument("--http-host", default="127.0.0.1")
    p.add_argument("--http-port", type=int, default=8000)
    p.add_argument(
        "--recordings-dir",
        type=str,
        default=None,
        help="Directory for saving recordings (default: uses RECORDINGS_DIR env or 'recordings')",
    )
    args = p.parse_args()

    # Set recordings directory if specified
    if args.recordings_dir:
        from .ws_recording import set_recordings_dir
        set_recordings_dir(args.recordings_dir)

    # spustíme HTTP/WS server (FastAPI + Uvicorn) paralelne
    config = uvicorn.Config(
        http_app,
        host=args.http_host,
        port=args.http_port,
        loop="asyncio",
        lifespan="off",
        log_level="info",
    )
    uvicorn_server = uvicorn.Server(config)
    asyncio.create_task(uvicorn_server.serve())
    print(f"[HTTP] UI na http://{args.http_host}:{args.http_port}/")

    # Initialize virtual device manager
    virtual_manager = None
    if VirtualDeviceManager is not None:
        async def on_virtual_sample(sample: dict):
            """Handle samples from virtual devices."""
            sys_ts = time.time()
            sys_mono = time.perf_counter()

            t = sample.get("type")
            hand = "unknown"
            if t == 0x01:
                hand = "left"
            elif t == 0x81:
                hand = "right"

            port = sample.get("port")

            # Update state store
            upsert_port(
                port,
                online=True,
                last_seen=sys_ts,
                last_sample_ts=sample.get("ts"),
                hand=hand,
                hand_code=t,
            )

            st = state_snapshot().get(port, {})
            uid = st.get("uid")
            fw = st.get("fw")
            uid_hex = st.get("uid_hex")
            uid_dec = st.get("uid_dec")

            # Broadcast sample
            await ws_manager.broadcast({
                "kind": "sample",
                "port": port,
                "ts": sample.get("ts"),
                "sys_ts": sys_ts,
                "sys_mono": sys_mono,
                "type": t,
                "adc": sample.get("adc"),
                "imu": sample.get("imu"),
                "uid": uid,
                "uid_hex": uid_hex,
                "uid_dec": uid_dec,
                "fw": fw,
                "hand": hand,
                "hand_code": t,
            })

        async def on_virtual_device_added(port: str):
            """Handle virtual device addition."""
            # Determine hand from virtual port
            hand = "left" if port == VIRTUAL_LEFT_PORT else "right"
            hand_code = 0x01 if hand == "left" else 0x81
            upsert_port(
                port,
                baud=0,  # Virtual device, no baud rate
                online=True,
                identified=False,
                uid=None, uid_dec=None, uid_hex=None, fw=None,
                hand=hand, hand_code=hand_code,
                last_seen=time.time(),
            )
            await ws_manager.broadcast({"kind": "device_added", "port": port, "hand": hand})

        async def on_virtual_identifier(port: str, uid: int, fw: int):
            """Handle virtual device identifier."""
            uid_hex = f"0x{uid:08X}"
            now = time.time()
            hand = "left" if port == VIRTUAL_LEFT_PORT else "right"
            hand_code = 0x01 if hand == "left" else 0x81

            upsert_port(
                port,
                identified=True,
                uid=uid,
                uid_dec=uid,
                uid_hex=uid_hex,
                fw=fw,
                hand=hand,
                hand_code=hand_code,
                online=True,
                last_seen=now,
                last_identifier_ts=now,
            )

            print(f"[VIRTUAL IDENTIFIER] {port}: UID={uid_hex} ({uid}) FW={fw} hand={hand}")
            await ws_manager.broadcast({
                "kind": "identifier",
                "port": port,
                "uid": uid,
                "uid_hex": uid_hex,
                "uid_dec": uid,
                "fw": fw,
                "hand": hand,
                "type": hand_code,
            })

        virtual_manager = VirtualDeviceManager(
            on_sample=on_virtual_sample,
            on_device_added=on_virtual_device_added,
            on_identifier=on_virtual_identifier,
        )

        # Register with server module
        from .server import set_virtual_manager
        set_virtual_manager(virtual_manager)
        print("[VIRTUAL] Virtual device manager initialized")
        print("[VIRTUAL] Use /api/virtual/enable to start virtual mode")

    scan_interval = args.scan_interval
    identify_retry = args.identify_retry
    baud = args.baud
    buzz_args = tuple(args.buzz_on_start) if args.buzz_on_start else None
    print_stream = args.print_stream

    # discovery loop beží stále
    mg_task = asyncio.create_task(
        manage_ports_loop(scan_interval, identify_retry, baud, buzz_args, print_stream)
    )
    try:
        await mg_task
    except KeyboardInterrupt:
        mg_task.cancel()
        try:
            await mg_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.run(main())