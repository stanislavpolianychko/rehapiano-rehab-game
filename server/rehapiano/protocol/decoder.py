# from __future__ import annotations
# from typing import List, Dict

# def _int24_from_3(b0: int, b1: int, b2: int) -> int:
#     v = (b0 << 16) | (b1 << 8) | b2
#     if v & 0x00800000:
#         v |= 0xFF000000
#     # convert to signed 32
#     if v & 0x80000000:
#         v = v - (1 << 32)
#     return v

# def parse_adc_v6_payload(payload36: bytes) -> Dict:
#     """
#     v6 stream payload (36 B): 18B ADC + 18B IMU
#     ADC order: ch1..ch5 + dummy ch0 (zeros) -> we normalize to list [0, ch1..ch5]
#     IMU order: linAccX,Y,Z, pitch, roll, yaw, magX,Y,Z (each int16, big-endian)
#     """
#     if len(payload36) != 36:
#         raise ValueError(f"v6 payload must be 36 bytes, got {len(payload36)}")
#     adc_raw = payload36[:18]
#     imu_raw = payload36[18:]

#     # 6 triplets of 3 bytes (MSB..LSB)
#     triplets = [adc_raw[i:i+3] for i in range(0, 18, 3)]
#     # First 5 are ch1..ch5, last is dummy ch0 == 0
#     ch1_to_5 = [_int24_from_3(t[0], t[1], t[2]) for t in triplets[:5]]
#     # Build normalized list [dummy0, ch1..ch5]
#     adc_vals = [0] + ch1_to_5

#     def s16(h: int, l: int) -> int:
#         v = (h << 8) | l
#         if v & 0x8000:
#             v -= 0x10000
#         return v

#     words = [s16(imu_raw[i], imu_raw[i+1]) for i in range(0, 18, 2)]
#     imu = {
#         "linAccX": words[0],
#         "linAccY": words[1],
#         "linAccZ": words[2],
#         "pitch":   words[3],
#         "roll":    words[4],
#         "yaw":     words[5],
#         "magX":    words[6],
#         "magY":    words[7],
#         "magZ":    words[8],
#     }
#     return {"adc": adc_vals, "imu": imu}

# def parse_identifier_payload(payload: bytes) -> tuple[int, int]:
#     """
#     Vráti (uid, fw).
#     Nové FW (2.27): payload má 5B: [HH HL LH LL FW]
#     Staršie experimenty: mohlo byť 7B (napr. s echo cmd) – tolerujeme.
#     """
#     n = len(payload)
#     if n == 5:
#         HH, HL, LH, LL, fw = payload
#         uid = ((HH << 24) | (HL << 16) | (LH << 8) | LL) & 0xFFFFFFFF
#         return uid, fw

#     if n == 7:
#         # tolerantný režim: skús nájsť 4 po sebe idúce byty pre UID a posledný nech je FW
#         # najčastejšie bolo payload[0]==0x01 (cmd echo), potom UID[1..4], FW[5] + 1 byte extra.
#         # Bez špecifikácie radšej sprav konzervatívne:
#         # - ak payload[0] vyzerá ako CMD (0x01), ber UID z 1..4 a FW z 5
#         if payload[0] == 0x01:
#             HH, HL, LH, LL, fw = payload[1], payload[2], payload[3], payload[4], payload[5]
#             uid = ((HH << 24) | (HL << 16) | (LH << 8) | LL) & 0xFFFFFFFF
#             return uid, fw
#         # fallback: vezmi stred – 4 byty pred koncom a predposledný ako FW
#         HH, HL, LH, LL, fw = payload[2], payload[3], payload[4], payload[5], payload[6]
#         uid = ((HH << 24) | (HL << 16) | (LH << 8) | LL) & 0xFFFFFFFF
#         return uid, fw

#     raise ValueError(f"Identifier payload length unexpected: {n} bytes")


from __future__ import annotations
from typing import Dict

def _int24_from_3(b0: int, b1: int, b2: int) -> int:
    v = (b0 << 16) | (b1 << 8) | b2
    if v & 0x00800000:
        v |= 0xFF000000
    if v & 0x80000000:
        v = v - (1 << 32)
    return v

def _s16(h: int, l: int) -> int:
    v = (h << 8) | l
    if v & 0x8000:
        v -= 0x10000
    return v

def parse_stream_payload(payload: bytes) -> Dict:
    """
    FW 2.31 stream payload (57 B):
      ADC(18) + linAcc(6) + euler(6) + gyro(6) + gravity(6) + mag(6) + quat(8) + temp(1)
    Výstup:
      {"adc":[0,ch1..ch5], "imu":{linAccX.., pitch.., gyroX.., gravX.., magX.., quatW.., temp}}
    """
    if len(payload) != 57:
        raise ValueError(f"FW2.31 payload must be 57 bytes, got {len(payload)}")

    adc_raw = payload[:18]
    rest = payload[18:]

    triplets = [adc_raw[i:i + 3] for i in range(0, 18, 3)]
    ch1_to_5 = [_int24_from_3(t[0], t[1], t[2]) for t in triplets[:5]]
    adc_vals = [0] + ch1_to_5  # CH0 dummy na indexe 0 (zachovaj kompatibilitu)

    idx = 0
    def take2():
        nonlocal idx
        h, l = rest[idx], rest[idx + 1]
        idx += 2
        return _s16(h, l)

    linAccX, linAccY, linAccZ = take2(), take2(), take2()
    pitch,   roll,    yaw     = take2(), take2(), take2()
    gyroX,   gyroY,   gyroZ   = take2(), take2(), take2()
    gravX,   gravY,   gravZ   = take2(), take2(), take2()
    magX,    magY,    magZ    = take2(), take2(), take2()
    quatW,   quatX,   quatY,  quatZ = take2(), take2(), take2(), take2()
    temp = rest[idx]

    imu = {
        "linAccX": linAccX, "linAccY": linAccY, "linAccZ": linAccZ,
        "pitch": pitch, "roll": roll, "yaw": yaw,
        "gyroX": gyroX, "gyroY": gyroY, "gyroZ": gyroZ,
        "gravX": gravX, "gravY": gravY, "gravZ": gravZ,
        "magX": magX, "magY": magY, "magZ": magZ,
        "quatW": quatW, "quatX": quatX, "quatY": quatY, "quatZ": quatZ,
        "temp": temp
    }
    return {"adc": adc_vals, "imu": imu}

def parse_identifier_payload(payload: bytes) -> tuple[int, int]:
    """
    Returns (uid, fw) — FW 2.31 keeps 0x02/0x05 format.
    """
    if len(payload) != 5:
        raise ValueError(f"Identifier payload length unexpected: {len(payload)} bytes")
    HH, HL, LH, LL, fw = payload
    uid = ((HH << 24) | (HL << 16) | (LH << 8) | LL) & 0xFFFFFFFF
    return uid, fw
