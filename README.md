# RehaPiano Game

A web-based rehabilitation game for hand therapy using the RehaPiano device. Built as a bachelor's thesis project, the system adapts a Flappy Bird-style game for use with sensor gloves worn by stroke patients during rehabilitation exercises.

## Overview

The project consists of two components:

- **Frontend** (`frontend/`) — A browser-based rehabilitation game built with TypeScript and Vite. The game replaces traditional jump-based controls with continuous pressure-sensitive input from the RehaPiano gloves, allowing patients to exercise finger flexion and extension while playing.

- **Server** (`server/`) — The RehaPiano streamer server, a Python application that communicates with the RehaPiano hardware and streams real-time sensor data to the frontend via WebSocket. **This component was provided by the thesis supervisor** and is not part of the thesis implementation. See `server/README.md` for its own documentation.

## How It Works

```
RehaPiano Gloves  -->  Streamer Server (Python)  -->  WebSocket  -->  Game (Browser)
     [hardware]           [supervisor-provided]        [JSON]        [thesis work]
```

1. The patient wears RehaPiano sensor gloves on one or both hands
2. The streamer server reads ADC sensor values from the gloves via serial connection
3. Sensor data is streamed to the browser over WebSocket as JSON messages
4. The game maps finger pressure to bird movement:
   - **Extension** (negative force, lifting fingers) — bird moves **up**
   - **Compression** (positive force, pressing down) — bird moves **down**
5. A doctor/therapist configures difficulty, sensitivity, and session parameters through a dedicated settings page

## Quick Start

### Prerequisites

- **Node.js** 18+ (for the frontend)
- **Python** 3.9+ (for the server)
- **RehaPiano hardware** (optional — keyboard fallback available for testing)

### Running

Start the server and frontend in separate terminals:

```bash
# Terminal 1: Start the RehaPiano streamer server
./start-server.sh

# Terminal 2: Start the game frontend
./start-frontend.sh
```

Or manually:

```bash
# Frontend
cd frontend
npm install
npm run dev          # Development server at http://localhost:8080

# Server
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m rehapiano.app.main --http-host 0.0.0.0 --http-port 5555
```

### Pages

| URL | Description |
|-----|-------------|
| `http://localhost:8080/` | The game |
| `http://localhost:8080/settings.html` | Doctor settings page |

### Keyboard Controls (Fallback)

When the RehaPiano device is not connected, the game falls back to keyboard controls:

| Key | Action |
|-----|--------|
| Arrow Up / W | Bird moves up |
| Arrow Down / S | Bird moves down |
| Any key | Start game / Restart |

### Virtual Finger Mode

When connected to the streamer server, you can simulate finger input via keyboard:

| Keys | Action |
|------|--------|
| Q, W, E, R, T | Left hand fingers (compression) |
| Y, U, I, O, P | Right hand fingers (compression) |
| Shift + above | Extension (negative force) |

## Project Structure

```
rehapiano-game/
├── README.md                  # This file
├── start-frontend.sh          # Frontend launcher script
├── start-server.sh            # Server launcher script
├── docs.md                    # Thesis structure outline
│
├── frontend/                  # Game application (thesis implementation)
│   ├── README.md              # Frontend-specific documentation
│   ├── ARCHITECTURE.md        # Technical architecture documentation
│   ├── index.html             # Game page entry point
│   ├── settings.html          # Doctor settings page
│   ├── vite.config.ts         # Vite build configuration
│   ├── tsconfig.json          # TypeScript configuration
│   ├── eslint.config.js       # ESLint configuration
│   ├── .prettierrc            # Prettier configuration
│   ├── public/assets/         # Game assets (images, sounds)
│   └── src/                   # TypeScript source code
│       ├── main.ts            # Game entry point
│       ├── settings.ts        # Settings page entry point
│       ├── types.ts           # Shared type definitions
│       ├── utils.ts           # Utility functions
│       ├── storage.ts         # LocalStorage persistence
│       ├── Assets.ts          # Sound asset management
│       ├── debug.ts           # Visual debugging overlay
│       ├── game/              # Game logic modules
│       │   ├── Game.ts        # Main game orchestrator
│       │   ├── Bird.ts        # Player-controlled bird entity
│       │   ├── Pipe.ts        # Obstacle entity
│       │   ├── PipeManager.ts # Obstacle lifecycle manager
│       │   ├── Land.ts        # Ground collision boundary
│       │   └── LevelProgression.ts  # Difficulty progression system
│       ├── rehapiano/         # RehaPiano device integration
│       │   └── RehaPianoConnection.ts  # WebSocket client
│       └── styles/            # CSS stylesheets
│
└── server/                    # RehaPiano streamer (provided by supervisor)
    ├── README.md
    ├── rehapiano/             # Python application
    └── requirements.txt
```

## Technology Stack

### Frontend (Thesis Implementation)

| Technology | Purpose |
|------------|---------|
| TypeScript 5.x | Type-safe application code |
| Vite 6 | Build tool, dev server with HMR |
| Howler.js | Cross-browser audio playback |
| ESLint + Prettier | Code quality and formatting |
| ES Modules | Modern module system |
| CSS Animations | Game element movement (pipes, bird, sky) |
| WebSocket API | Real-time communication with RehaPiano server |
| LocalStorage | Settings persistence and high score storage |

### Server (Supervisor-Provided)

| Technology | Purpose |
|------------|---------|
| Python 3.9+ | Application runtime |
| FastAPI/Starlette | HTTP + WebSocket server |
| PySerial | Hardware serial communication |

## Credits

- **Original game**: [FloppyBird](https://github.com/nebez/floppybird/) by Nebez Briefkani — the frontend was forked from this open-source TypeScript Flappy Bird clone and extensively modified for rehabilitation use. Licensed under Apache 2.0.
- **Game assets**: Original Flappy Bird artwork by Dong Nguyen / .GEARS games. Used under the open invitation shared by the creator.
- **RehaPiano streamer server**: Provided by the thesis supervisor as part of the RehaPiano research project.

## License

The frontend code modifications are distributed under the same Apache License 2.0 as the original FloppyBird project. See `frontend/LICENSE` for details.
