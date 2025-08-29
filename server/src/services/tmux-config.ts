/**
 * TMUX Configuration for proper ANSI escape sequence handling
 */

export const TMUX_CONFIG = {
  // Terminal type that supports all ANSI sequences
  terminalOverrides: [
    'xterm*:Tc',  // True color support
    'xterm*:smcup@:rmcup@',  // Disable alternate screen
    'xterm*:Ms=\\E]52;%p1%s;%p2%s\\007',  // Clipboard
  ].join(','),
  
  // Options for better ANSI handling
  options: [
    'set -g default-terminal "xterm-256color"',
    'set -g terminal-overrides "xterm*:Tc"',
    'set -g escape-time 0',  // No delay for escape sequences
    'set -g focus-events on',  // Pass through focus events
    'set -g mouse on',  // Mouse support
    'set -g history-limit 50000',  // Large scrollback
    'set -g remain-on-exit off',  // Exit when command finishes
    'setw -g aggressive-resize on',  // Resize to smallest client
    'setw -g automatic-rename off',  // Don't rename windows
    'set -g set-titles on',  // Set terminal title
    'set -g set-titles-string "#S"',  // Title format
  ],
  
  // Create config file content
  generateConfig(): string {
    return this.options.join('\n');
  }
}