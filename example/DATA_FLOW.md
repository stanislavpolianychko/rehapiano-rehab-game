# Data Flow

## Sensor Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│              RehaPiano Hardware                              │
│  - 16 pressure sensors (10 fingers + 6 additional)          │
│  - Real-time data stream                                     │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Binary WebSocket Data
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         RehaPianoConnection                                   │
│  - WebSocket client                                          │
│  - Receives binary data                                      │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Decode
                        ▼
┌─────────────────────────────────────────────────────────────┐
│      RehapianoDataConverter                                  │
│  - Decodes binary format                                     │
│  - Extracts timestamp                                        │
│  - Extracts 16 channel values                                │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ (timestamp, [16 floats], raw_data)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              rp_queue (deque)                                │
│  - Unlimited size queue                                      │
│  - Format: (datetime, [16 float values], raw_socket)       │
│  - Continuously updated                                      │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Game reads latest: rp_queue[-1]
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Game Logic                                      │
│  - Reads current sensor values                              │
│  - Applies gains (calibration)                              │
│  - Processes for game type                                  │
│  - Updates visualization                                    │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ During game duration
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Data Collection                                      │
│  - Collects all samples during game                         │
│  - Stores in raw_data list                                  │
│  - Processes additional metrics                              │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ After game ends
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Data Processing                                      │
│  - Extract raw sensor data                                  │
│  - Compress (zlib)                                          │
│  - Encode (base64)                                          │
│  - Create STEP_RESULT message                               │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ Send via WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Server                                          │
│  - Receives compressed data                                 │
│  - Stores examination results                                │
└─────────────────────────────────────────────────────────────┘
```

## Data Processing Pipeline

### Raw Data Collection
```
Game Start
    │
    ├─> Clear rp_queue
    ├─> Add initial zero sample
    │
    └─> During Game:
        │
        ├─> rp_queue continuously receives:
        │   (timestamp_1, [val1, val2, ..., val16], raw_1)
        │   (timestamp_2, [val1, val2, ..., val16], raw_2)
        │   (timestamp_3, [val1, val2, ..., val16], raw_3)
        │   ...
        │
        └─> Game reads latest: rp_queue[-1][1]
            (16 float values)
```

### Data Transformation
```
Raw Sensor Values (16 channels)
    │
    ├─> Apply Gains (calibration)
    │   value[i] *= gains[i]
    │
    ├─> Filter (threshold)
    │   value = abs(value) if abs(value) > 0.02 else 0.0
    │
    └─> Game-specific processing:
        │
        ├─> MAX_FORCE:
        │   ├─> Track maximum per finger
        │   ├─> Normalize to max
        │   └─> Visualize as columns
        │
        ├─> REACTION:
        │   ├─> Check threshold per finger
        │   ├─> Detect press events
        │   └─> Calculate reaction time
        │
        └─> RHYTHM:
            ├─> Calculate mean of active fingers
            ├─> Detect press/release
            └─> Count presses
```

### Data Serialization
```
Collected Data (list of samples)
    │
    ├─> Each sample: raw_socket_data (binary)
    │
    ├─> Pickle serialization
    │   pickle.dumps(data)
    │
    ├─> Compression
    │   zlib.compress(pickled_data)
    │
    ├─> Base64 encoding
    │   base64.b64encode(compressed_data)
    │
    └─> JSON message
        {
          "action": "STEP_RESULT",
          "payload": {
            "examination_id": "...",
            "step_id": "...",
            "additional_data": "{...}",
            "raw": "base64_string"
          }
        }
```

## Finger Mapping

### Finger Indices (0-9)
```
Left Hand:           Right Hand:
0 - Thumb           5 - Thumb
1 - Index           6 - Index
2 - Middle          7 - Middle
3 - Ring            8 - Ring
4 - Pinky           9 - Pinky
```

### Sensor Channel Mapping
```
FINGER_POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...]
                    │  │  │  │  │  │  │  │  │  │
                    │  │  │  │  │  │  │  │  │  └─> Right Pinky
                    │  │  │  │  │  │  │  │  └─> Right Ring
                    │  │  │  │  │  │  │  └─> Right Middle
                    │  │  │  │  │  │  └─> Right Index
                    │  │  │  │  │  └─> Right Thumb
                    │  │  │  │  └─> Left Pinky
                    │  │  │  └─> Left Ring
                    │  │  └─> Left Middle
                    │  └─> Left Index
                    └─> Left Thumb
```

## Data Structures

### Sensor Queue Item
```python
(timestamp: datetime.datetime,
 values: List[float],  # 16 values
 raw_data: bytes)      # Original binary data
```

### Raw Data Format
```python
# MAX_FORCE
raw_data = [
    [sample_1_bytes, sample_2_bytes, ...],  # Iteration 1
    [sample_1_bytes, sample_2_bytes, ...],  # Iteration 2
    ...
]

# REACTION / RHYTHM
raw_data = [
    [sample_1_bytes, sample_2_bytes, ...]   # Single iteration
]
```

### Additional Data Format
```python
# MAX_FORCE
additional_data = {}

# REACTION
additional_data = [
    {
        "finger": 0,
        "offset": 1234,      # ms from game start
        "reaction": 567      # ms from ball appearance
    },
    ...
]

# RHYTHM
additional_data = [
    {
        "press_offset": 1000,    # ms from game start
        "release_offset": 1500    # ms from game start
    },
    ...
]
```


