#!/bin/bash

# Covibes Deployment Script
# Usage: ./deploy.sh [development|production]

set -e

ENVIRONMENT=${1:-development}

echo "🚀 Starting Covibes deployment for environment: $ENVIRONMENT"

# Validate environment parameter
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "❌ Error: Environment must be either 'development' or 'production'"
    echo "Usage: ./deploy.sh [development|production]"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ Dependencies check passed"

# Setup environment files
echo "🔧 Setting up environment configuration for $ENVIRONMENT..."

if [ "$ENVIRONMENT" = "production" ]; then
    # Copy production environment files
    if [ -f "client/.env.production" ]; then
        cp client/.env.production client/.env
        echo "✅ Production client environment configured"
    fi
    
    if [ -f "server/.env.production" ]; then
        cp server/.env.production server/.env
        echo "✅ Production server environment configured"
    fi
else
    # Copy development environment files
    if [ -f "client/.env.development" ]; then
        cp client/.env.development client/.env
        echo "✅ Development client environment configured"
    fi
    
    if [ -f "server/.env.development" ]; then
        cp server/.env.development server/.env
        echo "✅ Development server environment configured"
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."

cd client
npm install
echo "✅ Client dependencies installed"

cd ../server
npm install
echo "✅ Server dependencies installed"

cd ..

# Build client
echo "🏗️  Building client application..."
cd client
if [ "$ENVIRONMENT" = "production" ]; then
    npm run build:production
else
    npm run build:development
fi
echo "✅ Client build completed"

cd ..

# Build server
echo "🏗️  Building server application..."
cd server
if [ "$ENVIRONMENT" = "production" ]; then
    npm run build:production
else
    npm run build:development
fi
echo "✅ Server build completed"

cd ..

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "   1. Review production environment variables in .env files"
    echo "   2. Set up database: cd server && npm run prisma:migrate"
    echo "   3. Start production server: cd server && npm run start:production"
    echo "   4. Serve client files from server/dist or use a web server"
else
    echo "   1. Review development environment variables in .env files"
    echo "   2. Set up database: cd server && npm run prisma:migrate"
    echo "   3. Start development servers:"
    echo "      - Backend: cd server && npm run dev:development"
    echo "      - Frontend: cd client && npm run dev:development"
fi
echo ""
echo "🌐 Environment URLs:"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "   - Frontend: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3000"
    echo "   - Backend:  http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001"
else
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend:  http://localhost:3001"
fi
echo ""