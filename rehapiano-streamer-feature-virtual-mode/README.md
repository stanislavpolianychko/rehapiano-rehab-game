# RehaPiano Streamer (FW 2.31)

A lean Python streamer for RehaPiano devices running firmware **2.31**.

It provides:

- USB serial **auto-discovery**
- Streaming decoder for **FW 2.31 only** (single, modern format)
- **WebSocket** broadcast (`/ws`) for the front-end
- Simple **HTTP API** (calibration, reboot, haptics)
- Static front-end (live charts + motor controls)

> ℹ️ Older frame variants (e.g., 2.27) are intentionally **not** supported.  
> The stream payload length is **57 bytes** (`LEN = 0x39`) and includes extended IMU fields.

---

## Table of contents

- [Quick start](#quick-start)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running](#running)
- [Frontend (UI)](#frontend-ui)
- [Virtual Mode](#virtual-mode)
- [WebSocket protocol](#websocket-protocol)
- [HTTP API](#http-api)
- [Logging & diagnostics](#logging--diagnostics)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Plans](#plans-docker)
- [License](#license)

---
## RehaPiano device hardware description
### Payload structure and normalization

| # | Bytes (index) | Field name | Description | Normalization (÷) | Unit | Typical range | Notes |
|:-:|:---------------|:------------|:-------------|:------------------|:------|:---------------|:-------|
| 1 | 0–2 | `adc[0]` | ADC channel 0 – Thumb tensometer | 128 | relative unit | −250 … +250 | External analog strain sensor |
| 2 | 3–5 | `adc[1]` | ADC channel 1 – Index tensometer | 128 | relative unit | −250 … +250 |  |
| 3 | 6–8 | `adc[2]` | ADC channel 2 – Middle tensometer | 128 | relative unit | −250 … +250 |  |
| 4 | 9–11 | `adc[3]` | ADC channel 3 – Ring tensometer | 128 | relative unit | −250 … +250 |  |
| 5 | 12–14 | `adc[4]` | ADC channel 4 – Little tensometer | 128 | relative unit | −250 … +250 |  |
| 6 | 15–17 | `adc[5]` | ADC channel 5 – Reserved / unused | 128 | — | 0 | Always 0 |
| 7 | 18–19 | `imu.linAccX` | Linear acceleration X-axis | 100 | m/s² | −19.6 … +19.6 | Gravity-compensated dynamic acceleration |
| 8 | 20–21 | `imu.linAccY` | Linear acceleration Y-axis | 100 | m/s² | −19.6 … +19.6 |  |
| 9 | 22–23 | `imu.linAccZ` | Linear acceleration Z-axis | 100 | m/s² | −19.6 … +19.6 |  |
| 10 | 24–25 | `imu.pitch` | Euler pitch angle | 16 | ° | −180 … +180 | Rotation around X-axis |
| 11 | 26–27 | `imu.roll` | Euler roll angle | 16 | ° | −90 … +90 | Rotation around Y-axis |
| 12 | 28–29 | `imu.yaw` | Euler yaw / heading | 16 | ° | 0 … 360 | Rotation around Z-axis |
| 13 | 30–31 | `imu.gyroX` | Angular velocity around X-axis | 16 | °/s | ±2000 | Gyroscope rate output |
| 14 | 32–33 | `imu.gyroY` | Angular velocity around Y-axis | 16 | °/s | ±2000 |  |
| 15 | 34–35 | `imu.gyroZ` | Angular velocity around Z-axis | 16 | °/s | ±2000 |  |
| 16 | 36–37 | `imu.gravX` | Gravity vector X-axis | 100 | m/s² | −9.81 … +9.81 | Static gravity direction vector |
| 17 | 38–39 | `imu.gravY` | Gravity vector Y-axis | 100 | m/s² | −9.81 … +9.81 |  |
| 18 | 40–41 | `imu.gravZ` | Gravity vector Z-axis | 100 | m/s² | −9.81 … +9.81 |  |
| 19 | 42–43 | `imu.magX` | Magnetic field X-axis | 16 | µT | −1300 … +1300 | 1 µT = 16 LSB |
| 20 | 44–45 | `imu.magY` | Magnetic field Y-axis | 16 | µT | −1300 … +1300 |  |
| 21 | 46–47 | `imu.magZ` | Magnetic field Z-axis | 16 | µT | −2500 … +2500 |  |
| 22 | 48–49 | `imu.quatW` | Quaternion W (real) | 16384 | — | −1.0 … +1.0 | Normalized rotation component |
| 23 | 50–51 | `imu.quatX` | Quaternion X (imag.) | 16384 | — | −1.0 … +1.0 |  |
| 24 | 52–53 | `imu.quatY` | Quaternion Y (imag.) | 16384 | — | −1.0 … +1.0 |  |
| 25 | 54–55 | `imu.quatZ` | Quaternion Z (imag.) | 16384 | — | −1.0 … +1.0 |  |
| 26 | 56–57 | `imu.temp` | IMU internal temperature | 1 | °C | 20 … 50 | Internal die temperature |

---

### ⚙️ Summary of normalization (from Bosch BNO055 datasheet)

| Quantity | 1 Unit (LSB) | Normalization divisor | Unit | Source |
|-----------|---------------|-----------------------|-------|---------|
| Linear acceleration | 1 m/s² = 100 LSB | ÷ 100 | m/s² | Table 3-33 |
| Gravity vector | 1 m/s² = 100 LSB | ÷ 100 | m/s² | Table 3-37 |
| Gyroscope | 1 °/s = 16 LSB | ÷ 16 | °/s | Table 3-22 |
| Euler angles | 1 ° = 16 LSB | ÷ 16 | ° | Table 3-29 |
| Magnetometer | 1 µT = 16 LSB | ÷ 16 | µT | Table 3-19 |
| Quaternion | 1 = 2¹⁴ LSB | ÷ 16384 | — | Table 3-31 |
| Temperature | 1 °C = 1 LSB | ÷ 1 | °C | Table 3-39 |
| ADC | custom scaling | ÷ 128 | relative | external tensometer circuit |

---

### 🧭 Axis orientation (right-handed coordinate system)

| Axis | Direction | Typical meaning |
|-------|------------|----------------|
| X | Forward | pointing away from connector |
| Y | Right | pointing to the right of the device |
| Z | Up | orthogonal upward |

> - **Pitch (X-axis):** forward/backward tilt  
> - **Roll (Y-axis):** side tilt  
> - **Yaw (Z-axis):** compass heading  
> - **Gravity vector:** static orientation reference (~9.81 m/s²)  
> - **Linear acceleration:** dynamic movement (gravity removed)  
> - **Quaternion:** precise 3D rotation (normalized)  

---

✅ *All normalization rules are applied automatically in*  
`rehapiano/core/payload_normalizer.py` *based on values defined in* `config/normalization.yaml`.
## Quick start

1) Create & activate a virtualenv (Python 3.11+):

```bash
python -m venv .venv
source .venv/bin/activate      # PowerShell: .venv\Scripts\Activate.ps1
pip install -U pip
```

2) Install dependencies:

```bash
pip install fastapi uvicorn "pyserial>=3.5" serial_asyncio
```

3) Run the streamer + web UI:

```bash
python -m rehapiano.app.main --http-host 0.0.0.0 --http-port 5555
```

4) Open the UI in your browser:  
`http://<your_ip>:5555/` (locally: `http://127.0.0.1:5555/`)

---

## Requirements

- **Python 3.11+**
- OS with USB-UART support (macOS / Linux / Windows*)
- Python packages: `fastapi`, `uvicorn`, `pyserial`, `serial_asyncio`

\* Discovery currently filters port names containing `"usb"` (see [Troubleshooting](#troubleshooting)).

---

## Installation

### A) Local dev (simple)

Just install the packages inside your venv (see **Quick start**).

### B) Editable install (recommended for development)

If you have a `pyproject.toml` / `setup.cfg`:

```bash
pip install -e .
```

If not, you can set `PYTHONPATH`:

```bash
export PYTHONPATH="$PWD"
```

---

## Running

Main entry point:

```bash
python -m rehapiano.app.main --http-host 0.0.0.0 --http-port 5555
```

Available options:

- `--baud` *(int, default 1000000)* — serial baudrate
- `--scan-interval` *(float, default 2.0)* — how often to scan for new/removed ports (seconds)
- `--identify-retry` *(float, default 3.0)* — how often to re-send RequestIdentifier until we get a reply (seconds)
- `--buzz-on-start FINGER PWM DUR_MS` — optional single haptic test after opening the port
- `--print-stream` — prints brief ADC/IMU info to console for each sample
- `--http-host` *(default `127.0.0.1`)* — bind host for HTTP/WS server
- `--http-port` *(int, default 8000)* — bind port for HTTP/WS server

Examples:

```bash
# local run on port 8000 with stream debug prints
python -m rehapiano.app.main --print-stream

# custom baud & port + one-time haptic test (finger=2, pwm=160, 500 ms)
python -m rehapiano.app.main --baud 921600 --http-port 9000 --buzz-on-start 2 160 500
```


---
## Docker
WARNING: Docker works only with LINUX platform. 
### Build localy

```
docker build -t rehapiano:local .
```

### Run localy

```
docker run --rm -d \
  --name rehapiano \
  --privileged \
  -v /dev:/dev \
  -p 5555:5555 \
  rehapiano:local
```
---

## Frontend (UI)

- Served from `/` (FastAPI static files).
- WebSocket endpoint: `ws://<host>:<port>/ws`.
- Charts via **uPlot** (client-side JS).
- Motor control panel in the UI (“Motorky – nastavenie”).

**Tips**
- The **Freeze** button pauses processing of incoming `sample` messages in the browser (handy for debugging).
- The left pane shows devices with last known values.

---

## Virtual Mode

Virtual Mode allows development and testing **without physical RehaPiano hardware**. It simulates two virtual hand devices using keyboard input.

### Enabling Virtual Mode

1. **Via UI:** Click the **"Virtual OFF"** button in the top-right corner of the web interface. It will change to **"Virtual ON"** and display a keyboard guide panel.

2. **Via API:**
   ```bash
   curl -X POST http://localhost:5555/api/virtual/enable
   ```

### Keyboard Mapping

When Virtual Mode is enabled, pressing keys simulates finger presses on the tensometers:

| Hand | Keys | Finger mapping |
|------|------|----------------|
| **Left** | Q W E R T | little → ring → middle → index → thumb |
| **Right** | Y U I O P | little → ring → middle → index → thumb |

### Virtual Device Properties

| Property | Left Hand | Right Hand |
|----------|-----------|------------|
| Port | `/virtual/left` | `/virtual/right` |
| UID | `2000001` (`0x001E8481`) | `2000002` (`0x001E8482`) |
| Firmware | `231` | `231` |
| Hand code | `0x01` (1) | `0x81` (129) |

> **Note:** UIDs starting with `2` indicate virtual devices in the database.

### ADC Waveform Simulation

The virtual devices generate realistic ADC values with proper envelope:

- **Attack:** Quick rise to peak (~300-400) when key is pressed
- **Sustain:** Holds at ~70% of peak with slight variation while key is held
- **Release:** Gradual decay back to baseline when key is released
- **Noise:** Random noise is added for realism

### Virtual Mode API

#### Get Status
```bash
GET /api/virtual
```
Response:
```json
{
  "enabled": true,
  "available": true,
  "left": {
    "port": "/virtual/left",
    "uid": 2000001,
    "pressed_keys": ["q", "w"]
  },
  "right": {
    "port": "/virtual/right",
    "uid": 2000002,
    "pressed_keys": []
  }
}
```

#### Enable Virtual Mode
```bash
POST /api/virtual/enable
```

#### Disable Virtual Mode
```bash
POST /api/virtual/disable
```

#### Send Key Event (programmatic)
```bash
POST /api/virtual/key
Content-Type: application/json

{"key": "q", "action": "down"}
```
```bash
POST /api/virtual/key
Content-Type: application/json

{"key": "q", "action": "up"}
```

### Use Cases

- **Game development:** Test games without physical devices
- **UI development:** Verify chart rendering and data flow
- **Demo/presentation:** Show system functionality without hardware
- **CI/CD testing:** Automated tests with simulated input

---

## WebSocket protocol

Endpoint: `ws://<host>:<port>/ws`.

On connect, the server immediately sends a **snapshot** (current devices state).  
Then, it pushes **events**:

### `device_added`

```json
{
  "kind": "device_added",
  "port": "/dev/cu.usbserial-1120",
  "hand": "right"
}
```

Notes:
- `hand` is `"left"`, `"right"`, or `"unknown"` for physical devices (until first sample determines it)
- For virtual devices, `hand` is immediately known (`"left"` or `"right"`)

### `device_removed`

```json
{
  "kind": "device_removed",
  "port": "/dev/cu.usbserial-1120",
  "hand": "right"
}
```

### `identifier`

```json
{
  "kind": "identifier",
  "port": "/dev/cu.usbserial-1120",
  "uid": 16318713,
  "uid_hex": "0x00F900F9",
  "uid_dec": 16318713,
  "fw": 231,
  "hand": "right",
  "type": 129
}
```

Notes:
- `hand` is `"left"`, `"right"`, or `"unknown"` (determined from sample messages or virtual device port)
- `type` is the hand code: `0x01` (1) for left, `0x81` (129) for right

### `sample` (main streaming message)

```json
{
  "kind": "sample",
  "port": "/dev/cu.usbserial-1120",
  "ts": 1760472141.836568,
  "sys_ts": 1760472141.836599,
  "sys_mono": 1067251.150828916,
  "type": 129,
  "adc": [0, -58899, -49692, -45134, -15969, -77615],
  "imu": {
    "linAccX": 0, "linAccY": -1, "linAccZ": -1,
    "pitch": -2306, "roll": -1244, "yaw": 846,
    "gyroX": 0, "gyroY": -2, "gyroZ": -2,
    "gravX": -958, "gravY": 121, "gravZ": -168,
    "magX": 822, "magY": 11, "magZ": -78,
    "quatW": 9439, "quatX": 6955, "quatY": 10437, "quatZ": -4694,
    "temp": 38
  },
  "uid": 16318713,
  "uid_hex": "0x00F900F9",
  "uid_dec": 16318713,
  "fw": 231,
  "hand": "right",
  "hand_code": 129
}
```

Notes:

- `type` maps to hand: `0x01 = left`, `0x81 = right`.
- `adc` has 6 values; **index 0 is dummy** (always 0). Real fingers are **1..5** (little → thumb).
- IMU fields reflect FW **2.31** and are raw integers.



### `haptic` (main streaming message)
```json
{
  "kind": "haptic",
  "port": "/dev/cu.usbserial-1120",
  "uid": 16318713,
  "uid_hex": "0x00F900F9",
  "uid_dec": 16318713,
  "fw": 231,
  "finger": ["thumb", "index"],
  "pwm": 184,
  "duration_ms": 500,
  "sys_ts": 1760472201.125,
  "sys_mono": 1067260.4539
}
```

Notes:

- Sent when /api/haptic is called or when the UI manually triggers motor feedback:
- finger can be a single-element list (e.g. ["little"]) or multiple (e.g. ["thumb","index"]).
-	pwm is the raw 0–255 PWM duty cycle.
- duration_ms is motor activation duration.
- Appears immediately after the device command is sent (before ACK).
- Used for synchronization and debugging of haptic events in recordings.
---

### `calibration` (main streaming message)
```json
{
  "kind": "calibration",
  "port": "/dev/cu.usbserial-1120",
  "uid": 16318713,
  "uid_hex": "0x00F900F9",
  "uid_dec": 16318713,
  "fw": 231,
  "sys_ts": 1760472220.505,
  "sys_mono": 1067268.220
}
```

Notes:
- Emitted when /api/calibration endpoint is triggered.
- Indicates that a calibration command has been sent to the target device.
- No payload beyond device metadata; calibration results (if any) are not reported here.
- Appears in the recording stream for traceability (e.g., aligning calibration events with samples).

### `reboot` (main streaming message)
```json
{
  "kind": "reboot",
  "port": "/dev/cu.usbserial-1120",
  "uid": 16318713,
  "uid_hex": "0x00F900F9",
  "uid_dec": 16318713,
  "fw": 231,
  "sys_ts": 1760472245.777,
  "sys_mono": 1067274.988
}
```

Notes:
- Emitted when /api/reboot endpoint is called.
- Confirms that a reboot command was sent to the specified device(s).
- The device itself will disconnect and reconnect on reboot; this event serves as a marker in the data stream.
- Useful for post-analysis of device restarts during experiments or diagnostics.
---


## HTTP API



Base URL: `http://<host>:<port>`

### List devices

`GET /api/devices`

```json
{
  "devices": {
    "/dev/cu.usbserial-1120": {
      "online": true,
      "identified": true,
      "uid": 16318713,
      "uid_hex": "0x00F900F9",
      "uid_dec": 16318713,
      "fw": 231,
      "hand": "right",
      "hand_code": 129,
      "last_seen": 1760472141.84,
      "last_sample_ts": 1760472141.83,
      "baud": 1000000
    }
  }
}
```

### Haptics (motor)

`POST /api/haptic`

Body:

```json
{
  "port": "/dev/cu.usbserial-1120",  // "all" | "any" | explicit port
  "finger": 2,                       // finger index (0..4 in UI mapping)
  "pwm": 160,                        // 0..255
  "duration_ms": 500                 // 0..3000
}
```

Example:

```bash
curl -X POST http://127.0.0.1:5555/api/haptic   -H "Content-Type: application/json"   -d '{"port":"any","finger":2,"pwm":160,"duration_ms":500}'
```

### Calibration

`POST /api/calibration`

```json
{ "port": "all" }
```

### Reboot

`POST /api/reboot`

```json
{ "port": "/dev/cu.usbserial-1120" }
```

---

## Logging & diagnostics

- On startup & discovery, watch for `DISCOVERY` messages.
- The serial layer can log:
  - **actual RX chunk sizes** (e.g., `RX 64B:`),
  - **payload length checks** (expected **57B**),
  - checksum status (`FRAME checksum FAIL ...`).
- `--print-stream` will print decoded `adc` & `imu` per sample.

> CSV/NDJSON logging is easy to add either in `SerialDeviceTask._reader_loop` or directly in `on_sample_cb` inside `main.py`.

---

## WebSocket Recording API (Streamer)

This module provides a **simple one-shot recording mechanism** that captures **everything sent over the WebSocket** — exactly as it is broadcast to connected clients.  
Each recording run produces one `.jsonl` or `.jsonl.gz` file and a matching `.meta.json` file.  
Only one recording can be active at a time.

---

### Overview

- **Source:** WS Tap — a lightweight hook inside `broadcast()` duplicates every WS message to the recorder.
- **Scope:** Captures all outgoing WS traffic (e.g., `sample`, `haptic`, `calibration`, `reboot`, etc.).
- **Single active recorder:** Only one recording can run at once.  
- **Automatic stop:** Recording stops automatically after the requested duration or after the server’s hard cap.
- **Output format:** NDJSON (`.jsonl`) or compressed `.jsonl.gz`.  
  While recording, data are written to `*.part`; when stopped or expired, the file is atomically renamed and metadata finalized.

---

### API Endpoints

#### 1. Start Recording  
**POST** `/api/ws-recording/start`

##### Body (all fields optional)
```json
{
  "duration_s": 300,
  "compress": true,
  "notes": "experiment or user comment"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `duration_s` | int | Desired recording length in seconds. Limited by the hard cap (server-side). |
| `compress` | bool | If `true`, saves `.jsonl.gz` instead of `.jsonl`. |
| `notes` | string | Optional text added to the metadata file. |

##### Example response (201 Created)
```json
{
  "recording_id": "rc_8b12a3ef",
  "status": "recording",
  "started_at": "2025-10-17T14:03:11.234Z",
  "limits": { "duration_s": 300, "hard_cap_s": 900 },
  "paths": {
    "data": "recordings/rc_8b12a3ef.jsonl.gz",
    "meta": "recordings/rc_8b12a3ef.meta.json"
  }
}
```

**Error codes:**
- `409 already_recording` — another recording is already running.

---

#### 2. Get Status  
**GET** `/api/ws-recording`

##### Example response (when recording is active)
```json
{
  "recording_id": "rc_8b12a3ef",
  "status": "recording",
  "started_at": 1760692991.234,
  "limits": { "duration_s": 300, "hard_cap_s": 900 },
  "stats": { "samples": 54321, "bytes_written": 9876543, "dropped": 0 },
  "path_current": "recordings/rc_8b12a3ef.jsonl.gz.part"
}
```

##### Example response (when idle)
```json
{ "status": "idle" }
```

---

#### 3. Stop Recording  
**POST** `/api/ws-recording/stop`

##### Example response (200 OK)
```json
{
  "recording_id": "rc_8b12a3ef",
  "status": "stopped",
  "finished_at": "2025-10-17T14:06:22.882Z",
  "stats": { "samples": 128734, "bytes_written": 20934821, "dropped": 0 },
  "paths": {
    "data": "recordings/rc_8b12a3ef.jsonl.gz",
    "meta": "recordings/rc_8b12a3ef.meta.json"
  }
}
```

**Error codes:**
- `409 not_recording` — no active recording to stop.

---

### Output Files

#### 1. Data file
Stored in `recordings/`  
- **Format:** NDJSON (Newline-Delimited JSON)
- **Extension:** `.jsonl` or `.jsonl.gz`
- **Structure:** Each WebSocket message = one JSON line  
  Example:
  ```json
  {"kind":"sample","port":"/dev/cu.usbserial-1120","ts":1760472141.83,...}
  ```

#### 2. Metadata file
Stored in the same directory as the data file (`*.meta.json`)  
Contains recording details:
```json
{
  "recording_id": "rc_8b12a3ef",
  "status": "stopped",
  "started_at": "2025-10-17T14:03:11.234Z",
  "finished_at": "2025-10-17T14:06:22.882Z",
  "limits": { "duration_s": 300, "hard_cap_s": 900 },
  "stats": { "samples": 128734, "bytes_written": 20934821, "dropped": 0, "channels_seen": ["sample","haptic","reboot","calibration"] },
  "paths": { "data": "recordings/rc_8b12a3ef.jsonl.gz" },
  "notes": "experiment / user comment",
  "version": 1
}
```

#### 3. Temporary file
During recording:  
- Data is written to `*.part`.  
- On stop or timeout, `.part` is renamed to the final file and metadata is updated (`status: "stopped"`).

---

### Example Usage (via `curl`)

#### Start a 5-minute gzip recording
```bash
curl -X POST http://localhost:5555/api/ws-recording/start   -H "Content-Type: application/json"   -d '{"duration_s":300,"compress":true,"notes":"test run"}'
```

#### Check recording status
```bash
curl http://localhost:5555/api/ws-recording
```

#### Stop the current recording
```bash
curl -X POST http://localhost:5555/api/ws-recording/stop
```

---

### Recording Logic Summary

| Step | Description |
|------|--------------|
| 1 | Client sends `POST /api/ws-recording/start` |
| 2 | Server creates a new recording ID and starts writing to `recordings/rc_xxxx.jsonl(.gz).part` |
| 3 | Every WebSocket broadcast message is duplicated into this file via `ws_tap.publish(msg)` |
| 4 | Recording stops automatically after `duration_s` or `HARD_CAP_S`, or when `/stop` is called |
| 5 | Metadata are finalized (`.meta.json`), `.part` file is renamed to its final name |
| 6 | Client can now safely upload or analyze the result |

---

### Best Practices
- **No active WS client required:** messages are captured even if the frontend is closed.
- **Always stop the recording** before starting a new one — concurrent sessions are not supported.
- **Use compression** (`compress=true`) for long runs — much smaller file size.
- **NDJSON format** is ideal for analysis: can be parsed line-by-line or loaded into Pandas.
- **Safe termination:** on server shutdown, the recorder finalizes open files to avoid corruption.

---

### Quick Validation in Python / Jupyter

```python
import gzip, json
from collections import Counter
from datetime import datetime

# path to your recording
path = "recordings/rc_8b12a3ef.jsonl.gz"

records = []
openf = gzip.open if path.endswith(".gz") else open
with openf(path, "rt", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

print(f"Loaded {len(records):,} WS messages")

# basic breakdown by kind
kinds = Counter(r.get("kind", "unknown") for r in records)
print("Kinds:", kinds)

# timing range
ts = [r.get("sys_ts") or r.get("ts") for r in records if isinstance(r.get("sys_ts") or r.get("ts"), (int,float))]
if ts:
    print(f"Duration: {max(ts)-min(ts):.2f}s")
    print("From:", datetime.fromtimestamp(min(ts)))
    print("To  :", datetime.fromtimestamp(max(ts)))
```

---

**Summary:**  
This recording subsystem is a lightweight way to capture **all WebSocket traffic** in its raw JSON form for debugging, analysis, or offline playback.  
It requires no extra client logic and can be fully controlled through three simple HTTP endpoints.


## Troubleshooting

**No devices appear / UI shows nothing**  
Discovery filters ports whose device name contains `"usb"`.

- **macOS/Linux**: typically OK (`/dev/tty.usb*`, `/dev/cu.usb*`).  
- **Windows**: ports are `COMx` → adjust the filter in `main.py`:
  ```python
  ports = [p.device for p in list_ports.comports() if "usb" in p.device.lower()]
  ```
  On Windows you can simply remove the filter and use `list_ports.comports()`.

**`ModuleNotFoundError: rehapiano...`**  
Run from the repo root: `python -m rehapiano.app.main ...`  
Or set `PYTHONPATH`: `export PYTHONPATH="$PWD"`  
Or do an editable install: `pip install -e .`

**WS connected but no data**  
Ensure the device is actually streaming (you should see RX/frame logs in the console).  
In the UI, **Freeze** toggled to “Unfreeze” means samples are being ignored.

---

<!-- ## Plans (Docker)

A Docker image will be added later. Typical usage will look like:

```bash
docker build -t rehapiano-streamer .
docker run --rm --device=/dev/ttyUSB0 -p 5555:5555 rehapiano-streamer   python -m rehapiano.app.main --http-host 0.0.0.0 --http-port 5555
```

> Note: with Docker you must pass the USB device into the container (`--device=...`) and/or use `--privileged`, depending on the host OS.

--- -->

## Project structure

```
rehapiano/
  app/
    main.py           # entrypoint (uvicorn + discovery loop)
    server.py         # FastAPI app, WS manager, HTTP API
    static/
      index.html      # UI
      app.js          # client logic (WS, charts, motor controls, virtual mode)
      app.css         # styles
    state_store.py    # runtime state store
    ws_tap.py         # pub-sub hook for recording
    ws_recording.py   # NDJSON recording system
  io/
    serial_port.py    # SerialDeviceTask (pyserial-asyncio)
    virtual_device.py # Virtual mode - keyboard simulation of hand devices
  protocol/
    framing.py        # frame parser (FW 2.31)
    decoder.py        # payload decode (ADC + IMU)
  core/
    payload_normalizer.py  # YAML-driven unit conversion
  config/
    normalization.yaml     # sensor conversion rules
```

---

## TODO
- endpoint for multi haptic 

## License

Internal use within the RehaPiano (APVV) project.  
Contact: KKUI team.
