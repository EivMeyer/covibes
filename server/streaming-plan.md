# Claude Chat Streaming Implementation Plan

## Current State
- Using `--output-format json` which waits for complete response
- Single emission of full message
- No real-time feedback during generation

## Target State
- Use `--output-format stream-json` for real-time streaming
- Emit partial messages as they arrive
- Character-by-character typing effect in UI
- Maintain session continuity

## Implementation Phases

### Phase 1: Backend Streaming (ChatPtyManager)
```typescript
// Replace executeClaudeCommand with streamClaudeCommand
private streamClaudeCommand(
  command: string,
  args: string[],
  env: Record<string, string>,
  workspaceDir: string,
  onChunk: (chunk: StreamEvent) => void
): Promise<ClaudeResponse>
```

Key changes:
1. Use `--output-format stream-json` instead of `json`
2. Add `--include-partial-messages` for character-by-character updates
3. Parse NDJSON stream (newline-delimited JSON)
4. Emit chunks via callback as they arrive

### Phase 2: WebSocket Event Stream
New events:
- `agent_chat_stream_start` - Indicates streaming began
- `agent_chat_stream_chunk` - Partial message content
- `agent_chat_stream_end` - Complete message with metadata
- `agent_chat_stream_error` - Stream-specific errors

Event payload:
```typescript
interface StreamChunk {
  agentId: string;
  type: 'partial' | 'complete' | 'error';
  content?: string;        // Incremental content
  fullContent?: string;    // Full message so far
  sessionId?: string;      // For complete events
  metadata?: {
    duration?: number;
    cost?: number;
    tokens?: number;
  };
}
```

### Phase 3: Frontend Streaming UI
```typescript
// AgentChatTile.tsx changes
const [streamingMessage, setStreamingMessage] = useState<string>('');
const [isStreaming, setIsStreaming] = useState(false);

socket.on('agent_chat_stream_chunk', (chunk: StreamChunk) => {
  if (chunk.agentId === currentAgentId) {
    setStreamingMessage(prev => prev + chunk.content);
  }
});
```

UI Features:
- Typing indicator during stream
- Character-by-character rendering
- Smooth text animation
- Cancel stream ability

### Phase 4: Session Management
Challenge: Stream events don't include session_id until complete
Solution:
1. Start stream without --resume for first message
2. Capture session_id from completion event
3. Use --resume for subsequent messages

### Phase 5: Error Handling & Edge Cases
- Network interruptions during stream
- Partial JSON parse errors
- Stream timeout handling
- Graceful fallback to non-streaming

## Technical Implementation Details

### NDJSON Parser
```typescript
const parseNDJSON = (buffer: string): StreamEvent[] => {
  return buffer
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn('Invalid JSON line:', line);
        return null;
      }
    })
    .filter(Boolean);
};
```

### Stream Event Types (from Claude)
```typescript
interface ClaudeStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  message?: { id: string; role: string; };
  delta?: { text: string; };
  usage?: { input_tokens: number; output_tokens: number; };
}
```

### Buffer Management
- Accumulate partial lines until newline
- Handle multi-byte UTF-8 characters
- Clear buffer on stream end

## Migration Strategy
1. Implement streaming alongside existing JSON mode
2. Add feature flag for streaming
3. Test with subset of users
4. Gradual rollout
5. Remove old JSON mode

## Performance Considerations
- Reduce WebSocket message frequency (batch chunks)
- Debounce UI updates for smooth rendering
- Implement backpressure for slow clients

## Testing Plan
1. Unit tests for NDJSON parser
2. Integration tests for stream handling
3. E2E tests for full streaming flow
4. Load testing with multiple concurrent streams
5. Network failure simulation

## Success Metrics
- Time to first character < 500ms
- Smooth character rendering (60fps)
- No message loss or corruption
- Session continuity maintained
- Graceful error recovery