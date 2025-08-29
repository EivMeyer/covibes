import React, { useState, useEffect, useRef } from 'react';
import { apiService } from './services/api';
import io, { Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
}

interface ChatMessage {
  userId: string;
  userName: string;
  message: string;  // Changed from 'content' to 'message'
  timestamp: string;
  teamId: string;
}

export default function SimpleApp() {
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Login form state
  const [email, setEmail] = useState('alice@demo.com');
  const [password, setPassword] = useState('demo123');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Check if already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('colabvibe_auth_token');
    if (token) {
      apiService.getCurrentUser()
        .then(data => {
          setUser(data.user);
          setTeam(data.team);
          setIsLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('colabvibe_auth_token');
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Connect to WebSocket when user is authenticated
  useEffect(() => {
    if (!user || !team) return;
    
    const token = localStorage.getItem('colabvibe_auth_token');
    if (!token) return;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Join team
      socket.emit('join-team', { teamId: team.id, token });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('chat-message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('error', (error) => {
      console.error('🔌 WebSocket error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, team]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await apiService.login({ email, password });
      setUser(response.user);
      setTeam(response.team);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('colabvibe_auth_token');
    setUser(null);
    setTeam(null);
    // Don't clear messages - keep chat history
    setIsConnected(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !isConnected) return;

    socketRef.current.emit('chat-message', {
      message: newMessage.trim(),  // Changed from 'content' to 'message'
      teamId: team?.id
    });
    
    setNewMessage('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show dashboard if logged in
  if (user && team) {
    return (
      <div className="min-h-screen bg-midnight-900 text-white">
        <div className="container mx-auto p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">
              Colab<span className="text-electric">Vibe</span>
            </h1>
            <button 
              onClick={handleLogout}
              className="bg-coral text-white px-4 py-2 rounded hover:bg-coral/80"
            >
              Logout
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-midnight-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Welcome {user.name}!</h2>
              <p className="text-gray-300">Team: {team.name}</p>
              <p className="text-gray-300">Email: {user.email}</p>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
                <button className="bg-electric text-midnight-900 px-4 py-2 rounded mr-2 hover:bg-electric/90">
                  Spawn Agent
                </button>
                <button className="bg-team-purple text-white px-4 py-2 rounded hover:bg-team-purple/80">
                  View Agents
                </button>
              </div>
            </div>
            
            <div className="bg-midnight-800 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Team Chat</h2>
                <div className={`flex items-center text-sm ${isConnected ? 'text-success' : 'text-coral'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-success' : 'bg-coral'}`}></div>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              <div className="h-64 bg-midnight-700 rounded p-4 mb-4 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center">
                    {isConnected ? 'No messages yet. Start the conversation!' : 'Connecting to chat...'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message, index) => (
                      <div key={message.id || `msg-${index}`} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-electric">{message.userName}</span>
                          <span className="text-gray-400 text-xs">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-white">
                          {message.message || '[NO MESSAGE]'} 
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <form onSubmit={sendMessage}>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isConnected ? "Type a message..." : "Connecting..."}
                  disabled={!isConnected}
                  className="w-full bg-midnight-700 text-white px-4 py-2 rounded border border-midnight-600 focus:border-electric focus:outline-none disabled:opacity-50"
                />
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show login form
  return (
    <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
      <div className="bg-midnight-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Colab<span className="text-electric">Vibe</span>
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-midnight-700 text-white px-4 py-3 rounded border border-midnight-600 focus:border-electric focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-midnight-700 text-white px-4 py-3 rounded border border-midnight-600 focus:border-electric focus:outline-none"
              required
            />
          </div>
          
          {error && (
            <div className="bg-coral/20 border border-coral text-coral px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-electric text-midnight-900 font-bold py-3 rounded hover:bg-electric/90 disabled:opacity-50"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-400 text-sm">
          Demo: alice@demo.com / demo123
        </div>
      </div>
    </div>
  );
}