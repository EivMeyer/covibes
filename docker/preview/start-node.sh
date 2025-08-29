#!/bin/bash
#
# Node.js Start Script

set -e

echo "Starting Node.js preview container..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "No package.json found, looking for server files..."
    
    # Look for common entry points
    if [ -f "server.js" ]; then
        echo "Found server.js, starting with node..."
        exec node server.js
    elif [ -f "app.js" ]; then
        echo "Found app.js, starting with node..."
        exec node app.js
    elif [ -f "index.js" ]; then
        echo "Found index.js, starting with node..."
        exec node index.js
    else
        echo "No server files found, serving static content..."
        exec http-server . -p ${PORT:-3000} --cors
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set port
export PORT=${PORT:-3000}

# Try different start methods
if command -v jq >/dev/null 2>&1; then
    START_SCRIPT=$(jq -r '.scripts.start // empty' package.json)
    DEV_SCRIPT=$(jq -r '.scripts.dev // empty' package.json)
    MAIN_FILE=$(jq -r '.main // empty' package.json)
else
    START_SCRIPT=$(grep -o '"start"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"start"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
    DEV_SCRIPT=$(grep -o '"dev"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"dev"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
    MAIN_FILE=$(grep -o '"main"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"main"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")
fi

echo "Available options: start='$START_SCRIPT', dev='$DEV_SCRIPT', main='$MAIN_FILE'"

# Execute the appropriate command
if [ -n "$DEV_SCRIPT" ]; then
    echo "Running dev script: $DEV_SCRIPT"
    exec npm run dev
elif [ -n "$START_SCRIPT" ]; then
    echo "Running start script: $START_SCRIPT"
    exec npm start
elif [ -n "$MAIN_FILE" ] && [ -f "$MAIN_FILE" ]; then
    echo "Running main file: $MAIN_FILE"
    exec node "$MAIN_FILE"
elif [ -f "server.js" ]; then
    echo "Running server.js with nodemon for development..."
    exec npx nodemon server.js
elif [ -f "app.js" ]; then
    echo "Running app.js with nodemon for development..."
    exec npx nodemon app.js
elif [ -f "index.js" ]; then
    echo "Running index.js with nodemon for development..."
    exec npx nodemon index.js
else
    echo "No runnable Node.js application found, serving static files..."
    exec http-server . -p $PORT --cors
fi