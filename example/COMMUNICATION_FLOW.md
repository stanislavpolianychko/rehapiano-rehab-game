# Communication Flow

## WebSocket Server Communication

### Connection Flow
```
┌──────────┐                    ┌──────────┐
│   Game   │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │ 1. Connect (local/remote)     │
     ├──────────────────────────────>│
     │                               │
     │ 2. INIT                       │
     │<──────────────────────────────┤
     │  {action: "INIT",             │
     │   payload: {                  │
     │     institution_id,           │
     │     institution_name,         │
     │     device_code,              │
     │     tenzometer_data           │
     │   }}                          │
     │                               │
     │ 3. START_EXAMINATION          │
     │<──────────────────────────────┤
     │  {action: "START_EXAMINATION",│
     │   payload: {                  │
     │     examination_id,           │
     │     patient_code,             │
     │     scenario: {...}           │
     │   }}                          │
     │                               │
     │ 4. START_CONFIRMATION         │
     ├──────────────────────────────>│
     │  {action: "START_CONFIRMATION"│
     │   payload: {                  │
     │     examination_id            │
     │   }}                          │
     │                               │
     │ 5. [Game runs...]             │
     │                               │
     │ 6. STEP_RESULT (per step)     │
     ├──────────────────────────────>│
     │  {action: "STEP_RESULT",      │
     │   payload: {                  │
     │     examination_id,           │
     │     step_id,                  │
     │     additional_data,          │
     │     raw: base64(compressed)   │
     │   }}                          │
     │                               │
     │ 7. END_CONFIRMATION           │
     ├──────────────────────────────>│
     │  {action: "END_CONFIRMATION", │
     │   payload: {                  │
     │     examination_id            │
     │   }}                          │
     │                               │
     │ 8. STEP_REQUEST (optional)    │
     │<──────────────────────────────┤
     │  {action: "STEP_REQUEST",     │
     │   payload: {                  │
     │     examination_id,           │
     │     steps: [step_ids]         │
     │   }}                          │
     │                               │
     │ 9. STEP_RESULT (resend)       │
     ├──────────────────────────────>│
```

### Message Queue System
```
┌─────────────────────────────────────────┐
│         SocketConnection                │
│                                         │
│  ┌──────────────┐    ┌──────────────┐   │
│  │ Receive Queue│    │  Send Queue  │   │
│  │  (Queue)     │    │   (Queue)    │   │
│  └──────┬───────┘    └──────┬───────┘   │
│         │                   │           │
│         │                   │           │
│    Listen Thread         Send Thread    │
│    (async loop)         (async loop)    │
│         │                   │           │
│         ▼                   ▼           │
│  ┌──────────────┐    ┌──────────────┐   │
│  │ WebSocket    │    │ WebSocket    │   │
│  │ Connection   │    │ Connection   │   │
│  └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────┘
```

## RehaPiano Hardware Communication

### Connection Flow
```
┌──────────┐                    ┌──────────┐
│   Game   │                    │ RehaPiano│
└────┬─────┘                    │ Hardware │
     │                          └────┬─────┘
     │                               │
     │ 1. Connect WebSocket          │
     ├──────────────────────────────>│
     │                               │
     │ 2. Activate Recording         │
     ├──────────────────────────────>│
     │                               │
     │ 3. Continuous Sensor Data     │
     │<──────────────────────────────┤
     │  Binary encoded data          │
     │  (decoded to 16 channels)     │
     │                               │
     │ 4. Deactivate Recording       │
     ├──────────────────────────────>│
     │                               │
```

### Sensor Data Processing
```
Raw Binary Data
      │
      ▼
┌──────────────┐
│   Decoder    │
│ (Rehapiano   │
│  Data        │
│  Converter)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 16 Channels  │
│ [float, ...] │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  rp_queue    │
│  (deque)     │
│              │
│  Format:     │
│  (timestamp, │
│   [16 vals], │
│   raw_data)  │
└──────────────┘
```

## Message Types

### From Server to Game

#### INIT
```json
{
  "action": "INIT",
  "payload": {
    "institution_id": "A847-BFG8",
    "institution_name": "Nemocnica 1",
    "device_code": "ABCD-1234",
    "tenzometer_data": [
      {"code": 0, "gain": 1.0},
      ...
    ]
  }
}
```

#### START_EXAMINATION
```json
{
  "action": "START_EXAMINATION",
  "payload": {
    "examination_id": "TR42-REFG9",
    "patient_code": "IV48-UG76",
    "note": "bla-note",
    "scenario": {
      "scenario_id": "PLTR-4217",
      "name": "scen_name",
      "steps": [
        {
          "step_id": "UTR4-DRF8",
          "step_number": 1,
          "padding_start": 500,
          "padding_end": 500,
          "duration": 5000,
          "pause": 2000,
          "fingers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          "additional_config": "{\"iteration_count\": 3}",
          "type": "MAX_FORCE"
        }
      ]
    }
  }
} 
```

#### STEP_REQUEST
```json
{
  "action": "STEP_REQUEST",
  "payload": {
    "examination_id": "TR42-REFG9",
    "steps": ["UTR4-DRF8"]
  }
} 
```

### From Game to Server

#### START_CONFIRMATION
```json
{
  "action": "START_CONFIRMATION",
  "payload": {
    "examination_id": "TR42-REFG9"
  }
}
```

#### STEP_RESULT
```json
{
  "action": "STEP_RESULT",
  "payload": {
    "examination_id": "TR42-REFG9",
    "step_id": "UTR4-DRF8",
    "additional_data": "{}",
    "raw": "base64_encoded_compressed_pickle_data"
  }
}
```

#### END_CONFIRMATION
```json
{
  "action": "END_CONFIRMATION",
  "payload": {
    "examination_id": "TR42-REFG9"
  }
}
```


