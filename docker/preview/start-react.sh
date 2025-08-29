#!/bin/bash
#
# React/Vite Start Script
#
# Intelligently detects the project type and starts the appropriate dev server

set -e

echo "Starting React/Vite preview container..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "No package.json found, serving static files..."
    exec http-server . -p ${PORT:-5173} --cors
fi

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Read package.json to determine the appropriate start command
if command -v jq >/dev/null 2>&1; then
    # Use jq if available
    DEV_SCRIPT=$(jq -r '.scripts.dev // empty' package.json)
    START_SCRIPT=$(jq -r '.scripts.start // empty' package.json)
    SERVE_SCRIPT=$(jq -r '.scripts.serve // empty' package.json)
    HAS_VITE=$(jq -r '.devDependencies.vite // .dependencies.vite // empty' package.json)
    HAS_REACT=$(jq -r '.dependencies.react // empty' package.json)
else
    # Fallback to grep/sed parsing
    DEV_SCRIPT=$(grep -o '"dev"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"dev"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
    START_SCRIPT=$(grep -o '"start"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"start"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
    HAS_VITE=$(grep -q '"vite"' package.json && echo "vite" || echo "")
    HAS_REACT=$(grep -q '"react"' package.json && echo "react" || echo "")
fi

echo "Detected project type: React=${HAS_REACT:-no}, Vite=${HAS_VITE:-no}"
echo "Available scripts: dev='$DEV_SCRIPT', start='$START_SCRIPT'"

# Set port environment variable
export PORT=${PORT:-5173}
export VITE_PORT=$PORT

# Determine and execute the appropriate command
if [ -n "$DEV_SCRIPT" ]; then
    echo "Running dev script: $DEV_SCRIPT"
    exec npm run dev
elif [ -n "$START_SCRIPT" ]; then
    echo "Running start script: $START_SCRIPT"
    exec npm start
elif [ -n "$HAS_VITE" ]; then
    echo "Running Vite directly..."
    exec npx vite --host 0.0.0.0 --port $PORT
elif [ -n "$HAS_REACT" ]; then
    echo "Running React app..."
    exec npx react-scripts start
else
    echo "No recognized React/Vite setup, serving static files..."
    exec http-server . -p $PORT --cors
fi