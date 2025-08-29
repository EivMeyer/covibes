# ColabVibe: Project Context for LLM Agents

## IMPORTANT INSTRUCTIONS - ALWAYS FOLLOW

### Git Workflow - MANDATORY FOR ALL AGENTS
**ALWAYS push to staging branch when completing any task:**
1. **Create or checkout staging branch**: 
   - If staging doesn't exist: `git checkout -b staging`
   - If staging exists: `git checkout staging`
2. **Stage all changes**: `git add .`
3. **Commit with descriptive message**: 
   - Use conventional commits: `git commit -m "feat: added IDE integration"`
   - Or: `git commit -m "fix: resolved API connection issue"`
4. **Push to staging**: 
   - First push: `git push -u origin staging`
   - Subsequent pushes: `git push origin staging`
5. **NEVER push directly to main/master** unless explicitly instructed
6. **This ensures all changes are reviewed before merging to production**

Example workflow:
```bash
# After completing a task
git checkout -b staging  # or git checkout staging
git add .
git commit -m "feat: implemented full IDE with Monaco Editor"
git push -u origin staging  # or git push origin staging
```

**Git Hooks are configured** to enforce this workflow:
- **pre-push hook**: Blocks direct pushes to main/master
- **post-commit hook**: Reminds to push to staging after commits
- Run `./setup-git-hooks.sh` to enable hooks if not already active

### Server Management
**NEVER restart the development servers unless explicitly prompted by the user.** The servers have auto-restart capabilities (nodemon for backend, HMR for frontend) and will automatically reload when files are changed. Only start/restart servers when the user specifically asks you to do so.

### Port Configuration
**ALWAYS use these ports for development:**
- **Frontend (Vite)**: Port **3000** - The client application with hot module replacement
- **Backend (Express/Socket.io)**: Port **3001** - The API server with WebSocket support
- The frontend is configured with `strictPort: true` in `vite.config.ts` to ensure it always runs on port 3000
- The frontend proxies `/api` and `/socket.io` requests to the backend on port 3001

**Key Health Check Commands**:
```bash
cd tests
npm run check:hmr              # Quick HMR health check
npm run test:hmr              # Full HMR regression test
cd tests/utils && ./run-health-checks.sh  # All system health checks
```

### ⚠️ **Critical Patterns to Follow**

#### **Database-Backed State Pattern**
```typescript
// ❌ WRONG: In-memory state (prone to desync)
const containerState = new Map();

// ✅ CORRECT: Database-backed state (always consistent)
await this.prisma.previewDeployment.upsert({
  where: { teamId },
  create: { teamId, containerId, port, status: 'running' },
  update: { status: 'running', updatedAt: new Date() }
});
```


#### **Test Organization Pattern**
```bash
# ✅ CORRECT: Focused, essential tests
tests/playwright/preview/e2e.spec.js          # One comprehensive preview test
tests/utils/health-checks/hmr-check.js        # Quick system health verification

# ❌ WRONG: Debugging artifacts and iterations  
tests/preview-investigation.js                # Remove debugging scripts
tests/preview-simple.js                       # Remove duplicate attempts
tests/preview-cors-fix.js                     # Remove one-time fixes
```

## Project Overview

ColabVibe is a fully functional web-based collaboration platform where developers spawn AI agents to work on code collaboratively. The system enables real-time team collaboration with persistent chat, AI agent management, terminal access, Monaco IDE integration, and remote VM execution. **Updated August 2025 with enhanced message persistence, database-backed state management, comprehensive testing infrastructure, and Docker containerization.**

### Core Capabilities
- **Multi-user team collaboration** with real-time chat and presence
- **AI agent spawning** and management with live output streaming
- **Integrated Monaco Editor IDE** with syntax highlighting and IntelliSense
- **Terminal integration** with xterm.js for direct VM interaction
- **Live preview system** with automatic deployment and sharing
- **GitHub integration** for repository management and webhooks
- **Flexible workspace layouts** with drag-and-drop panel management
- **Mobile-responsive design** with dedicated mobile interfaces

## Technology Stack

### Backend (`colabvibe/server/`)
- **Runtime**: Node.js >=18.0.0 with TypeScript and ESM modules
- **Framework**: Express.js with Socket.io for real-time features
- **Database**: PostgreSQL with Prisma ORM (comprehensive schema with 7 models)
- **Authentication**: JWT with Passport.js and GitHub OAuth
- **Services**: SSH2 for VM connections, Docker for preview deployments, advanced terminal management
- **Testing**: Jest with comprehensive integration and unit tests
- **Terminal Management**: Multiple PTY managers (tmux, screen, local, remote)

### Frontend (`colabvibe/client/`)
- **Framework**: React 19.1.1 with TypeScript and Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.17 with responsive design patterns
- **State Management**: React hooks with context providers
- **Real-time**: Socket.io client 4.8.1 for WebSocket connections
- **Editor**: Monaco Editor for IDE functionality
- **Terminal**: xterm.js 5.3.0 with WebSocket streaming
- **Layout**: Multiple workspace systems (Muuri, Allotment, React Grid Layout, Dockview)
- **Testing**: Vitest with React Testing Library and Playwright for E2E
- **Architecture**: Feature-based component organization with mobile-responsive design

### Infrastructure
- **Development**: Docker Compose for local database services
- **Deployment**: PM2 for process management, Nginx for reverse proxy
- **Version Control**: Git with enforced staging branch workflow
- **Containerization**: Comprehensive Docker infrastructure for agents and previews
  - Claude agent containers with wrapper scripts
  - Multi-language preview containers (React, Next.js, Node.js, Python, Static)
  - Workspace synchronization containers
- **Testing**: Organized Playwright test suite with health checks and utilities

## Project Structure

```
covibes/
├── CLAUDE.md                      # Main project context (this file)
├── server/                        # Backend Express/Socket.io server
│   │   ├── src/                   # TypeScript source code
│   │   │   ├── routes/            # API route handlers (9 modules)
│   │   │   ├── services/          # Terminal management services
│   │   │   ├── config/            # Passport.js configuration
│   │   │   └── middleware/        # Authentication middleware
│   │   ├── services/              # Business logic services (14 modules)
│   │   ├── prisma/                # Database schema and migrations
│   │   └── tests/                 # Backend test suites (integration + unit)
├── client/                        # Frontend React application
│   │   ├── src/                   # React components and logic
│   │   │   ├── components/        # Feature-based component organization
│   │   │   │   ├── features/      # Feature modules (agents, auth, chat, etc.)
│   │   │   │   ├── layout/        # Workspace layout systems
│   │   │   │   ├── mobile/        # Mobile-responsive components
│   │   │   │   ├── tiles/         # Workspace tile components
│   │   │   │   └── ui/            # Reusable UI components
│   │   │   ├── services/          # API and socket services
│   │   │   ├── hooks/             # Custom React hooks (8 modules)
│   │   │   └── pages/             # Main page components
│   │   ├── public/                # Static assets
│   │   └── tests/                 # Frontend test suites
├── docker-compose.yml             # Local development services
├── docker/                        # Docker infrastructure
│   ├── claude-agent/              # Claude agent containerization
│   ├── preview/                   # Multi-language preview containers
│   └── workspace-sync/            # Workspace synchronization
├── tests/                         # Comprehensive E2E testing
│   ├── playwright/                # Organized by feature (agents, auth, preview, etc.)
│   ├── utils/health-checks/       # System health verification utilities
│   └── integration/               # Backend integration tests
├── scripts/                       # Deployment and utility scripts
└── docs/                          # Additional documentation
```

## Key Development Commands

### Server Development
```bash
cd server
# Set required environment variables first:
export EC2_HOST=ec2-13-60-242-174.eu-north-1.compute.amazonaws.com
export EC2_USERNAME=ubuntu

npm run dev          # Start development server on port 3001 with hot reload
npm run build        # Build TypeScript to JavaScript
npm run lint         # Type check with TypeScript
npm run test         # Run all tests
npm run test:integration  # Run integration tests only
npm run prisma:migrate    # Run database migrations
npm run prisma:studio     # Open database admin interface
```

### Client Development
```bash
cd client
npm run dev          # Start Vite development server on port 3000
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run Vitest unit tests
npm run type-check   # TypeScript type checking
```

### Database Management
```bash
# Start local services
docker-compose up -d postgres redis

# Database operations
cd server
npm run prisma:migrate     # Apply schema changes
npm run prisma:generate    # Regenerate Prisma client
npm run prisma:seed        # Seed with demo data
```

### Testing
```bash
# Backend tests
cd server
TEST_DATABASE_URL="postgresql://..." npm run test:integration

# Frontend tests
cd client
npm run test
npm run test:coverage

# E2E tests
cd tests
npm install
npx playwright test
```

## Environment Variables

### Required Environment Variables for Server Startup
**CRITICAL**: These environment variables must be set before starting the server to prevent startup failures:

```bash
# EC2 Configuration (REQUIRED for Docker services)
export EC2_HOST=ec2-13-60-242-174.eu-north-1.compute.amazonaws.com
export EC2_USERNAME=ubuntu

# Database Configuration
export DATABASE_URL="postgresql://postgres:password@localhost:5432/colabvibe_dev"
export TEST_DATABASE_URL="postgresql://postgres:password@localhost:5433/colabvibe_test"

# Authentication
export JWT_SECRET="development-jwt-secret-key"
export ENCRYPTION_KEY="32-character-development-encrypt-key!"

# GitHub OAuth (Optional - for GitHub integration)
export GITHUB_CLIENT_ID="your-github-client-id"
export GITHUB_CLIENT_SECRET="your-github-client-secret"

# Development Mode
export NODE_ENV="development"
```

### Environment Setup Script
Create a `.env` file in the root directory or run these commands before starting the server:

```bash
# Quick setup script for development
export EC2_HOST=ec2-13-60-242-174.eu-north-1.compute.amazonaws.com
export EC2_USERNAME=ubuntu
export JWT_SECRET="development-jwt-secret-key"
export ENCRYPTION_KEY="32-character-development-encrypt-key!"
export NODE_ENV="development"

# Then start the server
cd server && npm run dev
```

### Startup Issues Prevention
Common startup failures and their fixes:

1. **"EC2_HOST environment variable is required"**
   - Fix: `export EC2_HOST=ec2-13-60-242-174.eu-north-1.compute.amazonaws.com`

2. **"EC2_USERNAME environment variable is required"**
   - Fix: `export EC2_USERNAME=ubuntu`

3. **"listen EADDRINUSE: address already in use :::3001"**
   - Fix: `lsof -ti:3001 | xargs kill -9`

4. **Database connection errors**
   - Ensure PostgreSQL is running: `docker-compose up -d postgres`
   - Check DATABASE_URL environment variable

## Important Files & Their Purposes

### Core Application Files
- `server/src/server.ts` - Main Express server with Socket.io setup
- `server/src/routes/` - API route handlers (agents, auth, github, ide, layout, preview, team, terminal, vm, workspace)
- `server/prisma/schema.prisma` - Database schema with 7 models (agents, teams, users, messages, container_instances, preview_deployments, terminal_history)
- `client/src/App.tsx` - Main React application component
- `client/src/components/features/` - Feature-based component organization
- `client/src/pages/Dashboard.tsx` - Main application interface
- `server/services/` - Business logic services (14 modules including terminal management)

### Configuration Files
- `server/package.json` - Backend dependencies and scripts (Node.js >=18.0.0)
- `client/package.json` - Frontend dependencies and scripts (React 19.1.1, Vite 5.4.19)
- `client/vite.config.ts` - Vite build configuration with proxy setup
- `client/tailwind.config.js` - Tailwind CSS 3.4.17 configuration
- `docker-compose.yml` - Local development services
- `docker/` - Docker infrastructure configurations

### Testing Infrastructure
- `server/tests/` - Backend unit and integration tests (organized by type)
- `client/src/test/` - Frontend unit tests with Vitest and React Testing Library
- `tests/` - Comprehensive E2E testing with Playwright
- `tests/playwright/` - Organized test suites (agents/, auth/, preview/, collaboration/, etc.)
- `tests/utils/health-checks/` - System health verification utilities
- `tests/playwright.config.js` - E2E test configuration

## Database Schema (Prisma)

The database uses 7 core models with comprehensive relationships:

### Core Models
```prisma
// Teams - Central organizing unit
model teams {
  id                  String    @id
  name                String
  teamCode            String    @unique
  repositoryUrl       String?
  workspaceLayouts    Json?
  workspaceTiles      Json?
  // Relations: users[], agents[], messages[], container_instances[], preview_deployments?
}

// Users - Team members with VM and GitHub integration
model users {
  id                  String    @id @unique
  email               String    @unique
  userName            String
  teamId              String
  vmId                String?   // VM connection details
  githubId            String?   @unique
  githubUsername      String?
  claudeConfigDir     String?   // Claude config directory path
  // Relations: teams, agents[], messages[], container_instances[]
}

// Agents - AI agents with terminal isolation
model agents {
  id                  String    @id
  userId              String
  teamId              String
  task                String
  status              String    @default("running")
  output              String    @default("")
  terminalIsolation   String    @default("tmux")     // tmux, screen, local
  terminalLocation    String    @default("local")    // local, remote
  isSessionPersistent Boolean   @default(false)
  tmuxSessionName     String?
  // Relations: users, teams, container_instances[], terminal_history[]
}

// Container Instances - Docker container management
model container_instances {
  id           String   @id
  teamId       String
  userId       String
  agentId      String?
  type         String   // agent, preview, workspace
  containerId  String?
  status       String   @default("starting")
  terminalPort Int?
  previewPort  Int?
  metadata     Json     @default("{}")
  // Relations: teams, users, agents?
}

// Preview Deployments - Database-backed preview state
model preview_deployments {
  id              String    @id
  teamId          String    @unique
  containerId     String
  containerName   String
  port            Int
  proxyPort       Int
  status          String
  projectType     String
  lastHealthCheck DateTime?
  errorMessage    String?
  // Relations: teams (unique)
}

// Messages - Persistent team chat
model messages {
  id        String   @id
  content   String
  userId    String
  teamId    String
  createdAt DateTime @default(now())
  // Relations: users, teams
}

// Terminal History - Agent terminal output persistence
model terminal_history {
  id        String   @id
  agentId   String
  output    String
  timestamp DateTime @default(now())
  type      String   @default("output")
  // Relations: agents
}
```

## Common Development Patterns

### Adding New API Endpoints
1. Define route in `colabvibe/server/src/routes/`
2. Add authentication middleware if needed
3. Update database schema in `prisma/schema.prisma` if required
4. Write integration tests in `server/tests/integration/`
5. Update frontend API service in `client/src/services/api.ts`

### Creating New React Components
1. Create component in appropriate `client/src/components/` subdirectory
2. Follow existing patterns for TypeScript interfaces
3. Use Tailwind CSS for styling
4. Write unit tests in `__tests__/` subdirectory
5. Export from `index.ts` files for clean imports

### WebSocket Event Handling
1. Define events in `server/src/server.ts` Socket.io handlers
2. Update client-side socket handling in `client/src/services/socket.ts`
3. Ensure proper authentication and error handling
4. Test real-time functionality with multiple browser tabs

## Development Guidelines

### Code Quality
- **TypeScript**: Strict mode enabled, use proper typing
- **ESLint**: Configured for both frontend and backend
- **Prettier**: Automated code formatting
- **Testing**: Comprehensive test coverage required for new features

### Database Changes
1. Always create Prisma migrations: `npm run prisma:migrate`
2. Update seed data if schema changes affect demo data
3. Test migrations on clean database before committing
4. Consider backwards compatibility for production deployments

### Security Considerations
- JWT tokens for API authentication
- Input validation using Zod schemas
- SQL injection prevention through Prisma
- XSS prevention with proper React patterns
- Encrypted storage of sensitive VM credentials

### Performance Optimization
- React component memoization where appropriate
- Database query optimization with Prisma
- WebSocket connection management and cleanup
- Lazy loading for large components and routes

## Troubleshooting Common Issues

### Database Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check connection string in `.env` files
- Run `npm run prisma:generate` after schema changes

### WebSocket Connection Problems
- Verify CORS configuration in server
- Check network ports are available (3000 for client, 3001 for server)
- Test Socket.io connection in browser dev tools

### Build Failures
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check TypeScript compilation: `npm run type-check`
- Verify all environment variables are set

### Test Failures
- Ensure test database is running and isolated
- Check for port conflicts during test runs
- Update test snapshots if intentional UI changes were made

### Preview System Issues
- **Recurring proxy errors**: Use database-backed state instead of in-memory Maps
- **Container state desync**: Implement health checks and reconciliation
- **Port conflicts**: Validate container health before assuming availability

### **Debugging Session Guidelines**
1. **Use health checks first** - `tests/utils/health-checks/` contains quick verification tools
2. **Fix root causes, not symptoms** - Database-backed state prevents desynchronization issues
3. **Leverage organized test structure** - Use `tests/playwright/` organized by feature for regression testing
4. **Check service relationships** - Services in both `/services/` and `/src/services/` have different purposes

### **Performance and Maintenance**
- **Database queries are cheap** compared to state desynchronization bugs
- **Health monitoring services** (30-second intervals) prevent bigger issues
- **Clean test organization** reduces maintenance overhead by 70%
- **Focused test suites** execute faster and catch real regressions

### **Architecture Evolution Principles**
1. **Replace in-memory state with database persistence**
2. **Add health monitoring for critical services**  
3. **Implement reconciliation patterns for external systems**
4. **Focus on regression detection over exhaustive edge case testing**

These patterns come from real debugging sessions and production issues. The database-backed state architecture prevents recurring container desynchronization problems that were previously common with in-memory state management.

## Key Service Architecture

### Business Logic Services (`server/services/`)
- **universal-preview-service.ts** - Database-backed preview management with health validation
- **preview-health-check.ts** - Background health monitoring (30-second intervals)
- **agent-chat.ts** - AI agent communication and output streaming
- **github.ts** - GitHub API integration and webhook handling
- **ssh.ts** - SSH connection management for VM operations
- **vm-manager.ts** - VM lifecycle and agent orchestration
- **crypto.ts** - Encryption/decryption utilities for credentials
- **port-allocator.ts** - Dynamic port management for containers
- **preview-service.ts** - Legacy preview service (being replaced)

### Terminal Management Services (`server/src/services/`)
- **terminal-manager-factory.ts** - Factory for creating terminal managers
- **terminal-manager-interface.ts** - Interface definitions
- **tmux-pty-manager.ts** - Tmux session management
- **screen-pty-manager.ts** - Screen session management  
- **local-pty-manager.ts** - Local terminal management
- **remote-pty-manager.ts** - Remote terminal management
- **terminal-buffer.ts** - Terminal output buffering
- **ssh-tunnel.ts** - SSH tunnel management
- **claude-config-manager.ts** - Claude configuration management

### Container Management Services
- **local-docker-manager.ts** - Local Docker operations
- **remote-docker-manager.ts** - Remote Docker operations
- **docker-manager-compat.ts** - Docker compatibility layer

## Team Collaboration Features

### Real-time Chat System
- WebSocket-based messaging with database persistence (`messages` table)
- User presence indicators and typing status
- Message history with pagination
- Team-scoped conversations

### Agent Management
- Spawn AI agents with custom tasks and terminal isolation
- Live output streaming with terminal history persistence
- Multiple terminal isolation options (tmux, screen, local)
- Agent control (start/stop) by owners with Docker container integration
- Team visibility of all agent activities

### Workspace Layouts
- Multiple layout systems (Muuri, Allotment, React Grid Layout, Dockview)
- Drag-and-drop panel arrangement with persistent preferences
- JSON-based layout storage in `teams.workspaceLayouts`
- Mobile-responsive adaptations

### Preview System
- Database-backed deployment state (`preview_deployments` table)
- Health monitoring with automatic reconciliation
- Multi-language project support (React, Next.js, Node.js, Python, Static)
- Docker containerization with proxy management
- Shared team preview URLs with live reload

## Docker Infrastructure

### Container Types (`docker/`)
- **claude-agent/** - Containerized Claude agents with wrapper scripts
- **preview/** - Multi-language preview containers:
  - `Dockerfile.react` - React applications
  - `Dockerfile.nextjs` - Next.js applications  
  - `Dockerfile.node` - Node.js applications
  - `Dockerfile.python` - Python applications
  - `Dockerfile.static` - Static sites
  - `Dockerfile.workspace` - General workspace containers
- **workspace-sync/** - Workspace synchronization containers

### Container Management
- Database-backed container state (`container_instances` table)
- Health monitoring with automatic reconciliation
- Port allocation and proxy management
- Multi-team isolation with secure networking

## Critical Development Notes

### Current Architecture Patterns
- **Database-backed state** - All container and preview state stored in PostgreSQL
- **Health monitoring** - Background services validate and reconcile container state
- **Feature-based organization** - Client components organized by domain (`components/features/`)
- **Multiple terminal management** - Supports tmux, screen, local, and remote terminals
- **Comprehensive testing** - Organized test suites with health check utilities

### File Organization
- **Server services**: `/services/` (business logic) vs `/src/services/` (terminal management)
- **Client features**: Organized by domain in `src/components/features/`
- **Tests**: Organized by type in `tests/playwright/` with utility helpers
- **Docker**: Infrastructure containers in `docker/` directory

This context provides comprehensive guidance for LLM agents working on ColabVibe. The codebase follows database-backed state management patterns with comprehensive Docker containerization and organized testing infrastructure.

**Important**: Don't restart servers unless explicitly asked - they auto-reload on file changes.