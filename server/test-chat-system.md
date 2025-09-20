# Testing Chat Agents in ColabVibe

## Quick Test via API

### 1. Start the servers (if not running)
```bash
cd server
npm run dev  # Backend on port 3001

# In another terminal
cd client
npm run dev  # Frontend on port 3000
```

### 2. Test with curl commands

```bash
# Login with demo user
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}' | \
  grep -oP '"token":"\K[^"]+')

echo "Token: $TOKEN"

# Spawn a chat agent
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
echo "Agent ID: $AGENT_ID"

# Send a message to the chat agent
curl -X POST http://localhost:3001/api/agents/${AGENT_ID}/input \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello! Please say: Chat is working"}'

# Wait and check the response
sleep 5

# List agents to see the output
curl -X GET http://localhost:3001/api/agents/list \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Test via Frontend UI

### 1. Open the app
Navigate to: http://localhost:3000

### 2. Login
- Email: `alice@demo.com`
- Password: `demo123`

### 3. Spawn a chat agent
- Look for "Spawn Agent" or "+" button
- Select mode: **Chat**
- Leave task empty or enter a greeting
- Click "Spawn"

### 4. Send messages
- Find the agent in your workspace
- Type messages in the input field
- You should get clean responses without terminal noise

## Test with WebSocket monitoring

Create this test file:

```javascript
// test-chat-live.js
import { io } from 'socket.io-client';

async function test() {
  // Login
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@demo.com',
      password: 'demo123'
    })
  });
  const { token, teamId } = await loginRes.json();

  // Connect WebSocket
  const socket = io('http://localhost:3001', {
    auth: { token },
    transports: ['websocket']
  });

  // Join team room
  socket.emit('join_team', { teamId, token });

  // Listen for chat responses
  socket.on('agent_chat_response', (data) => {
    console.log('💬 Chat Response:', data);
  });

  socket.on('agent-output', (data) => {
    console.log('📤 Agent Output:', data);
  });

  // Spawn agent
  const spawnRes = await fetch('http://localhost:3001/api/agents/spawn', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task: '',
      mode: 'chat',
      terminalIsolation: 'none'
    })
  });
  const { agent } = await spawnRes.json();

  // Send message
  await fetch(`http://localhost:3001/api/agents/${agent.id}/input`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: 'Say: "WebSocket test successful"'
    })
  });

  // Wait for response
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 10000);
}

test();
```

Run with: `node test-chat-live.js`

## What to Look For

### ✅ Success Signs:
- Clean text responses (no terminal codes like `\x1b[0m`)
- No command echoes (you don't see the `claude` command)
- Session IDs being tracked for conversation continuity
- Fast responses (~2-3 seconds)

### ❌ Failure Signs:
- Terminal noise in responses (ANSI codes, colors)
- Command echoes visible
- Responses wrapped in terminal prompts
- Very slow or hanging responses

## Check Server Logs

Watch the server console for:
```
💬 Sending chat message for <agent-id>
🆕 Starting new conversation
🆔 Session ID stored: <session-id>
✅ Chat response received for <agent-id> (2487ms)
🔄 Resuming conversation <session-id>  # On follow-up messages
```

## Test Conversation Continuity

Send multiple messages to the same agent:
1. "What's 2+2?"
2. "What was my previous question?"

The agent should remember the context if session management is working.

## Debugging

If responses aren't coming through:

1. Check Claude CLI works directly:
```bash
claude --print "Test" --output-format json --dangerously-skip-permissions
```

2. Check the server logs for errors
3. Verify the database is seeded: `npm run prisma:seed`
4. Check WebSocket connection in browser dev tools (Network tab)