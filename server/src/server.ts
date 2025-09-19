/**
 * ColabVibe Express Server
 * 
 * Core requirements:
 * - Express server with JSON parsing and CORS
 * - Socket.io WebSocket server for real-time collaboration
 * - API routes for auth, agents, team, and VM management
 * - Static file serving for the frontend
 * - Database connection using Prisma
 * - WebSocket event handlers for team collaboration
 * - Comprehensive error handling
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { GlobalSSHSession } from './types/socket-ext.js';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import session from 'express-session';
import passport from './config/passport.js';
import { configurePassport } from './config/passport.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import route handlers
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import teamRoutes from './routes/team.js';
import vmRoutes from './routes/vm.js';
import previewRoutes from './routes/preview.js';
import githubRoutes from './routes/github.js';
import ideRoutes from './routes/ide.js';
import terminalRoutes from './routes/terminal.js';
import layoutRoutes from './routes/layout.js';
import workspaceRoutes from './routes/workspace.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';

// Import services
// import { dockerPreviewService } from '../services/docker-preview-service.js';
import { previewHealthCheck } from '../services/preview-health-check.js';
import { universalPreviewService } from '../services/universal-preview-service.js';
// import { mockAgentService, isMockAgentEnabled } from '../services/mock-agent.js';
import { previewService } from '../services/preview-service.js';
import { agentChatService } from '../services/agent-chat.js';
import { claudeExecutor } from './services/claude-executor.js';
import terminalBuffer from './services/terminal-buffer.js';
import { dockerManager } from './services/docker-manager-compat.js';

// Load environment variables
dotenv.config();

// CORS Configuration Helper
function getCorsOrigins(): string[] {
  const allowedOrigins = process.env['ALLOWED_ORIGINS'];
  if (allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default development origins
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003'
  ];
  
  // Production origins based on BASE_HOST
  if (BASE_HOST && BASE_HOST !== 'localhost') {
    // Add HTTP and HTTPS versions for production
    const prodOrigins = [
      `http://${BASE_HOST}:3000`,
      `https://${BASE_HOST}:3000`,
      `http://${BASE_HOST}:3001`,
      `https://${BASE_HOST}:3001`
    ];
    
    // Add without port for standard HTTP/HTTPS
    if (!BASE_HOST.includes(':')) {
      prodOrigins.push(`http://${BASE_HOST}`);
      prodOrigins.push(`https://${BASE_HOST}`);
    }
    
    defaultOrigins.push(...prodOrigins);
  }
  
  // Add frontend URL if specified
  const frontendUrl = process.env['FRONTEND_URL'];
  if (frontendUrl && !defaultOrigins.includes(frontendUrl)) {
    defaultOrigins.push(frontendUrl);
  }
  
  // Add preview URL if specified
  const previewUrl = process.env['PREVIEW_URL'];
  if (previewUrl && !defaultOrigins.includes(previewUrl)) {
    defaultOrigins.push(previewUrl);
  }
  
  return defaultOrigins;
}

// Get the base host from environment or default to localhost
const BASE_HOST = process.env['BASE_HOST'];
if (!BASE_HOST) {
  throw new Error('BASE_HOST environment variable is required. Set it to your production domain.');
}

// Debug: Log CORS configuration
console.log('🌐 BASE_HOST:', BASE_HOST);
const corsOrigins = getCorsOrigins();
console.log('🌐 CORS Origins:', corsOrigins);

// ES module equivalent (commented out as unused)
// const __filename = fileURLToPath(import.meta.url);

// Initialize Express app and HTTP server
const app = express();
const server = createServer(app);

// Set max listeners to prevent memory leaks
server.setMaxListeners(50);

const io = new SocketIOServer(server, {
  cors: {
    origin: true, // Allow all origins temporarily
    methods: ["GET", "POST"],
    credentials: true
  },
  // Enable both polling and WebSocket for terminal real-time communication
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true, // Allow WebSocket upgrade for better terminal performance
  httpCompression: false, // Disable compression
  perMessageDeflate: false,
  allowEIO3: false
});

// Initialize Prisma client (needed for authentication middleware)
const prisma = new PrismaClient();

// Socket.io connection debugging
io.engine.on('initial_headers', (_headers, req) => {
  console.log('🔍 Socket.io initial headers:', req.url);
});

io.engine.on('connection_error', (err) => {
  console.log('🚨 Socket.io connection error:', err);
});

// Socket.io authentication middleware
io.use(async (socket: any, next) => {
  try {
    console.log('🔐 Socket.io authentication middleware triggered for connection');
    
    // Extract token from handshake auth or query parameters
    console.log('🔍 Socket.io handshake auth:', socket.handshake.auth);
    console.log('🔍 Socket.io handshake query:', socket.handshake.query);
    console.log('🔍 Socket.io handshake headers:', socket.handshake.headers);
    
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    console.log('🔍 Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (!token) {
      console.log('❌ No authentication token provided for Socket.io connection');
      return next(new Error('Authentication token required'));
    }

    // Remove 'Bearer ' prefix if present
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as any;
    const userId = decoded.userId;

    console.log('✅ Socket.io JWT verified successfully, userId:', userId);

    // Fetch user and team data
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { teams: true }
    });

    if (!user) {
      console.log('❌ User not found for Socket.io connection:', userId);
      return next(new Error('User not found'));
    }

    if (!user.teams) {
      console.log('❌ User has no team for Socket.io connection:', userId);
      return next(new Error('User not assigned to team'));
    }

    // Set socket authentication data
    socket.userId = userId;
    socket.teamId = user.teams.id;
    socket.userName = user.userName;

    console.log('🎯 Socket.io authenticated:', {
      socketId: socket.id,
      userId,
      teamId: user.teams.id,
      userName: user.userName
    });

    next();
  } catch (error) {
    console.error('🚨 Socket.io authentication failed:', error);
    next(new Error('Authentication failed'));
  }
});

// Initialize agent chat service with Socket.io server
agentChatService.setSocketServer(io);

// PTY Event Handling - Connect dockerManager events to WebSocket broadcasting
dockerManager.on('pty-ready', (data: { agentId: string; ptyProcess: any }) => {
  console.log(`🎯 PTY ready for agent: ${data.agentId}`);
  // PTY event handling is done in terminal_connect handler
});

dockerManager.on('pty-killed', (data: { agentId: string }) => {
  console.log(`🗑️ PTY killed for agent: ${data.agentId}`);
  
  // Notify all connected sockets for this agent
  const sockets = agentSockets.get(data.agentId);
  if (sockets) {
    for (const socketId of sockets) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit('terminal_disconnected', { 
          agentId: data.agentId,
          reason: 'PTY process killed'
        });
      }
    }
  }
  
  // Clean up
  globalSSHSessions.delete(data.agentId);
  agentSockets.delete(data.agentId);
});

dockerManager.on('pty-cleaned', (data: { agentId: string; reason: string }) => {
  console.log(`🧹 PTY cleaned for agent: ${data.agentId} (${data.reason})`);
  
  // Notify connected sockets that PTY was cleaned up
  const sockets = agentSockets.get(data.agentId);
  if (sockets) {
    for (const socketId of sockets) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit('terminal_disconnected', { 
          agentId: data.agentId,
          reason: `PTY cleaned (${data.reason})`
        });
      }
    }
  }
  
  // Clean up
  globalSSHSessions.delete(data.agentId);
  agentSockets.delete(data.agentId);
});

// CRITICAL FIX: Handle PTY data events from DockerManager
dockerManager.on('pty-data', async (data: { agentId: string; data: string; timestamp: number }) => {
  console.log(`📡 PTY data event received for agent ${data.agentId}: ${data.data.length} bytes`);
  
  // Add output to terminal buffer for history and processing
  terminalBuffer.addOutput(data.agentId, data.data);
  
  // Get agent owner info
  const agent = await prisma.agents.findUnique({
    where: { id: data.agentId },
    select: { userId: true }
  }).catch(() => null);
  
  // Broadcast to all sockets connected to this agent
  const sockets = agentSockets.get(data.agentId);
  if (sockets && sockets.size > 0) {
    console.log(`📤 Broadcasting to ${sockets.size} sockets for agent ${data.agentId}`);
    
    for (const socketId of sockets) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const isOwner = agent && agent.userId === targetSocket.userId;
        
        // Send raw data to ALL viewers (xterm.js handles ANSI perfectly)
        targetSocket.emit('terminal_data', {
          type: 'data',
          agentId: data.agentId,
          data: data.data,
          timestamp: data.timestamp,
          isOwner: isOwner,
          isReadOnly: !isOwner
        });
      }
    }
  } else {
    console.log(`⚠️ No sockets connected for PTY agent ${data.agentId} - data will be buffered`);
  }
});

// Handle PTY process exit events
dockerManager.on('pty-exit', (data: { agentId: string; code: number; signal: string }) => {
  console.log(`🔌 PTY process exited for agent ${data.agentId}: code=${data.code}, signal=${data.signal}`);
  
  // Notify all connected sockets for this agent
  const sockets = agentSockets.get(data.agentId);
  if (sockets) {
    for (const socketId of sockets) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit('terminal_disconnected', { 
          agentId: data.agentId,
          code: data.code,
          signal: data.signal
        });
      }
    }
  }
  
  // Clean up
  globalSSHSessions.delete(data.agentId);
  agentSockets.delete(data.agentId);
});


// Configuration  
const PORT = process.env['PORT'] || 3001;
const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. This is critical for authentication security.');
}

// CORS configuration - TEMPORARY: Allow all origins for debugging
app.use(cors({
  origin: true, // Allow all origins temporarily
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration for OAuth
app.use(session({
  secret: (() => {
    const sessionSecret = process.env['SESSION_SECRET'];
    if (!sessionSecret) {
      throw new Error('SESSION_SECRET environment variable is required. This is critical for session security.');
    }
    return sessionSecret;
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport and configure strategies
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Add no-cache headers for all API routes in development
app.use('/api', (_req, res, next) => {
  if (process.env['NODE_ENV'] === 'development') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static files from public directory (for testing pages)
app.use('/test', express.static(path.join(__dirname, '../public')));

// Serve CSS files for pitch deck
app.use('/css', express.static(path.join(__dirname, '../../../css')));

// Serve test screenshots for pitch deck
app.use('/tests', express.static(path.join(__dirname, '../../../tests')));

// Serve founder images for pitch deck
app.use('/founders', express.static(path.join(__dirname, '../../../pitch/output/founders')));

// Serve JS files for pitch deck
app.use('/js', express.static(path.join(__dirname, '../../../js')));



// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Serve the standalone terminal test HTML
app.get('/terminal-test', (_req, res) => {
  const htmlPath = '/home/ubuntu/covibes/claude-terminal-test.html';
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading terminal test HTML:', error);
      return res.status(500).json({ error: 'Failed to read terminal test HTML' });
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// Test page for full-screen terminal - Working implementation
app.get('/chat-test', (_req, res) => {
  // Use the same HTML as /terminal-test
  const htmlPath = '/home/ubuntu/covibes/claude-terminal-test.html';
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading terminal test HTML:', error);
      // Fallback to inline HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><body><h1>Error loading terminal</h1><p>${error.message}</p></body></html>`);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// Plan Mode - Chat interface based on sugyan/claude-code-webui
app.get('/plan', (_req, res) => {
  const htmlPath = '/home/ubuntu/covibes/plan-chat-interface.html';
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading plan interface HTML:', error);
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><body><h1>Error loading plan interface</h1><p>${error.message}</p></body></html>`);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// Think Mode - Terminal interface based on siteboon/claudecodeui
app.get('/think', (_req, res) => {
  const htmlPath = '/home/ubuntu/covibes/think-terminal-interface.html';
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading think interface HTML:', error);
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><body><h1>Error loading think interface</h1><p>${error.message}</p></body></html>`);
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// Legacy inline HTML terminal (backup)
app.get('/chat-test-old', (_req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Agent Terminal - Enhanced</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #000;
      color: #0f0;
      font-family: 'Courier New', monospace;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    #header {
      background: #111;
      padding: 15px;
      border-bottom: 2px solid #0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #status {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #666;
    }
    .status-indicator.connected {
      background: #0f0;
      box-shadow: 0 0 10px #0f0;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .status-indicator.error {
      background: #f00;
      box-shadow: 0 0 10px #f00;
    }
    #terminal-container {
      flex: 1;
      padding: 10px;
      overflow: hidden;
    }
    #terminal {
      width: 100%;
      height: 100%;
    }
    button {
      background: #0f0;
      color: #000;
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      transition: all 0.3s;
    }
    button:hover {
      background: #0a0;
      box-shadow: 0 0 10px #0f0;
    }
    button:disabled {
      background: #666;
      cursor: not-allowed;
    }
    #logs {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #0f0;
      padding: 10px;
      max-width: 400px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 12px;
      display: none;
    }
    #logs.visible {
      display: block;
    }
    .log-entry {
      margin-bottom: 5px;
      padding: 2px;
    }
    .log-error {
      color: #f00;
    }
    .log-success {
      color: #0f0;
    }
    .log-info {
      color: #ff0;
    }
  </style>
</head>
<body>
  <div id="header">
    <div>
      <h1 style="color: #0f0; text-shadow: 0 0 10px #0f0;">Claude Code Terminal</h1>
    </div>
    <div id="status">
      <div class="status-item">
        <span>Socket:</span>
        <div id="socket-status" class="status-indicator"></div>
        <span id="socket-text">Disconnected</span>
      </div>
      <div class="status-item">
        <span>Agent:</span>
        <div id="agent-status" class="status-indicator"></div>
        <span id="agent-text">Not spawned</span>
      </div>
      <button id="spawn-btn" disabled>Spawn Agent</button>
      <button id="log-toggle">Show Logs</button>
    </div>
  </div>

  <div id="terminal-container">
    <div id="terminal"></div>
  </div>

  <div id="logs"></div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <script>
    // Configuration
    const BACKEND_URL = window.location.origin;
    const DEMO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTBrbGZlMWQwMDAwMTNwMGc0OWE1MzJnIiwidGVhbUlkIjoiZGVtby10ZWFtLTAwMSIsInVzZXJOYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzI1ODk5OTY0LCJleHAiOjE3NTc0MzU5NjR9.l6Gks7egUqg7Bod59r3gnjLBiAzFCQjtFvNzcrXPNt8';

    // State
    let socket = null;
    let terminal = null;
    let fitAddon = null;
    let currentAgentId = null;
    let isConnected = false;
    let isSpawning = false;

    // Logging
    const logs = [];
    const maxLogs = 50;

    function addLog(message, type = 'info') {
      const timestamp = new Date().toTimeString().split(' ')[0];
      logs.push({ timestamp, message, type });
      if (logs.length > maxLogs) logs.shift();
      updateLogDisplay();
      console.log(\`[\${type.toUpperCase()}] \${message}\`);
    }

    function updateLogDisplay() {
      const logsEl = document.getElementById('logs');
      logsEl.innerHTML = logs.map(log =>
        \`<div class="log-entry log-\${log.type}">[\${log.timestamp}] \${log.message}</div>\`
      ).reverse().join('');
    }

    // UI Updates
    function updateSocketStatus(connected) {
      const indicator = document.getElementById('socket-status');
      const text = document.getElementById('socket-text');
      const btn = document.getElementById('spawn-btn');
      if (connected) {
        indicator.className = 'status-indicator connected';
        text.textContent = 'Connected';
        btn.disabled = false;
      } else {
        indicator.className = 'status-indicator error';
        text.textContent = 'Disconnected';
        btn.disabled = true;
      }
    }

    function updateAgentStatus(status, agentId = null) {
      const indicator = document.getElementById('agent-status');
      const text = document.getElementById('agent-text');
      const btn = document.getElementById('spawn-btn');

      switch(status) {
        case 'spawning':
          indicator.className = 'status-indicator';
          text.textContent = 'Spawning...';
          btn.disabled = true;
          break;
        case 'connected':
          indicator.className = 'status-indicator connected';
          text.textContent = agentId ? agentId.substring(0, 8) : 'Connected';
          btn.disabled = true;
          break;
        case 'error':
          indicator.className = 'status-indicator error';
          text.textContent = 'Error';
          btn.disabled = !isConnected;
          break;
        default:
          indicator.className = 'status-indicator';
          text.textContent = 'Not spawned';
          btn.disabled = !isConnected;
      }
    }

    // Terminal initialization
    function initTerminal() {
      terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Consolas, "Liberation Mono", Menlo, monospace',
        theme: {
          background: '#000000',
          foreground: '#00ff00',
          cursor: '#00ff00',
          cursorAccent: '#000000'
        },
        cols: 80,
        rows: 24,
        convertEol: true,
        scrollback: 10000
      });

      fitAddon = new FitAddon.FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(document.getElementById('terminal'));
      fitAddon.fit();

      terminal.writeln('\\x1b[32m═══════════════════════════════════════════\\x1b[0m');
      terminal.writeln('\\x1b[32m     Claude Code Agent Terminal v3.0\\x1b[0m');
      terminal.writeln('\\x1b[32m═══════════════════════════════════════════\\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\\x1b[33mInitializing...\\x1b[0m');

      // Handle terminal input
      terminal.onData((data) => {
        if (currentAgentId && socket) {
          socket.emit('terminal_input', {
            agentId: currentAgentId,
            data: data
          });
        }
      });

      // Handle resize
      window.addEventListener('resize', () => {
        if (fitAddon) {
          fitAddon.fit();
          if (currentAgentId && socket) {
            socket.emit('terminal_resize', {
              agentId: currentAgentId,
              cols: terminal.cols,
              rows: terminal.rows
            });
          }
        }
      });

      addLog('Terminal initialized', 'success');
    }

    // Socket connection
    function connectSocket() {
      addLog('Connecting to server...', 'info');

      socket = io(BACKEND_URL, {
        auth: { token: DEMO_TOKEN },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      socket.on('connect', () => {
        isConnected = true;
        updateSocketStatus(true);
        addLog('Socket connected', 'success');
        terminal.writeln('\\x1b[32m✓ Connected to server\\x1b[0m');
        terminal.writeln('');

        // Auto-spawn agent on connect
        if (!currentAgentId && !isSpawning) {
          setTimeout(spawnAgent, 500);
        }
      });

      socket.on('disconnect', () => {
        isConnected = false;
        updateSocketStatus(false);
        addLog('Socket disconnected', 'error');
        terminal.writeln('\\x1b[31m✗ Disconnected from server\\x1b[0m');
      });

      socket.on('error', (error) => {
        addLog(\`Socket error: \${error}\`, 'error');
        terminal.writeln(\`\\x1b[31mError: \${error}\\x1b[0m\`);
      });

      // Terminal events
      socket.on('terminal_connected', (data) => {
        addLog(\`Terminal connected: \${JSON.stringify(data)}\`, 'success');
        terminal.writeln('\\x1b[32m✓ Terminal connected\\x1b[0m');
        terminal.writeln('');
        updateAgentStatus('connected', currentAgentId);
      });

      socket.on('terminal_data', (data) => {
        if (data && data.agentId === currentAgentId && data.data) {
          terminal.write(data.data);
        }
      });

      socket.on('terminal_error', (data) => {
        addLog(\`Terminal error: \${data.error}\`, 'error');
        terminal.writeln(\`\\x1b[31mTerminal error: \${data.error}\\x1b[0m\`);
      });

      socket.on('agent_spawned', (data) => {
        addLog(\`Agent spawned event received\`, 'info');
      });

      socket.on('claude_started', (data) => {
        addLog(\`Claude started: \${data.agentId}\`, 'success');
      });

      socket.on('reconnect', (attemptNumber) => {
        addLog(\`Reconnected after \${attemptNumber} attempts\`, 'success');
        terminal.writeln(\`\\x1b[32m✓ Reconnected to server\\x1b[0m\`);
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        addLog(\`Reconnection attempt \${attemptNumber}\`, 'info');
      });

      socket.on('reconnect_error', (error) => {
        addLog(\`Reconnection error: \${error.message}\`, 'error');
      });

      socket.on('reconnect_failed', () => {
        addLog('Failed to reconnect after maximum attempts', 'error');
        terminal.writeln('\\x1b[31m✗ Failed to reconnect to server\\x1b[0m');
      });
    }

    // Spawn agent
    async function spawnAgent() {
      if (!isConnected || isSpawning || currentAgentId) {
        addLog('Cannot spawn: not connected, already spawning, or agent exists', 'error');
        return;
      }

      isSpawning = true;
      updateAgentStatus('spawning');
      terminal.writeln('\\x1b[33mSpawning Claude Code agent...\\x1b[0m');
      addLog('Spawning agent...', 'info');

      try {
        // Join team first
        socket.emit('join-team', {
          teamId: 'demo-team-001',
          token: DEMO_TOKEN
        });

        // Small delay to ensure team join is processed
        await new Promise(r => setTimeout(r, 200));

        // Spawn agent via API
        const response = await fetch(\`\${BACKEND_URL}/api/agents/spawn\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${DEMO_TOKEN}\`
          },
          body: JSON.stringify({
            task: 'Terminal test session',
            teamId: 'demo-team-001'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(\`HTTP \${response.status}: \${errorText}\`);
        }

        const data = await response.json();
        currentAgentId = data.id || data.agentId || data.agent?.id;

        if (!currentAgentId) {
          throw new Error('No agent ID in response');
        }

        addLog(\`Agent spawned: \${currentAgentId}\`, 'success');
        terminal.writeln(\`\\x1b[32m✓ Agent spawned: \${currentAgentId}\\x1b[0m\`);
        terminal.writeln('\\x1b[33mConnecting to terminal...\\x1b[0m');

        // Connect to terminal with retry logic
        let retries = 0;
        const maxRetries = 5;
        const connectToTerminal = () => {
          socket.emit('terminal_connect', {
            agentId: currentAgentId
          });
          addLog(\`Sent terminal_connect for \${currentAgentId} (attempt \${retries + 1})\`, 'info');

          retries++;
          if (retries < maxRetries) {
            setTimeout(connectToTerminal, 1000);
          }
        };

        setTimeout(connectToTerminal, 500);

      } catch (error) {
        addLog(\`Failed to spawn agent: \${error.message}\`, 'error');
        terminal.writeln(\`\\x1b[31mError: \${error.message}\\x1b[0m\`);
        updateAgentStatus('error');
        currentAgentId = null;
      } finally {
        isSpawning = false;
      }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      initTerminal();
      connectSocket();

      // Button handlers
      document.getElementById('spawn-btn').addEventListener('click', spawnAgent);

      document.getElementById('log-toggle').addEventListener('click', () => {
        const logs = document.getElementById('logs');
        const btn = document.getElementById('log-toggle');
        if (logs.classList.contains('visible')) {
          logs.classList.remove('visible');
          btn.textContent = 'Show Logs';
        } else {
          logs.classList.add('visible');
          btn.textContent = 'Hide Logs';
        }
      });
    });
  </script>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// HTML Pitch deck endpoint (English)
app.get('/pitch', (_req, res) => {
  const htmlPath = '/home/ubuntu/covibes/pitch/output/pitch-en.html';
  console.log(`📄 Serving HTML pitch deck from: ${htmlPath}`);
  
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ HTML pitch deck not found at: ${htmlPath}`);
    return res.status(404).json({ error: 'HTML pitch deck not found' });
  }
  
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading HTML pitch deck:', error);
      return res.status(500).json({ error: 'Failed to read HTML pitch deck' });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// HTML Pitch deck endpoint (Norwegian)
app.get('/pitch/no', (_req, res) => {
  const htmlPath = '/home/ubuntu/covibes/pitch/output/pitch-no.html';
  console.log(`📄 Serving Norwegian HTML pitch deck from: ${htmlPath}`);
  
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ Norwegian HTML pitch deck not found at: ${htmlPath}`);
    return res.status(404).json({ error: 'Norwegian HTML pitch deck not found' });
  }
  
  fs.readFile(htmlPath, 'utf8', (error, html) => {
    if (error) {
      console.error('Error reading Norwegian HTML pitch deck:', error);
      return res.status(500).json({ error: 'Failed to read Norwegian HTML pitch deck' });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// Legacy markdown pitch deck endpoint  
app.get('/pitch/md', (_req, res) => {
  const markdownPath = path.join(__dirname, '../../../pitch.md');
  console.log(`📄 Serving markdown pitch deck from: ${markdownPath}`);
  
  if (!fs.existsSync(markdownPath)) {
    console.error(`❌ Pitch deck not found at: ${markdownPath}`);
    return res.status(404).json({ error: 'Pitch deck not found' });
  }
  
  fs.readFile(markdownPath, 'utf8', (error, markdown) => {
    if (error) {
      console.error('Error reading pitch deck:', error);
      return res.status(500).json({ error: 'Failed to read pitch deck' });
    }

    // Convert markdown to HTML with professional styling
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ColabVibe: AI Workforce Management Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.7;
            color: #1a202c;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            min-height: 100vh;
        }
        .header {
            background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
            color: white;
            padding: 60px 40px;
            text-align: center;
        }
        .content {
            padding: 40px;
        }
        h1 {
            font-size: 3em;
            font-weight: 700;
            margin-bottom: 0.5em;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .tagline {
            font-size: 1.4em;
            opacity: 0.9;
            font-weight: 500;
        }
        h2 {
            color: #2d3748;
            font-size: 2.2em;
            font-weight: 600;
            margin: 50px 0 30px;
            border-left: 4px solid #667eea;
            padding-left: 20px;
        }
        h3 {
            color: #4a5568;
            font-size: 1.6em;
            font-weight: 600;
            margin: 30px 0 20px;
        }
        h4 {
            color: #667eea;
            font-weight: 600;
            font-size: 1.2em;
            margin: 20px 0 10px;
        }
        p {
            margin-bottom: 1.5em;
            font-size: 1.1em;
        }
        ul, ol {
            margin: 0 0 1.5em 1.5em;
        }
        li {
            margin-bottom: 0.8em;
            font-size: 1.05em;
        }
        strong {
            color: #2d3748;
            font-weight: 600;
        }
        hr {
            border: none;
            height: 3px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            margin: 50px 0;
            border-radius: 2px;
        }
        .emoji {
            font-size: 1.2em;
        }
        @media (max-width: 768px) {
            .container { margin: 0; }
            .header { padding: 40px 20px; }
            .content { padding: 30px 20px; }
            h1 { font-size: 2.2em; }
            h2 { font-size: 1.8em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ColabVibe</h1>
            <p class="tagline">AI Workforce Management Platform</p>
        </div>
        <div class="content">
            ${markdown
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/# (.*)/g, '<h1>$1</h1>')
              .replace(/## (.*)/g, '<h2>$1</h2>')
              .replace(/### (.*)/g, '<h3>$1</h3>')
              .replace(/#### (.*)/g, '<h4>$1</h4>')
              .replace(/---/g, '<hr>')
              .replace(/^- (.*)/gm, '<li>$1</li>')
              .replace(/^\d+\. (.*)/gm, '<li>$1</li>')
              .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
              .replace(/\n\n/g, '</p><p>')
              .replace(/^\*\*(.*)\*\*$/gm, '<p><strong>$1</strong></p>')
              .replace(/^([^<].*)$/gm, '<p>$1</p>')
              .replace(/<p><\/p>/g, '')
              .replace(/<p>(<h[1-6]>)/g, '$1')
              .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
              .replace(/<p>(<hr>)<\/p>/g, '$1')
              .replace(/<p>(<ul>)/g, '$1')
              .replace(/(<\/ul>)<\/p>/g, '$1')
            }
        </div>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(htmlContent);
  });
});

// Pitch deck viewer endpoint (HTML page with embedded PDF)
app.get('/pitch/viewer', (_req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ColabVibe Pitch Deck</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0b;
            color: #ffffff;
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 1rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #333;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .logo {
            font-size: 1.5rem;
            font-weight: bold;
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .nav {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .nav a {
            color: #94a3b8;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        
        .nav a:hover {
            color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.3);
        }
        
        .pdf-container {
            height: calc(100vh - 80px);
            width: 100%;
            position: relative;
        }
        
        .pdf-embed {
            width: 100%;
            height: 100%;
            border: none;
            background: #fff;
        }
        
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #94a3b8;
        }
        
        .spinner {
            border: 3px solid #333;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error {
            color: #ef4444;
            text-align: center;
            padding: 2rem;
        }
        
        @media (max-width: 768px) {
            .header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .logo {
                font-size: 1.2rem;
            }
            
            .nav {
                flex-wrap: wrap;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">ColabVibe</div>
        <nav class="nav">
            <a href="/">← Back to App</a>
            <a href="/pitch" target="_blank">Download PDF</a>
            <a href="https://github.com/colabvibe/colabvibe" target="_blank">GitHub</a>
        </nav>
    </div>
    
    <div class="pdf-container">
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Loading pitch deck...</p>
        </div>
        <embed 
            class="pdf-embed" 
            src="/pitch#toolbar=1&navpanes=0&scrollbar=1" 
            type="application/pdf"
            onload="document.getElementById('loading').style.display='none'"
            onerror="showError()"
        />
    </div>

    <script>
        function showError() {
            document.getElementById('loading').innerHTML = 
                '<div class="error">Failed to load PDF. <a href="/pitch" target="_blank">Click here to download</a></div>';
        }
        
        // Hide loading after 5 seconds if PDF hasn't loaded
        setTimeout(() => {
            const loading = document.getElementById('loading');
            if (loading.style.display !== 'none') {
                loading.style.display = 'none';
            }
        }, 5000);
    </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Demo endpoints (public, no auth required)
app.get('/api/agents/demo/chat-agent', async (req: express.Request, res: express.Response) => {
  try {
    const crypto = await import('crypto');
    const jwtModule = await import('jsonwebtoken');
    const jwt = jwtModule.default;

    // Create a demo team and user for this session
    const demoId = crypto.randomBytes(8).toString('hex');
    const teamId = `demo-team-${demoId}`;
    const userId = `demo-user-${demoId}`;

    // Create demo team
    await prisma.teams.create({
      data: {
        id: teamId,
        name: 'Chat Agent Demo',
        teamCode: `DEMO${demoId}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create demo user
    await prisma.users.create({
      data: {
        id: userId,
        email: `demo-${demoId}@example.com`,
        userName: 'Demo User',
        password: 'demo-password',
        teamId: teamId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Generate a temporary JWT token for the demo session
    const token = jwt.sign(
      {
        userId,
        email: `demo-${demoId}@example.com`,
        teamId
      },
      process.env['JWT_SECRET'] || 'demo-secret',
      { expiresIn: '1h' }
    );

    // Return demo credentials
    res.json({
      success: true,
      demo: {
        token,
        teamId,
        userId,
        teamCode: `DEMO${demoId}`,
        expiresIn: '1 hour',
        features: {
          chatAgents: true,
          terminalAgents: false,
          persistentData: false
        },
        instructions: [
          'This is a temporary demo session that expires in 1 hour',
          'Chat agents run without spawning terminal sessions',
          'Messages are processed using Claude\'s non-interactive mode',
          'No persistent data - session will be cleaned up after expiry'
        ]
      }
    });

    // Schedule cleanup after 1 hour
    setTimeout(async () => {
      try {
        // Clean up demo agents
        await prisma.agents.deleteMany({ where: { teamId } });
        // Clean up demo messages
        await prisma.messages.deleteMany({ where: { teamId } });
        // Clean up demo user
        await prisma.users.delete({ where: { id: userId } });
        // Clean up demo team
        await prisma.teams.delete({ where: { id: teamId } });
      } catch (error) {
        console.error(`Failed to cleanup demo session ${demoId}:`, error);
      }
    }, 60 * 60 * 1000); // 1 hour

  } catch (error: any) {
    console.error('Demo session creation error:', error);
    res.status(500).json({
      error: 'Failed to create demo session',
      message: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', authenticateToken, agentRoutes);
app.use('/api/team', authenticateToken, teamRoutes);
app.use('/api/vm', authenticateToken, vmRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/ide', ideRoutes);
app.use('/api/terminal', terminalRoutes); // No auth required for testing
app.use('/api/layout', authenticateToken, layoutRoutes); // Layout persistence requires authentication
app.use('/api/workspace', authenticateToken, workspaceRoutes); // Workspace persistence requires authentication
console.log('🎯 Demo routes registered');


// Special-case proxy for Vite dev absolute module paths when loaded via
// /api/preview/proxy/:teamId/:branch/.
// Some dev HTML (or 3rd-party templates) reference root-absolute URLs like
// "/@vite/client", "/@react-refresh", "/src/*" or "/assets/*". When the
// preview is embedded under the API proxy path, those requests would miss the
// preview proxy and hit this server instead, often returning HTML which causes
// "Failed to load module script (text/html)" errors. We detect such requests
// by checking the Referer and transparently forward them to the correct team
// preview container.
// VITE-ROUTER: Fix "Failed to load module script: text/html" errors
// This middleware detects JavaScript module requests that are incorrectly served as HTML
// and routes them to the correct team preview container based on Referer header.
app.use(async (req, res, next) => {
  const path = req.path || '';
  const referer = req.get('Referer') || '';
  
  // Check if this is a JavaScript file or Vite asset
  const isJSFile = path.match(/\.(js|jsx|ts|tsx|mjs)(\?.*)?$/);
  const isViteAsset = (
    path === '/@vite/client' ||
    path === '/@react-refresh' ||
    path.startsWith('/src/') ||
    path.startsWith('/node_modules/') ||
    path.startsWith('/@fs/') ||
    path.startsWith('/@id/')
  );
  
  // IMPORTANT: Exclude /assets/ from middleware to avoid interfering with production assets
  const isProductionAsset = path.startsWith('/assets/');
  
  // Skip if not a JS file/asset or if it's a production asset
  if ((!isJSFile && !isViteAsset) || isProductionAsset) {
    return next();
  }
  
  // Extract team from referer if present
  const teamMatch = referer.match(/\/api\/preview\/proxy\/([^\/]+)\/main\//);
  if (!teamMatch) {
    console.log(`🔍 [VITE-ROUTER] No team found in referer, passing through: ${path}`);
    return next();
  }
  
  const teamId = teamMatch[1];
  console.log(`🔍 [VITE-ROUTER] Routing ${path} to team ${teamId} based on referer`);
  
  // Forward to team preview proxy using Express redirect
  const proxyUrl = `/api/preview/proxy/${teamId}/main${path}`;
  console.log(`🔄 [VITE-ROUTER] Redirecting: ${req.originalUrl} -> ${proxyUrl}`);
  
  // Send an HTTP redirect to let the browser re-request the correct URL
  res.redirect(302, proxyUrl);
  
  console.log(`✅ [VITE-ROUTER] Sent redirect for ${path} to ${proxyUrl}`);
  return;
});

// Handle /preview/:teamId/* routes - redirect to proper proxy path (BEFORE static middleware!)
app.get('/preview/:teamId/*', async (req, res) => {
  const { teamId } = req.params;
  const subPath = (req.params as any)[0] || ''; // Get everything after teamId/

  console.log(`🔄 [PREVIEW-REDIRECT] Handling /preview/${teamId}/${subPath}`);

  // Redirect to the proper API proxy path
  const proxyPath = `/api/preview/proxy/${teamId}/main/${subPath}`;
  console.log(`🔄 [PREVIEW-REDIRECT] Redirecting to: ${proxyPath}`);

  res.redirect(302, proxyPath);
});

// Serve static files from React build (AFTER API routes and preview routes to prevent interference)
console.log('🔍 [DEBUG] process.cwd():', process.cwd());
console.log('🔍 [DEBUG] static path:', path.join(process.cwd(), '../client/dist'));
app.use(express.static(path.join(process.cwd(), '../client/dist'), {
  setHeaders: (res) => {
    if (process.env['NODE_ENV'] === 'development') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Catch-all route - serve React app for all non-API routes
app.get('*', (req, res) => {
  // Check if it's a mobile device
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos|mobile/i.test(userAgent);

  // Mobile users get the same app - it's already responsive
  if (isMobile && req.path === '/') {
    console.log('📱 Mobile user detected, serving responsive app:', userAgent);
    // Removed hardcoded demo-team-001 redirect - serve main app instead
  }

  res.sendFile(path.join(process.cwd(), 'client/dist/index.html'));
});

// WebSocket connection handling
// Note: Socket properties are now extended via module augmentation in socket-ext.d.ts

// Store active team connections
const teamConnections = new Map<string, Set<string>>();

// Store online users per team by user ID (not socket ID) to prevent duplicates
const teamOnlineUsers = new Map<string, Map<string, { 
  id: string; 
  name: string; 
  email: string; 
  lastActivity?: string;
  device?: string;
  socketIds: Set<string>; // Track all sockets for this user
}>>();

// Global SSH session store - agent-scoped, not socket-scoped
const globalSSHSessions = new Map<string, GlobalSSHSession>();

// Track active sockets per agent for broadcasting
const agentSockets = new Map<string, Set<string>>();

io.on('connection', (socket: Socket) => {
  console.log(`🔗 Client connected: ${socket.id}`);
  
  // Prevent EventEmitter memory leaks
  socket.setMaxListeners(50);
  
  // Debug: Log all incoming events
  socket.onAny((eventName, ...args) => {
    if (eventName.includes('terminal') || eventName.includes('connect') || eventName.includes('ssh')) {
      console.log(`🔍 WebSocket event: ${eventName}`, args);
    }
  });

  // DEBUG: Log ALL incoming WebSocket events to debug message sending
  socket.onAny((eventName, ...args) => {
    // Log everything except heartbeat events
    if (!eventName.includes('ping') && !eventName.includes('pong') && !eventName.includes('heartbeat')) {
      console.log(`🔍 [WEBSOCKET] Event received: "${eventName}"`, args.length > 0 ? JSON.stringify(args[0]).substring(0, 200) : 'no data');
    }
  });

  // Also log when messages are sent FROM server
  const originalEmit = socket.emit;
  socket.emit = function(eventName: string, ...args: any[]) {
    if (!eventName.includes('ping') && !eventName.includes('pong')) {
      console.log(`📤 [WEBSOCKET] Event sent: "${eventName}"`, args.length > 0 ? JSON.stringify(args[0]).substring(0, 100) : 'no data');
    }
    return originalEmit.apply(this, [eventName, ...args]);
  };

  // Handle team joining
  socket.on('join-team', async (data: { teamId: string; token: string }) => {
    try {
      console.log('🔐 Join team attempt:', { 
        teamId: data.teamId, 
        hasToken: !!data.token,
        tokenLength: data.token?.length 
      });
      
      // Verify JWT token
      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      const userId = decoded.userId;

      // Get user information from database
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: { teams: true }
      });

      if (!user || user.teamId !== data.teamId) {
        socket.emit('error', { message: 'Invalid team access' });
        return;
      }


      // Set socket user information
      socket.userId = userId;
      socket.teamId = data.teamId;
      socket.userName = user?.userName || 'Unknown';

      // Join socket room for team
      socket.join(data.teamId);

      // Track team connections
      if (!teamConnections.has(data.teamId)) {
        teamConnections.set(data.teamId, new Set());
      }
      teamConnections.get(data.teamId)!.add(socket.id);

      // Track online users by userId to prevent duplicates
      if (!teamOnlineUsers.has(data.teamId)) {
        teamOnlineUsers.set(data.teamId, new Map());
      }
      const teamUsers = teamOnlineUsers.get(data.teamId)!;
      
      // Check if user already exists
      const existingUser = teamUsers.get(userId);
      if (existingUser) {
        // Add this socket to existing user's socket list
        existingUser.socketIds.add(socket.id);
        existingUser.lastActivity = new Date().toISOString();
      } else {
        // Create new user entry
        teamUsers.set(userId, {
          id: userId,
          name: user?.userName || 'Unknown',
          email: user?.email || '',
          lastActivity: new Date().toISOString(),
          device: 'desktop', // Default, will be updated by activity ping
          socketIds: new Set([socket.id])
        });
      }

      // Get team members, recent agents, and recent messages
      const teamData = await prisma.teams.findUnique({
        where: { id: data.teamId },
        include: {
          users: {
            select: { id: true, userName: true, email: true, vmId: true }
          },
          agents: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              users: { select: { userName: true } }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              users: { select: { userName: true } }
            }
          }
        }
      });

      // Load recent messages and format them for the client
      const recentMessages = teamData?.messages?.reverse().map(msg => ({
        id: msg.id,
        userId: msg.userId,
        user: {
          userName: msg.users.userName
        },
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        teamId: msg.teamId
      })) || [];

      // Get current online users for this team (without socketIds for client)
      const onlineUsersList = Array.from(
        teamOnlineUsers.get(data.teamId)?.values() || []
      ).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        lastActivity: u.lastActivity,
        device: u.device,
        isOnline: true
      }));

      socket.emit('team-joined', {
        teamData,
        messages: recentMessages,
        connectedUsers: teamConnections.get(data.teamId)?.size || 0,
        onlineUsers: onlineUsersList
      });

      // Notify other team members of new connection
      socket.to(data.teamId).emit('user-connected', {
        userId,
        userName: user?.userName || 'Unknown',
        userEmail: user?.email || '',
        connectedUsers: teamConnections.get(data.teamId)?.size || 0
      });

    } catch (error) {
      console.error('Error joining team:', error);
      socket.emit('error', { message: 'Failed to join team' });
    }
  });

  // Handle activity pings
  socket.on('activity-ping', async (data: { timestamp: Date; device: string }) => {
    if (!socket.userId || !socket.teamId) {
      return;
    }

    try {
      const activityData = {
        userId: socket.userId,
        lastActivity: new Date(data.timestamp).toISOString(),
        device: data.device
      };

      // Broadcast activity update to all team members
      io.to(socket.teamId).emit('user-activity', activityData);

      // Update online users tracking by userId
      if (teamOnlineUsers.has(socket.teamId)) {
        const userMap = teamOnlineUsers.get(socket.teamId)!;
        const userInfo = userMap.get(socket.userId); // Use userId not socketId
        if (userInfo) {
          userInfo.lastActivity = activityData.lastActivity;
          userInfo.device = data.device;
        }
      }
    } catch (error) {
      console.error('Error handling activity ping:', error);
    }
  });

  // Handle chat messages
  socket.on('chat-message', async (data: { message: string; teamId: string }) => {
    if (!socket.userId || !socket.teamId || socket.teamId !== data.teamId) {
      socket.emit('error', { message: 'Not authenticated or invalid team' });
      return;
    }

    try {
      // Save message to database
      const savedMessage = await prisma.messages.create({
        data: {
          id: crypto.randomUUID(),
          content: data.message,
          userId: socket.userId!,
          teamId: data.teamId
        }
      });

      // Create message data for broadcast
      const messageData = {
        id: savedMessage.id,
        userId: socket.userId,
        user: {
          userName: socket.userName!
        },
        content: data.message,
        createdAt: savedMessage.createdAt.toISOString(),
        teamId: data.teamId
      };

      // Broadcast message to all team members
      io.to(data.teamId).emit('chat-message', messageData);

      // Check for @mentions of agents
      const mentionMatch = data.message.match(/@(\w+)/g);
      if (mentionMatch) {
        // Get all running agents in the team
        const agents = await prisma.agents.findMany({
          where: {
            teamId: data.teamId,
            status: 'running'
          }
        });

        for (const mention of mentionMatch) {
          const agentName = mention.substring(1); // Remove @ symbol
          
          // Find matching agent (case insensitive, partial match)
          const matchingAgent = agents.find(agent => {
            const name = agent.agentName || '';
            // Match first name only (e.g., @theo matches "Theo Foster")
            const firstName = name.split(' ')[0] || '';
            return firstName.toLowerCase() === agentName.toLowerCase() ||
                   name.toLowerCase().includes(agentName.toLowerCase()) ||
                   name.toLowerCase().replace(/\s+/g, '').includes(agentName.toLowerCase());
          });

          if (matchingAgent) {
            // Agent was mentioned! Send a response after a short delay
            setTimeout(async () => {
              try {
                // Extract the question/context after the mention
                const mentionIndex = data.message.toLowerCase().indexOf(`@${agentName.toLowerCase()}`);
                const messageAfterMention = data.message.substring(mentionIndex + mention.length).trim();
                
                // Generate appropriate response based on context
                let response = '';
                if (messageAfterMention.includes('?')) {
                  // It's a question
                  response = `Hello ${socket.userName}! I'm ${matchingAgent.agentName}, currently working on: "${matchingAgent.task}". How can I help you with that?`;
                } else if (messageAfterMention.toLowerCase().includes('status')) {
                  // Status request
                  response = `Status update: I'm actively working on "${matchingAgent.task}". Everything is running smoothly!`;
                } else if (messageAfterMention.toLowerCase().includes('help')) {
                  // Help request
                  response = `I'm here to help! I'm ${matchingAgent.agentName}, an AI agent focused on: "${matchingAgent.task}". Feel free to ask me anything related to my current task.`;
                } else {
                  // General acknowledgment
                  response = `Hi ${socket.userName}! You mentioned me. I'm currently working on: "${matchingAgent.task}". What would you like to know?`;
                }

                // Send agent response using the agent chat service
                await agentChatService.sendAgentMessage({
                  agentId: matchingAgent.id,
                  agentName: matchingAgent.agentName || `Agent ${matchingAgent.id.slice(-6)}`,
                  message: response,
                  teamId: data.teamId,
                  type: 'info'
                });
              } catch (error) {
                console.error('Error sending agent mention response:', error);
              }
            }, 1000); // 1 second delay for natural feel
          }
        }
      }

    } catch (error) {
      console.error('Error handling chat message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle agent chat messages
  socket.on('agent-chat-message', async (data: { 
    agentId: string; 
    message: string; 
    teamId: string 
  }) => {
    if (!socket.userId || !socket.teamId || socket.teamId !== data.teamId) {
      socket.emit('error', { message: 'Not authenticated or invalid team' });
      return;
    }

    try {
      // Verify agent exists and belongs to the team
      const agent = await prisma.agents.findFirst({
        where: {
          id: data.agentId,
          teamId: data.teamId,
          userId: socket.userId // Only allow owner to send messages on behalf of agent
        }
      });

      if (!agent) {
        socket.emit('error', { message: 'Agent not found or unauthorized' });
        return;
      }

      // Create agent message in database
      // Using a special format to distinguish agent messages
      const agentMessage = await prisma.messages.create({
        data: {
          id: crypto.randomUUID(),
          content: `[AGENT:${agent.agentName || agent.id}] ${data.message}`,
          userId: socket.userId!,
          teamId: data.teamId
        }
      });

      // Create message data for broadcast with agent metadata
      const messageData = {
        id: agentMessage.id,
        userId: `agent-${agent.id}`, // Use a special agent userId format
        user: {
          userName: agent.agentName || `Agent ${agent.id.slice(-6)}`
        },
        content: data.message,
        createdAt: agentMessage.createdAt.toISOString(),
        teamId: data.teamId,
        isAgent: true,
        agentId: agent.id,
        agentType: agent.type,
        type: 'agent' // Explicitly set message type
      };

      // Broadcast agent message to all team members
      io.to(data.teamId).emit('chat-message', messageData);

    } catch (error) {
      console.error('Error handling agent chat message:', error);
      socket.emit('error', { message: 'Failed to send agent message' });
    }
  });

  // Handle agent spawning
  socket.on('spawn-agent', async (data: { 
    type: string; 
    task: string; 
    repositoryUrl?: string;
    teamId: string;
  }) => {
    if (!socket.userId || !socket.teamId || socket.teamId !== data.teamId) {
      socket.emit('error', { message: 'Not authenticated or invalid team' });
      return;
    }

    try {
      // Create agent record in database
      const agent = await prisma.agents.create({
        data: {
          id: crypto.randomUUID(),
          userId: socket.userId!,
          teamId: data.teamId,
          type: data.type,
          task: data.task,
          repositoryUrl: data.repositoryUrl || null,
          status: 'spawning',
          updatedAt: new Date()
        },
        include: {
          users: { select: { userName: true } }
        }
      });

      // Notify team about new agent
      io.to(data.teamId).emit('agent-spawned', {
        agent: {
          ...agent,
          userName: agent.users.userName
        }
      });

      // Start agent execution (this would integrate with your agent service)
      // For now, emit status updates
      setTimeout(() => {
        io.to(data.teamId).emit('agent-status', {
          agentId: agent.id,
          status: 'running',
          message: `Agent ${agent.type} is now running task: ${agent.task}`
        });
      }, 1000);


    } catch (error) {
      console.error('Error spawning agent:', error);
      socket.emit('error', { message: 'Failed to spawn agent' });
    }
  });

  // Handle agent stop requests
  socket.on('stop-agent', async (data: { agentId: string; teamId: string }) => {
    if (!socket.userId || !socket.teamId || socket.teamId !== data.teamId) {
      socket.emit('error', { message: 'Not authenticated or invalid team' });
      return;
    }

    try {
      // Update agent status
      const agent = await prisma.agents.update({
        where: { id: data.agentId },
        data: { status: 'stopped' }
      });

      // Notify team about agent stop
      io.to(data.teamId).emit('agent-status', {
        agentId: agent.id,
        status: 'stopped',
        message: 'Agent stopped by user request'
      });

    } catch (error) {
      console.error('Error stopping agent:', error);
      socket.emit('error', { message: 'Failed to stop agent' });
    }
  });

  // Terminal event handlers - NEW PTY-based direct connection
  socket.on('terminal_connect', async (data: { agentId: string }) => {
    console.log('🔌 PTY TERMINAL CONNECT EVENT RECEIVED!');
    console.log('🔌 PTY Terminal connect requested:', { 
      agentId: data.agentId, 
      userId: socket.userId, 
      teamId: socket.teamId,
      authenticated: !!(socket.userId && socket.teamId)
    });
    
    if (!socket.userId || !socket.teamId) {
      console.log('❌ PTY Terminal connect denied: Not authenticated');
      socket.emit('terminal_error', { 
        agentId: data.agentId, 
        error: 'Not authenticated' 
      });
      return;
    }

    try {
      // Track this socket for the agent - prevent duplicates
      if (!agentSockets.has(data.agentId)) {
        agentSockets.set(data.agentId, new Set());
      }
      const sockets = agentSockets.get(data.agentId)!;
      
      // Check if this socket is already connected to this agent
      if (sockets.has(socket.id)) {
        console.log(`⚠️ Socket ${socket.id} already connected to agent ${data.agentId}`);

        // Send buffered history when reconnecting
        const history = terminalBuffer.getHistory(data.agentId);
        if (history.length > 0) {
          console.log(`📜 Sending ${history.length} history entries for agent ${data.agentId}`);
          for (const entry of history) {
            socket.emit('terminal_data', {
              agentId: data.agentId,
              data: entry.output
            });
          }
        }

        socket.emit('terminal_connected', { agentId: data.agentId });
        return;
      }
      
      // Connection deduplication: Only allow one connection per user per agent
      const existingUserSockets = Array.from(sockets).filter(socketId => {
        const existingSocket = io.sockets.sockets.get(socketId);
        return existingSocket && existingSocket.userId === socket.userId;
      });
      
      if (existingUserSockets.length > 0) {
        console.log(`🔄 Replacing ${existingUserSockets.length} existing connections for user ${socket.userId} on agent ${data.agentId}`);
        for (const oldSocketId of existingUserSockets) {
          sockets.delete(oldSocketId);
          const oldSocket = io.sockets.sockets.get(oldSocketId);
          if (oldSocket) {
            oldSocket.emit('terminal_replaced', { 
              agentId: data.agentId,
              message: 'Connection replaced by new tab' 
            });
          }
        }
      }
      
      sockets.add(socket.id);
      
      console.log('🎯 Checking for existing PTY process for agent:', data.agentId);
      
      // Check if PTY process already exists for this agent
      const existingPTY = dockerManager.getPTYProcess(data.agentId);
      if (existingPTY) {
        console.log('♻️ Reusing existing PTY process for agent:', data.agentId);

        // Send buffered history when reconnecting to existing PTY
        const history = terminalBuffer.getHistory(data.agentId);
        if (history.length > 0) {
          console.log(`📜 Sending ${history.length} history entries for existing PTY agent ${data.agentId}`);
          for (const entry of history) {
            socket.emit('terminal_data', {
              agentId: data.agentId,
              data: entry.output
            });
          }
        }

        socket.emit('terminal_connected', {
          agentId: data.agentId,
          message: 'Connected to existing PTY session'
        });
        return;
      }
      
      console.log('🚀 No existing PTY found, agent should already have been spawned');
      
      // The PTY process should have been created when the agent was spawned
      // If it doesn't exist, check if the agent still exists in database
      const ptyInfo = dockerManager.getPTYSessionInfo(data.agentId);
      if (!ptyInfo) {
        // Check if agent exists in database and its current status
        const dbAgent = await prisma.agents.findUnique({
          where: { id: data.agentId }
        });
        
        if (!dbAgent) {
          socket.emit('terminal_error', { 
            agentId: data.agentId, 
            error: 'Agent not found. This agent may have been deleted.',
            action: 'refresh_page'
          });
          return;
        }
        
        if (dbAgent.status === 'stopped') {
          socket.emit('terminal_error', { 
            agentId: data.agentId, 
            error: 'Agent is stopped. Terminal session is no longer available.',
            action: 'show_restart_option',
            suggestion: 'You can restart this agent or spawn a new one.'
          });
          return;
        }
        
        // Agent exists but no PTY - likely server restart
        socket.emit('terminal_error', { 
          agentId: data.agentId, 
          error: 'PTY session not found. The server may have been restarted.',
          action: 'show_restart_option',
          suggestion: 'Try refreshing the page or spawn a new agent.'
        });
        return;
      }
      
      // PTY data handlers are already attached in DockerManager - just track socket connection
      const ptyProcess = ptyInfo.ptyProcess;
      
      // Store PTY session in global sessions for this agent
      globalSSHSessions.set(data.agentId, { 
        client: null, // Not used in PTY mode
        stream: null, // Not used in PTY mode
        process: ptyProcess,
        agentId: data.agentId 
      });
      
      console.log(`✅ PTY terminal connected for agent: ${data.agentId}`);
      
      // Check if user is the owner of this agent
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        select: { userId: true }
      });
      
      const isOwner = agent && agent.userId === socket.userId;
      
      // CRITICAL FIX: Don't send buffered output to ANYONE
      // Buffered output contains carriage returns that don't work when sent all at once
      // Both owners and observers should only see live streaming data to preserve terminal behavior
      console.log(`🔌 ${isOwner ? 'Owner' : 'Observer'} connected to agent ${data.agentId} - live stream only (no buffered output to preserve ANSI sequences)`);
      
      // TEMP TEST: Disable buffered output for everyone to test if this fixes observer terminals
      /*
      if (isOwner) {
        // Owners can receive buffered output since they likely spawned the agent
        const bufferedOutput = dockerManager.getPTYOutputBuffer(data.agentId);
        if (bufferedOutput) {
          console.log(`📜 Sending ${bufferedOutput.length} bytes of buffered output to owner`);
          socket.emit('terminal_data', {
            type: 'data',
            agentId: data.agentId,
            data: bufferedOutput,
            timestamp: Date.now(),
            buffered: true
          });
        }
      }
      */
      
      // Don't send history to anyone - prevents carriage return issues
      // Both owners and viewers start with live stream only
      if (!isOwner) {
        console.log(`👁️ Read-only viewer connected to agent ${data.agentId} - starting live stream (no history)`);
      } else {
        console.log(`🔌 Owner connected to agent ${data.agentId} - live stream only`);
      }
      
      // Add subscriber to terminal buffer for future updates
      terminalBuffer.addSubscriber(data.agentId, socket.id, socket.userId!);
      
      // Notify client that terminal is connected with subscriber count
      const subscriberCount = terminalBuffer.getSubscriberCount(data.agentId);
      socket.emit('terminal_connected', {
        agentId: data.agentId,
        message: 'PTY session established',
        protocol: 'pty-raw-bytes',
        subscriberCount: subscriberCount
      });
      
      socket.emit('claude_started', { agentId: data.agentId, protocol: 'pty' });
      
    } catch (error) {
      console.error('PTY Terminal connect error:', error);
      socket.emit('terminal_error', {
        agentId: data.agentId,
        error: `Failed to establish PTY connection: ${(error as Error).message}`
      });
    }
  });

  socket.on('terminal_input', async (data: { agentId: string; type?: string; data: string }) => {
    if (!socket.userId || !socket.teamId) {
      return;
    }

    try {
      // SECURITY CHECK: Verify agent ownership before allowing terminal input
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        select: { userId: true, status: true }
      });

      if (!agent) {
        socket.emit('terminal_error', {
          agentId: data.agentId,
          error: 'Agent not found'
        });
        return;
      }

      if (agent.userId !== socket.userId) {
        console.warn(`🚨 User ${socket.userId} attempted to send input to agent ${data.agentId} owned by ${agent.userId}`);
        socket.emit('terminal_error', {
          agentId: data.agentId,
          error: 'Permission denied: You can only send input to your own agents'
        });
        return;
      }

      // Additional check: only allow input to running agents
      if (agent.status !== 'running') {
        socket.emit('terminal_error', {
          agentId: data.agentId,
          error: `Cannot send input to ${agent.status} agent`
        });
        return;
      }
      
      // NEW PTY PROTOCOL: Write directly to PTY process
      const success = dockerManager.writeToPTY(data.agentId, data.data);
      
      if (!success) {
        // Fallback to legacy SSH session if PTY not available
        const session = globalSSHSessions.get(data.agentId);
        
        if (session?.stream) {
          // Legacy SSH mode
          session.stream.write(data.data);
        } else {
          socket.emit('terminal_error', {
            agentId: data.agentId,
            error: 'No active terminal session found'
          });
        }
      }
      
    } catch (error) {
      console.error('PTY Terminal input error:', error);
      socket.emit('terminal_error', {
        agentId: data.agentId,
        error: 'Failed to send input to PTY process'
      });
    }
  });

  // Handle agent_input events from frontend (same as agent_chat_message but different event name)
  socket.on('agent_input', async (data: { agentId: string; input: string }) => {
    console.log(`🔍 [DEBUG] Received agent_input event:`, {
      agentId: data.agentId,
      input: data.input,
      userId: socket.userId,
      teamId: socket.teamId
    });

    if (!socket.userId || !socket.teamId) {
      console.log(`❌ [DEBUG] Missing auth - userId: ${socket.userId}, teamId: ${socket.teamId}`);
      return;
    }

    try {
      // SECURITY CHECK: Verify agent ownership and chat mode
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        select: { userId: true, status: true, mode: true, sessionId: true }
      });

      if (!agent) {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'Agent not found'
        });
        return;
      }

      if (agent.userId !== socket.userId) {
        console.warn(`🚨 User ${socket.userId} attempted to send input to agent ${data.agentId} owned by ${agent.userId}`);
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'Permission denied: You can only send input to your own agents'
        });
        return;
      }

      if (agent.mode !== 'chat') {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'This agent is in terminal mode, not chat mode'
        });
        return;
      }

      if (agent.status !== 'running') {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: `Cannot send input to ${agent.status} agent`
        });
        return;
      }

      // For chat mode, execute Claude command non-interactively
      console.log(`💬 Processing agent input for agent ${data.agentId}: ${data.input}`);

      // Send user message to chat
      await agentChatService.sendAgentMessage({
        agentId: data.agentId,
        agentName: `User`,
        message: data.input,
        teamId: socket.teamId,
        type: 'info'
      });

      try {
        // Execute Claude command non-interactively
        const response = await claudeExecutor.executeCommand({
          agentId: data.agentId,
          message: data.input,
          userId: socket.userId,
          teamId: socket.teamId,
          ...(agent.sessionId ? { sessionId: agent.sessionId } : {})
        });

        // Send Claude's response to chat
        await agentChatService.sendAgentMessage({
          agentId: data.agentId,
          agentName: `Agent`,
          message: response,
          teamId: socket.teamId,
          type: 'success'
        });

        console.log(`✅ Agent input processed successfully for agent ${data.agentId}`);

      } catch (executeError) {
        console.error(`❌ Error executing agent input for ${data.agentId}:`, executeError);

        await agentChatService.sendAgentMessage({
          agentId: data.agentId,
          agentName: `Agent`,
          message: `Error: ${executeError instanceof Error ? executeError.message : String(executeError)}`,
          teamId: socket.teamId,
          type: 'error'
        });
      }

    } catch (error) {
      console.error('Agent input error:', error);
      socket.emit('agent_chat_error', {
        agentId: data.agentId,
        error: 'Failed to process agent input'
      });
    }
  });

  socket.on('agent_chat_message', async (data: { agentId: string; message: string }) => {
    if (!socket.userId || !socket.teamId) {
      return;
    }

    try {
      // SECURITY CHECK: Verify agent ownership and chat mode
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        select: { userId: true, status: true, mode: true, sessionId: true }
      });

      if (!agent) {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'Agent not found'
        });
        return;
      }

      if (agent.userId !== socket.userId) {
        console.warn(`🚨 User ${socket.userId} attempted to send chat to agent ${data.agentId} owned by ${agent.userId}`);
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'Permission denied: You can only chat with your own agents'
        });
        return;
      }

      if (agent.mode !== 'chat') {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: 'This agent is in terminal mode, not chat mode'
        });
        return;
      }

      if (agent.status !== 'running') {
        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: `Cannot send message to ${agent.status} agent`
        });
        return;
      }

      // For chat mode, execute Claude command non-interactively
      console.log(`💬 Processing chat message for agent ${data.agentId}`);

      // Send user message to chat
      await agentChatService.sendAgentMessage({
        agentId: data.agentId,
        agentName: `User`,
        message: data.message,
        teamId: socket.teamId,
        type: 'info'
      });

      try {
        // Execute Claude command non-interactively
        const response = await claudeExecutor.executeCommand({
          agentId: data.agentId,
          message: data.message,
          userId: socket.userId,
          teamId: socket.teamId,
          ...(agent.sessionId ? { sessionId: agent.sessionId } : {})
        });

        // Send Claude's response to chat
        const agentInfo = await prisma.agents.findUnique({
          where: { id: data.agentId },
          select: { agentName: true }
        });

        await agentChatService.sendAgentMessage({
          agentId: data.agentId,
          agentName: agentInfo?.agentName || `Agent ${data.agentId.slice(-6)}`,
          message: response,
          teamId: socket.teamId,
          type: 'success'
        });

        // Also emit the response directly for immediate UI update
        socket.emit('agent_chat_response', {
          agentId: data.agentId,
          response: response,
          timestamp: new Date().toISOString()
        });

      } catch (executeError) {
        console.error(`❌ Failed to execute Claude command for agent ${data.agentId}:`, executeError);

        const errorMessage = executeError instanceof Error ? executeError.message : 'Failed to execute command';

        await agentChatService.sendAgentErrorMessage(data.agentId, errorMessage);

        socket.emit('agent_chat_error', {
          agentId: data.agentId,
          error: errorMessage
        });
      }

    } catch (error) {
      console.error('Agent chat message error:', error);
      socket.emit('agent_chat_error', {
        agentId: data.agentId,
        error: 'Failed to send chat message'
      });
    }
  });

  socket.on('terminal_resize', async (data: { agentId: string; cols: number; rows: number }) => {
    if (!socket.userId || !socket.teamId) {
      return;
    }

    console.log(`📐 PTY Terminal resize for agent ${data.agentId}: ${data.cols}x${data.rows}`);
    
    try {
      // SECURITY CHECK: Verify agent ownership before allowing terminal resize
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        select: { userId: true, status: true }
      });
      
      if (!agent) {
        console.warn(`PTY Terminal resize failed: Agent ${data.agentId} not found`);
        return;
      }
      
      if (agent.userId !== socket.userId) {
        console.warn(`🚨 User ${socket.userId} attempted to resize terminal for agent ${data.agentId} owned by ${agent.userId}`);
        return;
      }
      
      // NEW PTY PROTOCOL: Resize PTY process directly
      const success = dockerManager.resizePTY(data.agentId, data.cols, data.rows);
      
      if (success) {
        console.log(`✅ PTY Terminal resize successful for agent ${data.agentId} (${data.cols}x${data.rows})`);
      } else {
        // Fallback to legacy session if PTY not available
        const session = globalSSHSessions.get(data.agentId);
        
        if (session?.process) {
          // Legacy PTY mode  
          (session.process as any)?.resize?.(data.cols, data.rows);
          console.log(`✅ Legacy PTY resize for agent ${data.agentId} (${data.cols}x${data.rows})`);
        } else if (session?.stream && typeof session.stream.setWindow === 'function') {
          // Legacy SSH mode
          session.stream.setWindow(data.rows, data.cols);
          console.log(`✅ Legacy SSH resize for agent ${data.agentId} (${data.cols}x${data.rows})`);
        } else {
          console.warn(`PTY Terminal resize failed: No active session for agent ${data.agentId}`);
        }
      }
    } catch (error) {
      console.error('PTY Terminal resize error:', error);
    }
  });

  socket.on('terminal_disconnect', async (data: { agentId: string }) => {
    if (!socket.userId) return;
    
    try {
      console.log(`Terminal disconnected for agent ${data.agentId}`);
      
      // Remove from terminal buffer subscribers
      terminalBuffer.removeSubscriber(data.agentId, socket.id);
      
      // Remove from agent sockets tracking
      const sockets = agentSockets.get(data.agentId);
      if (sockets) {
        sockets.delete(socket.id);
      }
      
      // Notify remaining subscribers about viewer leaving
      const remainingCount = terminalBuffer.getSubscriberCount(data.agentId);
      const remainingSubscribers = terminalBuffer.getSubscribers(data.agentId);
      
      for (const subscriber of remainingSubscribers) {
        const targetSocket = io.sockets.sockets.get(subscriber.socketId);
        if (targetSocket) {
          targetSocket.emit('terminal_viewer_left', {
            agentId: data.agentId,
            subscriberCount: remainingCount
          });
        }
      }
      
      // Clean up SSH session (legacy code - might not be needed)
      const sshSessions = (socket as any).sshSessions;
      const session = sshSessions?.get(data.agentId);
      
      if (session) {
        session.client.end();
        sshSessions.delete(data.agentId);
        console.log(`🧹 Cleaned up SSH session for agent: ${data.agentId}`);
      }
      
      socket.emit('terminal_closed', {
        agentId: data.agentId,
        reason: 'User disconnected'
      });
    } catch (error) {
      console.error('Terminal disconnect error:', error);
    }
  });

  // Preview-related events
  socket.on('preview-refresh', async (data: { branch: string; repositoryUrl?: string }) => {
    if (!socket.teamId || !socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      console.log(`🔄 Preview refresh requested for team ${socket.teamId}, branch: ${data.branch}`);
      
      // Get team repository URL if not provided
      let repositoryUrl = data.repositoryUrl;
      if (!repositoryUrl) {
        const team = await prisma.teams.findUnique({
          where: { id: socket.teamId }
        });
        repositoryUrl = team?.repositoryUrl || undefined;
      }

      if (!repositoryUrl) {
        socket.emit('preview-error', {
          branch: data.branch,
          error: 'No repository configured for team',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Stop existing preview first to ensure clean state
      await universalPreviewService.stopPreview(socket.teamId);
      
      // Create new preview with updated repository URL
      const result = await universalPreviewService.startPreview(socket.teamId, repositoryUrl);

      // Notify team members of the successful refresh
      io.to(socket.teamId).emit('preview-updated', {
        branch: data.branch,
        timestamp: new Date().toISOString(),
        message: `Preview refreshed with new repository`,
        url: result.url,
        port: result.port
      });

      console.log(`✅ Preview refresh completed for team ${socket.teamId} with repository: ${repositoryUrl}`);
      
    } catch (error) {
      console.error('Error handling preview refresh:', error);
      socket.emit('preview-error', {
        branch: data.branch,
        error: error instanceof Error ? error.message : 'Failed to refresh preview',
        timestamp: new Date().toISOString()
      });
      
      // Also notify team members
      io.to(socket.teamId).emit('preview-error', {
        branch: data.branch,
        error: error instanceof Error ? error.message : 'Failed to refresh preview',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('preview-status', async (data: { branch: string }) => {
    if (!socket.teamId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      console.log(`📊 Preview status requested for team ${socket.teamId}, branch: ${data.branch}`);
      
      // Get preview container status from Docker service
      // TODO: Enable Docker service integration
      // const status = await dockerPreviewService.getContainerStatus(
      //   socket.teamId, 
      //   data.branch as 'main' | 'staging'
      // );

      // For now, emit a mock status
      socket.emit('preview-status-update', {
        branch: data.branch,
        status: 'not_found',
        message: 'Docker service integration pending',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error getting preview status:', error);
      socket.emit('preview-error', {
        branch: data.branch,
        error: 'Failed to get preview status',
        timestamp: new Date().toISOString()
      });
    }
  });

  // New event: Stop preview container
  socket.on('preview-stop', async (data: { branch: string }) => {
    if (!socket.teamId || !socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      console.log(`🛑 Preview stop requested for team ${socket.teamId}, branch: ${data.branch}`);
      
      // Find container
      const container = await prisma.preview_deployments.findFirst({
        where: { 
          teamId: socket.teamId!
        }
      });

      if (!container?.containerId) {
        socket.emit('preview-error', {
          branch: data.branch,
          error: 'Preview container not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Stop container using Docker service
      // TODO: Enable Docker service integration
      // await dockerPreviewService.stopContainer(container.containerId);

      // Update database
      await prisma.preview_deployments.update({
        where: { id: container.id },
        data: { 
          status: 'stopped',
          updatedAt: new Date()
        }
      });

      // Release port (mock)
      // dockerPreviewService.releasePort(container.port);

      // Notify all team members
      io.to(socket.teamId).emit('preview-status-update', {
        branch: data.branch,
        status: 'stopped',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Preview stopped for team ${socket.teamId}, branch: ${data.branch}`);

    } catch (error) {
      console.error('Error stopping preview:', error);
      socket.emit('preview-error', {
        branch: data.branch,
        error: error instanceof Error ? error.message : 'Failed to stop preview',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Remove socket from agent tracking and cleanup SSH sessions when no sockets remain
    for (const [agentId, sockets] of agentSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        
        // Remove from terminal buffer subscribers
        terminalBuffer.removeSubscriber(agentId, socket.id);
        
        // Notify remaining subscribers about viewer leaving
        const remainingCount = terminalBuffer.getSubscriberCount(agentId);
        const remainingSubscribers = terminalBuffer.getSubscribers(agentId);
        
        for (const subscriber of remainingSubscribers) {
          const targetSocket = io.sockets.sockets.get(subscriber.socketId);
          if (targetSocket) {
            targetSocket.emit('terminal_viewer_left', {
              agentId,
              subscriberCount: remainingCount
            });
          }
        }
        
        // If no more sockets for this agent, cleanup SSH session
        if (sockets.size === 0) {
          agentSockets.delete(agentId);
          
          // Clean up the SSH session to prevent memory leaks
          const sshSession = globalSSHSessions.get(agentId);
          if (sshSession) {
            console.log(`🧹 Cleaning up SSH session for agent ${agentId} - no active sockets remaining`);
            try {
              if (sshSession.client && typeof sshSession.client.end === 'function') {
                sshSession.client.end();
              }
              if (sshSession.stream && typeof sshSession.stream.end === 'function') {
                sshSession.stream.end();
              }
            } catch (error) {
              console.warn(`Warning: Error cleaning up SSH session for agent ${agentId}:`, error);
            }
            globalSSHSessions.delete(agentId);
          }
        }
      }
    }

    if (socket.teamId) {
      // Remove from team connections
      const connections = teamConnections.get(socket.teamId);
      if (connections) {
        connections.delete(socket.id);
        if (connections.size === 0) {
          teamConnections.delete(socket.teamId);
        }

        // Remove from online users
        const onlineUsers = teamOnlineUsers.get(socket.teamId);
        if (onlineUsers && socket.userId) {
          const userInfo = onlineUsers.get(socket.userId);
          if (userInfo) {
            // Remove this socket from the user's socket list
            userInfo.socketIds.delete(socket.id);
            
            // Only remove user if they have no more active sockets
            if (userInfo.socketIds.size === 0) {
              onlineUsers.delete(socket.userId);
              
              // Notify team members of disconnection only when user has no more sockets
              socket.to(socket.teamId).emit('user-disconnected', {
                userId: socket.userId,
                userName: socket.userName,
                connectedUsers: connections.size
              });
            }
          }
          
          if (onlineUsers.size === 0) {
            teamOnlineUsers.delete(socket.teamId);
          }
        }
      }
    }
  });

  
  // Workspace synchronization events
  socket.on('workspace-update', async (data: { tiles?: any; layouts?: any; sidebarWidth?: number }) => {
    if (!socket.teamId || !socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Update team workspace configuration in database
      const updateData: any = {};
      if (data.tiles !== undefined) updateData.workspaceTiles = data.tiles;
      if (data.layouts !== undefined) updateData.workspaceLayouts = data.layouts;
      if (data.sidebarWidth !== undefined) updateData.sidebarWidth = data.sidebarWidth;

      await prisma.teams.update({
        where: { id: socket.teamId },
        data: updateData
      });

      // Broadcast to all team members except sender
      socket.to(socket.teamId).emit('workspace-updated', {
        ...data,
        updatedBy: socket.userId,
        timestamp: new Date().toISOString()
      });

      console.log(`Workspace updated for team ${socket.teamId} by user ${socket.userId}`);
    } catch (error) {
      console.error('Error updating workspace:', error);
      socket.emit('error', { message: 'Failed to update workspace configuration' });
    }
  });

  socket.on('workspace-drag-start', (data: { tileId: string; position?: { x: number; y: number } }) => {
    if (!socket.teamId || !socket.userId) {
      return;
    }

    // Broadcast drag start to all team members except sender
    socket.to(socket.teamId).emit('workspace-drag-started', {
      tileId: data.tileId,
      position: data.position,
      draggedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('workspace-drag-move', (data: { tileId: string; position: { x: number; y: number } }) => {
    if (!socket.teamId || !socket.userId) {
      return;
    }

    // Broadcast drag movement to all team members except sender
    socket.to(socket.teamId).emit('workspace-drag-moved', {
      tileId: data.tileId,
      position: data.position,
      draggedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('workspace-drag-stop', (data: { tileId: string; finalPosition?: { x: number; y: number; w: number; h: number } }) => {
    if (!socket.teamId || !socket.userId) {
      return;
    }

    // Broadcast drag stop to all team members except sender
    socket.to(socket.teamId).emit('workspace-drag-stopped', {
      tileId: data.tileId,
      finalPosition: data.finalPosition,
      draggedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('workspace-tile-add', (data: { type: string; title: string; position?: { x: number; y: number; w: number; h: number } }) => {
    if (!socket.teamId || !socket.userId) {
      return;
    }

    // Broadcast tile addition to all team members except sender
    socket.to(socket.teamId).emit('workspace-tile-added', {
      type: data.type,
      title: data.title,
      position: data.position,
      addedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('workspace-tile-remove', (data: { tileId: string }) => {
    if (!socket.teamId || !socket.userId) {
      return;
    }

    // Broadcast tile removal to all team members except sender
    socket.to(socket.teamId).emit('workspace-tile-removed', {
      tileId: data.tileId,
      removedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

});

/**
 * WebSocket Upgrade Handler for Preview Proxy
 * Handles WebSocket upgrades for HMR and live reload in preview containers
 */
server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    // Check if this is a preview proxy WebSocket upgrade
    // Matches both old live pattern and new proxy pattern
    const previewMatch = url.pathname.match(/^\/api\/preview\/(?:([^\/]+)\/live\/(.*)$|proxy\/([^\/]+)\/([^\/]+)\/?.*)/);
    
    if (previewMatch) {
      // Extract teamId from either pattern: live/teamId or proxy/teamId/branch
      const teamId = previewMatch[1] || previewMatch[3];
      
      console.log(`🔄 WebSocket upgrade for preview proxy: team ${teamId}, path: ${url.pathname}`);
      
      // Allow HMR WebSocket connections without authentication
      // HMR (Hot Module Replacement) requests from Vite/dev servers don't carry JWT tokens
      // Check if this is likely an HMR WebSocket (no auth header + upgrade header)
      const isHMRRequest = url.pathname.includes('/__vite_hmr') ||
                          (request.headers.upgrade === 'websocket' && !request.headers.authorization);
      
      console.log(`🔍 WebSocket upgrade debug: path=${url.pathname}, upgrade=${request.headers.upgrade}, hasAuth=${!!request.headers.authorization}, isHMR=${isHMRRequest}`);
      
      if (!isHMRRequest) {
        // Verify authentication via authorization header for non-HMR requests
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          console.warn('❌ Preview proxy WebSocket upgrade denied: No auth token');
          socket.destroy();
          return;
        }
      } else {
        console.log('🔥 Allowing HMR WebSocket upgrade without authentication');
      }
      
      // Skip JWT verification for HMR requests
      if (!isHMRRequest) {
        try {
          const authHeader = request.headers.authorization!;
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          const userId = decoded.userId;
          
          // Verify user belongs to the team
          const user = await prisma.users.findUnique({
            where: { id: userId }
          });
          
          if (!user || user.teamId !== teamId) {
            console.warn(`❌ Preview proxy WebSocket upgrade denied: Invalid team access for user ${userId}`);
            socket.destroy();
            return;
          }
        } catch (jwtError) {
          console.warn('❌ Preview proxy WebSocket upgrade denied: Invalid token', jwtError);
          socket.destroy();
          return;
        }
      }
        
        // Find running preview deployment using database-backed service
        const deployment = await universalPreviewService.getPreviewStatus(teamId!);
        
        if (!deployment || !deployment.proxyPort || !deployment.running) {
          console.warn(`❌ Preview proxy WebSocket upgrade failed: No running deployment for team ${teamId}`);
          socket.destroy();
          return;
        }
        
        // Proxy the WebSocket connection to the preview container
        const { createProxyMiddleware } = await import('http-proxy-middleware');
        
        // Create a temporary proxy middleware just for this WebSocket upgrade
        const wsProxy = createProxyMiddleware({
          target: `http://localhost:${deployment.proxyPort}`,
          changeOrigin: true,
          ws: true,
          pathRewrite: {
            [`^/api/preview/${teamId}/live`]: '',
            [`^/api/preview/proxy/${teamId}/[^/]+/?`]: ''
          },
          on: {
            error: (err: Error) => {
              console.error('Preview WebSocket proxy error:', err);
            }
          },
          logger: console
        });
        
        // Handle the WebSocket upgrade
        (wsProxy as any).upgrade?.(request, socket, head);
        
        console.log(`✅ WebSocket upgrade proxied to dedicated proxy on port ${deployment.proxyPort}`);
    }
  } catch (error) {
    console.error('❌ WebSocket upgrade handler error:', error);
    socket.destroy();
  }
});

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Database connection test
async function testDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Reconcile agent state on startup - mark agents without active PTY sessions as stopped
async function reconcileAgentState(): Promise<void> {
  try {
    console.log('🔄 Reconciling agent state on startup...');
    
    // Find all agents that are marked as "running" but have no active PTY session
    const runningAgents = await prisma.agents.findMany({
      where: {
        status: 'running'
      }
    });
    
    if (runningAgents.length === 0) {
      console.log('✅ No running agents found to reconcile');
      return;
    }
    
    let orphanedCount = 0;
    for (const agent of runningAgents) {
      // Check if this agent has an active PTY session or container
      const hasActivePTY = dockerManager.getPTYProcess(agent.id) !== null;
      const hasActiveContainer = dockerManager.getPTYSessionInfo(agent.id) !== null;
      
      if (!hasActivePTY && !hasActiveContainer) {
        // This agent is orphaned - mark it as stopped
        await prisma.agents.update({
          where: { id: agent.id },
          data: { 
            status: 'stopped',
            output: agent.output + '\n🔄 Server restarted - terminal session ended'
          }
        });
        
        // Emit status update to any connected clients
        io.to(`team-${agent.teamId}`).emit('agent_status', {
          agentId: agent.id,
          status: 'stopped',
          message: 'Agent stopped due to server restart'
        });
        
        orphanedCount++;
        console.log(`📝 Marked orphaned agent ${agent.id} as stopped`);
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`✅ Agent reconciliation completed: ${orphanedCount} orphaned agents marked as stopped`);
    } else {
      console.log('✅ Agent reconciliation completed: all running agents have active sessions');
    }
    
  } catch (error) {
    console.error('❌ Failed to reconcile agent state:', error);
    // Don't throw - this shouldn't prevent server startup
  }
}

// Preview service event listeners
previewService.on('status-change', (data) => {
  const { teamId, branch, status, port, url, error } = data;
  console.log(`📢 Preview status change: ${status} (team: ${teamId}, branch: ${branch})`);
  
  io.to(teamId).emit('preview-status-update', {
    branch,
    status,
    port,
    url,
    error,
    timestamp: new Date().toISOString()
  });
});

// dockerPreviewService.on('preview-ready', (data) => {
//   const { teamId, branch, port, url } = data;
//   console.log(`🎉 Preview ready: ${url} (team: ${teamId}, branch: ${branch})`);
//   io.to(teamId).emit('preview-ready', {
//     branch,
//     port,
//     url,
//     timestamp: new Date().toISOString()
//   });
// });

// dockerPreviewService.on('error', (data) => {
//   const { teamId, branch, error } = data;
//   console.log(`❌ Docker service error: ${error} (team: ${teamId}, branch: ${branch})`);
//   io.to(teamId).emit('preview-error', {
//     branch,
//     error,
//     timestamp: new Date().toISOString()
//   });
// });

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  await prisma.$disconnect();
  console.log('Database disconnected');
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  await prisma.$disconnect();
  console.log('Database disconnected');
  
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Test database connection first
    await testDatabaseConnection();
    
    // Add WebSocket upgrade handling for preview proxy HMR
    server.on('upgrade', (request, socket, head) => {
      console.log(`🔌 WebSocket upgrade request: ${request.url}`);
      
      // Check if this is a preview proxy WebSocket request
      const previewProxyMatch = request.url?.match(/^\/api\/preview\/proxy\/([^\/]+)\/([^\/]+)/);
      if (previewProxyMatch) {
        const teamId = previewProxyMatch[1];
        const branch = previewProxyMatch[2];
        console.log(`🎯 HMR WebSocket upgrade for team ${teamId}, branch ${branch}`);
        
        // Import and use the preview service to get the proxy port
        import('../services/universal-preview-service.js').then(async ({ universalPreviewService }) => {
          try {
            const previewStatus = await universalPreviewService.getPreviewStatus(teamId!);
            if (previewStatus && previewStatus.running) {
              const proxyPort = previewStatus.proxyPort || previewStatus.port;
              console.log(`🔄 Proxying HMR WebSocket to localhost:${proxyPort}`);
              
              // Create proxy middleware specifically for this WebSocket upgrade
              const { createProxyMiddleware } = await import('http-proxy-middleware');
              const wsProxy = createProxyMiddleware({
                target: `http://localhost:${proxyPort}`,
                changeOrigin: true,
                ws: true,
                pathRewrite: {
                  [`^/api/preview/proxy/${teamId}/${branch}`]: `/api/preview/proxy/${teamId}/${branch}`
                }
              });
              
              // Handle the WebSocket upgrade
              wsProxy.upgrade(request, socket as any, head);
            } else {
              console.log(`❌ No preview running for team ${teamId}`);
              socket.destroy();
            }
          } catch (error) {
            console.error('❌ WebSocket upgrade error:', error);
            socket.destroy();
          }
        });
      } else {
        // Not a preview proxy request, let Socket.io handle it
        console.log(`🔍 Non-preview WebSocket upgrade: ${request.url}`);
        socket.destroy();
      }
    });
    
    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 CoVibe server running on port ${PORT}`);
      console.log(`📱 Frontend available at: http://${BASE_HOST}:${PORT}`);
      console.log(`📱 Mobile view at: http://${BASE_HOST}:${PORT}/mobile`);
      console.log(`🏥 Health check at: http://${BASE_HOST}:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`🌐 CORS Origins: ${getCorsOrigins().join(', ')}`);
    });
    
    // Reconcile preview state on startup (after server starts)
    await universalPreviewService.reconcilePreviewState();
    
    // Reconcile agent state on startup - mark orphaned agents as stopped
    await reconcileAgentState();
    
    // Start preview health check service
    previewHealthCheck.start();

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('🛑 Shutting down gracefully...');
    previewHealthCheck.stop();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Export for testing purposes
export { app, server, io, prisma };

// Helper function to get IO instance
export const getIO = () => io;

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
// restart
