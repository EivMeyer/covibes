# CoVibe MVP Implementation Instructions for LLM Agents

## Overview
You are implementing CoVibe, a collaborative development platform where teams spawn AI agents from a web interface to work on code together. This document provides complete implementation instructions for building the MVP.

## Project Context
- **Architecture**: Web UI → Node.js Server → Individual VMs (via SSH)
- **Core Feature**: Multiple developers spawn Claude agents on their own VMs, everyone sees all agent outputs in real-time
- **Tech Stack**: Node.js + Express + Socket.io + PostgreSQL + Vanilla JS (no framework)
- **Timeline**: Build a working MVP that can demo successfully

## Repository Structure to Create
```
colabvibe/
├── server/
│   ├── server.js           # Main server file
│   ├── .env               # Environment variables
│   ├── package.json       # Dependencies
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── routes/
│   │   ├── auth.js       # Authentication endpoints
│   │   ├── agents.js     # Agent management
│   │   └── vm.js         # VM configuration
│   ├── services/
│   │   ├── ssh.js        # SSH connection management
│   │   ├── crypto.js     # Encryption utilities
│   │   └── agent.js      # Agent execution logic
│   ├── middleware/
│   │   └── auth.js       # JWT authentication
│   └── public/
│       ├── index.html    # Single page web app
│       ├── css/
│       │   └── style.css # Custom styles (Tailwind via CDN)
│       └── js/
│           ├── app.js    # Main application logic
│           ├── api.js    # API communication
│           └── socket.js # WebSocket handling
└── docs/
    └── test-plan.md      # Testing instructions

```

---

## Agent 1: Backend Infrastructure Developer

### Your Mission
Build the complete Node.js backend server with all API endpoints, WebSocket handling, and database setup.

### Specific Requirements

#### 1.1 Server Setup (`server/server.js`)
```javascript
// Create an Express server with Socket.io that:
// - Serves static files from /public
// - Has CORS enabled for development
// - Handles WebSocket connections for real-time features
// - Uses JWT for authentication
// - Port 3001 by default

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Initialize Express and Socket.io
// Setup middleware
// Serve static files from public/
// Initialize routes
// Start server
```

#### 1.2 Database Schema (`server/prisma/schema.prisma`)
```prisma
// Define these models with Prisma:
model Team {
  id         String   @id @default(uuid())
  name       String
  inviteCode String   @unique @default(cuid())
  createdAt  DateTime @default(now())
  users      User[]
  agents     Agent[]
  messages   Message[]
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String   // bcrypt hashed
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  vmConfig  Json?    // Encrypted VM credentials
  agents    Agent[]
  messages  Message[]
  createdAt DateTime @default(now())
}

model Agent {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  teamId     String
  team       Team     @relation(fields: [teamId], references: [id])
  task       String
  status     String   @default("running") // running, completed, failed
  output     Json     @default("[]") // Array of output lines
  startedAt  DateTime @default(now())
  completedAt DateTime?
}

model Message {
  id        String   @id @default(uuid())
  content   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  createdAt DateTime @default(now())
}
```

#### 1.3 Authentication Routes (`server/routes/auth.js`)
```javascript
// POST /api/auth/register
// Creates new team and first user
// Input: { teamName, userName, email, password }
// Output: { token, user, team }
// Hash password with bcrypt
// Generate unique invite code
// Sign JWT with user ID and team ID

// POST /api/auth/join
// Join existing team with invite code
// Input: { inviteCode, userName, email, password }
// Output: { token, user, team }
// Validate invite code exists
// Create user in that team

// POST /api/auth/login
// Input: { email, password }
// Output: { token, user, team }
// Verify password with bcrypt
// Return JWT token

// GET /api/auth/me
// Requires: JWT token in Authorization header
// Returns current user and team info
```

#### 1.4 Agent Routes (`server/routes/agents.js`)
```javascript
// POST /api/agents/spawn
// Requires authentication
// Input: { task }
// Process:
//   1. Create agent record in database
//   2. Get user's VM config
//   3. SSH to VM and execute Claude command
//   4. Return agentId immediately
//   5. Stream output via WebSocket

// GET /api/agents
// Returns all agents for user's team
// Include status, owner info, task

// DELETE /api/agents/:id
// Kill running agent
// Only agent owner can kill
// SSH to VM and kill process

// POST /api/agents/:id/input
// Send input to running agent
// Only owner can send input
```

#### 1.5 VM Configuration Routes (`server/routes/vm.js`)
```javascript
// POST /api/vm/configure
// Store encrypted VM credentials
// Input: { host, port, username, privateKey }
// Encrypt privateKey before storing
// Store in user.vmConfig field

// POST /api/vm/test
// Test SSH connection to VM
// Return { success: true/false, error? }
```

#### 1.6 WebSocket Events (`server/server.js`)
```javascript
// Handle these Socket.io events:

io.on('connection', (socket) => {
  // socket.on('auth', { token })
  // - Verify JWT
  // - Join team room: socket.join(`team:${teamId}`)
  // - Store userId and teamId on socket
  // - Emit current online users
  
  // socket.on('chat_message', { content })
  // - Save to database
  // - Broadcast to team room
  // - Include user info and timestamp
  
  // socket.on('agent_output', { agentId, data })
  // - Verify agent belongs to user's team
  // - Broadcast to team room
  // - Store recent output in memory
  
  // socket.on('disconnect')
  // - Update online users list
  // - Notify team members
});

// Emit these events:
// - 'user_online' / 'user_offline'
// - 'agent_started' / 'agent_completed' / 'agent_failed'
// - 'agent_output' with streaming data
// - 'chat_message' for new messages
// - 'preview_updated' when code changes
```

#### 1.7 SSH Service (`server/services/ssh.js`)
```javascript
const { Client } = require('ssh2');

class SSHService {
  constructor() {
    this.connections = new Map(); // Connection pool
  }
  
  async executeCommand(vmConfig, command) {
    // Decrypt VM credentials
    // Create SSH connection
    // Execute command
    // Return stream for output
    // Handle errors gracefully
  }
  
  async spawnAgent(vmConfig, agentId, task) {
    // Build Claude command:
    // claude -p "${task}" --output-format stream-json --dangerously-skip-permissions --verbose
    // Execute via SSH
    // Parse stream-json output
    // Emit to WebSocket as it arrives
  }
  
  async testConnection(vmConfig) {
    // Try to connect and run 'echo test'
    // Return success/failure
  }
}
```

#### 1.8 Environment Variables (`.env`)
```env
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/colabvibe_dev
JWT_SECRET=change-this-in-production-to-random-string
ENCRYPTION_KEY=32-character-key-for-vm-credential-encryption
```

### Testing Your Implementation
1. Start PostgreSQL locally
2. Run `npx prisma migrate dev` to create tables
3. Start server with `npm run dev`
4. Test each endpoint with curl or Postman
5. Verify WebSocket events with Socket.io client

---

## Agent 2: Frontend Web Developer

### Your Mission
Build a complete single-page web application using vanilla JavaScript (no framework) that provides a clean, real-time interface for CoVibe.

### Specific Requirements

#### 2.1 HTML Structure (`server/public/index.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoVibe - Ship Together, Code Whenever</title>
    
    <!-- Tailwind CSS via CDN for quick styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Socket.io client -->
    <script src="/socket.io/socket.io.js"></script>
    
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-gray-900 text-white">
    <!-- Auth Screen (shown when not logged in) -->
    <div id="authScreen" class="min-h-screen flex items-center justify-center">
        <!-- Login form -->
        <!-- Register form -->
        <!-- Join team form -->
    </div>
    
    <!-- Main App (shown when logged in) -->
    <div id="mainApp" class="hidden">
        <!-- Header with team name and logout -->
        <header class="bg-gray-800 p-4">
            <!-- Team name, user info, logout button -->
        </header>
        
        <!-- Three-column layout -->
        <div class="flex h-screen">
            <!-- Command Deck (Chat) -->
            <div class="w-1/3 bg-gray-800 p-4">
                <!-- Online users list -->
                <!-- Chat messages -->
                <!-- Message input -->
            </div>
            
            <!-- Workshop (Agents) -->
            <div class="w-1/3 bg-gray-700 p-4">
                <!-- VM config button -->
                <!-- Spawn agent button -->
                <!-- Agent list -->
                <!-- Agent output viewer (modal or inline) -->
            </div>
            
            <!-- Showcase (Preview) -->
            <div class="w-1/3 bg-gray-600 p-4">
                <!-- iframe for preview -->
                <!-- Refresh button -->
                <!-- Last update timestamp -->
            </div>
        </div>
    </div>
    
    <!-- Modals -->
    <div id="vmConfigModal" class="hidden">
        <!-- VM configuration form -->
    </div>
    
    <div id="spawnAgentModal" class="hidden">
        <!-- Task input form -->
    </div>
    
    <div id="agentOutputModal" class="hidden">
        <!-- Terminal-style output viewer -->
    </div>
    
    <!-- Scripts -->
    <script src="/js/api.js"></script>
    <script src="/js/socket.js"></script>
    <script src="/js/app.js"></script>
</body>
</html>
```

#### 2.2 API Communication (`server/public/js/api.js`)
```javascript
class API {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('token');
    }
    
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }
    
    async request(method, endpoint, data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(this.baseURL + endpoint, options);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    // Auth methods
    async register(teamName, userName, email, password) {
        const result = await this.request('POST', '/auth/register', {
            teamName, userName, email, password
        });
        this.setToken(result.token);
        return result;
    }
    
    async login(email, password) {
        const result = await this.request('POST', '/auth/login', {
            email, password
        });
        this.setToken(result.token);
        return result;
    }
    
    async joinTeam(inviteCode, userName, email, password) {
        const result = await this.request('POST', '/auth/join', {
            inviteCode, userName, email, password
        });
        this.setToken(result.token);
        return result;
    }
    
    // Agent methods
    async spawnAgent(task) {
        return this.request('POST', '/agents/spawn', { task });
    }
    
    async getAgents() {
        return this.request('GET', '/agents');
    }
    
    async killAgent(agentId) {
        return this.request('DELETE', `/agents/${agentId}`);
    }
    
    // VM methods
    async configureVM(host, port, username, privateKey) {
        return this.request('POST', '/vm/configure', {
            host, port, username, privateKey
        });
    }
    
    async testVM() {
        return this.request('POST', '/vm/test');
    }
}

const api = new API();
```

#### 2.3 WebSocket Management (`server/public/js/socket.js`)
```javascript
class SocketManager {
    constructor() {
        this.socket = null;
        this.listeners = {};
    }
    
    connect(token) {
        this.socket = io({
            auth: { token }
        });
        
        // Setup event listeners
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.emit('auth', { token });
        });
        
        this.socket.on('user_online', (user) => {
            this.trigger('userOnline', user);
        });
        
        this.socket.on('user_offline', (userId) => {
            this.trigger('userOffline', userId);
        });
        
        this.socket.on('chat_message', (message) => {
            this.trigger('chatMessage', message);
        });
        
        this.socket.on('agent_started', (agent) => {
            this.trigger('agentStarted', agent);
        });
        
        this.socket.on('agent_output', (data) => {
            this.trigger('agentOutput', data);
        });
        
        this.socket.on('agent_completed', (agentId) => {
            this.trigger('agentCompleted', agentId);
        });
        
        this.socket.on('preview_updated', () => {
            this.trigger('previewUpdated');
        });
    }
    
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    trigger(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

const socketManager = new SocketManager();
```

#### 2.4 Main Application (`server/public/js/app.js`)
```javascript
class CoVibeApp {
    constructor() {
        this.state = {
            user: null,
            team: null,
            agents: [],
            messages: [],
            onlineUsers: [],
            selectedAgent: null,
            agentOutputs: {} // agentId -> array of output lines
        };
        
        this.init();
    }
    
    init() {
        // Check for existing token
        const token = localStorage.getItem('token');
        if (token) {
            this.loadApp(token);
        } else {
            this.showAuthScreen();
        }
        
        this.setupEventListeners();
        this.setupSocketListeners();
    }
    
    setupEventListeners() {
        // Auth form submissions
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
        
        // Chat input
        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Agent spawn button
        document.getElementById('spawnAgentBtn')?.addEventListener('click', () => {
            this.showSpawnAgentModal();
        });
        
        // VM config button
        document.getElementById('vmConfigBtn')?.addEventListener('click', () => {
            this.showVMConfigModal();
        });
    }
    
    setupSocketListeners() {
        socketManager.on('userOnline', (user) => {
            this.state.onlineUsers.push(user);
            this.renderOnlineUsers();
        });
        
        socketManager.on('chatMessage', (message) => {
            this.state.messages.push(message);
            this.renderMessages();
        });
        
        socketManager.on('agentStarted', (agent) => {
            this.state.agents.push(agent);
            this.state.agentOutputs[agent.id] = [];
            this.renderAgents();
        });
        
        socketManager.on('agentOutput', (data) => {
            // data = { agentId, output, userId }
            if (!this.state.agentOutputs[data.agentId]) {
                this.state.agentOutputs[data.agentId] = [];
            }
            this.state.agentOutputs[data.agentId].push(data.output);
            
            // If this agent is selected, update the output view
            if (this.state.selectedAgent === data.agentId) {
                this.appendAgentOutput(data.output);
            }
        });
        
        socketManager.on('agentCompleted', (agentId) => {
            const agent = this.state.agents.find(a => a.id === agentId);
            if (agent) {
                agent.status = 'completed';
                this.renderAgents();
            }
        });
        
        socketManager.on('previewUpdated', () => {
            this.refreshPreview();
        });
    }
    
    async loadApp(token) {
        try {
            // Get current user info
            const { user, team } = await api.request('GET', '/auth/me');
            this.state.user = user;
            this.state.team = team;
            
            // Connect WebSocket
            socketManager.connect(token);
            
            // Load initial data
            const agents = await api.getAgents();
            this.state.agents = agents;
            
            // Show main app
            this.showMainApp();
            
            // Render initial UI
            this.renderTeamInfo();
            this.renderAgents();
            this.renderMessages();
            this.renderOnlineUsers();
            
        } catch (error) {
            console.error('Failed to load app:', error);
            localStorage.removeItem('token');
            this.showAuthScreen();
        }
    }
    
    showAuthScreen() {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
    
    showMainApp() {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }
    
    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const result = await api.login(email, password);
            this.loadApp(result.token);
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    }
    
    async handleRegister() {
        const teamName = document.getElementById('teamName').value;
        const userName = document.getElementById('userName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const result = await api.register(teamName, userName, email, password);
            this.loadApp(result.token);
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    }
    
    renderTeamInfo() {
        const header = document.getElementById('teamHeader');
        header.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold">${this.state.team.name}</h1>
                    <p class="text-sm text-gray-400">Invite Code: ${this.state.team.inviteCode}</p>
                </div>
                <div>
                    <span class="mr-4">${this.state.user.name}</span>
                    <button onclick="app.logout()" class="bg-red-500 px-4 py-2 rounded">Logout</button>
                </div>
            </div>
        `;
    }
    
    renderOnlineUsers() {
        const container = document.getElementById('onlineUsers');
        container.innerHTML = `
            <h3 class="font-bold mb-2">Online Users</h3>
            ${this.state.onlineUsers.map(user => `
                <div class="flex items-center mb-1">
                    <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span>${user.name}</span>
                </div>
            `).join('')}
        `;
    }
    
    renderMessages() {
        const container = document.getElementById('chatMessages');
        container.innerHTML = this.state.messages.map(msg => `
            <div class="mb-2">
                <span class="font-bold">${msg.userName}:</span>
                <span>${msg.content}</span>
                <span class="text-xs text-gray-500 ml-2">${new Date(msg.createdAt).toLocaleTimeString()}</span>
            </div>
        `).join('');
        
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }
    
    renderAgents() {
        const container = document.getElementById('agentList');
        container.innerHTML = `
            <h3 class="font-bold mb-2">Active Agents</h3>
            ${this.state.agents.map(agent => `
                <div class="bg-gray-800 p-2 mb-2 rounded cursor-pointer hover:bg-gray-700" 
                     onclick="app.selectAgent('${agent.id}')">
                    <div class="font-bold">${agent.userName}'s Agent</div>
                    <div class="text-sm">${agent.task}</div>
                    <div class="text-xs text-${agent.status === 'running' ? 'green' : 'gray'}-400">
                        ${agent.status}
                    </div>
                    ${agent.userId === this.state.user.id ? `
                        <button onclick="app.killAgent('${agent.id}')" 
                                class="bg-red-500 px-2 py-1 text-xs rounded mt-1">
                            Kill
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        `;
    }
    
    selectAgent(agentId) {
        this.state.selectedAgent = agentId;
        const output = this.state.agentOutputs[agentId] || [];
        this.showAgentOutput(agentId, output);
    }
    
    showAgentOutput(agentId, output) {
        const modal = document.getElementById('agentOutputModal');
        const agent = this.state.agents.find(a => a.id === agentId);
        
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div class="bg-gray-800 p-4 rounded w-3/4 h-3/4 flex flex-col">
                    <div class="flex justify-between mb-2">
                        <h3 class="font-bold">${agent.userName}'s Agent: ${agent.task}</h3>
                        <button onclick="app.closeAgentOutput()" class="text-red-500">Close</button>
                    </div>
                    <div id="agentOutputContent" class="bg-black text-green-400 p-2 font-mono text-sm overflow-auto flex-1">
                        ${output.join('<br>')}
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        // Auto-scroll to bottom
        const content = document.getElementById('agentOutputContent');
        content.scrollTop = content.scrollHeight;
    }
    
    appendAgentOutput(line) {
        const content = document.getElementById('agentOutputContent');
        if (content) {
            content.innerHTML += '<br>' + line;
            content.scrollTop = content.scrollHeight;
        }
    }
    
    closeAgentOutput() {
        document.getElementById('agentOutputModal').classList.add('hidden');
        this.state.selectedAgent = null;
    }
    
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message) {
            socketManager.emit('chat_message', { content: message });
            input.value = '';
        }
    }
    
    async spawnAgent() {
        const task = prompt('Enter task for agent:');
        if (task) {
            try {
                const result = await api.spawnAgent(task);
                console.log('Agent spawned:', result);
            } catch (error) {
                alert('Failed to spawn agent: ' + error.message);
            }
        }
    }
    
    async killAgent(agentId) {
        if (confirm('Kill this agent?')) {
            try {
                await api.killAgent(agentId);
                // Remove from state
                this.state.agents = this.state.agents.filter(a => a.id !== agentId);
                this.renderAgents();
            } catch (error) {
                alert('Failed to kill agent: ' + error.message);
            }
        }
    }
    
    refreshPreview() {
        const iframe = document.getElementById('previewFrame');
        iframe.src = iframe.src; // Reload iframe
        
        // Show notification
        const notification = document.getElementById('previewNotification');
        notification.textContent = 'Preview updated!';
        setTimeout(() => {
            notification.textContent = '';
        }, 3000);
    }
    
    logout() {
        localStorage.removeItem('token');
        window.location.reload();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CoVibeApp();
});
```

### Testing Your Implementation
1. Open http://localhost:3001 in browser
2. Create a new team
3. Open incognito window and join the team
4. Configure VM (can use mock data for testing)
5. Spawn an agent and verify output streams
6. Send chat messages between windows
7. Verify all real-time features work

---

## Agent 3: Integration & Testing Specialist

### Your Mission
Integrate the backend and frontend, ensure SSH connections work, test the complete system, and prepare for deployment.

### Specific Requirements

#### 3.1 SSH Integration Testing
Create `server/test/ssh-test.js`:
```javascript
// Test script to verify SSH connections work
// Test with actual EC2 instance
// Ensure Claude commands execute properly
// Verify output streaming works
```

#### 3.2 Mock Agent for Development
Create `server/services/mock-agent.js`:
```javascript
// When Claude is not available, simulate agent output
// Useful for frontend development
// Should emit realistic looking output at intervals
// Include different types of messages (info, error, success)
```

#### 3.3 End-to-End Test Script
Create `test/e2e-test.js`:
```javascript
// Automated test that:
// 1. Creates a team
// 2. Adds 3 users
// 3. Each user spawns an agent
// 4. Sends chat messages
// 5. Verifies all features work
```

#### 3.4 Docker Compose Setup
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: colabvibe_dev
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

#### 3.5 Deployment Configuration
Create deployment scripts:
- `scripts/deploy.sh` - Deploy to production
- `scripts/setup-vm.sh` - Setup script for user VMs
- Environment variable management
- SSL certificate setup

#### 3.6 Documentation
Create `README.md` with:
- Quick start instructions
- Architecture overview
- API documentation
- Troubleshooting guide

---

## Critical Implementation Notes

### Security Requirements
1. **NEVER** store unencrypted SSH keys
2. **ALWAYS** use parameterized queries (Prisma handles this)
3. **VALIDATE** all user input
4. **RATE LIMIT** agent spawning (max 10 per user per hour)
5. **SANITIZE** agent output before displaying (prevent XSS)

### Performance Requirements
1. **BUFFER** agent output (don't send every character)
2. **LIMIT** stored output to last 1000 lines
3. **PAGINATE** chat messages (load last 100 initially)
4. **DEBOUNCE** typing indicators
5. **POOL** SSH connections

### Error Handling
1. **GRACEFULLY** handle VM connection failures
2. **RETRY** failed SSH connections (3 attempts)
3. **NOTIFY** users of agent failures
4. **LOG** all errors for debugging
5. **FALLBACK** to mock agents if Claude unavailable

### Testing Checklist
- [ ] 3 users can join same team
- [ ] Each user can configure their VM
- [ ] Agents spawn successfully
- [ ] Output streams to all team members
- [ ] Only owner can kill their agent
- [ ] Chat messages broadcast to team
- [ ] Preview updates on git push
- [ ] System handles disconnections
- [ ] No memory leaks after 1 hour
- [ ] UI remains responsive

---

## Project Success Criteria

The MVP is complete when:

1. **Multi-user collaboration works**
   - 3+ users in same team
   - Real-time presence indicators
   - Team chat functioning

2. **Agent execution works**
   - Spawn agents on individual VMs
   - Stream output to all team members
   - Owner-only controls

3. **UI is functional**
   - Clean, responsive design
   - All features accessible
   - Real-time updates work

4. **System is stable**
   - Runs for 1+ hours without crashes
   - Handles errors gracefully
   - Reconnects automatically

5. **Demo ready**
   - Can demonstrate all features
   - No critical bugs
   - Deploys successfully

---

## Recommended Implementation Order

1. **Day 1-2**: Backend API (Agent 1)
   - Database setup
   - Auth endpoints
   - WebSocket foundation

2. **Day 3-4**: Frontend UI (Agent 2)
   - HTML structure
   - JavaScript application
   - Real-time features

3. **Day 5-6**: Integration (Agent 3)
   - SSH connections
   - Agent spawning
   - Output streaming

4. **Day 7**: Testing & Polish
   - End-to-end testing
   - Bug fixes
   - Deployment

---

## Common Pitfalls to Avoid

1. **Don't overcomplicate** - Use vanilla JS, not React
2. **Don't optimize early** - Get it working first
3. **Don't skip error handling** - Users need feedback
4. **Don't forget to test multi-user** - Core feature
5. **Don't hardcode values** - Use environment variables

---

## Questions to Ask Yourself

Before marking complete:
1. Can 3 people use this simultaneously?
2. Does agent output stream in real-time?
3. Do errors show helpful messages?
4. Will this work in a demo?
5. Is the code maintainable?

Good luck! Build something amazing that showcases the power of collaborative AI development.