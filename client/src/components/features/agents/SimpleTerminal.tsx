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
  onInput?: () => void // Callback when user sends input (for last active tracking)
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
  onInput,
  containerInfo,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [status, setStatus] = useState('initializing')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const [isWarming, setIsWarming] = useState(true) // 5-second warmup period
  const isWarmingRef = useRef(true) // Ref to track warming state in callbacks
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

  // Handle 5-second warmup period (only for starting agents)
  useEffect(() => {
    // Only show warmup for agents that are starting, not existing running agents
    const shouldWarmup = containerInfo?.status === 'starting'

    setIsWarming(shouldWarmup)
    isWarmingRef.current = shouldWarmup

    if (shouldWarmup) {
      const warmupTimer = setTimeout(() => {
        setIsWarming(false)
        isWarmingRef.current = false
        // Refit terminal after warmup period
        if (mountedRef.current && terminalInstanceRef.current) {
          resizeTerminal()
        }
      }, 5000) // 5 second warmup

      return () => clearTimeout(warmupTimer)
    }
  }, [agentId, containerInfo?.status, resizeTerminal])

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
        
        // Use debounced resize observer to prevent excessive resize events
        let resizeTimeout: NodeJS.Timeout | null = null
        resizeObserverRef.current = new ResizeObserver((entries) => {
          const entry = entries[0]
          if (!entry) return

          const width = entry.contentRect.width
          const height = entry.contentRect.height

          // Only trigger resize if size changed significantly (reduce sensitivity)
          if (Math.abs(width - lastWidth) > 30 || Math.abs(height - lastHeight) > 30) {
            lastWidth = width
            lastHeight = height

            // Cancel previous timeout if exists
            if (resizeTimeout) {
              clearTimeout(resizeTimeout)
            }

            // Debounce resize to prevent flickering
            resizeTimeout = setTimeout(() => {
              if (mountedRef.current && terminalInstanceRef.current) {
                resizeTerminal()
              }
              resizeTimeout = null
            }, 300)  // Increased delay for more stability
            ;(resizeObserverRef.current as any)._timeoutId = resizeTimeout
          }
        })

        resizeObserverRef.current.observe(terminalRef.current)
      }

      // Setup input handler - NEW PTY PROTOCOL (only for non-read-only terminals)
      if (!isReadOnly) {
        // Terminal is always fresh now, no need to clear old handlers
        dataDisposable = terminal.onData((data: string) => {
          // Block input during warmup period (use ref for real-time value)
          if (isWarmingRef.current) {
            return // Ignore all input during warmup
          }

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
            // Track this as the last active agent for inspector auto-injection
            if (onInput) {
              onInput()
            }
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

      // Initial refit after terminal is ready
      setTimeout(() => {
        if (mountedRef.current && terminalInstanceRef.current) {
          resizeTerminal()
        }
      }, 500)  // Initial refit

      // Second refit to ensure proper sizing
      setTimeout(() => {
        if (mountedRef.current && terminalInstanceRef.current) {
          resizeTerminal()
        }
      }, 1500)  // Secondary refit for stability

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
            // Write data directly to terminal - xterm handles ANSI sequences
            // No filtering needed - let xterm.js handle all escape sequences
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
            
            // Write output directly without any filtering
            // Let xterm.js handle all terminal escape sequences properly
            // This prevents issues with line updates and cursor movements
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
    <div className="h-full flex flex-col bg-gray-900 relative">
      {/* Warmup Overlay */}
      {isWarming && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Starting Terminal Session
            </h3>
            <p className="text-gray-400 text-sm">
              Initializing secure connection...
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Please wait 5 seconds
            </p>
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