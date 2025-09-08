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
import type { GlobalSSHSession, ContainerInfo } from './types/socket-ext.js';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Client } from 'ssh2';
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
import { getEscapedSystemPrompt } from './prompts/agentSystemPrompt.js';
import { agentChatService } from '../services/agent-chat.js';
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

// SSH Session Management (copied from simple-claude-server.js)
const sshSessions = new Map();

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

// Serve static files from React build
app.use(express.static(path.join(process.cwd(), 'client/dist'), {
  setHeaders: (res) => {
    if (process.env['NODE_ENV'] === 'development') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// SSH Helper Functions (copied from simple-claude-server.js)
function loadSSHKey(keyPath: string) {
  try {
    const fullPath = path.resolve(keyPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`SSH key not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error: any) {
    throw new Error(`Failed to load SSH key: ${error.message}`);
  }
}

function createSSHSession(sessionId: string, config: any, socket: any) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    // Auto-find SSH key if not provided
    if (!config.privateKey || config.privateKey.length < 100) {
      console.log('🔍 Auto-searching for SSH keys...');
      
      const possiblePaths = [
        './.ssh/ec2.pem',
        './.ssh/id_rsa', 
        './config/ssh-key.pem',
        path.join(process.env['HOME'] || '', '.ssh/id_rsa'),
        path.join(process.env['HOME'] || '', '.ssh/ec2.pem'),
      ];
      
      let keyFound = false;
      for (const keyPath of possiblePaths) {
        try {
          config.privateKey = loadSSHKey(keyPath);
          console.log(`✅ Found SSH key: ${keyPath} (${config.privateKey.length} bytes)`);
          keyFound = true;
          break;
        } catch (error) {
          continue;
        }
      }
      
      if (!keyFound) {
        reject(new Error('No SSH private key found. Please provide one or ensure it exists.'));
        return;
      }
    }
    
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('SSH connection timeout'));
    }, 10000);
    
    client.on('ready', () => {
      clearTimeout(timeout);
      console.log(`✅ SSH connection ready for session: ${sessionId}`);
      
      client.shell((err: any, stream: any) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        
        // Store session
        sshSessions.set(sessionId, {
          client,
          stream,
          socket: socket.id
        });
        
        // Handle stream data
        stream.on('data', (data: Buffer) => {
          socket.emit('ssh-output', {
            sessionId,
            output: data.toString()
          });
        });
        
        stream.on('close', () => {
          console.log(`🔌 SSH stream closed for session: ${sessionId}`);
          sshSessions.delete(sessionId);
          client.end();
        });
        
        stream.on('error', (error: any) => {
          console.error(`SSH stream error (${sessionId}):`, error);
          socket.emit('ssh-error', { 
            sessionId, 
            error: error.message 
          });
        });
        
        // Auto-start Claude Code
        setTimeout(() => {
          console.log(`🤖 Auto-starting Claude Code for session: ${sessionId}`);
          socket.emit('ssh-output', {
            sessionId,
            output: '\r\n🤖 Starting Claude Code...\r\n'
          });
          
          const systemPrompt = getEscapedSystemPrompt();
          stream.write(`claude --dangerously-skip-permissions --append-system-prompt "${systemPrompt}"\r`);
          
          setTimeout(() => {
            socket.emit('claude-started', { sessionId });
          }, 3000);
        }, 1500);
        
        resolve({ sessionId, stream });
      });
    });
    
    client.on('error', (error: any) => {
      clearTimeout(timeout);
      console.error(`SSH connection error (${sessionId}):`, error);
      reject(new Error(`SSH connection failed: ${error.message}`));
    });
    
    client.connect({
      host: config.host,
      username: config.username || 'ubuntu',
      privateKey: config.privateKey,
      port: config.port || 22,
      readyTimeout: 8000
    });
  });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
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

// Catch-all route - serve React app for all non-API routes
app.get('*', (req, res) => {
  // Check if it's a mobile device
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos|mobile/i.test(userAgent);
  
  // Redirect mobile users to the mobile-friendly preview instead of the complex workspace
  if (isMobile && req.path === '/') {
    console.log('📱 Mobile user detected, redirecting to preview:', userAgent);
    return res.redirect('/api/preview/proxy/demo-team-001/main/');
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
        socket.emit('terminal_connected', { 
          agentId: data.agentId,
          message: 'Connected to existing PTY session'
        });
        return;
      }
      
      console.log('🚀 No existing PTY found, agent should already have been spawned');
      
      // The PTY process should have been created when the agent was spawned
      // If it doesn't exist, something went wrong
      const ptyInfo = dockerManager.getPTYSessionInfo(data.agentId);
      if (!ptyInfo) {
        socket.emit('terminal_error', { 
          agentId: data.agentId, 
          error: 'PTY session not found. Agent may not have been properly spawned.' 
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

  // SSH Terminal Event Handlers (copied from simple-claude-server.js)
  socket.on('ssh-connect', async (config) => {
    const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🔄 Creating SSH session: ${sessionId}`);
      await createSSHSession(sessionId, config, socket);
      
      socket.emit('ssh-connected', { 
        sessionId,
        message: 'SSH connection established'
      });
      
    } catch (error: any) {
      console.error(`❌ SSH connection failed: ${error.message}`);
      socket.emit('ssh-error', { 
        error: error.message 
      });
    }
  });
  
  socket.on('ssh-input', (data) => {
    const { sessionId, input } = data;
    const session = sshSessions.get(sessionId);
    
    if (!session) {
      socket.emit('ssh-error', { 
        sessionId, 
        error: 'Session not found' 
      });
      return;
    }
    
    // Send input to SSH stream
    session.stream.write(input);
    
    // Check if starting Claude
    if (input.trim().toLowerCase() === 'claude') {
      setTimeout(() => {
        socket.emit('claude-started', { sessionId });
      }, 2000);
    }
  });

  socket.on('ssh-resize', (data) => {
    const { sessionId, cols, rows } = data;
    const session = sshSessions.get(sessionId);
    
    if (session?.stream?.setWindow) {
      session.stream.setWindow(rows, cols);
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
    const previewMatch = url.pathname.match(/^\/api\/preview\/([^\/]+)\/live\/(.*)$/);
    
    if (previewMatch) {
      const teamId = previewMatch[1];
      
      console.log(`🔄 WebSocket upgrade for preview proxy: team ${teamId}, path: ${url.pathname}`);
      
      // Verify authentication via authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        console.warn('❌ Preview proxy WebSocket upgrade denied: No auth token');
        socket.destroy();
        return;
      }
      
      try {
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
        
        // Find running preview container
        const containers = await dockerManager.getTeamContainers(teamId) as ContainerInfo[];
        const previewContainer = containers.find(c => 
          c.type === 'preview' && 
          c.status === 'running' && 
          c.previewPort
        );
        
        if (!previewContainer || !previewContainer.previewPort) {
          console.warn(`❌ Preview proxy WebSocket upgrade failed: No running container for team ${teamId}`);
          socket.destroy();
          return;
        }
        
        // Proxy the WebSocket connection to the preview container
        const { createProxyMiddleware } = await import('http-proxy-middleware');
        
        // Create a temporary proxy middleware just for this WebSocket upgrade
        const wsProxy = createProxyMiddleware({
          target: `http://${BASE_HOST}:${previewContainer.previewPort}`,
          changeOrigin: true,
          ws: true,
          pathRewrite: {
            [`^/api/preview/${teamId}/live`]: ''
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
        
        console.log(`✅ WebSocket upgrade proxied to container on port ${previewContainer.previewPort}`);
        
      } catch (jwtError) {
        console.warn('❌ Preview proxy WebSocket upgrade denied: Invalid token', jwtError);
        socket.destroy();
        return;
      }
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
