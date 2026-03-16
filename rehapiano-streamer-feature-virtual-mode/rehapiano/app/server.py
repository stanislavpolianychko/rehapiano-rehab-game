# rehapiano/app/server.py
from pathlib import Path
from typing import Set, Dict, List, Optional
import json
import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .state_store import snapshot as state_snapshot

from .ws_recording import SingleWsRecorder
from .ws_tap import ws_tap  # (ak ešte nemáš import pre TAP hook)

app = FastAPI()

# CORS middleware - allow requests from games running on different ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (localhost games)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],  # Allow all headers
)


# ---------- WebSocket manager ----------
class WSManager:
    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        # po pripojení pošli snapshot
        await ws.send_json({"kind": "snapshot", "devices": state_snapshot()})

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    async def broadcast(self, msg: dict):
         # TAP (nahrávanie 1:1 WS správ)
        await ws_tap.publish(msg)
        if not self.active:
            return

       

        data = json.dumps(msg, separators=(",", ":"))
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_manager = WSManager()
app.state.ws_manager = ws_manager
app.state.ws_recorder = SingleWsRecorder()

# ---------- Device registry (port -> SerialDeviceTask) ----------
class DeviceRegistry:
    def __init__(self) -> None:
        self._by_port: Dict[str, object] = {}

    def set(self, port: str, task: object) -> None:
        self._by_port[port] = task

    def remove(self, port: str) -> None:
        self._by_port.pop(port, None)

    def get(self, port: str) -> Optional[object]:
        return self._by_port.get(port)

    def all(self) -> List[object]:
        return list(self._by_port.values())

    def all_ports(self) -> List[str]:
        return list(self._by_port.keys())

    def get_any(self) -> Optional[object]:
        return next(iter(self._by_port.values()), None)

device_registry = DeviceRegistry()

# ---------- Static files ----------
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def index():
    # / -> static/index.html
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/health")
async def api_health():
    return {"ok": True, "devices": state_snapshot()}

# ---------- WebSocket endpoint ----------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        # drž otvorené; nič nečítame, broadcast ide zvonka (napr. z main.py)
        while True:
            await asyncio.sleep(3600)
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)

# ---------- Helpers pre API ----------

def _resolve_targets(sel: Optional[str]) -> List[object]:
    """
    sel môže byť:
      - None alebo "any" -> ľubovoľné jedno zariadenie (ak existuje)
      - "all" -> všetky zariadenia
      - konkrétny port string -> len tento port
    """
    if not sel or sel == "any":
        t = device_registry.get_any()
        return [t] if t else []
    if sel == "all":
        return device_registry.all()
    t = device_registry.get(sel)
    return [t] if t else []

def _ensure_targets_or_404(targets: List[object], what: str):
    if not targets:
        raise HTTPException(status_code=404, detail=f"No device found for selector '{what}'")

# ---------- API: haptic / calibration / reboot ----------

from fastapi import Request
from fastapi.responses import JSONResponse
import time


@app.post("/api/haptic")
async def api_haptic(payload: dict, request: Request):
    """
    JSON:
      {
        "port": "all" | "any" | "<konkrétny port>" | null,
        "finger": int,
        "pwm": int,
        "dur_ms": int   # alebo "duration_ms": int
      }
    """
    sel = payload.get("port")
    finger = int(payload.get("finger", 0))
    pwm = int(payload.get("pwm", 0))
    dur_ms = int(payload.get("dur_ms", payload.get("duration_ms", 0)))

    targets = _resolve_targets(sel)
    _ensure_targets_or_404(targets, sel or "any")

    ok = 0
    ws_mgr = getattr(request.app.state, "ws_manager", None)

    for t in targets:
        try:
            # 1) pošli do zariadenia
            await t.send_haptic(finger, pwm, dur_ms)
            ok += 1

            # 2) WS echo (len ak máme ws_manager)
            if ws_mgr is not None:
                now = time.time()
                uid = getattr(t, "uid", None)
                port = getattr(t, "port", None)
                fw   = getattr(t, "fw", None)

                msg = {
                    "kind": "haptic",
                    "port": port,
                    "uid": uid,
                    "uid_hex": (f"0x{int(uid):08X}" if isinstance(uid, int) else None),
                    "uid_dec": uid if isinstance(uid, int) else None,
                    "fw": fw,
                    "finger": [finger],          # ak chceš mená, zameň za ["thumb"] atď.
                    "pwm": pwm,
                    "duration_ms": dur_ms,
                    "sys_ts": now,
                    "sys_mono": time.monotonic(),
                }
                await ws_mgr.broadcast(msg)

        except Exception as e:
            print(f"[API haptic] error on {getattr(t, 'port', '?')}: {e}")

    return JSONResponse({"ok": True, "sent": ok, "ports": device_registry.all_ports()})


@app.post("/api/calibration")
async def api_calibration(payload: dict, request: Request):
    """
    JSON:
      {
        "port": "all" | "any" | "<konkrétny port>" | null
      }
    """
    sel = payload.get("port")
    targets = _resolve_targets(sel)
    _ensure_targets_or_404(targets, sel or "any")

    ok = 0
    ws_mgr = getattr(request.app.state, "ws_manager", None)

    for t in targets:
        try:
            await t.send_calibration()
            ok += 1

            # --- WS echo ---
            if ws_mgr is not None:
                import time
                now = time.time()
                uid = getattr(t, "uid", None)
                msg = {
                    "kind": "calibration",
                    "port": getattr(t, "port", None),
                    "uid": uid,
                    "uid_hex": f"0x{int(uid):08X}" if isinstance(uid, int) else None,
                    "uid_dec": uid if isinstance(uid, int) else None,
                    "fw": getattr(t, "fw", None),
                    "sys_ts": now,
                    "sys_mono": time.monotonic(),
                }
                await ws_mgr.broadcast(msg)

        except Exception as e:
            print(f"[API calib] error on {getattr(t, 'port', '?')}: {e}")

    return JSONResponse({"ok": True, "sent": ok})

@app.post("/api/reboot")
async def api_reboot(payload: dict, request: Request):
    """
    JSON:
      {
        "port": "all" | "any" | "<konkrétny port>" | null
      }
    """
    sel = payload.get("port")
    targets = _resolve_targets(sel)
    _ensure_targets_or_404(targets, sel or "any")

    ok = 0
    ws_mgr = getattr(request.app.state, "ws_manager", None)

    for t in targets:
        try:
            await t.send_reboot()
            ok += 1

            # --- WS echo ---
            if ws_mgr is not None:
                import time
                now = time.time()
                uid = getattr(t, "uid", None)
                msg = {
                    "kind": "reboot",
                    "port": getattr(t, "port", None),
                    "uid": uid,
                    "uid_hex": f"0x{int(uid):08X}" if isinstance(uid, int) else None,
                    "uid_dec": uid if isinstance(uid, int) else None,
                    "fw": getattr(t, "fw", None),
                    "sys_ts": now,
                    "sys_mono": time.monotonic(),
                }
                await ws_mgr.broadcast(msg)

        except Exception as e:
            print(f"[API reboot] error on {getattr(t, 'port', '?')}: {e}")

    return JSONResponse({"ok": True, "sent": ok})

@app.get("/api/devices")
async def get_devices():
    return {"devices": state_snapshot()}


# --- WS heartbeat pre rýchly check, či broadcast funguje ---
@app.on_event("startup")
async def _ws_heartbeat_start():
    # recorder (single-active)
    app.state.ws_recorder = SingleWsRecorder()

    async def _ticker():
        import time
        while True:
            try:
                await ws_manager.broadcast({"kind": "heartbeat", "t": time.time()})
            except Exception as e:
                print("[WS] heartbeat error:", e)
            await asyncio.sleep(2.0)
    asyncio.create_task(_ticker())


@app.post("/api/ws-recording/start")
async def ws_rec_start(payload: dict, request: Request):
    """
    JSON (všetko voliteľné):
      {
        "duration_s": 300,
        "compress": true,
        "notes": "experiment X"
      }
    """
    rec = getattr(request.app.state, "ws_recorder", None)
    if rec is None:
        raise HTTPException(500, "recorder_not_initialized")

    duration_s = payload.get("duration_s")
    compress = payload.get("compress")
    notes = payload.get("notes")

    try:
        res = await rec.start(duration_s=duration_s, compress=compress, notes=notes)
    except RuntimeError as e:
        if str(e) == "already_recording":
            raise HTTPException(409, "already_recording")
        raise
    return JSONResponse(res, status_code=201)


@app.post("/api/ws-recording/stop")
async def ws_rec_stop(request: Request):
    rec = getattr(request.app.state, "ws_recorder", None)
    if rec is None:
        raise HTTPException(500, "recorder_not_initialized")
    try:
        res = await rec.stop()
    except RuntimeError as e:
        if str(e) == "not_recording":
            raise HTTPException(409, "not_recording")
        raise
    return JSONResponse(res)


@app.get("/api/ws-recording")
async def ws_rec_status(request: Request):
    rec = getattr(request.app.state, "ws_recorder", None)
    if rec is None:
        raise HTTPException(500, "recorder_not_initialized")
    st = rec.state()
    if st.get("status") != "recording":
        return {"status": "idle"}
    return {
        "recording_id": st.get("recording_id"),
        "status": "recording",
        "started_at": st.get("started_at"),
        "limits": {"duration_s": st.get("duration_s"), "hard_cap_s": st.get("hard_cap_s")},
        "stats": {"samples": st.get("samples"), "bytes_written": st.get("bytes_written"), "dropped": st.get("dropped")},
        "path_current": st.get("part_path")
    }


# ---------- Virtual Mode API ----------
# Virtual mode manager will be set from main.py
virtual_manager = None

def set_virtual_manager(manager):
    """Set the virtual device manager (called from main.py)."""
    global virtual_manager
    virtual_manager = manager


@app.get("/api/virtual")
async def get_virtual_state():
    """Get current virtual mode state."""
    if virtual_manager is None:
        return {"enabled": False, "available": False}
    return {**virtual_manager.get_state(), "available": True}


@app.post("/api/virtual/enable")
async def enable_virtual_mode():
    """Enable virtual mode - starts virtual hand devices."""
    if virtual_manager is None:
        raise HTTPException(500, "virtual_manager_not_initialized")
    await virtual_manager.enable()
    return {"ok": True, "enabled": True}


@app.post("/api/virtual/disable")
async def disable_virtual_mode():
    """Disable virtual mode - stops virtual hand devices."""
    if virtual_manager is None:
        raise HTTPException(500, "virtual_manager_not_initialized")
    await virtual_manager.disable()

    # Remove virtual devices from state and notify clients
    from .state_store import remove_port
    from ..io.virtual_device import VIRTUAL_LEFT_PORT, VIRTUAL_RIGHT_PORT

    for port in [VIRTUAL_LEFT_PORT, VIRTUAL_RIGHT_PORT]:
        hand = "left" if port == VIRTUAL_LEFT_PORT else "right"
        remove_port(port)
        await ws_manager.broadcast({"kind": "device_removed", "port": port, "hand": hand})

    return {"ok": True, "enabled": False}


@app.post("/api/virtual/key")
async def virtual_key_event(payload: dict):
    """
    Handle keyboard events for virtual devices.
    JSON:
      {
        "key": "q",
        "action": "down" | "up"
      }
    """
    if virtual_manager is None:
        raise HTTPException(500, "virtual_manager_not_initialized")

    if not virtual_manager.enabled:
        raise HTTPException(400, "virtual_mode_not_enabled")

    key = payload.get("key", "").lower()
    action = payload.get("action", "").lower()

    if not key or action not in ("down", "up"):
        raise HTTPException(400, "invalid_key_or_action")

    if action == "down":
        virtual_manager.key_down(key)
    else:
        virtual_manager.key_up(key)

    return {"ok": True, "key": key, "action": action}


# ---------- Game Metadata API ----------
import os
import time as time_module

# Base directory for game metadata - each game saves to its own subfolder
GAME_METADATA_BASE_DIR = os.environ.get("GAME_METADATA_DIR", "../data")

@app.post("/api/game-metadata")
async def save_game_metadata(payload: dict):
    """
    Save game metadata/statistics to disk.
    Each game saves to its own subfolder: {base_dir}/{game_name}/

    JSON payload should contain:
      {
        "game": "flappy-hand",
        "timestamp": "2024-01-15T10:30:00Z",
        "results": { ... },
        ...
      }
    """
    # Get game name for subfolder
    game_name = payload.get("game", "unknown")

    # Create game-specific directory: e.g., ../data/flappy-hand/
    game_dir = os.path.join(GAME_METADATA_BASE_DIR, game_name)
    os.makedirs(game_dir, exist_ok=True)

    # Generate filename based on timestamp
    timestamp = payload.get("timestamp", "")
    ts_safe = timestamp.replace(":", "-").replace(".", "-") if timestamp else str(int(time_module.time() * 1000))
    filename = f"{ts_safe}.json"
    filepath = os.path.join(game_dir, filename)

    # Save to file
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        return JSONResponse({
            "ok": True,
            "path": filepath,
            "game": game_name,
            "filename": filename
        }, status_code=201)
    except Exception as e:
        raise HTTPException(500, f"Failed to save metadata: {str(e)}")
