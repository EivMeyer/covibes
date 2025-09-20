#!/bin/bash
set -e

# Covibes Production Deployment Script
# This script prevents the manual configuration hell we experienced

echo "🚀 Starting Covibes Production Deployment"
echo "=========================================="

# STEP 1: Environment Validation
echo "📋 STEP 1: Validating Environment..."

# Required environment variables
REQUIRED_VARS=(
    "EC2_HOST"
    "EC2_USERNAME" 
    "BASE_HOST"
    "DATABASE_URL"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
)

# Validate each required variable
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ CRITICAL: $var is not set!"
        echo "💡 Set it with: export $var=your-value"
        exit 1
    else
        echo "✅ $var is set"
    fi
done

# Validate IP addresses match
if [ "$EC2_HOST" != "$BASE_HOST" ]; then
    echo "⚠️  WARNING: EC2_HOST ($EC2_HOST) != BASE_HOST ($BASE_HOST)"
    echo "   This may cause connectivity issues"
fi

echo "✅ Environment validation passed!"

# STEP 2: Pre-deployment Cleanup
echo ""
echo "🧹 STEP 2: Pre-deployment Cleanup..."

# Kill any existing processes
echo "Stopping existing processes..."
pkill -f nodemon || true
pkill -f "vite.*dev" || true
pm2 delete all || true
pm2 kill || true

# Clean Docker conflicts
echo "Cleaning Docker containers..."
docker rm -f preview-demo-team-001 || true

# Clean build artifacts
echo "Cleaning build artifacts..."
cd /home/ubuntu/covibes
rm -rf server/dist || true
rm -rf client/dist || true

echo "✅ Cleanup completed!"

# STEP 3: Build Applications
echo ""
echo "🔨 STEP 3: Building Applications..."

# Build server
echo "Building server..."
cd server
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Server build failed!"
    exit 1
fi

# Build client
echo "Building client..."
cd ../client
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed!"
    exit 1
fi

echo "✅ Build completed!"

# STEP 4: Database Setup
echo ""
echo "🗄️  STEP 4: Database Setup..."

cd ../server

# Run migrations
echo "Running database migrations..."
npm run prisma:migrate

# Seed database
echo "Seeding database..."
npm run prisma:seed

echo "✅ Database setup completed!"

# STEP 5: Dependency Check
echo ""
echo "📦 STEP 5: Dependency Validation..."

# Check workspace dependencies
WORKSPACE_DIR="/home/ubuntu/.covibes/workspaces/demo-team-001"
if [ -d "$WORKSPACE_DIR" ]; then
    echo "Checking workspace dependencies..."
    cd "$WORKSPACE_DIR"
    
    # Ensure Three.js is installed
    if ! npm list three > /dev/null 2>&1; then
        echo "Installing missing Three.js..."
        npm install three
    fi
    
    echo "✅ Dependencies validated!"
else
    echo "⚠️  Workspace directory not found, will be created on first preview"
fi

# STEP 6: Start Production Server
echo ""
echo "🚀 STEP 6: Starting Production Server..."

cd /home/ubuntu/covibes

# Create production start command
PROD_CMD="NODE_ENV=production PORT=3001 BASE_HOST=$BASE_HOST EC2_HOST=$EC2_HOST EC2_USERNAME=$EC2_USERNAME DATABASE_URL=\"$DATABASE_URL\" JWT_SECRET=\"$JWT_SECRET\" ENCRYPTION_KEY=\"$ENCRYPTION_KEY\" node server/dist/src/server.js"

echo "Starting server with command:"
echo "$PROD_CMD"

# Start in background
nohup bash -c "$PROD_CMD" > /tmp/covibes-production.log 2>&1 &
SERVER_PID=$!

echo "✅ Server started with PID: $SERVER_PID"

# STEP 7: Health Checks
echo ""
echo "🏥 STEP 7: Health Validation..."

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# Check if server is responding
if curl -f "http://$BASE_HOST:3001/health" > /dev/null 2>&1; then
    echo "✅ Server health check passed!"
else
    echo "❌ Server health check failed!"
    echo "📋 Server logs:"
    tail -20 /tmp/covibes-production.log
    exit 1
fi

# Check if preview system works
echo "Testing preview system..."
if curl -f "http://$BASE_HOST:3001/api/preview/proxy/demo-team-001/main/" > /dev/null 2>&1; then
    echo "✅ Preview system working!"
else
    echo "⚠️  Preview system not ready yet (this is normal)"
fi

# STEP 8: Final Summary
echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "======================"
echo "📱 Main Site: http://$BASE_HOST:3001/"
echo "📱 Mobile Preview: http://$BASE_HOST:3001/api/preview/proxy/demo-team-001/main/"
echo "🏥 Health Check: http://$BASE_HOST:3001/health"
echo ""
echo "📋 Server PID: $SERVER_PID"
echo "📄 Logs: /tmp/covibes-production.log"
echo ""
echo "🔍 To monitor logs: tail -f /tmp/covibes-production.log"
echo "🛑 To stop server: kill $SERVER_PID"
echo ""
echo "✅ Covibes is now running in production mode!"