#!/bin/bash

# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}' | \
  grep -oP '"token":"\K[^"]+')

echo "Checking agents..."

# List agents
curl -s http://localhost:3001/api/agents/list \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
agents = data.get('agents', [])
print(f'Found {len(agents)} agents:')
for a in agents:
    print(f\"  ID: {a['id']}\")
    print(f\"    Mode: {a.get('mode', 'NOT SET')}\")
    print(f\"    Isolation: {a.get('terminalIsolation', 'NOT SET')}\")
    print(f\"    Status: {a.get('status', 'unknown')}\")
    print()
"