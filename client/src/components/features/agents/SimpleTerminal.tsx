import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import TerminalManager from '@/services/TerminalManager'

interface SimpleTerminalProps {
  agentId: string
  socket: any
  onClose?: () => void
  agents?: any[] // List of available agents for the dropdown
  onAgentChange?: (newAgentId: string) => void // Callback when agent is switched
  isReadOnly?: boolean // When true, disable input and show read-only mode
  userName?: string // Name of agent owner (for read-only mode)
  containerInfo?: {
    containerId: string;
    status: 'starting' | 'running' | 'stopped' | 'error';
    terminalPort?: number;
    previewPort?: number;
  }
}

export const SimpleTerminal: React.FC<SimpleTerminalProps> = ({
  agentId,
  socket,
  onClose,
  agents = [],
  onAgentChange,
  isReadOnly = false,
  userName,
  containerInfo,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [status, setStatus] = useState('initializing')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const mountedRef = useRef(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Font size controls
  const zoomIn = useCallback(() => {
    const newSize = Math.min(fontSize + 2, 24)
    setFontSize(newSize)
    TerminalManager.updateFontSize(agentId, newSize)
  }, [fontSize, agentId])

  const zoomOut = useCallback(() => {
    const newSize = Math.max(fontSize - 2, 8)
    setFontSize(newSize)
    TerminalManager.updateFontSize(agentId, newSize)
  }, [fontSize, agentId])

  const resetZoom = useCallback(() => {
    setFontSize(13)
    TerminalManager.updateFontSize(agentId, 13)
  }, [agentId])

  // Sync font size from TerminalManager on mount
  useEffect(() => {
    const currentSize = TerminalManager.getFontSize(agentId)
    setFontSize(currentSize)
  }, [agentId])


  // Function to resize terminal using FitAddon
  const resizeTerminal = useCallback(() => {
    if (!terminalRef.current || !mountedRef.current) return

    try {
      // Get the terminal instance from TerminalManager
      const terminalData = TerminalManager.getTerminalData(agentId)
      if (!terminalData?.fitAddon || !terminalData?.terminal) return
      
      // Simply fit the terminal to the container - trust FitAddon to do its job
      terminalData.fitAddon.fit()
      
      // Get the new dimensions after fitting
      const cols = terminalData.terminal.cols
      const rows = terminalData.terminal.rows
      
      console.debug(`Terminal resized for agent ${agentId}: ${cols}x${rows}`)
      
      // Notify server about terminal resize when agent is connected (only for non-read-only terminals)
      if (agentId && socket && socket.connected && !isReadOnly) {
        socket.emit('terminal_resize', { 
          agentId, 
          cols, 
          rows 
        })
      }
    } catch (error) {
      // Terminal not ready yet, skip resize
      console.debug('Terminal resize skipped:', error)
    }
  }, [agentId, socket, isReadOnly])

  // Initialize terminal
  useEffect(() => {
    mountedRef.current = true

    if (!terminalRef.current || !socket || !agentId) {
      return
    }

    // Store disposables for cleanup
    let dataDisposable: any = null
    let resizeObserver: ResizeObserver | null = null
    let connectionInterval: any = null

    // Wait for DOM to be ready
    requestAnimationFrame(() => {
      if (!terminalRef.current || !mountedRef.current) return

      // Get or create terminal from manager (FitAddon will handle sizing)
      const terminal = TerminalManager.getOrCreateTerminal(
        agentId,
        terminalRef.current,
        fontSize,
        isReadOnly
      )

      // Don't modify terminal options here - trust TerminalManager's setup
      terminalInstanceRef.current = terminal

      // Setup resize observer - works with or without agent attached
      if (terminalRef.current && 'ResizeObserver' in window) {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }

        let lastWidth = terminalRef.current.offsetWidth
        let lastHeight = terminalRef.current.offsetHeight
        
        resizeObserverRef.current = new ResizeObserver((entries) => {
          const entry = entries[0]
          if (!entry) return
          
          const width = entry.contentRect.width
          const height = entry.contentRect.height
          
          // Only trigger resize if size changed by more than 20 pixels (reduce sensitivity)
          if (Math.abs(width - lastWidth) > 20 || Math.abs(height - lastHeight) > 20) {
            lastWidth = width
            lastHeight = height
            
            const timeoutId = setTimeout(() => {
              if (mountedRef.current && terminalInstanceRef.current) {
                resizeTerminal()
              }
            }, 200)
            ;(resizeObserverRef.current as any)._timeoutId = timeoutId
          }
        })

        resizeObserverRef.current.observe(terminalRef.current)
      }

      // Setup input handler - NEW PTY PROTOCOL (only for non-read-only terminals)
      if (!isReadOnly) {
        // Terminal is always fresh now, no need to clear old handlers
        dataDisposable = terminal.onData((data: string) => {
          // Check for Ctrl+L (clear screen)
          if (data === '\x0c') {
            TerminalManager.clearTerminal(agentId)
            // Still send to server to clear server-side terminal
          }
          if (socket && socket.connected) {
            // NEW PTY PROTOCOL: Include type field for raw input
            socket.emit('terminal_input', {
              type: 'input',
              agentId,
              data
            })
          }
        })

        // Store the handler for cleanup
        TerminalManager.setDataHandler(agentId, dataDisposable)
      }

      // Connect to agent only if not already connected
      if (!TerminalManager.isConnected(agentId)) {
        if (socket.connected) {
          socket.emit('terminal_connect', { agentId })
          setStatus('Connecting...')  // Don't set Connected until we get confirmation
        } else {
          setStatus('Connecting...')
          connectionInterval = setInterval(() => {
            if (socket.connected && mountedRef.current && !TerminalManager.isConnected(agentId)) {
              socket.emit('terminal_connect', { agentId })
              setStatus('Connected')
              TerminalManager.setConnected(agentId, true)
              clearInterval(connectionInterval)
              connectionInterval = null
            }
          }, 500)
        }
      } else {
        setStatus('Connected')
      }
      
      // Trigger initial resize after terminal setup
      setTimeout(() => {
        if (mountedRef.current && terminalInstanceRef.current) {
          resizeTerminal()
        }
      }, 100)

      // Store resize observer reference for cleanup
      resizeObserver = resizeObserverRef.current
    })

    // Main cleanup on unmount
    return () => {
      mountedRef.current = false

      // Clean up data handler
      if (dataDisposable) {
        dataDisposable.dispose()
        TerminalManager.clearDataHandler(agentId)
      }

      // Clean up resize observer
      if (resizeObserver) {
        const timeoutId = (resizeObserver as any)._timeoutId
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        resizeObserver.disconnect()
      }

      // Clean up connection interval
      if (connectionInterval) {
        clearInterval(connectionInterval)
      }
    }
  }, [agentId, socket, resizeTerminal, isReadOnly])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !agentId) return


    // Clear any existing handlers first
    const existingHandlers = TerminalManager.getSocketHandlers(agentId)
    for (const [event, handler] of existingHandlers) {
      socket.off(event, handler)
    }
    TerminalManager.clearSocketHandlers(agentId)

    // Create new handlers - NEW PTY PROTOCOL
    const handleTerminalData = (data: any) => {
      if (data.agentId === agentId && mountedRef.current) {
        const terminal = TerminalManager.getTerminal(agentId)
        if (terminal) {
          try {
            // Just write the data directly - exactly like the working demo
            terminal.write(data.data)
          } catch (e) {
            console.error(`[SimpleTerminal] Error writing PTY data to terminal:`, e)
          }
        }
      }
    }

    // Legacy handler for backwards compatibility
    const handleTerminalOutput = (data: any) => {
      if (data.agentId === agentId && mountedRef.current) {
        const terminal = TerminalManager.getTerminal(agentId)
        if (terminal) {
          try {
            let output = data.output
            
            // MINIMAL FILTERING - Only remove the most problematic sequences
            // Keep most escape sequences to maintain proper terminal functionality
            
            // Only filter out tmux status bar updates that clutter the output
            // These often contain timestamps and session names like "claude-cm0:claude*"
            if (output.includes('claude-') && output.includes(':claude')) {
              // Remove standalone tmux status lines
              const simpleStatusPattern = /\[claude-[a-z0-9]+:claude\*?\s+.*?\d+:\d+\s+\d+-\w+-\d+\]/g
              output = output.replace(simpleStatusPattern, '')
            }
            
            // Write output directly to terminal, let xterm.js handle escape sequences properly
            terminal.write(output)
          } catch (e) {
            console.error(`[SimpleTerminal] Error writing to terminal:`, e)
          }
        }
      }
    }

    const handleTerminalError = (data: any) => {
      if (data.agentId === agentId && mountedRef.current) {
        console.error(`[SimpleTerminal] Terminal error for ${agentId}:`, data.error)
        setStatus('Error: ' + data.error)
        const terminal = TerminalManager.getTerminal(agentId)
        if (terminal) {
          try {
            terminal.writeln('\r\n❌ Terminal Error: ' + data.error)
            
            // Handle specific error actions from server
            if (data.action === 'refresh_page') {
              terminal.writeln('🔄 Please refresh the page to see the latest agent status')
            } else if (data.action === 'show_restart_option') {
              terminal.writeln('🔧 ' + (data.suggestion || 'Try refreshing the page or spawn a new agent'))
              terminal.writeln('💡 You can restart this agent from the agents panel')
            } else {
              terminal.writeln('🔧 Try refreshing the page or spawning a new agent')
            }
          } catch (e) {
            console.error(`[SimpleTerminal] Error writing error to terminal:`, e)
          }
        }
      }
    }

    const handleTerminalConnected = (data: any) => {
      if (data.agentId === agentId && mountedRef.current) {
        setStatus('Connected')
        TerminalManager.setConnected(agentId, true)
      }
    }

    const handleTerminalReplaced = (data: any) => {
      if (data.agentId === agentId && mountedRef.current) {
        setStatus('Replaced by new tab')
        const terminal = TerminalManager.getTerminal(agentId)
        if (terminal) {
          terminal.writeln('\r\n⚠️  Connection replaced by another tab/window')
        }
      }
    }

    // Store handlers in manager - NEW PTY PROTOCOL + Legacy
    TerminalManager.addSocketHandler(agentId, 'terminal_data', handleTerminalData) // NEW PTY
    TerminalManager.addSocketHandler(agentId, 'terminal_output', handleTerminalOutput) // Legacy
    TerminalManager.addSocketHandler(agentId, 'terminal_error', handleTerminalError)
    TerminalManager.addSocketHandler(agentId, 'terminal_connected', handleTerminalConnected)
    TerminalManager.addSocketHandler(agentId, 'terminal_replaced', handleTerminalReplaced)

    // Add listeners - NEW PTY PROTOCOL + Legacy
    socket.on('terminal_data', handleTerminalData) // NEW PTY raw byte streaming
    socket.on('terminal_output', handleTerminalOutput) // Legacy support
    socket.on('terminal_error', handleTerminalError)
    socket.on('terminal_connected', handleTerminalConnected)
    socket.on('terminal_replaced', handleTerminalReplaced)
    
    // Debug all socket events - listen for ANY event to troubleshoot
    const debugAllEvents = (eventName: string, ...args: any[]) => {
    }
    
    socket.onAny(debugAllEvents)

    // Cleanup
    return () => {
      socket.off('terminal_data', handleTerminalData) // NEW PTY
      socket.off('terminal_output', handleTerminalOutput) // Legacy
      socket.off('terminal_error', handleTerminalError)
      socket.off('terminal_connected', handleTerminalConnected)
      socket.off('terminal_replaced', handleTerminalReplaced)
      socket.offAny(debugAllEvents)
      
      // Clear stored handlers
      TerminalManager.clearSocketHandlers(agentId)
    }
  }, [agentId, socket])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false)
      }
    }

    if (showAgentDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAgentDropdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Disconnect from terminal if this component is truly unmounting
      if (socket && socket.connected && TerminalManager.isConnected(agentId)) {
        socket.emit('terminal_disconnect', { agentId })
        TerminalManager.setConnected(agentId, false)
      }
      
      // Note: We don't dispose the terminal here as it might be reused
      // The terminal will be disposed when the agent is killed or app closes
    }
  }, [agentId, socket])

  // Handle clear terminal button
  const handleClearTerminal = () => {
    TerminalManager.clearTerminal(agentId)
  }

  // Handle force resize terminal
  const handleForceResize = () => {
    TerminalManager.forceResize(agentId)
  }

  // Handle retry connection
  const handleRetryConnection = () => {
    setStatus('Retrying...')
    
    // Clear previous connection state
    TerminalManager.setConnected(agentId, false)
    
    // Attempt reconnection
    if (socket && socket.connected) {
      socket.emit('terminal_connect', { agentId })
    } else {
      setStatus('Socket disconnected - refresh page')
    }
  }

  // Handle agent selection from dropdown
  const handleAgentSelect = (selectedAgentId: string) => {
    if (selectedAgentId !== agentId && onAgentChange) {
      // Disconnect from current agent
      if (socket && socket.connected && TerminalManager.isConnected(agentId)) {
        socket.emit('terminal_disconnect', { agentId })
        TerminalManager.setConnected(agentId, false)
      }
      
      // Notify parent to change agent
      onAgentChange(selectedAgentId)
    }
    setShowAgentDropdown(false)
  }

  // Get current agent info
  const currentAgent = agents.find(agent => agent.id === agentId)
  
  // Filter available agents (exclude current one)
  const availableAgents = agents.filter(agent => agent.id !== agentId)

  // Helper function for container status icons
  const getContainerStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'starting': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚫';
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Terminal Header with Container Info */}
      {containerInfo && (
        <div className="bg-gray-800 border-b border-gray-700 px-3 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300">
                👁️ Observer{userName ? ` • ${userName}` : ''}
              </span>
            )}
            <span className="text-gray-300">
              Agent: {currentAgent?.agentName || `A-${agentId.slice(0, 6)}`}
            </span>
            <span className="text-gray-500">
              Container: {containerInfo.containerId.slice(-8)}
            </span>
            {containerInfo.terminalPort && (
              <span className="text-gray-500">
                Port: {containerInfo.terminalPort}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-l border-gray-600 pl-2 mr-2">
              <button
                onClick={zoomOut}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Zoom out"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-xs text-gray-500 min-w-[1.5rem] text-center">{fontSize}px</span>
              <button
                onClick={zoomIn}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Zoom in"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              <button
                onClick={resetZoom}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Reset zoom"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
              containerInfo.status === 'running' ? 'bg-green-900/50 text-green-300' :
              containerInfo.status === 'starting' ? 'bg-yellow-900/50 text-yellow-300' :
              containerInfo.status === 'stopped' ? 'bg-red-900/50 text-red-300' :
              'bg-gray-700 text-gray-400'
            }`}>
              {getContainerStatusIcon(containerInfo.status)}
              {containerInfo.status}
            </span>
            <span className={`text-xs ${
              status.includes('Error') ? 'text-red-400' :
              status === 'Connected' ? 'text-green-400' :
              'text-gray-500'
            }`}>
              {status}
            </span>
            {status.includes('Error') && (
              <button
                onClick={handleRetryConnection}
                className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Retry connection"
              >
                🔄 Retry
              </button>
            )}
            <button
              onClick={handleForceResize}
              className="text-xs px-2 py-0.5 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              title="Fix terminal width if it becomes too narrow"
            >
              📐 Fix Width
            </button>
          </div>
        </div>
      )}
      
      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="flex-1 terminal-container"
        // Mobile touch focus support
        tabIndex={0}
        onTouchStart={(e) => {
          // Focus terminal on touch start
          e.currentTarget.focus();
          // Get the actual terminal element and focus it
          const terminal = TerminalManager.getTerminal(agentId);
          if (terminal && terminal.element) {
            terminal.focus();
          }
        }}
        onMouseDown={(e) => {
          // Focus terminal on mouse down for desktop
          e.currentTarget.focus();
          const terminal = TerminalManager.getTerminal(agentId);
          if (terminal && terminal.element) {
            terminal.focus();
          }
        }}
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          position: 'relative',
          padding: 0, // xterm.js handles its own internal spacing
          width: '100%', // Use full available width
          height: '100%', // Use full available height
          outline: 'none', // Remove focus outline
          userSelect: 'auto', // Allow text selection
          touchAction: 'manipulation', // Improve touch responsiveness
          // Mobile-specific improvements for keyboard interaction
          WebkitTouchCallout: 'none', // Disable iOS callout on long press
          WebkitUserSelect: 'text', // Enable text selection on iOS
          MozUserSelect: 'text', // Enable text selection on Firefox mobile
          msUserSelect: 'text', // Enable text selection on IE/Edge mobile
        }}
      />
    </div>
  )
}