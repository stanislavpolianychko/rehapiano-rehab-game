#!/usr/bin/env bash
# Start the RehaPiano streamer (backend)
cd "$(dirname "$0")/server"

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

python -m rehapiano.app.main --http-host 0.0.0.0 --http-port 5555 "$@"
