#!/bin/bash
# Covibes Centralized Deployment Script
# 
# 🎯 SINGLE IP CONFIGURATION POINT
# To change IP addresses: Edit server/config/deployment.js ONLY

echo "🚀 Covibes Centralized Deployment"
echo "=================================="

# Get configuration from centralized source
echo "📋 Reading centralized configuration..."
cd /home/ubuntu/covibes

# Use Node.js to read our centralized config
CONFIG=$(node -e "
const config = require('./server/config/deployment.js');
console.log(JSON.stringify({
  EC2_HOST: config.EC2_HOST,
  BASE_HOST: config.BASE_HOST,
  SERVER_PORT: config.SERVER_PORT,
  SERVER_URL: config.SERVER_URL
}));
")

# Parse configuration
EC2_HOST=$(echo $CONFIG | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).EC2_HOST)")
BASE_HOST=$(echo $CONFIG | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).BASE_HOST)")
SERVER_PORT=$(echo $CONFIG | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).SERVER_PORT)")
SERVER_URL=$(echo $CONFIG | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).SERVER_URL)")

echo "✅ Configuration loaded from central config:"
echo "   EC2_HOST: $EC2_HOST"
echo "   BASE_HOST: $BASE_HOST"
echo "   SERVER_PORT: $SERVER_PORT"
echo "   SERVER_URL: $SERVER_URL"

# Set other required environment variables
export EC2_USERNAME=ubuntu
export DATABASE_URL="postgresql://postgres:password@localhost:5433/covibes_prod"
export JWT_SECRET="prod_jwt_2024_covibes_secure_random_key_123456789"
export ENCRYPTION_KEY="abcdef1234567890abcdef1234567890"
export NODE_ENV=production

echo ""
echo "🧹 Cleanup existing processes..."
pkill -f nodemon || true
pkill -f "vite.*dev" || true
pm2 delete all || true
pm2 kill || true

echo ""
echo "🔨 Building applications..."
cd server && npm run build
cd ../client && npm run build

echo ""
echo "🚀 Starting production deployment..."
cd /home/ubuntu/covibes

# Start using PM2 with centralized configuration
pm2 start ecosystem.config.js

echo ""
echo "🏥 Health check..."
sleep 5
if curl -f "$SERVER_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is running at: $SERVER_URL"
else
    echo "❌ Health check failed"
    pm2 logs --lines 10
    exit 1
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "📱 Access site: $SERVER_URL"
echo "🔧 IP configured in: server/config/deployment.js"
echo ""
echo "💡 To change IPs in future:"
echo "   1. Edit server/config/deployment.js PRIMARY_HOST"
echo "   2. Run: ./scripts/deploy.sh"
echo "   3. Done! No more hunting through files 🎯"