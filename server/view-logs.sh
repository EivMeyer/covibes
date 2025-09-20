#!/bin/bash

echo "==================================="
echo "VIEWING COLABVIBE SERVER LOGS"
echo "==================================="
echo ""
echo "Tailing the most recent Node.js process output..."
echo "Send a chat message and watch for:"
echo "  💬 [CHAT-MESSAGE-RECEIVED]"
echo "  📌 [MANAGER-TYPE] Got manager: ChatPtyManager"
echo "  💬 Sending chat message"
echo ""

# Find the nodemon process and attach to its output
NODEMON_PID=$(ps aux | grep "nodemon src/server.ts" | grep -v grep | awk '{print $2}' | head -1)

if [ -z "$NODEMON_PID" ]; then
  echo "❌ Server not running with nodemon"
  echo "Start it with: cd /home/eivind/repos/covibes/server && npm run dev"
else
  echo "📌 Found nodemon process: $NODEMON_PID"
  echo "Looking for logs..."

  # Try to find logs in standard locations
  if [ -f "/tmp/nodemon.log" ]; then
    tail -f /tmp/nodemon.log
  else
    echo "Try running this in the terminal where the server is running:"
    echo "Or restart the server with logging:"
    echo ""
    echo "cd /home/eivind/repos/covibes/server"
    echo "npm run dev 2>&1 | tee server.log"
    echo ""
    echo "Then run: tail -f /home/eivind/repos/covibes/server/server.log"
  fi
fi