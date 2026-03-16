# from __future__ import annotations
# import asyncio
# from dataclasses import dataclass
# from typing import Optional, Dict, List, Callable, Awaitable, Tuple
# import time
# import glob

# from .serial_port import SerialDeviceTask
# from ..protocol.messages import ParsedFrame

# # Kandidáti na macOS: /dev/tty.usb*
# MAC_PATTERNS = ["/dev/tty.usb*", "/dev/tty.SLAB*", "/dev/tty.usbserial*"]

# def list_candidate_ports() -> List[str]:
#     ports: List[str] = []
#     for pat in MAC_PATTERNS:
#         ports.extend(glob.glob(pat))
#     # dedupe + pekné zoradenie
#     return sorted(set(ports))

# @dataclass
# class RegisteredDevice:
#     port: str
#     uid: Optional[int]     # niekedy môžeme mať port bez UID, kým nepríde
#     fw: Optional[int]
#     task: SerialDeviceTask

# class DeviceManager:
#     def __init__(self, baudrate: int, max_devices: int = 2):
#         self.baudrate = baudrate
#         self.max_devices = max_devices
#         self.devices: Dict[str, RegisteredDevice] = {}  # key = port
#         self.frame_queue: "asyncio.Queue[ParsedFrame]" = asyncio.Queue()

#     async def _on_frames(self, frames: List[ParsedFrame]) -> None:
#         # pushni všetky rozparsované rámce do centrálnej fronty
#         for f in frames:
#             await self.frame_queue.put(f)

#     async def probe_and_attach(self, port: str, identify_timeout: float = 1.5) -> Optional[RegisteredDevice]:
#         if len(self.devices) >= self.max_devices:
#             return None
#         if port in self.devices:
#             return self.devices[port]

#         task = SerialDeviceTask(
#             port=port,
#             baudrate=self.baudrate,
#             identify_on_start=False,   # manuálne pošleme request
#             buzz_on_start=None,
#             on_frames=self._on_frames, # pripoj callback na odovzdávanie rámcov
#         )
#         # spusti reader
#         asyncio.create_task(task.run())
#         await asyncio.sleep(0.15)

#         # pošli identifier a počkaj
#         try:
#             uid_fw: Optional[Tuple[int,int]] = await task.request_identifier(timeout=identify_timeout, send=True)
#         except Exception:
#             uid_fw = None

#         uid, fw = (uid_fw if uid_fw else (None, None))
#         reg = RegisteredDevice(port=port, uid=uid, fw=fw, task=task)
#         self.devices[port] = reg
#         return reg

#     async def autodiscover(self) -> List[RegisteredDevice]:
#         regs: List[RegisteredDevice] = []
#         for port in list_candidate_ports():
#             if len(self.devices) >= self.max_devices:
#                 break
#             reg = await self.probe_and_attach(port)
#             if reg:
#                 regs.append(reg)
#         return regs

"""
Async serial task reading frames and sending host commands.
"""
import asyncio
import time
import serial_asyncio
import serial

from typing import Optional, Callable, Awaitable

from ..config import DEFAULT_BAUDRATE, READ_CHUNK, START_0, START_1, END_0, END_1
from ..protocol.framing import FrameAssembler
from ..protocol.decoder import parse_stream_payload, parse_identifier_payload


class SerialDeviceTask:
    def __init__(self, port: str, baudrate: int = DEFAULT_BAUDRATE,
                 on_sample: Optional[Callable[[dict], Awaitable[None]]] = None,
                 on_identifier: Optional[Callable[[int, int], Awaitable[None]]] = None):
        self.port = port
        self.baudrate = baudrate
        self.transport = None
        self.reader = None
        self.writer = None
        self.assembler = FrameAssembler(port)
        self.on_sample = on_sample
        self.on_identifier = on_identifier
        self._running = False

    async def open(self):
        self.reader, self.writer = await serial_asyncio.open_serial_connection(
            url=self.port,
            baudrate=self.baudrate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            xonxoff=False,
            rtscts=False,
            dsrdtr=False,
        )
        # krátka pauza po otvorení portu
        await asyncio.sleep(0.25)
        self._running = True
        asyncio.create_task(self._reader_loop())

    async def close(self):
        if self.writer:
            self.writer.close()
            try:
                await self.writer.wait_closed()
            except Exception:
                pass
            self.writer = None
        self.reader = None
        self._running = False

    async def _reader_loop(self):
        while self.reader is not None:
            try:
                data = await asyncio.wait_for(self.reader.read(READ_CHUNK), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            if not data:
                await asyncio.sleep(0.001)
                continue

            # --- SNIFFER: možná IDENT odpoveď v surovom byte streame ---
            sig = b"\xA0\xA2\x02"  # Start + TYPE=0x02 (identifier)
            idx = 0
            while True:
                j = data.find(sig, idx)
                if j == -1:
                    break
                preview = data[j:j + 24]
                print(f"[{self.port}] RX-SNIFF IDENT: " + " ".join(f"{b:02X}" for b in preview))
                idx = j + 1

            # --- Parse cez assembler ---
            now = time.time()
            frames = self.assembler.feed(data, now)

            for f in frames:
                if not f.checksum_ok:
                    # zle CRC – preskoč
                    continue

                # IDENTIFIER (bežne LEN=5; historicky sa vyskytlo aj 7)
                if f.variant == "identifier" and f.length in (5, 7):
                    try:
                        uid, fw = parse_identifier_payload(f.payload)
                    except Exception as e:
                        print(
                            f"[{self.port}] IDENTIFIER parse error: {e} payload="
                            + " ".join(f"{b:02X}" for b in f.payload)
                        )
                    else:
                        if self.on_identifier:
                            await self.on_identifier(uid, fw)
                        else:
                            print(f"[{self.port}] IDENTIFIER uid=0x{uid:08X} ({uid}) fw={fw}")

                # STREAM (v6) – FW 2.27..2.31 (36 B aj 57 B)
                elif (f.type in (0x01, 0x81)) and (f.length in (0x24, 0x39)):
                    parsed = parse_stream_payload(f.payload)  # jednotný parser pre 36/57 B
                    if self.on_sample:
                        await self.on_sample({
                            "port": self.port,
                            "ts": f.recv_ts,
                            **parsed,
                            "type": f.type,  # 0x01 = left, 0x81 = right
                        })
                    # else: ticho

                # iné rámce – ignoruj (alebo si odkomentuj log nižšie)
                # else:
                #     body_preview = " ".join(f"{b:02X}" for b in f.payload[:16])
                #     print(f"[{self.port}] FRAME unknown variant={f.variant} "
                #           f"type={f.type} len={f.length} body[:16]={body_preview}")

    # -------- host commands ----------
    def _xor(self, data: bytes) -> int:
        x = 0
        for b in data:
            x ^= b
        return x & 0xFF

    def _wrap(self, body: bytes) -> bytes:
        return bytes([START_0, START_1]) + body + bytes([END_0, END_1])

    def build_request_identifier(self) -> bytes:
        # Host->Device command (bez LEN):
        # A0 A2 TYPE(0x03) CMD(0x01) CHK XOR(TYPE+CMD) B0 B3
        TYPE = 0x03
        CMD = 0x01
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    def build_motor_activation(self, finger: int, pwm: int, duration_ms: int) -> bytes:
        # A0 A2 03 02 04 finger pwm durH durL chk B0 B3
        TYPE = 0x03
        CMD = 0x02
        durH = (duration_ms >> 8) & 0xFF
        durL = duration_ms & 0xFF
        payload = bytes([0x04, finger & 0xFF, pwm & 0xFF, durH, durL])
        chk = self._xor(bytes([TYPE, CMD]) + payload)
        return self._wrap(bytes([TYPE, CMD]) + payload + bytes([chk]))

    def build_calibration(self) -> bytes:
        # A0 A2 03 03 chk B0 B3
        TYPE = 0x03
        CMD = 0x03
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    def build_reboot(self) -> bytes:
        # A0 A2 03 04 chk B0 B3
        TYPE = 0x03
        CMD = 0x04
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    async def send_bytes(self, data: bytes):
        if not self.writer:
            raise RuntimeError("Serial not open")
        # TX debug
        tx = " ".join(f"{b:02X}" for b in data)
        print(f"[{self.port}] TX {len(data)}B: {tx}")
        self.writer.write(data)
        await self.writer.drain()

    async def send_identifier_request(self):
        for _ in range(1):
            await self.send_bytes(self.build_request_identifier())
            await asyncio.sleep(0.02)

    async def send_haptic(self, finger: int, pwm: int, duration_ms: int):
        await self.send_bytes(self.build_motor_activation(finger, pwm, duration_ms))

    async def send_calibration(self):
        await self.send_bytes(self.build_calibration())

    async def send_reboot(self):
        await self.send_bytes(self.build_reboot())
