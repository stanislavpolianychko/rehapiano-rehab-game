# Game Flow

## Overall Examination Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Start                        │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Initialize Connections                         │
│  - WebSocket to server                                       │
│  - WebSocket to RehaPiano                                    │
│  - Pygame display                                            │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Welcome Screen (draw_welcome_screen)           │
│  - Show device code                                          │
│  - Show institution name                                     │
│  - Wait for INIT message                                     │
│  - Check connections (server, RehaPiano, hands)             │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Receive START_EXAMINATION                            │
│  - Parse examination data                                    │
│  - Create Examination object                                 │
│  - Check connections                                         │
│  - Send START_CONFIRMATION                                   │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              For Each Step in Scenario                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Pre-Game Screen                                 │    │
│  │    - Show instructions                             │    │
│  │    - Show which fingers to use                     │    │
│  │    - Countdown (padding_start)                      │    │
│  │    - Activate recording before game starts          │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 2. Clear Sensor Queue                               │    │
│  │    - Reset data collection                          │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 3. Run Game (based on step_type)                   │    │
│  │    - MAX_FORCE: MaxForceGame                       │    │
│  │    - REACTION: ReactionGame                        │    │
│  │    - RHYTHM: RhythmGame                            │    │
│  │    - Collect sensor data during duration           │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 4. Collect Results                                 │    │
│  │    - Extract raw sensor data                        │    │
│  │    - Process additional metrics                     │    │
│  │    - Compress and encode                            │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 5. Send STEP_RESULT                                │    │
│  │    - Send to server via WebSocket                   │    │
│  │    - Store in buffer                                │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 6. Post-Game Screen                                │    │
│  │    - Show step completion                          │    │
│  │    - Show remaining steps                          │    │
│  │    - Wait (padding_end)                            │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Send END_CONFIRMATION                           │
│  - All steps completed                                       │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Return to Welcome Screen                        │
│  - Wait for next examination                                 │
└─────────────────────────────────────────────────────────────┘
```

## Game Type Specific Flows

### MAX_FORCE Game Flow
```
Pre-Game (padding_start)
    │
    ├─> Show instructions
    ├─> Show active fingers
    ├─> Countdown
    └─> Activate recording
        │
        ▼
Game (duration) - Multiple iterations
    │
    ├─> For each iteration:
    │   │
    │   ├─> Pre-iteration screen (pause)
    │   │
    │   ├─> Clear sensor queue
    │   │
    │   ├─> Game loop:
    │   │   ├─> Display column charts (force visualization)
    │   │   ├─> Display hands with finger indicators
    │   │   ├─> Track maximum force per finger
    │   │   ├─> Highlight green when new max reached
    │   │   └─> Update in real-time
    │   │
    │   └─> Collect iteration data
    │
    └─> Post-Game (padding_end)
        │
        ▼
Return: (raw_data, {})
```

### REACTION Game Flow
```
Pre-Game (padding_start)
    │
    ├─> Show instructions
    ├─> Show active fingers
    ├─> Show column layout
    └─> Countdown
        │
        ▼
Game (duration)
    │
    ├─> Initialize shapes (columns, balls)
    │
    ├─> Game loop:
    │   │
    │   ├─> Random wait (min_pause to max_pause)
    │   │
    │   ├─> Generate ball for random finger
    │   │   ├─> Show ball in column
    │   │   ├─> Start timer
    │   │   └─> Set active_id
    │   │
    │   ├─> Detect finger press:
    │   │   ├─> Check if active finger pressed
    │   │   ├─> Check threshold exceeded
    │   │   ├─> Calculate reaction time
    │   │   └─> Mark as caught
    │   │
    │   ├─> Timeout handling:
    │   │   ├─> If max_reaction_time exceeded
    │   │   └─> Remove ball
    │   │
    │   └─> Repeat for iteration_count balls
    │
    └─> Post-Game (padding_end)
        │
        ▼
Return: (raw_data, additional_data)
    additional_data = [
      {
        "finger": 0,
        "offset": 1234,
        "reaction": 567
      },
      ...
    ]
```

### RHYTHM Game Flow
```
Pre-Game (padding_start)
    │
    ├─> Show instructions
    ├─> Show active fingers
    ├─> Show circle indicator
    └─> Countdown
        │
        ▼
Game (duration)
    │
    ├─> Game loop:
    │   │
    │   ├─> Monitor finger presses:
    │   │   ├─> Calculate mean force of active fingers
    │   │   ├─> Compare to threshold
    │   │   ├─> Detect press/release
    │   │   └─> Count presses
    │   │
    │   ├─> Display:
    │   │   ├─> Circle (green when pressed, orange when not)
    │   │   ├─> Press count in center
    │   │   └─> Hand visualization
    │   │
    │   └─> Continue for duration
    │
    └─> Post-Game (padding_end)
        │
        ▼
Return: (raw_data, additional_data)
    additional_data = [
      {
        "press_offset": 1000,
        "release_offset": 1500
      },
      ...
    ]
```

## State Transitions

```
┌─────────────┐
│   INIT      │ (Waiting for INIT message)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  WELCOME    │ (Welcome screen, waiting for examination)
└─────┬───────┘
      │
      │ START_EXAMINATION received
      ▼
┌─────────────┐
│ PRE-GAME    │ (Instructions, countdown)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│   GAME      │ (Active game loop)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ POST-GAME   │ (Results, next step info)
└─────┬───────┘
      │
      │ More steps?
      ├─ YES ──> PRE-GAME
      │
      └─ NO ──> WELCOME
```


