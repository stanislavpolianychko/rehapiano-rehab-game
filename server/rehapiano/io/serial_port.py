"""
Async serial task (FW 2.31 only): reads 57B frames and pushes samples.
+ Payload guard: kontrola, že každý stream rámec má presne 57 B (LEN=0x39).
+ Telemetria: RX bitrate, backlog, frames OK/BAD, payload_ok/bad/unknown.
"""
import asyncio
import time
import serial_asyncio
import serial
from typing import Optional, Callable, Awaitable, Literal
from dataclasses import dataclass

from ..config import DEFAULT_BAUDRATE, READ_CHUNK, START_0, START_1, END_0, END_1
from ..protocol.framing import FrameAssembler
from ..protocol.decoder import parse_stream_payload, parse_identifier_payload
from ..core.payload_normalizer import PayloadNormalizer

@dataclass
class StreamStats:
    # totals
    bytes_total: int = 0
    chunks_total: int = 0
    frames_total: int = 0
    frames_bad_total: int = 0
    payload_ok_total: int = 0
    payload_bad_total: int = 0
    unknown_total: int = 0
    # window (periodic report)
    bytes_win: int = 0
    chunks_win: int = 0
    frames_win: int = 0
    frames_bad_win: int = 0
    payload_ok_win: int = 0
    payload_bad_win: int = 0
    unknown_win: int = 0
    last_report_ts: float = 0.0


class SerialDeviceTask:
    def __init__(self, port: str, baudrate: int = DEFAULT_BAUDRATE,
                 on_sample: Optional[Callable[[dict], Awaitable[None]]] = None,
                 on_identifier: Optional[Callable[[int,int], Awaitable[None]]] = None,
                 log_path: Optional[str] = None,                 # CSV log (voliteľné)
                 report_interval: float = 2.0,                   # perioda sumarizačného reportu
                 verbose_chunk: bool = False,                    # detail pre každý RX chunk
                 strict_len_mode: Literal["warn"] = "warn"):                       # ak True, neštandardné streamy dropni
        self.port = port
        self.baudrate = baudrate
        self.reader = None
        self.writer = None
        self.assembler = FrameAssembler(port)
        self.on_sample = on_sample
        self.on_identifier = on_identifier

        self._stats = StreamStats()
        self._report_interval = report_interval
        self._verbose_chunk = verbose_chunk
        self._log_path = log_path
        self._log_fh = None
        # self._strict_len = strict_len  # len stream frames (0x39) prejdú do on_sample
        self._strict_len_mode = strict_len_mode
        self.normalizer = PayloadNormalizer()  # config/normalization.yaml default

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
        if self._log_path:
            try:
                self._log_fh = open(self._log_path, "a", buffering=1)
                self._log_fh.write(
                    f"{now:.6f},{len(data)},{len(frames)},{bad},{buf_after},{parse_ms:.3f},"
                    f"{st.bytes_win},{st.frames_win},{st.payload_ok_win},{st.payload_bad_win},{st.unknown_win}\n"
                )
            except Exception as e:
                print(f"[{self.port}] WARN: cannot open log file '{self._log_path}': {e}")
                self._log_fh = None

        await asyncio.sleep(0.15)
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
        if self._log_fh:
            try:
                self._log_fh.close()
            except Exception:
                pass
            self._log_fh = None

    async def _reader_loop(self):
        while self.reader is not None:
            try:
                data = await asyncio.wait_for(self.reader.read(READ_CHUNK), timeout=1.0)
            except asyncio.TimeoutError:
                self._maybe_report()
                continue

            if not data:
                await asyncio.sleep(0.001)
                self._maybe_report()
                continue

            now = time.time()
            t0 = time.perf_counter()
            frames = self.assembler.feed(data, now)
            parse_ms = (time.perf_counter() - t0) * 1000.0

            bad = sum(1 for f in frames if not f.checksum_ok)
            ok = len(frames) - bad

            # štatistiky
            st = self._stats
            st.bytes_total += len(data); st.bytes_win += len(data)
            st.chunks_total += 1;        st.chunks_win += 1
            st.frames_total += len(frames); st.frames_win += len(frames)
            st.frames_bad_total += bad;     st.frames_bad_win += bad

            buf_after = self.assembler.buffer_size()

            # per-chunk verbose
            if self._verbose_chunk:
                print(
                    f"[{self.port}] RX chunk={len(data)}B  frames={len(frames)} "
                    f"(ok={ok},bad={bad})  buf={buf_after}B  parse={parse_ms:.2f}ms"
                )

            # spracovanie rámcov + payload guard
            for f in frames:
                # nevalidný checksum -> počítaj ako bad a pokračuj
                if not f.checksum_ok:
                    continue

                if f.variant == "identifier" and f.length == 0x05:
                    try:
                        uid, fw = parse_identifier_payload(f.payload)
                    except Exception as e:
                        print(f"[{self.port}] IDENT parse error: {e}")
                    else:
                        if self.on_identifier:
                            await self.on_identifier(uid, fw)
                    continue

                if (f.type in (0x01, 0x81)):
                    good = (f.length == 0x39) and (len(f.payload) == 57) and (f.variant == "v6_stream_57")
                    if good:
                        self._stats.payload_ok_total += 1
                        self._stats.payload_ok_win += 1
                        # parse & push
                        parsed = parse_stream_payload(f.payload)
                        # >>> NORMALIZÁCIA TU <<<
                        parsed_norm = self.normalizer.normalize_payload(parsed)
                        if self.on_sample:
                            await self.on_sample({
                                "port": self.port,
                                "ts": f.recv_ts,
                                **parsed_norm,
                                "type": f.type
                            })
                    else:
                        self._stats.payload_bad_total += 1
                        self._stats.payload_bad_win += 1
                        # LOG – žiadne výnimky, žiadne tiché zmiznutie
                        print(
                            f"[{self.port}] ERROR payload_len_guard "
                            f"type=0x{(f.type or 0):02X} len_field={f.length} real_len={len(f.payload)} "
                            f"variant={f.variant} chk_ok={f.checksum_ok}"
                        )
                    continue

            # CSV log (1 riadok / chunk)
            if self._log_fh:
                try:
                    self._log_fh.write(
                        f"{now:.6f},{len(data)},{len(frames)},{bad},{buf_after},{parse_ms:.3f},"
                        f"{st.bytes_win},{st.frames_win},{st.payload_ok_win},{st.payload_bad_win},{st.unknown_win}\n"
                    )
                except Exception as e:
                    print(f"[{self.port}] WARN: CSV write failed: {e}")

            self._maybe_report()

    # --------- telemetry helpers ----------
    def _maybe_report(self):
        now = time.time()
        st = self._stats
        if st.last_report_ts == 0.0:
            st.last_report_ts = now
            return
        dt = now - st.last_report_ts
        if dt < self._report_interval:
            return

        kbps = (st.bytes_win / dt) / 1024.0
        avg_chunk = (st.bytes_win / max(1, st.chunks_win))
        print(
            f"[{self.port}] RX {kbps:6.1f} kB/s | chunks={st.chunks_win} "
            f"| frames ok/bad={st.frames_win - st.frames_bad_win}/{st.frames_bad_win} "
            f"| payload ok/bad={st.payload_ok_win}/{st.payload_bad_win} "
            f"| unknown={st.unknown_win} | avg_chunk={avg_chunk:.1f}B "
            f"| buf={self.assembler.buffer_size()}B"
        )
        # reset okna
        st.bytes_win = st.chunks_win = st.frames_win = st.frames_bad_win = 0
        st.payload_ok_win = st.payload_bad_win = st.unknown_win = 0
        st.last_report_ts = now

    # -------- host commands ----------
    def _xor(self, data: bytes) -> int:
        x = 0
        for b in data:
            x ^= b
        return x & 0xFF

    def _wrap(self, body: bytes) -> bytes:
        return bytes([START_0, START_1]) + body + bytes([END_0, END_1])

    def build_request_identifier(self) -> bytes:
        TYPE = 0x03
        CMD  = 0x01
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    def build_motor_activation(self, finger: int, pwm: int, duration_ms: int) -> bytes:
        TYPE = 0x03
        CMD  = 0x02
        durH = (duration_ms >> 8) & 0xFF
        durL = duration_ms & 0xFF
        payload = bytes([0x04, finger & 0xFF, pwm & 0xFF, durH, durL])
        chk = self._xor(bytes([TYPE, CMD]) + payload)
        return self._wrap(bytes([TYPE, CMD]) + payload + bytes([chk]))

    def build_calibration(self) -> bytes:
        TYPE = 0x03
        CMD  = 0x03
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    def build_reboot(self) -> bytes:
        TYPE = 0x03
        CMD  = 0x04
        chk = self._xor(bytes([TYPE, CMD]))
        return self._wrap(bytes([TYPE, CMD, chk]))

    async def send_bytes(self, data: bytes):
        if not self.writer:
            raise RuntimeError("Serial not open")
        self.writer.write(data)
        await self.writer.drain()

    async def send_identifier_request(self):
        await self.send_bytes(self.build_request_identifier())

    async def send_haptic(self, finger: int, pwm: int, duration_ms: int):
        await self.send_bytes(self.build_motor_activation(finger, pwm, duration_ms))

    async def send_calibration(self):
        await self.send_bytes(self.build_calibration())

    async def send_reboot(self):
        await self.send_bytes(self.build_reboot())