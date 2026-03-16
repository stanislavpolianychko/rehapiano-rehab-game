# RehaPiano Integration - Implementation Steps

## Overview

This document outlines the step-by-step implementation plan for integrating RehaPiano gloves with the Flappy Bird game. The goal is to replace jump-based controls with continuous bidirectional control:
- **Extension** (negative sensor values, pulling up) → Bird moves **UP**
- **Compression** (positive sensor values, pressing down) → Bird moves **DOWN**

---

## Implementation Steps

### **Step 1: Game Logic Migration** ✅ First Priority
**Goal**: Convert from jump-based to continuous control system, testable with keyboard/mouse.

**Status**: Not Started

#### 1.1 Modify `Bird.ts`
- [ ] Remove or deprecate `jump()` method (keep for backward compatibility but make optional)
- [ ] Add `controlVelocity: number` property to store input control
- [ ] Add `setControlVelocity(velocity: number)` method
- [ ] Modify `tick()` to combine:
  - Base velocity (gravity)
  - Control velocity (from input)
  - Combined velocity affects position and rotation

#### 1.2 Modify `Game.ts`
- [ ] Remove `bird.jump()` call in `start()` method
- [ ] Remove `bird.jump()` call in `onScreenTouch()` when playing
- [ ] Add temporary keyboard controls for testing:
  - Arrow Up / W = negative velocity (bird goes up)
  - Arrow Down / S = positive velocity (bird goes down)
  - No key = neutral (only gravity applies)
- [ ] Add keyboard event listeners (`keydown`/`keyup`)
- [ ] Update `tick()` to apply keyboard control velocity

#### 1.3 Test Step 1
- [ ] Game should work with keyboard controls
- [ ] Bird moves up/down continuously (no jumping)
- [ ] Gravity still applies when no input
- [ ] Rotation reflects velocity direction
- [ ] Collision detection still works

**Expected Result**: Game works with continuous keyboard control, ready for RehaPiano integration.

---

### **Step 2: Create RehaPiano Connection Module**
**Goal**: Create standalone module that connects to RehaPiano and decodes sensor data.

**Status**: Not Started

#### 2.1 Create `src/RehaPianoConnection.ts`
- [ ] Create `RehaPianoConnection` class in `Floppy` namespace
- [ ] WebSocket connection to `ws://localhost:8005` (configurable)
- [ ] Set `binaryType = 'arraybuffer'` for binary data
- [ ] Implement connection lifecycle:
  - `connect()`: Promise-based connection
  - `disconnect()`: Clean disconnect
  - Connection status tracking
- [ ] Implement binary data decoding:
  - 8 bytes: timestamp (double, little-endian)
  - 64 bytes: 16 channels × 4 bytes each (float, little-endian)
  - Store decoded data in `Float32Array`
- [ ] Add finger mapping:
  - `FINGER_POSITIONS = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8]`
  - Methods to get finger-specific values
- [ ] Add utility methods:
  - `getRawSensorValues()`: Get all 16 channels with sign
  - `getFingerPressure(fingerIndex)`: Get absolute pressure for finger
  - `getAverageFingerValue()`: Get average across all fingers (with sign)
  - `isAnyFingerPressed()`: Check if any finger above threshold

#### 2.2 Test RehaPiano Module
- [ ] Test connection to mock streamer
- [ ] Verify data decoding (log values to console)
- [ ] Test with keyboard simulation (Q, W, E, etc.)
- [ ] Verify positive/negative values work correctly
- [ ] Test connection error handling

**Expected Result**: Standalone RehaPiano module that successfully connects and decodes sensor data.

---

### **Step 3: Integrate RehaPiano with Game**
**Goal**: Connect sensor data to bird control, replace keyboard with RehaPiano input.

**Status**: Not Started

#### 3.1 Add RehaPiano to `Game.ts`
- [ ] Add `rehaPiano: RehaPianoConnection` property
- [ ] Add `rehaPianoEnabled: boolean` flag
- [ ] Initialize RehaPiano in constructor:
  - Create connection instance
  - Attempt to connect (async)
  - Handle connection success/failure
- [ ] Add connection status UI indicator (optional)
- [ ] Implement reconnection logic on disconnect

#### 3.2 Map Sensor Values to Control
- [ ] Create `getRehaPianoControlVelocity()` method:
  - Get average sensor value from fingers (with sign preserved)
  - Map to control velocity:
    - Negative values (extension) → negative velocity (up)
    - Positive values (compression) → positive velocity (down)
  - Apply dead zone to prevent jitter
  - Apply scale factor for sensitivity
  - Clamp to max velocity limits
- [ ] Update `tick()` method:
  - If RehaPiano enabled: use sensor control velocity
  - If RehaPiano disabled: fallback to keyboard control
- [ ] Remove or disable keyboard controls when RehaPiano is active

#### 3.3 Configuration Options
- [ ] Add RehaPiano options to `GameOptions`:
  - `rehaPianoUrl?: string` (default: 'ws://localhost:8005')
  - `rehaPianoThreshold?: number` (default: 0.05)
  - `rehaPianoScale?: number` (default: 2.0)
  - `rehaPianoMaxVelocity?: number` (default: 5.0)
- [ ] Make parameters configurable/tunable

**Expected Result**: Game uses RehaPiano sensors for bird control, with keyboard fallback.

---

### **Step 4: Testing & Tuning**
**Goal**: Test with mock streamer, adjust parameters, ensure smooth gameplay.

**Status**: Not Started

#### 4.1 Test with Mock Streamer
- [ ] Start mock streamer: `python example/RehaPiano_MockStreamer/server.py`
- [ ] Test extension (Shift + keys) → bird goes up
- [ ] Test compression (keys without Shift) → bird goes down
- [ ] Test neutral (no keys) → gravity applies
- [ ] Test different pressure levels (Z, X, C keys)
- [ ] Verify smooth movement (no jitter)
- [ ] Test with different fingers (Q, W, E, etc.)

#### 4.2 Tune Parameters
- [ ] Adjust scale factor (sensitivity):
  - Too sensitive: bird moves too fast
  - Too slow: bird doesn't respond well
- [ ] Adjust dead zone (jitter prevention):
  - Too small: jittery movement
  - Too large: unresponsive
- [ ] Adjust max velocity (speed limits):
  - Prevent bird from moving too fast
  - Ensure playable difficulty
- [ ] Optionally adjust gravity:
  - May need to reduce if control is too sensitive
  - May need to increase if control is too weak

#### 4.3 Test Edge Cases
- [ ] Test connection loss during gameplay
- [ ] Test reconnection
- [ ] Test with no RehaPiano available (fallback to keyboard)
- [ ] Test with extreme sensor values
- [ ] Test collision detection still works
- [ ] Test scoring still works

**Expected Result**: Fully functional game with smooth RehaPiano control, well-tuned parameters.

---

## Technical Details

### RehaPiano Protocol
- **Connection**: WebSocket (binary)
- **URL**: `ws://localhost:8005` (mock streamer)
- **Data Format**: 72 bytes total
  - 8 bytes: timestamp (double, Unix milliseconds)
  - 64 bytes: 16 channels × 4 bytes (float, -1.0 to 1.0)

### Finger Mapping
```typescript
const FINGER_POSITIONS = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8];
// Fingers 0-4: Left hand (thumb, index, middle, ring, pinky)
// Fingers 5-9: Right hand (thumb, index, middle, ring, pinky)
```

### Control Mapping
```
Sensor Value: -1.0 to +1.0
              │
Extension     │    Compression
(Pull Up)     │    (Press Down)
Negative      │    Positive
     │        │        │
     ▼        │        ▼
Bird UP       │    Bird DOWN
(Negative     │    (Positive
 Velocity)    │     Velocity)
```

### Mock Streamer Controls
- **Q, W, E, R, T, Y, U, I**: Channels 0-7 (left hand)
- **A, S, D, F, G, H, J, K**: Channels 8-15 (right hand)
- **Z, X, C**: Pressure levels (50%, 75%, 100%)
- **Shift**: Invert values (negative)

---

## File Structure

```
frontend/
├── src/
│   ├── Bird.ts                    (MODIFY: Step 1)
│   ├── Game.ts                    (MODIFY: Step 1, 3)
│   ├── RehaPianoConnection.ts     (CREATE: Step 2)
│   ├── Common.ts                  (MODIFY: Step 3 - add options)
│   └── ...
└── ...
```

## Notes

- **Step 1 is critical**: Get continuous control working with keyboard first before adding RehaPiano complexity
- **Test incrementally**: Test each step before moving to the next
- **Keep keyboard fallback**: Always maintain keyboard controls as backup
- **Parameter tuning**: Expect to spend time tuning sensitivity, dead zones, etc.
- **Error handling**: Always handle connection failures gracefully

---

## Current Status

- [ ] Step 1: Game Logic Migration
- [ ] Step 2: RehaPiano Connection Module
- [ ] Step 3: Integration
- [ ] Step 4: Testing & Tuning

**Next Action**: Start with Step 1 - Game Logic Migration

