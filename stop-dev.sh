#!/bin/bash

echo "🛑 Stopping ColabVibe Development Environment..."

# Kill any development servers
echo "📡 Stopping development servers..."
pkill -f "npm run dev" 2>/dev/null || echo "   No development servers running"

# Stop database services
echo "🗄️  Stopping database services..."
docker-compose stop postgres redis

echo ""
echo "✅ Development environment stopped!"
echo ""