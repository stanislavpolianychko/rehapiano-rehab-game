# Architecture Documentation

Technical architecture of the RehaPiano rehabilitation game frontend.

## Module Dependency Graph

```
main.ts (entry point)
├── styles/reset.css
├── styles/main.css
├── debug.ts ──────────────────── types.ts (shared types, no dependencies)
├── storage.ts ────────────────── types.ts
└── game/Game.ts (orchestrator)
    ├── types.ts
    ├── utils.ts ──────────────── types.ts
    ├── Assets.ts ─────────────── howler (npm)
    ├── storage.ts
    ├── debug.ts
    ├── game/Bird.ts ──────────── types, utils, Assets, debug
    ├── game/Land.ts ──────────── types, utils, debug
    ├── game/PipeManager.ts
    │   └── game/Pipe.ts ──────── types, utils, debug
    ├── game/LevelProgression.ts ─ types (standalone)
    └── rehapiano/
        └── RehaPianoConnection.ts (standalone, no game deps)
```

## Game Loop Architecture

The game uses a **single `requestAnimationFrame` loop with a fixed-timestep accumulator**, following the pattern recommended by [MDN's Anatomy of a Video Game](https://developer.mozilla.org/en-US/docs/Games/Anatomy).

```
requestAnimationFrame fires
  → calculate elapsed time (delta)
  → cap delta at 200ms (prevents "spiral of death" after tab switch)
  → add delta to accumulator
  → while accumulator >= TICK_RATE (1000/60 ms):
      → run tick() (game logic: input, physics, collision, scoring)
      → subtract TICK_RATE from accumulator
  → run draw() (render bird position)
```

This approach:
- Keeps game logic deterministic at a fixed 60Hz rate regardless of display refresh rate
- Synchronizes rendering with the browser's repaint cycle via `rAF`
- Pauses automatically when the browser tab is backgrounded (saving CPU/battery)
- Prevents the accumulator from spiraling after long pauses (delta cap)

### Previous approach (replaced)
The original code used `setInterval(tick, 1000/60)` for game logic and a separate `requestAnimationFrame(draw)` for rendering. This was replaced because `setInterval` is not synchronized with the browser's repaint cycle, keeps firing when the tab is backgrounded, and has unreliable timer resolution.

## Input System

### Control Flow

```
RehaPiano Gloves                  Keyboard (fallback)
      │                                  │
      ▼                                  ▼
WebSocket JSON messages          keydown/keyup events
      │                                  │
      ▼                                  ▼
RehaPianoConnection             targetControlVelocity
      │                                  │
      ▼                                  ▼
getAverageFingerValue()         updateControlVelocity()
      │                          (gradual acceleration)
      ▼                                  │
getRehaPianoControlVelocity()            │
  (dead zone → scale → clamp)           │
      │                                  │
      └──────────┬───────────────────────┘
                 ▼
    bird.setControlVelocity(velocity)
                 │
                 ▼
         bird.tick() → position update
```

### Sensor Data Mapping

The RehaPiano gloves report ADC (Analog-to-Digital Converter) values for each finger:
- **Positive values** = compression (pressing down) → bird moves **down**
- **Negative values** = extension (lifting up) → bird moves **up**

The mapping pipeline in `getRehaPianoControlVelocity()`:
1. Get average force across all connected fingers
2. Apply dead zone (ignore values below `minimumForce` threshold)
3. Multiply by `responseStrength` scale factor
4. Clamp to `maximumSpeed` velocity limits (respecting level progression)

### Virtual Keyboard Mode

When connected to the streamer server, keyboard keys Q-P are forwarded to the server's virtual input API, simulating finger presses without physical hardware. This enables testing without gloves.

## Difficulty Progression System

The `LevelProgression` class manages 8 rehabilitation-focused exercise types:

| Type | Effect | Therapeutic Goal |
|------|--------|-----------------|
| `hand_tension` | Reduces max velocity (requires more force) | Strength building |
| `fast_reaction` | Reduces pipe delay (obstacles appear faster) | Reaction time |
| `precision_control` | Reduces pipe gap (narrower openings) | Fine motor precision |
| `speed_challenge` | Increases movement speed | Movement speed |
| `endurance` | Slightly reduces pipe delay | Sustained effort |
| `coordination` | Requires both extension and compression | Bilateral coordination |
| `fine_motor` | Smaller movements needed | Fine motor control |
| `range_of_motion` | Full extension/compression required | Joint range improvement |

Progression triggers every N points (configurable by doctor). Each trigger randomly selects an enabled exercise type and increments its step counter. The step counter determines the intensity of the effect.

## Doctor Settings

Settings are persisted in `localStorage` as JSON and loaded by the game on startup.

### Data Flow

```
Doctor Settings Page (settings.html)
  → settings.ts reads/writes DoctorSettings
  → storage.setDoctorSettings() → localStorage

Game Page (index.html)
  → main.ts: storage.getDoctorSettings() ← localStorage
  → passed as GameOptions.doctorSettings to Game constructor
  → Game creates LevelProgression.fromDoctorSettings(settings)
  → Game uses settings for threshold, scale, time limits, rest reminders
```

### Settings Categories

- **Hand selection**: Which hand(s) and fingers to track
- **Sensitivity**: Force threshold, response strength, max speed
- **Difficulty**: Starting gap size, obstacle frequency
- **Progression**: Points per level, enabled exercise types, max difficulty cap
- **Session**: Time limit (auto-stop), rest reminder interval

## Collision Detection

The game uses **AABB (Axis-Aligned Bounding Box)** collision detection. Each game entity (bird, pipes, land) maintains a `BoundingBox` with `x, y, width, height`.

The bird's bounding box accounts for rotation — as the bird rotates (based on velocity), its effective width and height change. This is computed using trigonometry in `Bird.tick()`.

Pipe positions are read from the DOM via `getBoundingClientRect()` because pipe movement is driven by CSS `@keyframes` animation, not JavaScript. This creates a coupling between CSS and game logic, but is acceptable given the small entity count.

## State Machine

```
Loading → SplashScreen → Playing → PlayerDying → PlayerDead → ScoreScreen
                ↑                                                    │
                └────────────────────────────────────────────────────┘
                                    (reset)
```

The state is managed via the `Game.state` setter, which updates the DOM body class (enabling CSS-driven visibility changes) and logs state transitions to the debugger.

## Build System

| Tool | Role |
|------|------|
| **Vite 6** | Dev server (HMR), production bundler, asset handling |
| **TypeScript 5.x** | Type checking only (`noEmit: true`) — Vite/esbuild handles transpilation |
| **ESLint 10** | Code quality with `typescript-eslint` rules |
| **Prettier** | Code formatting (4-space indent, single quotes, trailing commas) |

### Build Pipeline

```bash
npm run build
  → tsc --noEmit     # Type checking (no output files)
  → vite build       # esbuild transpilation + Rollup bundling → dist/
```

### Multi-Page Setup

Vite is configured with two entry points via `rollupOptions.input`:
- `index.html` → game page
- `settings.html` → doctor settings page

Shared code (storage, types) is automatically code-split by Rollup into a shared chunk.
