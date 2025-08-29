#!/bin/bash

# ColabVibe Server Start Script
# This script sets up and starts the ColabVibe TypeScript server

echo "🚀 Starting ColabVibe Server..."

# Check if .env exists, create from example if not
if [ ! -f .env ]; then
    echo "📄 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please review and update .env file with your configuration"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma client if needed
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🗄️  Running database migrations..."
npm run prisma:migrate

# Seed database with demo data
echo "🌱 Seeding database with demo data..."
npm run prisma:seed

# Start the development server
echo "🎯 Starting development server..."
npm run dev