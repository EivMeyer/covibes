#!/bin/bash
#
# Next.js Start Script

set -e

echo "Starting Next.js preview container..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "No package.json found, serving static files..."
    exec http-server . -p ${PORT:-3000} --cors
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set port
export PORT=${PORT:-3000}

# Check if this is a Next.js project
if grep -q '"next"' package.json; then
    echo "Detected Next.js project"
    
    # Try to run dev script first
    if npm run dev --silent 2>/dev/null; then
        exec npm run dev
    else
        echo "Running Next.js directly..."
        exec npx next dev -p $PORT
    fi
else
    echo "No Next.js detected, serving static files..."
    exec http-server . -p $PORT --cors
fi