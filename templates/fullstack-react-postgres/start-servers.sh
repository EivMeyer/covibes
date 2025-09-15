#!/bin/sh
# Start backend server
cd /app
node server.js &
BACKEND_PID=$!

# Keep the script running
echo "Backend server started with PID: $BACKEND_PID"
tail -f /dev/null
