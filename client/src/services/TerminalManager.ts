import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'

interface TerminalInstance {
  terminal: Terminal
  agentId: string
  connected: boolean
  disposed: boolean
  socketHandlers: Map<string, Function>
  fitAddon?: FitAddon
  fontSize: number
}

/**
 * Singleton manager for terminal instances to prevent duplicates
 * and ensure proper cleanup
 */
class TerminalManager {
  private static instance: TerminalManager
  private terminals: Map<string, TerminalInstance> = new Map()
  private activeConnections: Set<string> = new Set()

  private constructor() {}

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager()
    }
    return TerminalManager.instance
  }

  /**
   * Get or create a terminal instance for an agent
   */
  getOrCreateTerminal(
    agentId: string,
    container: HTMLElement,
    fontSize: number = 13,
    isReadOnly: boolean = false
  ): Terminal {
    // Check if we already have a terminal for this agent
    const existing = this.terminals.get(agentId)
    if (existing && !existing.disposed) {
      // DISPOSE THE OLD TERMINAL COMPLETELY to prevent event listener accumulation
      // This is critical for mobile where switching views is common
      if (existing.dataHandler) {
        existing.dataHandler.dispose()
      }
      existing.terminal.dispose()
      existing.fitAddon?.dispose()
      existing.socketHandlers.clear()
      this.terminals.delete(agentId)
      this.activeConnections.delete(agentId)

      // Now create a fresh terminal below
    }

    // Create new terminal - let xterm.js and FitAddon handle all sizing
    
    const terminal = new Terminal({
      cursorBlink: true, // Always blink cursor for consistent feel
      cursorStyle: 'block', // Keep consistent cursor style  
      disableStdin: isReadOnly, // Disable input for read-only terminals (like the working demo)
      fontSize: fontSize,
      // Force proper line handling
      cols: 80, // Set initial size to ensure proper buffer initialization
      rows: 24,
      fontFamily:
        '"SFMono-Regular", "Monaco", "Inconsolata", "Roboto Mono", "Consolas", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#f48771',
        green: '#90a959',
        yellow: '#f4bf75',
        blue: '#6a9fb5',
        magenta: '#aa759f',
        cyan: '#75b5aa',
        white: '#d4d4d4',
        brightBlack: '#5a5a5a',
        brightRed: '#f48771',
        brightGreen: '#90a959',
        brightYellow: '#f4bf75',
        brightBlue: '#6a9fb5',
        brightMagenta: '#aa759f',
        brightCyan: '#75b5aa',
        brightWhite: '#ffffff',
      },
      scrollback: 5000,
      // Don't set convertEol - let xterm use its default like the working demo
      allowTransparency: false,
      altClickMovesCursor: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{},./;:',
      smoothScrollDuration: 0,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      allowProposedApi: true,
      // DON'T set cols/rows - let FitAddon handle sizing completely
    })

    // Open terminal in container
    container.innerHTML = '' // Clear any existing content
    terminal.open(container)
    
    // Removed terminal-readonly class - observer terminals should look identical
    
    // Create and load fit addon
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    
    // Fit immediately to get initial sizing right
    try {
      fitAddon.fit()
    } catch (e) {
      console.warn('[TerminalManager] Initial fit failed:', e)
    }
    
    // Fit again after DOM settles
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch (e) {
        console.warn('[TerminalManager] Frame fit failed:', e)
      }
    })
    
    // And once more after a short delay to catch any layout changes
    setTimeout(() => {
      try {
        fitAddon.fit()
        const containerWidth = container.offsetWidth
        const containerHeight = container.offsetHeight
      } catch (error) {
        console.warn(`[TerminalManager] Final fit failed:`, error)
      }
    }, 100)

    // Store the instance
    this.terminals.set(agentId, {
      terminal,
      agentId,
      connected: false,
      disposed: false,
      socketHandlers: new Map(),
      fitAddon,
      fontSize,
    })

    return terminal
  }

  /**
   * Get terminal data including fitAddon
   */
  getTerminalData(agentId: string): TerminalInstance | undefined {
    return this.terminals.get(agentId)
  }

  /**
   * Get data handler for a terminal
   */
  getDataHandler(agentId: string): any {
    const instance = this.terminals.get(agentId)
    return instance?.dataHandler
  }

  /**
   * Set data handler for a terminal
   */
  setDataHandler(agentId: string, handler: any): void {
    const instance = this.terminals.get(agentId)
    if (instance) {
      // Dispose existing handler if any
      if (instance.dataHandler) {
        instance.dataHandler.dispose()
      }
      instance.dataHandler = handler
    }
  }

  /**
   * Clear data handler for a terminal
   */
  clearDataHandler(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance && instance.dataHandler) {
      instance.dataHandler.dispose()
      instance.dataHandler = null
    }
  }

  /**
   * Check if we're already connected to an agent
   */
  isConnected(agentId: string): boolean {
    return this.activeConnections.has(agentId)
  }

  /**
   * Mark an agent as connected
   */
  setConnected(agentId: string, connected: boolean): void {
    if (connected) {
      this.activeConnections.add(agentId)
      // Don't clear terminal on connection - let SSH output show
      // this.clearTerminal(agentId)
    } else {
      this.activeConnections.delete(agentId)
    }
    
    const instance = this.terminals.get(agentId)
    if (instance) {
      instance.connected = connected
    }
  }

  /**
   * Clear terminal screen and scrollback
   */
  clearTerminal(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance && !instance.disposed) {
      try {
        // Clear the terminal screen
        instance.terminal.clear()
        // Reset cursor to top
        instance.terminal.write('\x1b[H')
        // Clear scrollback buffer
        instance.terminal.scrollToTop()
      } catch (e) {
        console.warn(`[TerminalManager] Error clearing terminal:`, e)
      }
    }
  }

  /**
   * Reset terminal to clean state
   */
  resetTerminal(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance && !instance.disposed) {
      try {
        // Send reset escape sequence
        instance.terminal.write('\x1bc') // Full terminal reset
        instance.terminal.clear()
      } catch (e) {
        console.warn(`[TerminalManager] Error resetting terminal:`, e)
      }
    }
  }

  /**
   * Store socket handler for cleanup
   */
  addSocketHandler(agentId: string, event: string, handler: Function): void {
    const instance = this.terminals.get(agentId)
    if (instance) {
      instance.socketHandlers.set(event, handler)
    }
  }

  /**
   * Get stored socket handlers for an agent
   */
  getSocketHandlers(agentId: string): Map<string, Function> {
    return this.terminals.get(agentId)?.socketHandlers || new Map()
  }

  /**
   * Clear socket handlers for an agent
   */
  clearSocketHandlers(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance) {
      instance.socketHandlers.clear()
    }
  }

  /**
   * Update terminal font size
   */
  updateFontSize(agentId: string, fontSize: number): void {
    const instance = this.terminals.get(agentId)
    if (instance && !instance.disposed) {
      instance.fontSize = fontSize
      instance.terminal.options.fontSize = fontSize
      // Trigger a re-fit after font size change
      if (instance.fitAddon) {
        setTimeout(() => {
          instance.fitAddon?.fit()
        }, 0)
      }
    }
  }

  /**
   * Force terminal to resize (recovery mechanism)
   */
  forceResize(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance && !instance.disposed && instance.fitAddon) {
      try {
        
        // Simply call fit multiple times to ensure proper sizing
        instance.fitAddon.fit()
        
        // Call again in case first call didn't work
        setTimeout(() => {
          instance.fitAddon?.fit()
        }, 50)
        
        // And once more for good measure
        setTimeout(() => {
          instance.fitAddon?.fit()
          const cols = instance.terminal.cols
          const rows = instance.terminal.rows
        }, 100)
        
      } catch (error) {
        console.error(`[TerminalManager] Error during force resize for agent ${agentId}:`, error)
      }
    }
  }

  /**
   * Get current font size for a terminal
   */
  getFontSize(agentId: string): number {
    const instance = this.terminals.get(agentId)
    return instance?.fontSize || 13
  }

  /**
   * Dispose a terminal instance
   */
  disposeTerminal(agentId: string): void {
    const instance = this.terminals.get(agentId)
    if (instance && !instance.disposed) {
      
      try {
        instance.terminal.dispose()
        instance.disposed = true
      } catch (e) {
        console.warn(`[TerminalManager] Error disposing terminal:`, e)
      }
      
      this.terminals.delete(agentId)
      this.activeConnections.delete(agentId)
    }
  }

  /**
   * Dispose all terminals
   */
  disposeAll(): void {
    for (const [agentId] of this.terminals) {
      this.disposeTerminal(agentId)
    }
    this.terminals.clear()
    this.activeConnections.clear()
  }

  /**
   * Get terminal instance for an agent
   */
  getTerminal(agentId: string): Terminal | null {
    const instance = this.terminals.get(agentId)
    return instance && !instance.disposed ? instance.terminal : null
  }
}

export default TerminalManager.getInstance()