# How to Start the RehaPiano Game (Both Sides)

You need to run **two** things: the **WebSocket server** (mock RehaPiano) and the **frontend game** (browser).

---

## 1. Start the RehaPiano Mock Streamer (Server)

This sends fake sensor data over WebSocket so the game can react to key presses.

### Option A: Using pip

```bash
cd example/RehaPiano_MockStreamer

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements-pip.txt

# Run the server
python server.py
```

### Option B: Using conda (from original README)

```bash
cd example/RehaPiano_MockStreamer
conda create --name rehapiano --file requirements.txt
conda activate rehapiano
python server.py
```

**You should see:**
- `Starting server on ws://localhost:8005`
- `✅ Server is running and waiting for connections...`

**If you get "Address already in use" on port 8005:**  
Either stop the old process, or use another port:

```bash
# Option A: Use a different port
python server.py --port 8006
# Then open the game with: http://localhost:8080/?rpUrl=ws://localhost:8006

# Option B: Find and stop what's using 8005
lsof -i :8005
kill <PID>
python server.py
```

**macOS:** If the keyboard library asks for permissions, add Terminal to  
**System Settings → Privacy & Security → Accessibility**.

---

## 2. Start the Frontend Game

The game is a static site: compile TypeScript, then serve the `docs` folder.

### One-time setup (first time only)

```bash
cd frontend
npm install
```

### Every time you want to play

**Terminal 1 – compile TypeScript (run after code changes):**

```bash
cd frontend
npm run compile
```

**Terminal 2 – serve the game:**

```bash
cd frontend
./bin/serve
```

If that fails, use Python (pick a free port if 8080 is in use):

```bash
cd frontend/docs
python3 -m http.server 8080
# If you see "Address already in use", try another port:
python3 -m http.server 3000
```

**Then open in browser:**  
http://localhost:8080 (or the port you used, e.g. http://localhost:3000).

---

## 3. Quick checklist

| Step | Command | Where |
|------|--------|--------|
| 1. Start server | `python server.py` | `example/RehaPiano_MockStreamer/` |
| 2. Compile game  | `npm run compile` | `frontend/` |
| 3. Serve game    | `./bin/serve` or `npx http-server docs -c-1` | `frontend/` |
| 4. Play          | Open http://localhost:8080 | Browser |

---

## 4. Controls (when using the mock streamer)

- **Focus the server terminal** and type keys to control the bird:
  - **q, w, e, r, t, y, u, i, a, s, d, f, g, h, j, k** → move bird **UP**
  - **Q, W, E, …** (capital) or **Shift + key** → move bird **DOWN**
  - **x** then channel key → medium pressure (faster)
  - **y** then channel key → strong pressure
  - **z** then channel key → maximum pressure

The game connects to **ws://localhost:8005** by default.  
To use another URL, open the game with query params, e.g.:  
`http://localhost:8080/?rpUrl=ws://localhost:8005`
