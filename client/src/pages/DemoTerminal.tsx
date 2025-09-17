import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { CanvasAddon } from 'xterm-addon-canvas'
import 'xterm/css/xterm.css'

interface DemoTerminalProps {
  agentId?: string
  socket?: any
}

export const DemoTerminal: React.FC<DemoTerminalProps> = ({ agentId, socket }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lastDataRef = useRef<string>('')
  const bufferRef = useRef<string[]>([])
  const isProcessingRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)

  // Optimized terminal write with buffering
  const processBuffer = useCallback(() => {
    if (!terminalRef.current || isProcessingRef.current || bufferRef.current.length === 0) {
      return
    }

    isProcessingRef.current = true
    const term = terminalRef.current

    // Process all buffered data in one go
    const data = bufferRef.current.join('')
    bufferRef.current = []

    // Use requestAnimationFrame for smoother rendering
    requestAnimationFrame(() => {
      try {
        term.write(data)
      } catch (error) {
        console.error('Terminal write error:', error)
      } finally {
        isProcessingRef.current = false
        // Check if more data arrived while processing
        if (bufferRef.current.length > 0) {
          processBuffer()
        }
      }
    })
  }, [])

  // Buffer incoming data
  const handleTerminalData = useCallback((data: any) => {
    if (!agentId || (data.agentId && data.agentId !== agentId)) {
      return
    }

    const newData = data.data || data

    // Dedupe check - avoid writing same data twice
    if (newData === lastDataRef.current) {
      console.log('Skipping duplicate data')
      return
    }

    lastDataRef.current = newData
    bufferRef.current.push(newData)

    // Process buffer with debouncing
    setTimeout(processBuffer, 10)
  }, [agentId, processBuffer])

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    console.log('Initializing demo terminal...')

    // Create terminal with optimized settings for dynamic CLI output
    const term = new Terminal({
      // Performance settings
      rendererType: 'canvas',  // Use canvas for better performance
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 3,

      // Buffer settings
      scrollback: 10000,  // Large buffer for CLI tools

      // Visual settings
      fontSize: 14,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SFMono-Regular", "Monaco", "Consolas", monospace',
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.2,

      // Cursor settings
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 1,

      // Theme - optimized for readability
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#f0f0f0',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        selectionForeground: '#ffffff',

        // ANSI colors
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },

      // Features
      allowTransparency: false,
      disableStdin: true,  // Read-only for observer
      convertEol: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}\'",;',

      // Windows support
      windowsMode: navigator.platform.includes('Win'),
      windowOptions: {},
    })

    // Open terminal in container
    term.open(containerRef.current)
    terminalRef.current = term

    // Add fit addon for responsive resizing
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    // Add web links addon
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    // Add canvas addon for better performance
    const canvasAddon = new CanvasAddon()
    term.loadAddon(canvasAddon)

    // Initial fit
    setTimeout(() => {
      fitAddon.fit()
      console.log(`Terminal initialized: ${term.cols}x${term.rows}`)
    }, 0)

    // Set up resize observer for responsive behavior
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return

      // Debounce resize to avoid flicker
      clearTimeout((window as any).resizeTimeout)
      ;(window as any).resizeTimeout = setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          console.log(`Terminal resized: ${cols}x${rows}`)

          // Notify server of resize if connected
          if (socket && agentId) {
            socket.emit('terminal_resize', { agentId, cols, rows })
          }
        }
      }, 100)
    })

    resizeObserver.observe(containerRef.current)
    resizeObserverRef.current = resizeObserver

    // Write initial message
    term.write('\x1b[1;36m🚀 Demo Terminal Initialized\x1b[0m\r\n')
    term.write('\x1b[90m════════════════════════════════════════\x1b[0m\r\n')
    term.write('\x1b[33mOptimized for Claude Code CLI output\x1b[0m\r\n')
    term.write('\x1b[90m• Large scrollback buffer (10000 lines)\x1b[0m\r\n')
    term.write('\x1b[90m• Canvas rendering for performance\x1b[0m\r\n')
    term.write('\x1b[90m• Smart resize handling\x1b[0m\r\n')
    term.write('\x1b[90m• Buffered output processing\x1b[0m\r\n')
    term.write('\x1b[90m════════════════════════════════════════\x1b[0m\r\n\r\n')

    // Cleanup
    return () => {
      console.log('Cleaning up terminal...')
      clearTimeout((window as any).resizeTimeout)
      resizeObserver.disconnect()
      term.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      resizeObserverRef.current = null
    }
  }, []) // Only run once on mount

  // Socket connection handling
  useEffect(() => {
    if (!socket || !agentId || !terminalRef.current) return

    console.log('Connecting to agent terminal:', agentId)

    // Connect to agent
    socket.emit('terminal_connect', {
      agentId,
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows
    })

    // Set up event handlers
    socket.on('terminal_data', handleTerminalData)

    socket.on('terminal_connected', () => {
      console.log('Terminal connected to agent')
      setIsConnected(true)
      if (terminalRef.current) {
        terminalRef.current.write('\x1b[32m✓ Connected to agent\x1b[0m\r\n')
      }
    })

    socket.on('terminal_error', (error: any) => {
      console.error('Terminal error:', error)
      if (terminalRef.current) {
        terminalRef.current.write(`\x1b[31m✗ Error: ${error.message || 'Unknown error'}\x1b[0m\r\n`)
      }
    })

    // Cleanup
    return () => {
      console.log('Disconnecting from agent terminal')
      socket.off('terminal_data', handleTerminalData)
      socket.off('terminal_connected')
      socket.off('terminal_error')
      socket.emit('terminal_disconnect', { agentId })
      setIsConnected(false)
    }
  }, [socket, agentId, handleTerminalData])

  return (
    <div className="h-screen w-screen flex flex-col bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-semibold">Demo Terminal</h1>
          {agentId && (
            <span className="text-xs text-gray-400">
              Agent: {agentId.slice(0, 8)}
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${
            isConnected ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'
          }`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Scrollback: 10K</span>
          <span>|</span>
          <span>Renderer: Canvas</span>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{
          padding: '4px',
          backgroundColor: '#0c0c0c'
        }}
      />
    </div>
  )
}