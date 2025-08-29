# CoVibe Architecture

## System Overview

CoVibe uses a three-tier architecture that separates execution (VMs), coordination (Server), and presentation (Mobile Apps). This enables distributed agent execution with centralized team coordination.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Sarah's Phone  │     │ Miguel's Phone  │     │  Chen's Phone   │
│  (React Native) │     │  (React Native) │     │  (React Native) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                      WebSocket & HTTPS
                                 │
                    ┌────────────▼────────────┐
                    │   Coordination Server   │
                    │  - Team Chat & Presence │
                    │  - Agent Output Streams │
                    │  - Shared Preview       │
                    │  - GitHub Webhooks      │
                    └────────────┬────────────┘
                                 │
                    Connection Strategy Layer
                   (SSH Proxy for MVP, Flexible)
                    ┌────────────┼────────────┐
                    │            │            │
         ┌──────────▼───┐  ┌────▼──────┐  ┌──▼──────────┐
         │ Sarah's VM   │  │Miguel's VM│  │ Chen's VM   │
         │ Claude Code  │  │Claude Code│  │ Claude Code │
         │ ↓ WebSocket  │  │↓ WebSocket│  │ ↓ WebSocket │
         └──────────────┘  └───────────┘  └─────────────┘
                    │            │            │
                    └────────────┼────────────┘
                                 │
                           GitHub Repository
```

## Component Details

### 1. Mobile Applications

**Technology**: React Native + Expo
**Purpose**: User interface for team collaboration

**Key Features**:
- Three-tab navigation (Command Deck, Workshop, Showcase)
- WebSocket connection for real-time updates
- Secure storage for VM credentials
- Agent spawn interface
- Output streaming display

**State Management**:
```typescript
interface AppState {
  user: User;
  team: Team;
  agents: Agent[];
  chat: Message[];
  presence: PresenceMap;
  previewUrl: string;
}
```

### 2. Coordination Server

**Technology**: Node.js + Express + Socket.io
**Purpose**: Central hub for team coordination

**Connection Strategy**: Flexible architecture supporting multiple VM connection methods
- **MVP**: SSH Proxy (server stores encrypted credentials, proxies commands)
- **Future**: Agent Polling (VMs poll for commands, no SSH needed)
- **Future**: Direct Tunnel (reverse tunnels from VMs)

**Core Services**:

#### API Layer (REST)
```
POST   /api/auth/login          # Team login with invite code
POST   /api/auth/refresh        # Refresh auth token
POST   /api/team/create         # Create new team
POST   /api/team/invite         # Generate invite code

POST   /api/agent/spawn         # Start agent on user's VM
DELETE /api/agent/:id           # Kill agent (owner only)
GET    /api/agent/list          # List all team agents

POST   /api/chat/message        # Send team message
GET    /api/chat/history        # Get message history

POST   /api/vm/register         # Register user's VM
PUT    /api/vm/update           # Update VM connection info
```

#### WebSocket Layer (Real-time)
```javascript
// Events from client to server
socket.emit('join_team', { teamId, token });
socket.emit('agent_spawn', { task, vmId });
socket.emit('agent_control', { agentId, command });
socket.emit('chat_message', { message });
socket.emit('presence_update', { status });

// Events from server to clients
socket.on('agent_output', { agentId, owner, data, canControl });
socket.on('agent_status', { agentId, status });
socket.on('chat_message', { userId, message, timestamp });
socket.on('team_presence', { users });
socket.on('preview_updated', { url, commit });
```

#### Database Schema (PostgreSQL)
```sql
-- Core tables
teams (id, name, invite_code, created_at)
users (id, team_id, email, name, created_at)
vms (id, user_id, connection_config, last_seen)
agents (id, user_id, task, status, started_at, completed_at)
messages (id, team_id, user_id, content, timestamp)

-- Real-time state (Redis)
presence:{teamId} → Set of online user IDs
agent:{agentId}:output → Circular buffer of recent output
agent:{agentId}:status → Current agent status
```

### 3. Individual VMs

**Technology**: Ubuntu + Claude Code CLI
**Purpose**: Execute AI agents

**VM Setup Requirements**:
```bash
# Software
- Ubuntu 22.04+
- Node.js 20+
- Claude Code CLI
- Git with team repo access
- PM2 (optional, for local monitoring)

# Directory Structure
/home/ubuntu/
├── project/              # Team's git repository
├── .claude/              # Claude configuration
├── agent_logs/           # Output logs per agent
└── colabvibe_agent.js    # Agent wrapper script
```

**Agent Wrapper Script**:
```javascript
// colabvibe_agent.js - Runs on each VM
const { spawn } = require('child_process');
const WebSocket = require('ws');

function runAgent(agentId, task, serverUrl, token) {
  const ws = new WebSocket(serverUrl);
  
  const claude = spawn('claude', [
    '-p', task,
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--verbose'
  ], { cwd: '/home/ubuntu/project' });
  
  claude.stdout.on('data', (data) => {
    ws.send(JSON.stringify({
      type: 'output',
      agentId,
      data: data.toString(),
      token
    }));
  });
  
  claude.on('exit', (code) => {
    ws.send(JSON.stringify({
      type: 'complete',
      agentId,
      code,
      token
    }));
    ws.close();
  });
}
```

### 4. Shared Preview System

**Technology**: PM2 + Node.js
**Purpose**: Single preview for entire team

**Architecture**:
```
GitHub Webhook → Server → Pull latest → Restart preview
                            ↓
                   PM2 ecosystem.config.js
                            ↓
                   Preview app on port 3000
                            ↓
                   Nginx reverse proxy
                            ↓
                   https://preview.colabvibe.app
```

**Deployment Flow**:
1. Agent commits code to GitHub
2. GitHub webhook hits `/api/webhook/push`
3. Server pulls latest from main branch
4. PM2 restarts preview application
5. All team members see updated preview

## Connection Architecture

### Flexible Connection Strategy

The server uses a pluggable architecture for VM connections, allowing different strategies based on user preference and security requirements:

```javascript
// Server-side connection manager
class ConnectionManager {
  async executeOnVM(userId, command) {
    const user = await getUser(userId);
    const strategy = this.strategies[user.connectionType];
    return strategy.execute(user.vmConfig, command);
  }
  
  strategies = {
    'ssh_proxy': new SSHProxyStrategy(),      // MVP
    'polling': new PollingStrategy(),         // Future
    'reverse_tunnel': new TunnelStrategy(),   // Future
  }
}
```

This design allows:
- **Quick MVP launch** with SSH proxy
- **Progressive enhancement** as platform matures
- **User choice** based on security needs
- **No breaking changes** when adding new strategies

## Data Flow Scenarios

### Scenario 1: Spawning an Agent (MVP - SSH Proxy)

```
1. Sarah taps "Spawn Agent" in app
2. App sends POST /api/agent/spawn with task
3. Server validates Sarah owns the VM
4. Server retrieves encrypted SSH credentials
5. Server SSHs to Sarah's VM using credentials
6. Executes: node colabvibe_agent.js <agentId> <task>
7. Agent starts, connects WebSocket back to server
8. Server broadcasts "agent_started" to team
9. All team members see "Sarah's agent: Add auth"
```

### Scenario 2: Watching Agent Output

```
1. Sarah's agent outputs: "Installing passport..."
2. VM WebSocket sends output to server
3. Server stores in Redis circular buffer
4. Server broadcasts to all team WebSocket clients
5. Sarah sees output with [Kill] [Input] buttons
6. Miguel sees same output (read-only)
7. Chen opens app later, fetches recent output from Redis
```

### Scenario 3: Preview Update

```
1. Agent completes, commits to GitHub
2. GitHub webhook → POST /api/webhook/push
3. Server verifies webhook signature
4. Server SSHs to preview VM
5. Executes: cd /preview && git pull && pm2 restart preview
6. Server broadcasts "preview_updated" event
7. All apps refresh Showcase WebView
```

## Security Architecture

### Authentication Flow
```
1. User enters team invite code
2. Server validates code, returns JWT
3. JWT stored in secure storage on device
4. All API calls include JWT in header
5. WebSocket auth via JWT on connection
```

### VM Connection Strategy (Flexible Architecture)

#### MVP: SSH Proxy Strategy
```
1. User provides VM SSH key/password via mobile app
2. Credentials encrypted with server key + user ID
3. Stored encrypted in server database
4. Server decrypts and uses for SSH operations
5. Never accessible to other team members

Note: This is the simplest approach for demo/MVP.
Future versions will support more secure options.
```

#### Future: Polling Strategy
```
1. VM runs polling agent that connects to server
2. No SSH credentials needed
3. VM pulls commands from queue
4. More secure but requires VM setup
```

#### Future: Device-Only Strategy
```
1. Credentials never leave mobile device
2. Direct SSH from mobile to VM
3. Most secure but complex mobile implementation
```

### Permission Model
```
- Team Level: Read all, write to chat
- Agent Level: Read all, control own only
- VM Level: Access own only
- Preview: Read all, deploy via git only
```

## Scaling Considerations

### Current Architecture Limits
- **Teams**: ~100 concurrent teams
- **Users per team**: ~10 active users
- **Agents**: ~5 concurrent per team
- **Output streaming**: ~1MB/s per agent

### Bottlenecks & Solutions
1. **WebSocket connections**: Use Socket.io clustering
2. **SSH connection pool**: Implement connection pooling
3. **Output storage**: Use Redis with TTL (1 hour)
4. **Preview hosting**: One preview per team (port allocation)

### Future Scaling Path
```
Phase 1 (Current): Single server, multiple VMs
Phase 2: Load balancer + multiple servers
Phase 3: Kubernetes for preview isolation
Phase 4: Edge deployment for global teams
```

## Implementation Details

### Connection Strategy Implementations

```javascript
// strategies/SSHProxyStrategy.js (MVP)
class SSHProxyStrategy {
  async execute(vmConfig, command) {
    const ssh = new SSH2.Client();
    const credentials = await decrypt(vmConfig.encryptedKey);
    
    return new Promise((resolve, reject) => {
      ssh.on('ready', () => {
        ssh.exec(command, (err, stream) => {
          if (err) reject(err);
          resolve(stream);
        });
      }).connect({
        host: vmConfig.host,
        username: vmConfig.username,
        privateKey: credentials
      });
    });
  }
}

// strategies/PollingStrategy.js (Future)
class PollingStrategy {
  async execute(vmConfig, command) {
    // Add command to queue
    await redis.lpush(`vm:${vmConfig.id}:commands`, command);
    // Wait for agent to pick up and execute
    return await waitForExecution(vmConfig.id, command);
  }
}
```

### VM Configuration Schema

```typescript
interface VMConfig {
  id: string;
  userId: string;
  connectionType: 'ssh_proxy' | 'polling' | 'tunnel';
  
  // For SSH Proxy (MVP)
  host?: string;
  port?: number;
  username?: string;
  encryptedKey?: string;  // Encrypted SSH private key
  
  // For Polling (Future)
  agentToken?: string;
  lastPoll?: Date;
  
  // For Tunnel (Future)
  tunnelId?: string;
  tunnelPort?: number;
}
```

## Technology Stack Summary

### Frontend (Mobile)
- React Native 0.72+
- Expo SDK 49+
- React Navigation 6
- Zustand for state
- Socket.io client
- expo-secure-store

### Backend (Server)
- Node.js 20+
- Express/Fastify
- Socket.io
- PostgreSQL 15+
- Redis 7+
- Prisma ORM
- PM2
- SSH2 (for MVP SSH proxy)

### Infrastructure
- Ubuntu 22.04 VMs
- Claude Code CLI
- GitHub for repositories
- Nginx for reverse proxy
- Let's Encrypt for SSL

## Development & Deployment

### Local Development
```bash
# Server
npm install
npm run dev  # Runs with nodemon

# Mobile
npm install
npm run ios/android  # Expo development

# Database
docker-compose up -d  # PostgreSQL + Redis
npm run migrate      # Prisma migrations
```

### Production Deployment
```bash
# Server (on coordination VM)
pm2 start ecosystem.config.js
pm2 save

# SSL setup
certbot --nginx -d api.colabvibe.app -d preview.colabvibe.app

# Database backups
pg_dump colabvibe > backup.sql  # Daily cron
```

## Monitoring & Observability

### Key Metrics
- Active agents per team
- WebSocket connections
- Agent completion rate
- Preview deployment success
- API response times
- Claude API costs per user

### Logging Strategy
- Server logs → CloudWatch/Datadog
- Agent outputs → Redis (temporary) + S3 (archive)
- Error tracking → Sentry
- Performance → New Relic/DataDog

## Failure Modes & Recovery

### VM Disconnection
- Agent continues running
- Output buffered locally
- Reconnect and replay on recovery

### Server Crash
- Agents continue on VMs
- Mobile apps reconnect automatically
- Fetch missed state from Redis/PostgreSQL

### GitHub Downtime
- Agents can still run
- Preview updates queue
- Retry webhook on recovery

## MVP Architecture Summary

### What We're Building First (Demo)

For the initial demo/MVP, we're using the **SSH Proxy Strategy**:

1. **Simple credential flow**: Mobile app → Server (encrypted storage) → VM
2. **Server handles SSH**: No complex mobile SSH implementation needed
3. **Proven technology**: SSH2 library is battle-tested
4. **Quick to market**: Can build and demo in weeks

### Why This Approach Works

- **Demo friendly**: Works reliably in all demo scenarios
- **Debuggable**: Easy to test and troubleshoot
- **Flexible**: Architecture allows migration to more secure options later
- **Practical**: Gets us to market quickly to validate the concept

### Security Notes for MVP

While the SSH Proxy approach stores encrypted credentials on the server, we mitigate risks by:
- Encrypting with server key + user ID (unique per user)
- Audit logging all VM access
- Rate limiting agent spawning
- Allowing users to rotate credentials anytime
- Planning migration path to more secure options

### Future Migration Path

The flexible architecture ensures we can evolve without breaking changes:
1. **MVP**: SSH Proxy (server stores encrypted credentials)
2. **v2**: Add polling option for security-conscious users
3. **v3**: Direct mobile SSH for maximum security
4. **v4**: Enterprise options with Vault integration

---

This architecture provides a solid foundation for async team collaboration while maintaining individual control and resource isolation. The flexible connection strategy allows us to ship quickly while preserving the ability to enhance security as the platform matures.