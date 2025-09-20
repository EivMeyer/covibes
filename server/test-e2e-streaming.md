# End-to-End Streaming Test Guide

## Test Steps

### 1. Rebuild the Server
```bash
cd server
npm run build
```

### 2. Restart the Server
```bash
# Kill existing server if needed
pkill -f "npm run dev"

# Start server
npm run dev
```

### 3. Start the Frontend (if not already running)
```bash
cd ../client
npm run dev
```

### 4. Test the Streaming Experience

1. **Open the application** in your browser
2. **Spawn a new Chat Agent**:
   - Click "Spawn Agent" button
   - Select "Chat Mode"
   - Enter a task description
   - Click "Spawn"

3. **Open the Agent Chat tile**:
   - The Agent Chat tile should open automatically
   - If not, add it manually from the workspace

4. **Send a message that will generate a longer response**:
   - Type: "Explain how JavaScript promises work with examples"
   - Press Enter

5. **Observe the streaming behavior**:
   - You should see "🚀 Stream started" in the browser console
   - The response should appear character by character
   - A blue pulsing cursor should be visible while streaming
   - The message should auto-scroll as content arrives
   - When complete, the cursor disappears

## Expected Console Output

### Browser Console:
```
🚀 Stream started for agent: agent-xxx
💬 Chat response received (full message after streaming)
```

### Server Console:
```
📡 [STREAM-START] Stream started for agent agent-xxx
🆕 Starting new streaming conversation
✅ Stream completed for agent agent-xxx
```

## Troubleshooting

### If streaming doesn't work:

1. **Check Claude CLI version**:
   ```bash
   claude --version
   ```
   Make sure it's recent enough to support `--output-format stream-json`

2. **Test streaming directly**:
   ```bash
   claude --output-format stream-json --verbose "Hello"
   ```
   You should see NDJSON events stream to stdout

3. **Check server logs for errors**:
   - Look for any error messages related to streaming
   - Check if the Claude process is spawning correctly

4. **Verify WebSocket events**:
   - Open browser DevTools > Network > WS tab
   - Look for `agent_chat_stream_start` and `agent_chat_stream_chunk` events

## Success Criteria

✅ Response appears character by character (not all at once)
✅ Blue pulsing cursor visible during streaming
✅ Auto-scrolling works as content arrives
✅ No errors in console
✅ Session continuity works (follow-up messages maintain context)

## Demo Messages to Test

1. **Short response**: "What is 2+2?"
2. **Medium response**: "List 5 benefits of TypeScript"
3. **Long response**: "Explain the concept of closure in JavaScript with detailed examples"
4. **Follow-up**: "Can you make that example shorter?"

The streaming should work smoothly for all message lengths, with real-time character-by-character rendering.