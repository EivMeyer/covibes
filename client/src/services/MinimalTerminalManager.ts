import { Terminal } from 'xterm'

// MINIMAL terminal manager - just like the working demo
class MinimalTerminalManager {
  private static instance: MinimalTerminalManager
  private terminals: Map<string, Terminal> = new Map()

  static getInstance(): MinimalTerminalManager {
    if (!MinimalTerminalManager.instance) {
      MinimalTerminalManager.instance = new MinimalTerminalManager()
    }
    return MinimalTerminalManager.instance
  }

  getOrCreateTerminal(
    agentId: string,
    container: HTMLElement,
    isReadOnly: boolean = false
  ): Terminal {
    // Check if we already have a terminal
    const existing = this.terminals.get(agentId)
    if (existing) {
      console.log(`[MinimalTerminal] Reusing terminal for agent: ${agentId}`)
      return existing
    }

    // Create new terminal - EXACTLY like the demo
    console.log(`[MinimalTerminal] Creating terminal for agent: ${agentId}, isReadOnly: ${isReadOnly}`)
    
    const terminal = new Terminal({
      cursorBlink: !isReadOnly,
      disableStdin: isReadOnly,
      theme: {
        background: '#000000',
        foreground: '#00ff00'
      }
    })

    // Open terminal in container - that's it!
    terminal.open(container)
    
    // Store it
    this.terminals.set(agentId, terminal)
    
    console.log(`[MinimalTerminal] Terminal created and opened for agent: ${agentId}`)
    return terminal
  }

  getTerminal(agentId: string): Terminal | null {
    return this.terminals.get(agentId) || null
  }

  disposeTerminal(agentId: string): void {
    const terminal = this.terminals.get(agentId)
    if (terminal) {
      terminal.dispose()
      this.terminals.delete(agentId)
      console.log(`[MinimalTerminal] Disposed terminal for agent: ${agentId}`)
    }
  }
}

export default MinimalTerminalManager.getInstance()