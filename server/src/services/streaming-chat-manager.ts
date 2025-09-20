import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

interface StreamEvent {
  type: 'stream_event' | 'system' | 'assistant' | 'result' | 'error';
  event?: {
    type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
    message?: {
      id: string;
      role: string;
      model?: string;
    };
    delta?: {
      text?: string;
      type?: string;
    };
    content_block?: {
      type: string;
      text?: string;
    };
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  message?: {
    id: string;
    role: string;
    content: Array<{ type: string; text: string }>;
  };
  subtype?: string;
  session_id?: string;
  result?: string;
  error?: {
    type: string;
    message: string;
  };
}

interface StreamingSession {
  agentId: string;
  sessionId: string | undefined;
  conversationStarted: boolean;
  currentMessage: string;
  isStreaming: boolean;
  claudeProcess: ChildProcess | undefined;
  isInToolUse?: boolean;
}

export class StreamingChatManager extends EventEmitter {
  private sessions = new Map<string, StreamingSession>();
  private buffers = new Map<string, string>();

  async startStream(
    agentId: string,
    message: string,
    sessionId?: string,
    workspaceDir: string = process.cwd(),
    systemPrompt?: string
  ): Promise<void> {
    let session = this.sessions.get(agentId);

    if (!session) {
      // Generate a UUID for the session if not provided
      const uuid = sessionId || randomUUID();
      session = {
        agentId,
        sessionId: uuid,
        conversationStarted: false,
        currentMessage: '',
        isStreaming: false,
        claudeProcess: undefined
      };
      console.log(`🆔 Created new session with UUID: ${uuid}`);
    }

    if (session.isStreaming) {
      throw new Error('Stream already in progress');
    }

    session.isStreaming = true;
    session.currentMessage = '';
    this.sessions.set(agentId, session);

    // Build command arguments
    const args: string[] = [];

    // Use streaming JSON for real-time updates
    const useStreaming = true;

    if (useStreaming) {
      // Use streaming output with verbose for detailed events
      args.push('--output-format', 'stream-json');
      args.push('--include-partial-messages');
      args.push('--verbose');  // Required for streaming with Claude CLI
    } else {
      // Use regular output format for simpler handling
      console.log(`📝 [CLAUDE] Using simple output format for ${agentId}`);
    }

    args.push('--dangerously-skip-permissions');

    // Use session ID for conversation continuity
    if (session.conversationStarted && session.sessionId) {
      // Resume existing conversation
      args.push('--resume', session.sessionId);
      console.log(`🔄 Resuming streaming session ${session.sessionId}`);
    } else if (session.sessionId) {
      // Start new conversation with explicit session ID
      args.push('--session-id', session.sessionId);
      console.log(`🆕 Starting new streaming conversation with session ID ${session.sessionId}`);

      // Add system prompt for first message if provided
      if (systemPrompt) {
        args.push('--append-system-prompt', systemPrompt);
      }
    }

    // Add the message
    args.push(message);

    // Spawn Claude process
    const claudeProcess = spawn('claude', args, {
      cwd: workspaceDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    session.claudeProcess = claudeProcess;

    // Handle stdout (streaming responses)
    let hasReceivedData = false;
    claudeProcess.stdout.on('data', (chunk) => {
      hasReceivedData = true;
      console.log(`📥 [CLAUDE-STDOUT] Received chunk for ${agentId}:`, chunk.toString().substring(0, 200));
      this.handleStreamChunk(agentId, chunk.toString());
    });

    // Handle stderr (errors and debug info)
    let stderrOutput = '';
    claudeProcess.stderr.on('data', (chunk) => {
      const output = chunk.toString();
      stderrOutput += output;
      console.error(`⚠️ [CLAUDE-STDERR] ${agentId}:`, output);

      // Check for common errors
      if (output.includes('command not found') || output.includes('not found')) {
        this.emit('stream-error', agentId, 'Claude CLI not found. Please install Claude CLI.');
        claudeProcess.kill();
      } else if (output.includes('error') || output.includes('Error')) {
        // Some errors might still allow the process to continue
        console.error(`❌ Claude error detected for ${agentId}:`, output);
      }
    });

    // Handle process exit
    claudeProcess.on('close', (code) => {
      session.isStreaming = false;

      if (code !== 0) {
        const errorMsg = `Claude exited with code ${code}. ${stderrOutput ? `Error: ${stderrOutput}` : ''}`;
        console.error(`❌ [CLAUDE-EXIT] ${agentId}: ${errorMsg}`);
        this.emit('stream-error', agentId, errorMsg);
      } else if (!hasReceivedData) {
        // Process succeeded but no data received - might be a format issue
        console.warn(`⚠️ [CLAUDE-NO-DATA] Process completed but no stdout data for ${agentId}`);

        // Try to use stderr as fallback if it contains response
        if (stderrOutput && !stderrOutput.includes('error')) {
          // Sometimes claude outputs to stderr instead
          console.log(`📥 [CLAUDE-STDERR-FALLBACK] Using stderr as response for ${agentId}`);
          this.emit('stream-complete', agentId, {
            type: 'complete',
            fullContent: stderrOutput,
            sessionId: session.sessionId
          });
        } else {
          this.emit('stream-error', agentId, 'No response received from Claude');
        }
      } else if (hasReceivedData && session.currentMessage) {
        // Plain text mode - emit the complete message
        console.log(`✅ [CLAUDE-COMPLETE] Emitting complete message for ${agentId}: ${session.currentMessage.substring(0, 100)}...`);
        session.conversationStarted = true;

        this.emit('stream-complete', agentId, {
          type: 'complete',
          fullContent: session.currentMessage,
          sessionId: session.sessionId
        });
      }

      // Clear buffer
      this.buffers.delete(agentId);
    });

    // Emit stream start
    this.emit('stream-start', agentId);
  }

  private handleStreamChunk(agentId: string, chunk: string) {
    const session = this.sessions.get(agentId);
    if (!session) return;

    // Check if this looks like JSON streaming data
    if (chunk.includes('"type"') && chunk.includes('{')) {
      // Handle as JSON stream
      // Append to buffer
      let buffer = this.buffers.get(agentId) || '';
      buffer += chunk;

      // Process complete lines
      const lines = buffer.split('\n');

      // Keep last incomplete line in buffer
      this.buffers.set(agentId, lines.pop() || '');

      // Parse each complete line
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event: StreamEvent = JSON.parse(line);
          this.processStreamEvent(agentId, event);
        } catch (e) {
          console.warn(`⚠️ Failed to parse stream JSON for ${agentId}:`, line);
        }
      }
    } else {
      // We should NEVER be here if streaming is working properly
      // Log this as an error case
      console.error(`⚠️ [STREAMING] Non-JSON chunk received for ${agentId} - this shouldn't happen with stream-json format:`, chunk.substring(0, 100));

      // Don't accumulate non-JSON chunks - they're likely tool outputs being printed directly
      // The actual chat response will come through the JSON events
    }
  }

  private processStreamEvent(agentId: string, event: StreamEvent) {
    const session = this.sessions.get(agentId);
    if (!session) return;

    // Handle Claude Code streaming format
    if (event.type === 'stream_event' && event.event) {
      switch (event.event.type) {
        case 'message_start':
          console.log(`💬 Stream started for ${agentId}`);
          // Reset current message for new assistant message
          session.currentMessage = '';
          session.isInToolUse = false;
          // Don't store message ID as session ID - we get UUID from system event
          break;

        case 'content_block_start':
          // Check if this is a tool use block - if so, skip it
          if (event.event.content_block?.type === 'tool_use') {
            console.log(`🔧 Skipping tool use block for ${agentId}`);
            session.isInToolUse = true;

            // Emit tool use event for frontend
            const toolName = (event.event.content_block as any).name || 'Tool';
            console.log(`🔧 Emitting tool use event for ${agentId}: ${toolName}`);
            this.emit('tool-use', agentId, { tool: toolName });
          } else {
            session.isInToolUse = false;
          }
          break;

        case 'content_block_delta':
          // Only accumulate text deltas that are NOT from tool use
          if (event.event.delta?.text && !session.isInToolUse) {
            // Accumulate message
            session.currentMessage += event.event.delta.text;

            // Emit partial update
            this.emit('stream-chunk', agentId, {
              type: 'partial',
              content: event.event.delta.text,
              fullContent: session.currentMessage
            });
          } else if (event.event.delta?.type === 'input_json_delta') {
            // This is tool input - skip it
            console.log(`🔧 Skipping tool input delta for ${agentId}`);
          }
          break;

        case 'content_block_stop':
          // Reset tool use flag when block ends
          session.isInToolUse = false;
          break;

        case 'message_stop':
          console.log(`✅ Stream completed for ${agentId}`);
          session.conversationStarted = true;
          session.isInToolUse = false;

          // Don't emit here - wait for the result event which has the full message
          break;
      }
    } else if (event.type === 'system' && event.session_id) {
      // Store UUID session ID from system init - this is what we need for resuming
      if (!session.sessionId || !session.conversationStarted) {
        session.sessionId = event.session_id;
        console.log(`🆔 Got UUID session ID from system init: ${event.session_id}`);
      }
    } else if (event.type === 'assistant' && event.message) {
      // Assistant message with full content - only take text blocks, not tool use blocks
      const fullText = event.message.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      if (fullText) {
        // This should be the actual chat response without tool outputs
        session.currentMessage = fullText;
      }
    } else if (event.type === 'result' && event.result) {
      // Final result with complete message
      console.log(`✅ Got final result for ${agentId}: ${event.result.substring(0, 100)}...`);
      session.conversationStarted = true;

      // Emit complete message - ensure we pass the UUID session ID
      this.emit('stream-complete', agentId, {
        type: 'complete',
        fullContent: event.result,
        sessionId: session.sessionId || event.session_id // Use the UUID from system init
      });
    } else if (event.type === 'error') {
      console.error(`❌ Stream error for ${agentId}:`, event.error);
      this.emit('stream-error', agentId, event.error?.message || 'Unknown error');
    }
  }

  cancelStream(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session || !session.isStreaming) {
      return false;
    }

    // Kill the Claude process
    if (session.claudeProcess) {
      session.claudeProcess.kill('SIGTERM');
      session.isStreaming = false;
      this.emit('stream-cancelled', agentId);
      return true;
    }

    return false;
  }

  getSession(agentId: string): StreamingSession | undefined {
    return this.sessions.get(agentId);
  }

  clearSession(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session?.claudeProcess) {
      session.claudeProcess.kill('SIGTERM');
    }
    this.sessions.delete(agentId);
    this.buffers.delete(agentId);
  }
}