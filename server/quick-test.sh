#!/bin/bash

echo "🧪 Quick Chat Agent Test"
echo "========================"

# Login
echo "1. Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}' | \
  grep -oP '"token":"\K[^"]+')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to login. Is the server running on port 3001?"
  exit 1
fi

echo "✅ Logged in"

# Spawn chat agent
echo -e "\n2. Spawning chat agent..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/agents/spawn \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "",
    "mode": "chat",
    "terminalIsolation": "none",
    "agentType": "claude"
  }')

AGENT_ID=$(echo "$RESPONSE" | grep -oP '"id":"\K[^"]+' | head -1)

if [ -z "$AGENT_ID" ]; then
  echo "❌ Failed to spawn agent"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Agent spawned: $AGENT_ID"

# Send test message
echo -e "\n3. Sending test message..."
curl -s -X POST http://localhost:3001/api/agents/${AGENT_ID}/input \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": "Say exactly: Chat system working perfectly"}' > /dev/null

echo "⏳ Waiting 5 seconds for response..."
sleep 5

# Check agent output
echo -e "\n4. Checking response..."
OUTPUT=$(curl -s -X GET http://localhost:3001/api/agents/list \
  -H "Authorization: Bearer $TOKEN")

echo "$OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
agents = data.get('agents', [])
for agent in agents:
    if agent['id'] == '$AGENT_ID':
        print('📝 Agent output:', agent.get('output', 'No output yet'))
        break
else:
    print('Agent not found in list')
"

# Clean up
echo -e "\n5. Cleaning up..."
curl -s -X DELETE http://localhost:3001/api/agents/${AGENT_ID} \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Test complete!"