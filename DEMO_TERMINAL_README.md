# Demo Terminal - Clean Implementation

A fresh, optimized xterm.js terminal implementation designed specifically for Claude Code CLI output.

## Access Points

1. **Demo List Page**: `/demo-list`
   - Shows all active agents
   - Click any agent to open its terminal
   - Provides instructions and status indicators

2. **Direct Terminal**: `/demo?agentId=<agent-id>`
   - Opens terminal connected to specific agent
   - Full-screen experience
   - Real-time output streaming

3. **Standalone Terminal**: `/demo`
   - Terminal without agent connection
   - For testing terminal features

## Key Features

### Performance Optimizations
- **Canvas Renderer**: Uses xterm's canvas addon for better performance
- **Smart Buffering**: Batches output with requestAnimationFrame
- **Deduplication**: Prevents duplicate data from being written
- **Large Scrollback**: 10,000 lines for extensive CLI output

### Resize Handling
- **Fit Addon**: Automatically fits terminal to container
- **ResizeObserver**: Responsive to window/panel resizing
- **Debounced Resizing**: Prevents flicker during resize operations
- **Server Sync**: Notifies server of dimension changes

### Visual Design
- **Optimized Theme**: High contrast colors for readability
- **Modern Font Stack**: Cascadia Code, JetBrains Mono, Fira Code
- **Status Indicators**: Connection state, scrollback size, renderer type
- **Clean Layout**: Minimal chrome, maximum terminal space

## Architecture

### Data Flow
```
Agent Process → Server (PTY) → WebSocket → Client Buffer → requestAnimationFrame → xterm.write()
```

### Key Components
- `DemoTerminal.tsx`: Main terminal component with optimizations
- `DemoList.tsx`: Agent listing and navigation page
- Buffer management with refs to prevent React re-renders
- WebSocket event handlers with proper cleanup

## Technical Details

### Terminal Configuration
```typescript
{
  rendererType: 'canvas',        // Better performance
  scrollback: 10000,              // Large buffer
  fastScrollModifier: 'shift',    // Shift+scroll for fast scrolling
  cursorBlink: true,              // Visual feedback
  convertEol: true,               // Handle line endings
  disableStdin: true,             // Read-only for observers
}
```

### Buffer Processing
- Accumulates incoming data in array buffer
- Processes with 10ms debounce
- Uses requestAnimationFrame for smooth rendering
- Handles re-entrant calls safely

### Resize Strategy
- ResizeObserver monitors container dimensions
- 100ms debounce on resize events
- Fit addon recalculates cols/rows
- Emits dimension updates to server

## Testing

### Manual Testing Steps
1. Navigate to `/demo-list`
2. Spawn a test agent from main dashboard
3. Click agent to open terminal
4. Test:
   - Output streaming
   - Window resizing
   - Scrolling (normal and fast with Shift)
   - Long-running command output
   - ANSI color codes
   - Cursor positioning

### Known Improvements
- Canvas renderer deprecated warning (works fine, upgrade to @xterm/addon-canvas later)
- Could add search functionality
- Could add copy/paste enhancements
- Could add terminal recording/replay

## Comparison to Previous Implementation

### Previous Issues
- Random blinking
- Repeated/stale output
- Resize sensitivity
- Performance with large output

### New Solutions
- Canvas rendering (no blinking)
- Buffer deduplication (no repeats)
- Debounced resize (stable resizing)
- requestAnimationFrame batching (smooth output)

## Usage in Production

This is a demo/experimental implementation. To integrate:

1. Test thoroughly with real agent output
2. Monitor performance with large datasets
3. Consider adding error recovery
4. Add telemetry for debugging
5. Gradually migrate from existing terminal components

## Next Steps

1. Test with various Claude Code CLI commands
2. Monitor memory usage with long-running agents
3. Add WebGL renderer option for even better performance
4. Implement search and selection features
5. Add terminal multiplexing for multiple agents