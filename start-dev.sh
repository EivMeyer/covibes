#!/bin/bash

# ColabVibe Development Startup Script

echo "🚀 Starting ColabVibe in Development Mode"
echo ""

# Set development environment
export NODE_ENV=development

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

# Start services in development mode
echo ""
echo "🏗️  Starting services..."

# Kill any existing background processes
pkill -f "npm run dev" 2>/dev/null || true

# Start backend server in background
echo "📡 Starting backend server (development mode)..."
cd server
npm run dev:development &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server in background  
echo "🌐 Starting frontend server (development mode)..."
cd client
npm run dev:development &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📋 Server Information:"
echo "   🔸 Backend:  http://localhost:3001 (PID: $BACKEND_PID)"
echo "   🔸 Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "📝 Logs:"
echo "   - Backend logs: server terminal"
echo "   - Frontend logs: client terminal"
echo ""
echo "🛑 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   or use Ctrl+C in respective terminals"
echo ""

# Keep script running and wait for user input
echo "Press Ctrl+C to stop all development servers..."
trap "echo '🛑 Shutting down development servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Wait for background processes
wait