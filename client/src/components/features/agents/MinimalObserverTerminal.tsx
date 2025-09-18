import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'

// MINIMAL Observer Terminal - exactly like the working demo observer.html
interface MinimalObserverTerminalProps {
  agentId: string
  socket: any
}

export const MinimalObserverTerminal: React.FC<MinimalObserverTerminalProps> = ({
  agentId,
  socket
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const [isWarming, setIsWarming] = useState(true) // 5-second warmup period

  // Handle 5-second warmup period
  useEffect(() => {
    setIsWarming(true)
    const warmupTimer = setTimeout(() => {
      setIsWarming(false)
    }, 5000) // 5 second warmup

    return () => clearTimeout(warmupTimer)
  }, [agentId]) // Reset warmup when agent changes

  useEffect(() => {
    if (!terminalRef.current || !socket || !agentId) {
      return
    }

    // Create terminal - EXACTLY like the demo observer.html
    // BUT we need to set explicit dimensions for ANSI escape sequences to work properly
    const term = new Terminal({
      cursorBlink: true, // Match agent terminal cursor
      disableStdin: true,
      cols: 80,  // Explicit dimensions needed for proper ANSI handling
      rows: 24,  // Without this, cursor movement and line clearing break
      fontSize: 13, // Match agent terminal font size
      fontFamily: '"SFMono-Regular", "Monaco", "Inconsolata", "Roboto Mono", "Consolas", monospace',
      theme: {
        background: '#1e1e1e', // Match agent terminal exactly
        foreground: '#d4d4d4', // Match agent terminal exactly
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
      allowTransparency: false,
      altClickMovesCursor: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{},./;:',
    })

    // Open terminal
    term.open(terminalRef.current)
    terminalInstanceRef.current = term

    // Only receive output, no input - exactly like the demo
    const handleTerminalData = (data: any) => {
      if (data.agentId === agentId) {
        term.write(data.data)
      }
    }

    socket.on('terminal_data', handleTerminalData)
    
    // Connect message
    term.write('\r\nObserver connected - Read Only Mode\r\n')
    
    // Request connection to agent with terminal size
    socket.emit('terminal_connect', { 
      agentId,
      cols: 80,
      rows: 24
    })

    // Cleanup
    return () => {
      socket.off('terminal_data', handleTerminalData)
      term.dispose()
    }
  }, [agentId, socket])

  return (
    <div className="h-full flex flex-col bg-gray-900 relative">
      {/* Warmup Overlay */}
      {isWarming && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Starting Observer Session
            </h3>
            <p className="text-gray-400 text-sm">
              Connecting to agent terminal...
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Please wait 5 seconds
            </p>
          </div>
        </div>
      )}

      <div className="bg-gray-800 border-b border-gray-700 px-3 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-900/50 text-orange-300">
            👁️ Read-only Observer
          </span>
          <span className="text-gray-300">
            Agent: {agentId.slice(0, 6)}
          </span>
        </div>
      </div>
      <div
        ref={terminalRef}
        className="flex-1 terminal-container"
        style={{
          backgroundColor: '#000000',
          padding: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  )
}