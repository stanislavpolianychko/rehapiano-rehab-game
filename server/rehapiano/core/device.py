from dataclasses import dataclass
from typing import Optional

@dataclass
class DeviceProfile:
    uid: Optional[int] = None
    fw: Optional[int] = None
    has_imu: Optional[bool] = None
    protocol_v6: Optional[bool] = None
    # TODO: capabilities bitfield, hand L/R, atď.
