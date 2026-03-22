#!/usr/bin/env bash
# Start the Flappy Hand game (frontend)
cd "$(dirname "$0")/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Compile TypeScript and serve
echo "Compiling TypeScript..."
npx tsc

echo "Starting dev server on http://localhost:8080"
npx http-server -c-1 docs
