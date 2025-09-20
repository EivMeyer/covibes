# Streaming Integration Guide

## Step 1: Compile & Test Streaming Manager

```bash
# Compile the new streaming manager
cd /home/eivind/repos/covibes/server
npm run build

# Test it works
node test-streaming.js
```

## Step 2: Update ChatPtyManager to Use Streaming

Replace the `executeChatCommand` method in `chat-pty-manager.ts`:

```typescript
// Add import at top
import { StreamingChatManager } from './streaming-chat-manager';

// Add to class
private streamingManager = new StreamingChatManager();

// Replace executeChatCommand with:
private async executeChatCommand(session: ChatSession, data: string): Promise<void> {
  try {
    session.isWaitingForResponse = true;

    // Set up streaming event handlers
    this.streamingManager.once('stream-start', (agentId) => {
      this.emit('chat-stream-start', agentId);
    });

    this.streamingManager.on('stream-chunk', (agentId, chunk) => {
      if (agentId === session.agentId) {
        this.emit('chat-stream-chunk', agentId, chunk);
      }
    });

    this.streamingManager.once('stream-complete', async (agentId, data) => {
      if (agentId === session.agentId) {
        // Store session ID
        session.claudeSessionId = data.sessionId;
        session.conversationStarted = true;

        // Emit complete response
        this.emit('chat-response', agentId, data.fullContent);

        // Store in history
        await this.storeTerminalHistory(agentId, data.fullContent, 'output');
      }
      session.isWaitingForResponse = false;
    });

    this.streamingManager.once('stream-error', (agentId, error) => {
      if (agentId === session.agentId) {
        this.emit('chat-error', agentId, error);
      }
      session.isWaitingForResponse = false;
    });

    // Start the stream
    await this.streamingManager.startStream(
      session.agentId,
      data,
      session.claudeSessionId,
      session.metadata?.workspaceDir || this.WORKSPACE_BASE
    );

  } catch (error) {
    session.isWaitingForResponse = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.emit('chat-error', session.agentId, errorMsg);
  }
}
```

## Step 3: Add WebSocket Events in server.ts

```typescript
// Add to global chat response listeners (around line 3232)
terminalManagerFactory.on('chat-stream-start', (agentId: string) => {
  console.log(`📡 Stream started for agent ${agentId}`);

  // Get agent info and emit to team
  prisma.agents.findUnique({
    where: { id: agentId }
  }).then(agent => {
    if (agent) {
      io.to(agent.teamId).emit('agent_chat_stream_start', {
        agentId,
        timestamp: new Date().toISOString()
      });
    }
  });
});

terminalManagerFactory.on('chat-stream-chunk', (agentId: string, chunk: any) => {
  // Get agent info and emit chunk to team
  prisma.agents.findUnique({
    where: { id: agentId }
  }).then(agent => {
    if (agent) {
      io.to(agent.teamId).emit('agent_chat_stream_chunk', {
        agentId,
        ...chunk
      });
    }
  });
});
```

## Step 4: Update Frontend AgentChatTile.tsx

```typescript
// Add streaming state
const [streamingContent, setStreamingContent] = useState<string>('');
const [isStreaming, setIsStreaming] = useState(false);

// Add streaming event handlers
useEffect(() => {
  if (!socket || !currentAgentId) return;

  const handleStreamStart = (data: any) => {
    if (data.agentId === currentAgentId) {
      setIsStreaming(true);
      setStreamingContent('');
    }
  };

  const handleStreamChunk = (data: any) => {
    if (data.agentId === currentAgentId) {
      setStreamingContent(prev => prev + (data.content || ''));
    }
  };

  const handleStreamComplete = (data: any) => {
    if (data.agentId === currentAgentId) {
      // Add complete message to history
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
        agentId: currentAgentId
      }]);

      setStreamingContent('');
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

  socket.on('agent_chat_stream_start', handleStreamStart);
  socket.on('agent_chat_stream_chunk', handleStreamChunk);
  socket.on('agent_chat_response', handleStreamComplete);

  return () => {
    socket.off('agent_chat_stream_start', handleStreamStart);
    socket.off('agent_chat_stream_chunk', handleStreamChunk);
    socket.off('agent_chat_response', handleStreamComplete);
  };
}, [socket, currentAgentId, streamingContent]);

// Update the render to show streaming content
{isStreaming && (
  <div className="message assistant">
    <div className="typing-indicator">
      {streamingContent}
      <span className="cursor">▊</span>
    </div>
  </div>
)}
```

## Step 5: Add CSS for Smooth Streaming

```css
.typing-indicator {
  animation: fadeIn 0.3s ease-in;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Testing the Integration

1. Rebuild server: `npm run build`
2. Restart server and frontend
3. Spawn a chat agent
4. Send a message
5. Watch the response stream in character by character!

## Rollback Plan

If streaming causes issues, you can quickly revert:
1. Keep the original `executeClaudeCommand` method
2. Add a feature flag: `ENABLE_STREAMING=true`
3. Switch between streaming and non-streaming based on flag