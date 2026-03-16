# """
# Framer for RehaPiano protocol (FW 2.27)

# Variants:
# - v6 stream:
#     A0 A2 | TYPE(0x01/0x81) | LEN(0x24) | PAYLOAD(36) | CHK(1B XOR of TYPE+LEN+PAYLOAD) | B0 B3

# - identifier (FW 2.27):
#     A0 A2 | TYPE(0x02) | LEN(0x05) | PAYLOAD(UID4 + FW1) | CHK(1B XOR of TYPE+LEN+PAYLOAD) | B0 B3
#     (ŽIADNY CMD v odpovedi, checksum je 1-bajtový XOR.)
# """

# from __future__ import annotations
# from dataclasses import dataclass
# from typing import List, Optional

# from ..config import START_0, START_1, END_0, END_1
# from .messages import ParsedFrame


# @dataclass
# class FramingConfig:
#     # Bezpečné defaulty
#     max_frame_len: int = 256
#     min_frame_len: int = 8


# class FrameAssembler:
#     def __init__(self, port_name: str, cfg: Optional[FramingConfig] = None):
#         self.port_name = port_name
#         self.cfg = cfg or FramingConfig()
#         self._buf = bytearray()

#     def feed(self, data: bytes, recv_ts: float) -> List[ParsedFrame]:
#         """
#         Prijme kus RX bytestreamu, vyextrahuje všetky celé rámce
#         a vráti ich ako ParsedFrame zoznam.
#         """
#         self._buf.extend(data)
#         out: List[ParsedFrame] = []

#         while True:
#             # 1) Align na START
#             start = self._find_start(self._buf)
#             if start < 0:
#                 # nič ako START v buffri – nechaj posledné min_frame_len bajtov pre istotu
#                 if len(self._buf) > self.cfg.max_frame_len:
#                     del self._buf[:-self.cfg.min_frame_len]
#                 break

#             if start > 0:
#                 del self._buf[:start]

#             # 2) Potrebujeme aspoň START + type + len
#             if len(self._buf) < 2 + 1 + 1:
#                 break

#             # type/len bez odmazania
#             type_b = self._buf[2]
#             len_b = self._buf[3]

#             # 3) Predikcia očakávanej celkovej dĺžky rámca
#             expected_total = None
#             if type_b in (0x01, 0x81) and len_b == 0x24:
#                 # v6 stream
#                 # A0A2 + type(1) + len(1) + payload(36) + chk(1) + B0B3
#                 expected_total = 2 + 1 + 1 + 36 + 1 + 2
#             elif type_b == 0x02 and len_b == 0x05:
#                 # identifier FW 2.27
#                 # A0A2 + type(1) + len(1) + payload(5) + chk(1) + B0B3
#                 expected_total = 2 + 1 + 1 + 5 + 1 + 2
#             else:
#                 # neznámy typ/dĺžka – fallback: skús nájsť END a parse (legacy/šum)
#                 end = self._find_end(self._buf, 2)
#                 if end < 0:
#                     # nemáme celé – čakáme na ďalšie byty
#                     if len(self._buf) > self.cfg.max_frame_len:
#                         # posuň sa za START, ak by to bol falošný začiatok
#                         del self._buf[:2]
#                     break
#                 frame = bytes(self._buf[:end + 2])
#                 del self._buf[:end + 2]
#                 out.append(self._safe_parse(frame, recv_ts))
#                 continue

#             # 4) Počkaj, kým je celý rámec v buffri
#             if len(self._buf) < expected_total:
#                 break

#             # 5) Skontroluj END na očakávanom mieste
#             if not (self._buf[expected_total - 2] == END_0 and self._buf[expected_total - 1] == END_1):
#                 # niečo nesedí – zahoď START a hľadaj ďalší
#                 del self._buf[:2]
#                 continue

#             # 6) Máme frame – vystrihni a parse
#             frame = bytes(self._buf[:expected_total])
#             del self._buf[:expected_total]
#             out.append(self._safe_parse(frame, recv_ts))

#         return out

#     # ---------------- internals ----------------

#     def _safe_parse(self, frame: bytes, recv_ts: float) -> ParsedFrame:
#         try:
#             return self._parse_frame(frame, recv_ts)
#         except Exception:
#             return ParsedFrame(
#                 port=self.port_name, recv_ts=recv_ts, raw=frame,
#                 variant="unknown", type=None, command=None, length=None,
#                 payload=b"", checksum=0, checksum_ok=False
#             )

#     def _parse_frame(self, frame: bytes, recv_ts: float) -> ParsedFrame:
#         # Základná validácia markerov
#         if not (
#             len(frame) >= 8 and
#             frame[0] == START_0 and frame[1] == START_1 and
#             frame[-2] == END_0 and frame[-1] == END_1
#         ):
#             return ParsedFrame(self.port_name, recv_ts, frame, "unknown", None, None, None, b"", 0, False)

#         body = frame[2:-2]  # všetko medzi START a END

#         # --- Identifier (FW 2.27)
#         #     A0 A2 | 0x02 | 0x05 | payload(5) | chk(1B XOR) | B0 B3
#         if len(body) == (1 + 1 + 5 + 1):
#             type_b = body[0]
#             length = body[1]
#             if type_b == 0x02 and length == 0x05:
#                 payload = body[2:2 + 5]
#                 chk = body[-1]
#                 calc = self._xor(bytes([type_b, length]) + payload) & 0xFF
#                 ok = (calc == chk)
#                 return ParsedFrame(
#                     port=self.port_name, recv_ts=recv_ts, raw=frame,
#                     variant="identifier", type=type_b, command=None, length=length,
#                     payload=payload, checksum=chk, checksum_ok=ok
#                 )

#         # --- v6 stream
#         #     A0 A2 | TYPE(0x01/0x81) | LEN(0x24) | payload(36) | chk(1B XOR) | B0 B3
#         if len(body) == (1 + 1 + 36 + 1):
#             type_b = body[0]
#             length = body[1]
#             payload = body[2:2 + 36]
#             chk = body[-1]
#             calc = self._xor(bytes([type_b, length]) + payload) & 0xFF
#             ok = (calc == chk) and (length == 0x24) and (type_b in (0x01, 0x81))
#             return ParsedFrame(
#                 port=self.port_name, recv_ts=recv_ts, raw=frame,
#                 variant="v6_stream", type=type_b, command=None, length=length,
#                 payload=payload, checksum=chk, checksum_ok=ok
#             )

#         # neznámy formát
#         return ParsedFrame(self.port_name, recv_ts, frame, "unknown", None, None, None, b"", 0, False)

#     @staticmethod
#     def _xor(data: bytes) -> int:
#         x = 0
#         for b in data:
#             x ^= b
#         return x

#     @staticmethod
#     def _find_start(buf: bytearray) -> int:
#         # nájdi prvé A0 A2
#         for i in range(len(buf) - 1):
#             if buf[i] == START_0 and buf[i + 1] == START_1:
#                 return i
#         return -1

#     @staticmethod
#     def _find_end(buf: bytearray, start_search_from: int = 0) -> int:
#         # nájdi prvé B0 B3 (fallback režim)
#         for i in range(start_search_from, len(buf) - 1):
#             if buf[i] == END_0 and buf[i + 1] == END_1:
#                 return i
#         return -1

"""
Framer for RehaPiano protocol (FW 2.31 only)

Stream:
    A0 A2 | TYPE(0x01/0x81) | LEN(0x39) | PAYLOAD(57) | CHK(1B XOR of TYPE+LEN+PAYLOAD) | B0 B3

Identifier:
    A0 A2 | TYPE(0x02) | LEN(0x05) | PAYLOAD(UID4 + FW1) | CHK(1B XOR TYPE+LEN+PAYLOAD) | B0 B3
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional

from ..config import START_0, START_1, END_0, END_1
from .messages import ParsedFrame


@dataclass
class FramingConfig:
    max_frame_len: int = 256
    min_frame_len: int = 8


class FrameAssembler:
    def __init__(self, port_name: str, cfg: Optional[FramingConfig] = None):
        self.port_name = port_name
        self.cfg = cfg or FramingConfig()
        self._buf = bytearray()
    
    def buffer_size(self) -> int:
        return len(self._buf)

    def feed(self, data: bytes, recv_ts: float) -> List[ParsedFrame]:
        self._buf.extend(data)
        out: List[ParsedFrame] = []

        while True:
            start = self._find_start(self._buf)
            if start < 0:
                if len(self._buf) > self.cfg.max_frame_len:
                    del self._buf[:-self.cfg.min_frame_len]
                break
            if start > 0:
                del self._buf[:start]

            if len(self._buf) < 4:
                break

            type_b = self._buf[2]
            len_b = self._buf[3]
            expected_total = None

            # FW 2.31 stream len=0x39
            if type_b in (0x01, 0x81) and len_b == 0x39:
                expected_total = 2 + 1 + 1 + 0x39 + 1 + 2
            # identifier len=0x05
            elif type_b == 0x02 and len_b == 0x05:
                expected_total = 2 + 1 + 1 + 0x05 + 1 + 2
            else:
                # fallback: skús nájsť END a vyseknúť čokoľvek (napr. šum)
                end = self._find_end(self._buf, 2)
                if end < 0:
                    if len(self._buf) > self.cfg.max_frame_len:
                        del self._buf[:2]
                    break
                frame = bytes(self._buf[:end + 2])
                del self._buf[:end + 2]
                out.append(self._safe_parse(frame, recv_ts))
                continue

            if len(self._buf) < expected_total:
                break

            if not (self._buf[expected_total - 2] == END_0 and self._buf[expected_total - 1] == END_1):
                # nie je to validný rámec – zahoď START a hľadaj ďalší
                del self._buf[:2]
                continue

            frame = bytes(self._buf[:expected_total])
            del self._buf[:expected_total]
            out.append(self._safe_parse(frame, recv_ts))

        return out

    # ---------------- internals ----------------

    def _safe_parse(self, frame: bytes, recv_ts: float) -> ParsedFrame:
        try:
            return self._parse_frame(frame, recv_ts)
        except Exception:
            return ParsedFrame(
                port=self.port_name, recv_ts=recv_ts, raw=frame,
                variant="unknown", type=None, command=None, length=None,
                payload=b"", checksum=0, checksum_ok=False
            )

    def _parse_frame(self, frame: bytes, recv_ts: float) -> ParsedFrame:
        if not (
            len(frame) >= 8 and
            frame[0] == START_0 and frame[1] == START_1 and
            frame[-2] == END_0 and frame[-1] == END_1
        ):
            return ParsedFrame(self.port_name, recv_ts, frame, "unknown", None, None, None, b"", 0, False)

        body = frame[2:-2]

        # identifier (0x02/0x05)
        if len(body) == (1 + 1 + 5 + 1) and body[0] == 0x02 and body[1] == 0x05:
            type_b = body[0]
            length = body[1]
            payload = body[2:2 + 5]
            chk = body[-1]
            calc = self._xor(bytes([type_b, length]) + payload) & 0xFF
            ok = (calc == chk)
            return ParsedFrame(
                port=self.port_name, recv_ts=recv_ts, raw=frame,
                variant="identifier", type=type_b, command=None, length=length,
                payload=payload, checksum=chk, checksum_ok=ok
            )

        # FW 2.31 stream (len=0x39)
        if len(body) == (1 + 1 + 0x39 + 1) and body[0] in (0x01, 0x81) and body[1] == 0x39:
            type_b = body[0]
            length = 0x39
            payload = body[2:2 + 0x39]
            chk = body[-1]
            calc = self._xor(bytes([type_b, length]) + payload) & 0xFF
            ok = (calc == chk)
            return ParsedFrame(
                port=self.port_name, recv_ts=recv_ts, raw=frame,
                variant="v6_stream_57", type=type_b, command=None, length=length,
                payload=payload, checksum=chk, checksum_ok=ok
            )

        return ParsedFrame(self.port_name, recv_ts, frame, "unknown", None, None, None, b"", 0, False)

    @staticmethod
    def _xor(data: bytes) -> int:
        x = 0
        for b in data:
            x ^= b
        return x

    @staticmethod
    def _find_start(buf: bytearray) -> int:
        for i in range(len(buf) - 1):
            if buf[i] == START_0 and buf[i + 1] == START_1:
                return i
        return -1

    @staticmethod
    def _find_end(buf: bytearray, start_search_from: int = 0) -> int:
        for i in range(start_search_from, len(buf) - 1):
            if buf[i] == END_0 and buf[i + 1] == END_1:
                return i
        return -1
