#!/bin/bash

echo "================================"
echo "Simple Chat Agent Test"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Login
echo -e "${YELLOW}Step 1: Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -oP '"token":"\K[^"]+')

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✅ Logged in successfully${NC}"
else
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

# 2. Spawn chat agent
echo -e "\n${YELLOW}Step 2: Spawn chat agent${NC}"
SPAWN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/agents/spawn \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "",
    "mode": "chat",
    "terminalIsolation": "none",
    "agentType": "claude"
  }')

AGENT_ID=$(echo "$SPAWN_RESPONSE" | grep -oP '"id":"\K[^"]+' | head -1)

if [ -n "$AGENT_ID" ]; then
  echo -e "${GREEN}✅ Agent spawned: $AGENT_ID${NC}"
else
  echo -e "${RED}❌ Failed to spawn agent${NC}"
  echo "Response: $SPAWN_RESPONSE"
  exit 1
fi

# 3. Send message
echo -e "\n${YELLOW}Step 3: Send test message${NC}"
echo "Message: 'Please respond: Test successful'"

INPUT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/agents/${AGENT_ID}/input \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": "Please respond: Test successful"}')

echo "Response: $INPUT_RESPONSE"

# 4. Wait for Claude
echo -e "\n${YELLOW}Step 4: Waiting for Claude response (7 seconds)...${NC}"
sleep 7

# 5. Clean up
echo -e "\n${YELLOW}Step 5: Cleanup${NC}"
curl -s -X DELETE http://localhost:3001/api/agents/${AGENT_ID} \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✅ Agent cleaned up${NC}"

echo -e "\n================================"
echo -e "${GREEN}Test Complete!${NC}"
echo ""
echo "Check the server logs for:"
echo "  💬 Chat response received for $AGENT_ID"
echo "  🆔 Session ID stored: <session-id>"
echo ""
echo "If you see these, the chat mode is working!"
echo "================================"