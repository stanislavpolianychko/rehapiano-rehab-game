# RehaPiano Game Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RehaPiano Game System                        │
└─────────────────────────────┼───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   WebSocket  │      │   RehaPiano  │      │    Pygame    │
│    Server    │      │   Hardware   │      │     GUI      │
│              │      │  (or Mock)   │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Game (main.py)  │
                    │   - Orchestrator  │
                    │   - State Manager │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Socket       │      │ RehaPiano    │      │ Message      │
│ Connection   │      │ Connection   │      │ Handler      │
│              │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Component Details

### 1. Main Game (`game.py`)
- **Purpose**: Central orchestrator
- **Responsibilities**:
  - Initialize Pygame display
  - Manage game state (welcome screen, game, post-game)
  - Coordinate between WebSocket and RehaPiano connections
  - Handle examination flow
  - Manage GUI thread

### 2. Socket Connection (`communicator.py`)
- **Purpose**: WebSocket client for server communication
- **Responsibilities**:
  - Connect to WebSocket server (local or remote)
  - Receive messages: INIT, START_EXAMINATION, STEP_REQUEST, TERMINATE
  - Send messages: START_CONFIRMATION, STEP_RESULT, END_CONFIRMATION
  - Handle authentication (REST API token)
  - Queue-based message handling

### 3. RehaPiano Connection (`rp_communicator.py`)
- **Purpose**: WebSocket client for RehaPiano hardware
- **Responsibilities**:
  - Connect to RehaPiano device (or mock streamer)
  - Receive real-time sensor data (16 channels)
  - Decode binary sensor data
  - Maintain queue of sensor readings
  - Check hand connectivity (left/right)

### 4. Message Handler (`message_handler.py`)
- **Purpose**: Process incoming WebSocket messages
- **Responsibilities**:
  - Parse JSON messages
  - Route to appropriate handlers
  - Create Examination objects
  - Update game state

### 5. Game Types
- **MaxForceGame** (`maxforce.py`): Measure maximum finger force
- **ReactionGame** (`reaction.py`): Test reaction time to visual cues
- **RhythmGame** (`rhythm.py`): Test rhythmic pressing patterns

### 6. Scenario (`scenario.py`)
- **Purpose**: Base class for game scenarios
- **Responsibilities**:
  - Pre-game screens (instructions, countdown)
  - Post-game screens (results, next step)
  - Common UI elements (hands, fingers, countdown)

## Threading Model

```
Main Thread (asyncio)
│
├── GUI Thread (threading.Thread)
│   └── Pygame event loop
│       └── Display updates
│
├── WebSocket Listen Thread (threading.Thread)
│   └── asyncio event loop
│       └── Receive messages from server
│
├── WebSocket Send Thread (threading.Thread)
│   └── asyncio event loop
│       └── Send messages to server
│
└── RehaPiano Listen Thread (threading.Thread)
    └── asyncio event loop
        └── Receive sensor data
```

## Data Structures

### Examination
```
Examination
├── exam_id: str
├── patient_code: str
├── note: str
└── scenario: Scenario
    ├── scenario_id: str
    ├── name: str
    ├── note: str
    └── steps: List[Step]
        ├── step_id: str
        ├── step_number: int
        ├── padding_start: int (ms)
        ├── padding_end: int (ms)
        ├── duration: int (ms)
        ├── pause: int (ms)
        ├── fingers: List[int] (0-9)
        ├── additional_config: dict
        └── step_type: str (MAX_FORCE, REACTION, RHYTHM)
```

### Sensor Data
- **Format**: `(timestamp, [16 float values], raw_socket_data)`
- **Channels**: 16 sensors (10 fingers + 6 additional)
- **Queue**: `deque` with unlimited size
- **Update Rate**: Real-time (depends on hardware)


