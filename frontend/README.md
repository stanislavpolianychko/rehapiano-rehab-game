# RehaPiano Game — Frontend

The browser-based rehabilitation game, adapted from the open-source [FloppyBird](https://github.com/nebez/floppybird/) project by Nebez Briefkani. The original Flappy Bird clone has been extensively modified to serve as a hand rehabilitation tool for stroke patients using the RehaPiano sensor gloves.

## Key Modifications from Original

The original FloppyBird was a standard tap-to-jump browser game. The following changes were made to adapt it for rehabilitation:

| Area | Original | Modified |
|------|----------|----------|
| **Control system** | Tap/click to jump | Continuous pressure-sensitive input (up/down) |
| **Input source** | Mouse/touch | RehaPiano sensor gloves via WebSocket (keyboard fallback) |
| **Gravity** | Always pulling down | Disabled — bird moves only via patient input |
| **Difficulty** | Static | Dynamic 8-type progression system tied to rehabilitation exercises |
| **Configuration** | None | Doctor settings page with clinical parameters |
| **Session management** | None | Time limits, rest reminders |
| **Game loop** | `setInterval` + `requestAnimationFrame` | Single `rAF` with fixed-timestep accumulator |
| **Build system** | Raw `tsc` with namespace concatenation | Vite 6 with ES modules |
| **Module system** | TypeScript namespaces | ES module `import`/`export` |
| **Dependencies** | jQuery (CDN), Howler (CDN) | Howler (npm), no jQuery |

## Development

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server (http://localhost:8080)
npm run build     # Type-check + production build
npm run preview   # Serve production build locally
npm run typecheck # TypeScript type checking only
npm run lint      # ESLint check
npm run lint:fix  # ESLint auto-fix
npm run format    # Prettier formatting
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical documentation of the game architecture, module structure, and design decisions.

## Pages

- **`/`** (index.html) — The game itself. Reads doctor settings from localStorage and connects to the RehaPiano streamer.
- **`/settings.html`** — Doctor configuration page. Allows therapists to configure sensitivity, difficulty, progression types, session limits, and hand/finger selection.

## Asset Notice

The visual game assets (sprites, fonts, sounds) are extracted from the original Flappy Bird game by Dong Nguyen / .GEARS games. They are used under the open invitation shared by the creator and are not part of the thesis implementation.
