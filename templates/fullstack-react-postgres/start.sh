#!/bin/sh
# Start backend server in background
cd /app
node server.js &

# Start Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173
