from dataclasses import dataclass
from typing import Optional, Dict, List


@dataclass
class RawFrame:
    data: bytes
    checksum_ok: Optional[bool]
    port: str
    recv_ts: float


@dataclass
class StreamSample:
    uid: Optional[int]
    fw: Optional[int]
    left_right: Optional[int]             # 0x01 = left, 0x81 = right
    ch_raw: List[int]                     # 6x int32 (24-bit signed); index 0 = dummy CH0
    imu_raw: Dict[str, Optional[int]]     # IMU: acc/euler/mag + optional gyro/gravity/quat/temp
    recv_ts: float
    port: str


@dataclass
class ParsedFrame:
    port: str
    recv_ts: float
    raw: bytes                # full frame including markers
    variant: str              # 'v6_stream_36' | 'v6_stream_57' | 'identifier' | 'unknown'
    type: Optional[int]       # 0x01/0x81 for stream, 0x02 for identifier
    command: Optional[int]    # for identifier (CMD=0x01), otherwise None
    length: Optional[int]     # payload length (without checksum)
    payload: bytes
    checksum: int             # 1-byte XOR value
    checksum_ok: bool
