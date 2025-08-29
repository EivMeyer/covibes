# Carriage Return Handling Fix for Observer Terminals

## Problem
Observer mode terminals in ColabVibe were not properly handling carriage returns (`\r`), causing progress bars, spinners, and other ANSI-based animations to appear on multiple lines instead of updating in place.

## Root Cause
The issue was caused by the terminal persistence layer (tmux) interfering with ANSI escape sequences. Tmux's terminal emulation layer was intercepting and modifying the sequences, preventing proper carriage return handling.

## Solution
Created a new terminal manager using GNU Screen as an alternative to tmux. Screen provides better ANSI escape sequence passthrough while still maintaining persistent sessions.

### Key Changes

1. **Created ScreenPtyManager** (`server/src/services/screen-pty-manager.ts`)
   - Alternative to TmuxPtyManager
   - Uses GNU Screen for persistent sessions
   - Passes through ANSI sequences more faithfully

2. **Updated Terminal Factory** (`server/src/services/terminal-manager-factory.ts`)
   - Added support for 'screen' isolation mode
   - Routes to ScreenPtyManager when screen mode is selected

3. **Fixed Terminal Component** (`client/src/components/features/agents/SimpleTerminal.tsx`)
   - Removed forced `isReadOnly = false` bug
   - Simplified data handling to match working demo pattern

4. **Updated TerminalManager** (`client/src/services/TerminalManager.ts`)
   - Uses `disableStdin: isReadOnly` for proper read-only terminals
   - Removed explicit `convertEol` setting to use xterm defaults

## Installation Requirements

### Option 1: Use GNU Screen (Recommended for Persistent Sessions)
```bash
# Install GNU Screen
sudo apt-get update
sudo apt-get install -y screen

# Update agents route default isolation to 'screen'
# In server/src/routes/agents.ts, change:
terminalIsolation: z.enum(['none', 'docker', 'tmux', 'screen']).optional().default('screen')
```

### Option 2: Use Direct PTY (No Persistence)
The system currently defaults to 'none' isolation mode which uses direct PTY processes. This works perfectly for ANSI sequences but doesn't provide session persistence.

## Testing
A test script is available at `tests/test-carriage-return-processing.js` to verify carriage return handling.

## Technical Details

### Why Screen Works Better Than Tmux
- **Tmux**: Has its own terminal emulation layer that modifies ANSI sequences
- **Screen**: More transparent passthrough of terminal sequences
- **Direct PTY**: Best for ANSI sequences but no persistence

### ANSI Sequences Affected
- `\r` - Carriage return (move cursor to beginning of line)
- `\x1b[K` - Clear to end of line
- `\x1b[2K` - Clear entire line
- `\x1b[A` - Move cursor up
- `\x1b[B` - Move cursor down

## Demo
A minimal working demo is available in the `xterm-stream/` directory that demonstrates proper carriage return handling with xterm.js.