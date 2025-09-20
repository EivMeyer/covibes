# CoVibe MVP Implementation Plan

## MVP Goal
A functioning system where 2-3 developers can spawn Claude agents, watch each other's agents work in real-time, and see a shared preview of their project - accessible via **web browser** (primary for MVP) and mobile app (secondary).

## Success Criteria
- [ ] 2+ users can join the same team via web browser
- [ ] Each user can spawn agents on their own VM
- [ ] All users see real-time agent output streams
- [ ] Team chat works
- [ ] Shared preview updates when code changes
- [ ] Works on Chrome/Safari/Firefox
- [ ] Mobile app also works (lower priority)

---

## Phase 1: Server Foundation (3 days)
*Goal: Basic server that can handle teams and WebSocket connections*

### Task 1.1: Project Setup
```bash
mkdir covibes-server
cd covibes-server
npm init -y
```
- [ ] Install dependencies: `express socket.io cors dotenv bcrypt jsonwebtoken`
- [ ] Install dev dependencies: `nodemon @types/node`
- [ ] Create basic folder structure: `/routes`, `/services`, `/middleware`, `/public`
- [ ] Setup `.env` file with PORT=3001, JWT_SECRET=dev-secret
- [ ] Create `server.js` with basic Express + Socket.io setup
- [ ] Serve static files from `/public` for web UI
- [ ] Test: Server starts on http://localhost:3001

### Task 1.2: Database Setup
```bash
npm install prisma @prisma/client
npx prisma init
```
- [ ] Install PostgreSQL locally or use Docker
- [ ] Create database: `createdb covibes_dev`
- [ ] Define Prisma schema:
  ```prisma
  model Team {
    id         String   @id @default(uuid())
    name       String
    inviteCode String   @unique
    users      User[]
  }
  
  model User {
    id       String  @id @default(uuid())
    email    String  @unique
    name     String
    teamId   String
    team     Team    @relation(fields: [teamId], references: [id])
    vmConfig Json?   // Stores encrypted VM credentials
  }
  
  model Agent {
    id        String   @id @default(uuid())
    userId    String
    task      String
    status    String   // running, completed, failed
    startedAt DateTime @default(now())
  }
  ```
- [ ] Run migration: `npx prisma migrate dev --name init`
- [ ] Test: Can connect to database

### Task 1.3: Auth Endpoints
- [ ] POST `/api/auth/register` - Create team & first user
- [ ] POST `/api/auth/join` - Join existing team
- [ ] POST `/api/auth/login` - Login existing user
- [ ] GET `/api/auth/me` - Get current user info
- [ ] Middleware: `authenticateToken` for protected routes
- [ ] Test with curl/Postman

### Task 1.4: WebSocket Setup
- [ ] Socket.io connection handling
- [ ] Join team room on connection
- [ ] Team presence tracking
- [ ] Broadcast online users to team
- [ ] Test: Multiple clients can connect

### Task 1.5: VM Configuration Endpoint
- [ ] POST `/api/vm/configure` - Store encrypted VM credentials
- [ ] GET `/api/vm/test` - Test VM connection
- [ ] Test: Can store and retrieve VM config

---

## Phase 2: Web UI (3-4 days)
*Goal: Simple, clean web interface that works immediately*

### Task 2.1: Base HTML/CSS Setup
Create `/public/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>CoVibe</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div id="app"></div>
  <script src="/js/app.js"></script>
</body>
</html>
```
- [ ] Setup Tailwind CSS via CDN (quick for MVP)
- [ ] Create responsive layout
- [ ] Three-column design: Command Deck | Workshop | Showcase
- [ ] Mobile-responsive (stacked on small screens)
- [ ] Test: Layout looks good

### Task 2.2: Vanilla JS App Structure
Create `/public/js/app.js`:
```javascript
// Simple state management
const state = {
  user: null,
  team: null,
  agents: [],
  messages: [],
  onlineUsers: []
};

// Socket.io connection
const socket = io();

// UI Components
const App = {
  init() {
    this.renderAuth();
    this.setupSocketListeners();
  },
  renderAuth() { /* Login/Join form */ },
  renderDashboard() { /* Main 3-column UI */ },
  renderCommandDeck() { /* Chat */ },
  renderWorkshop() { /* Agents */ },
  renderShowcase() { /* Preview */ }
};
```
- [ ] Basic component structure
- [ ] State management
- [ ] DOM manipulation helpers
- [ ] Event handlers
- [ ] Test: App loads without errors

### Task 2.3: Auth UI
- [ ] Login form (email, password)
- [ ] Create team form (team name, user info)
- [ ] Join team form (invite code, user info)
- [ ] Store JWT in localStorage
- [ ] Auto-login if token exists
- [ ] Logout button
- [ ] Test: Can create team and login

### Task 2.4: Command Deck (Chat)
- [ ] Chat message list
- [ ] Message input field
- [ ] Send button or Enter to send
- [ ] Show sender name and timestamp
- [ ] Auto-scroll to bottom
- [ ] Online users list with green dots
- [ ] Test: Can send and receive messages

### Task 2.5: Workshop (Agents)
- [ ] VM configuration modal
  - Host, username, SSH key input
  - Test connection button
- [ ] "Spawn Agent" button
  - Task input modal
  - Loading state while spawning
- [ ] Agent list
  - Show owner, task, status
  - Click to view output
- [ ] Agent output viewer
  - Terminal-style display
  - Real-time streaming
  - Kill button for own agents
- [ ] Test: Can spawn and view agents

### Task 2.6: Showcase (Preview)
- [ ] iframe showing preview URL
- [ ] Refresh button
- [ ] Full-screen toggle
- [ ] "Preview updating..." indicator
- [ ] Fallback if preview is down
- [ ] Test: Shows live preview

---

## Phase 3: Agent Execution (3-4 days)
*Goal: Spawn real Claude agents on VMs and stream output*

### Task 3.1: SSH Connection Service
```bash
npm install ssh2
```
- [ ] Create `services/SSHService.js`
- [ ] Connection pooling
- [ ] `executeCommand(vmConfig, command)` method
- [ ] `testConnection(vmConfig)` method
- [ ] Test: Can SSH to EC2

### Task 3.2: Agent Spawn Endpoint
- [ ] POST `/api/agent/spawn`
- [ ] SSH to user's VM
- [ ] Execute Claude command
- [ ] Return agent ID
- [ ] Handle errors gracefully
- [ ] Test: Spawns real Claude agent

### Task 3.3: Agent Output Streaming
- [ ] Parse Claude's stream-json output
- [ ] Store recent output in memory
- [ ] Broadcast to team via WebSocket
- [ ] Handle large outputs efficiently
- [ ] Test: See real-time output

### Task 3.4: Agent Control
- [ ] Kill agent endpoint
- [ ] Input to agent endpoint
- [ ] Owner-only permissions
- [ ] Test: Can control own agents

---

## Phase 4: Mobile App (Optional for MVP, 3-4 days)
*Goal: React Native app as secondary interface*

### Task 4.1: Expo Setup
```bash
npx create-expo-app covibes-mobile
```
- [ ] Install dependencies
- [ ] Configure API URL
- [ ] Setup navigation
- [ ] Test: Runs in simulator

### Task 4.2: WebView Approach (Fastest)
- [ ] Single WebView pointing to web UI
- [ ] Native navigation bar
- [ ] Handle auth token passing
- [ ] Native feel with web content
- [ ] Test: Can use web UI in app

### Task 4.3: Native Screens (If Time)
- [ ] Native auth screens
- [ ] Native chat UI
- [ ] Native agent list
- [ ] Reuse web preview
- [ ] Test: Native screens work

---

## Phase 5: Preview System (2 days)
*Goal: Shared preview that updates automatically*

### Task 5.1: Preview Server Setup
- [ ] Use server VM or separate VM
- [ ] Install PM2
- [ ] Clone test repository
- [ ] Setup PM2 ecosystem
- [ ] Test: Preview runs on port 3000

### Task 5.2: GitHub Integration
- [ ] Webhook endpoint
- [ ] Auto-pull on push
- [ ] PM2 restart
- [ ] Broadcast update event
- [ ] Test: Push updates preview

### Task 5.3: Preview in UI
- [ ] iframe integration
- [ ] Auto-refresh on update
- [ ] Loading states
- [ ] Error handling
- [ ] Test: Preview updates live

---

## Phase 6: Polish & Deploy (2-3 days)
*Goal: Demo-ready system*

### Task 6.1: UI Polish
- [ ] Loading spinners everywhere
- [ ] Error messages
- [ ] Empty states
- [ ] Smooth transitions
- [ ] Dark mode (optional)
- [ ] Test: Feels professional

### Task 6.2: Testing
- [ ] 3-user test scenario
- [ ] Concurrent agents
- [ ] Large outputs
- [ ] Network issues
- [ ] Fix all bugs found

### Task 6.3: Deployment
- [ ] Deploy server (Railway/Fly.io)
- [ ] Configure domain
- [ ] SSL certificates
- [ ] Environment variables
- [ ] Test: Works in production

---

## Simplified Architecture for MVP

```
┌─────────────────────────────────────┐
│         Web Browser (Primary)        │
│  ┌──────────┬──────────┬─────────┐ │
│  │ Command  │ Workshop │ Showcase│ │
│  │  (Chat)  │ (Agents) │(Preview)│ │
│  └──────────┴──────────┴─────────┘ │
└─────────────────────────────────────┘
                  │
                  ↓ HTTPS + WebSocket
                  │
         ┌────────────────┐
         │ CoVibe Server│
         │  (Node.js)     │
         └────────────────┘
                  │
                  ↓ SSH
                  │
    ┌─────────────────────────┐
    │ Individual VMs          │
    │ (Claude Code)           │
    └─────────────────────────┘
```

---

## Quick Start Development

### Day 1-3: Server + Web UI Basic
```bash
# Start server
cd covibes-server
npm install
npm run dev

# Open browser
open http://localhost:3001
```

### Day 4-6: Agent Integration
- Connect to real VMs
- Stream real output
- Test with team

### Day 7-8: Polish
- Fix bugs
- Improve UI
- Deploy

---

## Minimal Tech Stack

### Frontend (Web)
- HTML + Tailwind CSS (via CDN)
- Vanilla JavaScript (no framework)
- Socket.io client
- No build process!

### Backend
- Node.js + Express
- Socket.io
- PostgreSQL + Prisma
- SSH2 for VM connections

### Why This Approach
- **No build step** - Just edit and refresh
- **No framework** - Fast to develop
- **Tailwind CDN** - Pretty UI instantly
- **Vanilla JS** - No compilation needed
- **Single deployment** - Server serves everything

---

## Testing the MVP

### Manual Test Script
1. Open 3 browser tabs
2. Create team in tab 1
3. Join team in tabs 2 & 3
4. Configure VMs for each user
5. User 1: Spawn agent "Create a todo app"
6. All users: Watch output streaming
7. User 2: Spawn agent "Add authentication"
8. User 3: Chat "Looking good!"
9. Check preview updates
10. Success if no crashes!

---

## Time Estimate

- **Week 1**: Server + Web UI + Agent basics
- **Week 2**: Polish + Deploy + Mobile (if time)

**Total: 2 weeks to working MVP**

Could be done in **1 week** by:
- Using mock agents initially
- Skipping mobile entirely
- Minimal UI polish
- Single test VM

---

## Definition of Done

MVP is complete when:
1. ✅ 3 people can use it in web browsers
2. ✅ Each spawns agents on their VMs
3. ✅ Everyone sees agent outputs
4. ✅ Chat works
5. ✅ Preview shows latest code
6. ✅ 10-minute demo runs smoothly

Ship it! 🚀