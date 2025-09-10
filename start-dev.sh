#!/bin/bash

# ColabVibe Development Startup Script

echo "🚀 Starting ColabVibe in Development Mode"
echo ""

# Set development environment
export NODE_ENV=development

# Function to check if port is in use
check_port() {
    local port=$1
    if ss -tlnp | grep -q ":$port "; then
        echo "⚠️  Warning: Port $port is already in use"
        return 1
    fi
    return 0
}

# Check and clean ports
echo "🔍 Checking ports..."
if check_port 3000; then
    echo "   ✅ Port 3000 available"
else
    echo "   🔧 Cleaning up port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

if check_port 3001; then
    echo "   ✅ Port 3001 available"  
else
    echo "   🔧 Cleaning up port 3001..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
fi

# Kill any existing development processes
echo "🧹 Cleaning up any existing dev processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "vite.*dev" 2>/dev/null || true

sleep 3

# Double-check ports are actually free
echo "🔍 Verifying ports are clean..."
for i in {1..5}; do
    if ss -tlnp | grep -q ":3000 "; then
        echo "   🔧 Port 3000 still busy, trying again..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   ✅ Port 3000 is now free"
        break
    fi
done

for i in {1..5}; do
    if ss -tlnp | grep -q ":3001 "; then
        echo "   🔧 Port 3001 still busy, trying again..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   ✅ Port 3001 is now free"
        break
    fi
done

# Start database services first (using existing local Redis)
echo "🗄️  Starting database services..."
docker-compose up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Build client first (required for server static file serving)
echo "🔨 Building client application..."
cd client
npm run build
cd ..

# Start services in development mode
echo ""
echo "🏗️  Starting services..."

# Start backend server in background
echo "📡 Starting backend server (development mode)..."
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server in background  
echo "🌐 Starting frontend server (development mode)..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📋 Server Information:"
echo "   🔸 Backend:  http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001 (PID: $BACKEND_PID)"
echo "   🔸 Frontend: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000 (PID: $FRONTEND_PID)"
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