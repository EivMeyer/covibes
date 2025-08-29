import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import io, { Socket } from 'socket.io-client'

interface TerminalPageProps {
  agentId?: string
  user?: any
  socket?: Socket | null
}

export const TerminalPage: React.FC<TerminalPageProps> = ({ agentId, user: propUser, socket: propSocket }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState('initializing')
  const [user, setUser] = useState<any>(propUser || null)
  const [agents, setAgents] = useState<any[]>([])
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const currentAgentId = agentId || urlParams.get('agentId')
  const isEmbedded = urlParams.get('embedded') === 'true'
  const urlFontSize = urlParams.get('fontSize')
  
  const [fontSize, setFontSize] = useState(
    urlFontSize ? parseInt(urlFontSize, 10) : 10 // Use URL fontSize if provided, otherwise default to 10
  )

  // Update fontSize when URL parameter changes
  useEffect(() => {
    const newFontSize = urlFontSize ? parseInt(urlFontSize, 10) : 10
    console.log('🔍 Terminal font size from URL:', urlFontSize, '-> setting to:', newFontSize)
    setFontSize(newFontSize)
  }, [urlFontSize])

  // Initialize user and socket
  useEffect(() => {
    // If we have props from parent, use them
    if (propUser && propSocket) {
      setUser(propUser)
      socketRef.current = propSocket
      setStatus('Connected')
      
      // Get agents using existing auth
      const token = localStorage.getItem('colabvibe_auth_token')
      if (token) {
        fetch('/api/agents', {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(agentsRes => {
          setAgents(agentsRes.agents || [])
          console.log('📋 Available agents:', agentsRes.agents)
        })
        .catch(err => console.error('Failed to get agents:', err))
      }
      return
    }

    // Fallback: create own connection if not passed from parent
    const token = localStorage.getItem('colabvibe_auth_token')
    if (!token) {
      setStatus('Not authenticated - please login first')
      return
    }

    // Get user info and agents
    Promise.all([
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json()),
      fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json())
    ])
    .then(([userRes, agentsRes]) => {
      setUser(userRes.user)
      setAgents(agentsRes.agents || [])
      console.log('📋 Available agents:', agentsRes.agents)
    })
    .catch(err => {
      console.error('Failed to get user/agents:', err)
      setStatus('Authentication failed - please login first')
    })

    // Create socket connection
    const socket = io('/', {
      transports: ['polling', 'websocket'],
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('🔌 Terminal socket connected')
      setStatus('Socket connected')
    })

    socket.on('disconnect', () => {
      console.log('🔌 Terminal socket disconnected')
      setStatus('Disconnected')
    })

    return () => {
      if (!propSocket) { // Only disconnect if we created our own socket
        socket.disconnect()
      }
    }
  }, [propUser, propSocket])

  // Font size controls
  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 1, 24)) // Max 24px
  }

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 1, 6)) // Min 6px
  }

  useEffect(() => {
    if (!terminalRef.current || !socketRef.current || !currentAgentId || !user) {
      console.log('Missing requirements:', {
        dom: !!terminalRef.current,
        socket: !!socketRef.current,
        agentId: !!currentAgentId,
        user: !!user
      })
      return
    }

    const socket = socketRef.current

    // Create terminal
    console.log('🔍 Creating terminal with font size:', fontSize)
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: '"SFMono-Regular", "Monaco", "Inconsolata", "Roboto Mono", "Consolas", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      scrollback: 5000,
      convertEol: true,
      cols: 120,
      rows: 40,
    })

    // Open terminal
    terminalRef.current.innerHTML = ''
    terminal.open(terminalRef.current)
    terminalInstanceRef.current = terminal

    // Handle terminal input
    const dataDisposable = terminal.onData((data: string) => {
      if (socket && socket.connected) {
        console.log('🔌 Sending terminal input:', data)
        socket.emit('terminal_input', { agentId: currentAgentId, data })
      }
    })

    // Socket event handlers
    const handleTerminalOutput = (data: any) => {
      console.log('🔌 Terminal output received:', data)
      if (data.agentId === currentAgentId) {
        terminal.write(data.output)
      }
    }

    const handleTerminalError = (data: any) => {
      console.log('🔌 Terminal error:', data)
      if (data.agentId === currentAgentId) {
        setStatus('Error: ' + data.error)
        terminal.writeln('\r\n❌ Error: ' + data.error)
      }
    }

    const handleTerminalConnected = (data: any) => {
      console.log('🔌 Terminal connected:', data)
      if (data.agentId === currentAgentId) {
        setStatus('Connected')
      }
    }

    // Add listeners
    socket.on('terminal_output', handleTerminalOutput)
    socket.on('terminal_error', handleTerminalError)
    socket.on('terminal_connected', handleTerminalConnected)

    // Connect to agent
    console.log('🔌 Attempting to connect to agent:', currentAgentId)
    if (socket.connected) {
      socket.emit('terminal_connect', { agentId: currentAgentId })
      setStatus('Connecting to agent...')
    } else {
      const connectWhenReady = () => {
        if (socket.connected) {
          socket.emit('terminal_connect', { agentId: currentAgentId })
          setStatus('Connecting to agent...')
          socket.off('connect', connectWhenReady)
        }
      }
      socket.on('connect', connectWhenReady)
    }

    // Cleanup
    return () => {
      dataDisposable.dispose()
      socket.off('terminal_output', handleTerminalOutput)
      socket.off('terminal_error', handleTerminalError)
      socket.off('terminal_connected', handleTerminalConnected)
      terminal.dispose()
    }
  }, [currentAgentId, user, fontSize])

  if (!currentAgentId) {
    return (
      <div className="h-screen bg-[#1e1e1e] text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl mb-6">Terminal - Select Agent</h1>
          
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xl mb-4">No agents found</p>
              <p className="text-gray-400">Go to the main dashboard to spawn an agent first</p>
              <a 
                href="/" 
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-lg mb-4">Click an agent to connect to its terminal:</p>
              <div className="grid gap-4">
                {agents.map((agent: any) => (
                  <div 
                    key={agent.id}
                    className="bg-[#2d2d30] border border-[#3e3e42] rounded p-4 hover:bg-[#3d3d40] cursor-pointer"
                    onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.set('agentId', agent.id)
                      window.location.href = url.toString()
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm text-gray-400">ID: {agent.id}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(agent.id)
                              // Visual feedback
                              const btn = e.currentTarget
                              const originalContent = btn.innerHTML
                              btn.innerHTML = '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>'
                              btn.classList.add('text-green-400')
                              setTimeout(() => {
                                btn.innerHTML = originalContent
                                btn.classList.remove('text-green-400')
                              }, 1000)
                            }}
                            className="text-xs px-2 py-1 bg-[#3e3e42] hover:bg-[#4e4e52] rounded text-gray-400 hover:text-white transition-colors ml-2"
                            title="Copy agent ID"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                            </svg>
                          </button>
                        </div>
                        <div className="font-semibold">{agent.task || 'No task description'}</div>
                        <div className="text-sm text-gray-300">
                          Owner: {agent.userName} • Status: {agent.status}
                        </div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        agent.status === 'running' ? 'bg-green-400' :
                        agent.status === 'starting' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Terminal</h1>
          <p className="mb-4">Please log in to access the terminal</p>
          <div className="text-sm text-gray-400 mb-4">Status: {status}</div>
          <a 
            href="/" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#1e1e1e] flex flex-col">
      {/* Header - hide in embedded mode */}
      {!isEmbedded && (
        <div className="bg-[#2d2d30] text-white px-4 py-2 border-b border-[#3e3e42]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold">Terminal</h1>
              <span className="text-sm text-gray-400">Agent: {currentAgentId.slice(-8)}</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Font size controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={decreaseFontSize}
                  className="w-6 h-6 flex items-center justify-center bg-[#3e3e42] hover:bg-[#4e4e52] rounded text-sm font-bold"
                  title="Decrease font size"
                >
                  -
                </button>
                <span className="text-xs text-gray-400 min-w-[20px] text-center">{fontSize}px</span>
                <button
                  onClick={increaseFontSize}
                  className="w-6 h-6 flex items-center justify-center bg-[#3e3e42] hover:bg-[#4e4e52] rounded text-sm font-bold"
                  title="Increase font size"
                >
                  +
                </button>
              </div>
              {/* Status indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  status === 'Connected' ? 'bg-green-400' : 
                  status === 'Connecting...' ? 'bg-yellow-400 animate-pulse' : 
                  'bg-red-400'
                }`} />
                <span className="text-sm">{status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Container */}
      <div className={`flex-1 ${isEmbedded ? 'p-0' : 'p-4'}`}>
        <div 
          ref={terminalRef}
          className="w-full h-full"
          style={{ 
            backgroundColor: '#1e1e1e',
            border: isEmbedded ? 'none' : '1px solid #3e3e42',
            borderRadius: isEmbedded ? '0' : '4px'
          }}
        />
      </div>
    </div>
  )
}