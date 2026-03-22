#!/usr/bin/env bash
# Start the RehaPiano game (frontend dev server)
cd "$(dirname "$0")/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Starting Vite dev server..."
npm run dev
