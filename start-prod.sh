#!/bin/bash

# ColabVibe Production Startup Script

echo "🚀 Starting ColabVibe in Production Mode"
echo ""

# Set production environment
export NODE_ENV=production

# Function to check if port is in use
check_port() {
    local port=$1
    if netstat -tuln | grep -q ":$port "; then
        echo "⚠️  Warning: Port $port is already in use"
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking ports..."
check_port 3000 || echo "   Frontend port 3000 may be busy"
check_port 3001 || echo "   Backend port 3001 may be busy"

# Check if applications are built
echo "🔍 Checking build status..."

if [ ! -d "client/dist" ]; then
    echo "❌ Client build not found. Building now..."
    cd client
    npm run build:production
    cd ..
fi

if [ ! -d "server/dist" ]; then
    echo "❌ Server build not found. Building now..."
    cd server
    npm run build:production
    cd ..
fi

echo "✅ Build check completed"

# Start production server
echo ""
echo "🏗️  Starting production server..."

cd server
npm run start:production &
BACKEND_PID=$!
cd ..

echo ""
echo "✅ Production server started!"
echo ""
echo "📋 Server Information:"
echo "   🔸 Backend:  http://ec2-13-60-242-174.eu-north-1.compute.amazonaws.com:3001 (PID: $BACKEND_PID)"
echo "   🔸 Frontend: http://ec2-13-60-242-174.eu-north-1.compute.amazonaws.com:3000 (served by backend)"
echo ""
echo "📝 Notes:"
echo "   - Frontend is served as static files from backend"
echo "   - Both frontend and backend run on the same server process"
echo "   - Database migrations should be run separately if needed"
echo ""
echo "🛑 To stop server:"
echo "   kill $BACKEND_PID"
echo ""

# Keep script running and wait for user input
echo "Press Ctrl+C to stop production server..."
trap "echo '🛑 Shutting down production server...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT

# Wait for background process
wait