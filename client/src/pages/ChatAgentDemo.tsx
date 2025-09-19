import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

interface DemoCredentials {
  token: string;
  teamId: string;
  userId: string;
  teamCode: string;
}

interface Agent {
  id: string;
  task: string;
  status: string;
  mode: 'chat';
  agentName?: string;
  sessionId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  agentId?: string;
}

const ChatAgentDemo: React.FC = () => {
  const [demoActive, setDemoActive] = useState(false);
  const [credentials, setCredentials] = useState<DemoCredentials | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnTask, setSpawnTask] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start demo session
  const startDemo = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await axios.get(`${backendUrl}/api/agents/demo/chat-agent`);
      const { demo } = response.data;

      setCredentials(demo);
      setDemoActive(true);

      // Connect WebSocket with demo token (use HTTP not HTTPS)
      const wsUrl = backendUrl.replace('https://', 'http://');
      const newSocket = io(wsUrl, {
        auth: { token: demo.token }
      });

      newSocket.on('connect', () => {
        console.log('Demo WebSocket connected');
        newSocket.emit('join-team', { teamId: demo.teamId, token: demo.token });
      });

      newSocket.on('agent-spawned', (data: { agent: Agent }) => {
        console.log('Agent spawned:', data.agent);
        setAgents(prev => {
          const newAgents = [...prev, data.agent];
          // Auto-select the first agent
          if (newAgents.length === 1) {
            setSelectedAgent(data.agent);
          }
          return newAgents;
        });

        // Add system message
        const systemMessage: ChatMessage = {
          id: `sys-${Date.now()}`,
          role: 'agent',
          content: `Chat agent "${data.agent.agentName || data.agent.id}" has been spawned. Mode: ${data.agent.mode}. No terminal will be created.`,
          timestamp: new Date(),
          agentId: data.agent.id
        };
        setMessages(prev => [...prev, systemMessage]);
      });

      // Listen for agent status updates
      newSocket.on('agent-status', (data: { agentId: string, status: string, message?: string }) => {
        console.log('Agent status update:', data);
        setAgents(prev => prev.map(agent =>
          agent.id === data.agentId
            ? { ...agent, status: data.status }
            : agent
        ));

        // If agent just became ready, show a message
        if (data.status === 'running' && data.message) {
          const systemMessage: ChatMessage = {
            id: `sys-status-${Date.now()}`,
            role: 'agent',
            content: `✅ ${data.message}`,
            timestamp: new Date(),
            agentId: data.agentId
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      });

      newSocket.on('agent_chat_response', (data: { agentId: string, response: string }) => {
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          agentId: data.agentId
        };
        setMessages(prev => [...prev, agentMessage]);
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Failed to start demo:', error);
      alert('Failed to start demo session');
    }
  };

  // Spawn a chat agent
  const spawnAgent = async () => {
    if (!socket || !credentials || !spawnTask) return;

    setIsSpawning(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await axios.post(
        `${backendUrl}/api/agents/spawn`,
        {
          task: spawnTask,
          mode: 'chat' // Explicitly set chat mode
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.token}`
          }
        }
      );

      const agent = response.data.agent;
      console.log('Spawned chat agent:', agent);
      setSpawnTask('');
    } catch (error) {
      console.error('Failed to spawn agent:', error);
      alert('Failed to spawn agent');
    } finally {
      setIsSpawning(false);
    }
  };

  // Send message to agent
  const sendMessage = () => {
    if (!socket || !selectedAgent || !inputMessage) return;

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to backend
    socket.emit('agent_chat_message', {
      agentId: selectedAgent.id,
      message: inputMessage
    });

    setInputMessage('');
  };

  // End demo session
  const endDemo = () => {
    if (socket) {
      socket.disconnect();
    }
    setDemoActive(false);
    setCredentials(null);
    setAgents([]);
    setMessages([]);
    setSelectedAgent(null);
  };

  if (!demoActive) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl font-bold mb-6">Chat Agent Demo</h1>

          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">What's New?</h2>
            <p className="mb-4 text-gray-300">
              Experience non-interactive Claude agents that process messages without spawning terminal sessions.
              This demo showcases the new efficient chat mode that uses Claude's --print flag for direct responses.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700 p-4 rounded">
                <h3 className="font-semibold text-green-400 mb-2">✨ Chat Mode (New)</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• No terminal spawning</li>
                  <li>• Claude --print flag for responses</li>
                  <li>• Session continuity with --resume</li>
                  <li>• Lower resource usage</li>
                </ul>
              </div>

              <div className="bg-gray-700 p-4 rounded">
                <h3 className="font-semibold text-blue-400 mb-2">🖥️ Terminal Mode (Classic)</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Spawns persistent terminal</li>
                  <li>• Interactive shell sessions</li>
                  <li>• Full PTY management</li>
                  <li>• Higher resource usage</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-4 mb-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ This is a temporary demo session that expires in 1 hour.
                All data will be automatically cleaned up after expiry.
              </p>
            </div>

            <button
              onClick={startDemo}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Start Demo Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex h-screen">
        {/* Agent List Sidebar */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Chat Agents</h2>
            <p className="text-xs text-gray-400 mb-4">Team Code: {credentials?.teamCode}</p>

            {/* Spawn Agent Form */}
            <div className="space-y-2">
              <input
                type="text"
                value={spawnTask}
                onChange={(e) => setSpawnTask(e.target.value)}
                placeholder="What should this agent do?"
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={spawnAgent}
                disabled={isSpawning || !spawnTask}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
              >
                {isSpawning ? 'Spawning...' : 'Spawn Chat Agent'}
              </button>
            </div>
          </div>

          {/* Agent List */}
          <div className="flex-1 overflow-y-auto p-4">
            {agents.length === 0 ? (
              <p className="text-gray-500 text-center">No agents spawned yet</p>
            ) : (
              <div className="space-y-2">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedAgent?.id === agent.id
                        ? 'bg-green-600/20 border border-green-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-semibold">
                      {agent.agentName || `Agent ${agent.id.slice(-6)}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      Mode: {agent.mode} | Status: <span className={agent.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>{agent.status === 'running' ? 'Ready' : 'Starting...'}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {agent.task}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* End Demo Button */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={endDemo}
              className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
            >
              End Demo Session
            </button>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          {selectedAgent ? (
            <>
              {/* Agent Header */}
              <div className="bg-gray-800 border-b border-gray-700 p-4">
                <h3 className="text-lg font-semibold">
                  {selectedAgent.agentName || `Agent ${selectedAgent.id.slice(-6)}`}
                </h3>
                <p className="text-sm text-gray-400">Chat Mode - No Terminal</p>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages
                  .filter(msg => !msg.agentId || msg.agentId === selectedAgent.id)
                  .map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-2xl px-4 py-2 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        <div className="text-xs opacity-75 mb-1">
                          {msg.role === 'user' ? 'You' : 'Agent'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-gray-800 border-t border-gray-700 p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-xl mb-2">No agent selected</p>
                <p>Spawn a chat agent or select one from the list</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatAgentDemo;