# Covibes Docker Infrastructure

This directory contains the complete Docker-based infrastructure for Covibes's Multi-Agent Collaborative Development Environment. The system provides isolated, scalable containers for Claude agents and preview services with shared workspace functionality.

## Architecture Overview

```
docker/
├── docker-compose.template.yml    # Main orchestration template
├── claude-agent/                  # Claude agent container
│   ├── Dockerfile                 # Base image with Claude CLI
│   ├── claude-agent-wrapper.sh    # Agent execution wrapper
│   └── agent-service.js           # HTTP API service
├── preview/                       # Preview containers
│   ├── Dockerfile.react           # React/Vite projects
│   ├── Dockerfile.nextjs          # Next.js projects
│   ├── Dockerfile.node            # Node.js projects
│   ├── Dockerfile.python          # Python projects
│   ├── Dockerfile.static          # Static HTML/CSS/JS
│   └── start-*.sh                 # Framework-specific start scripts
├── workspace-sync/                # Git synchronization
│   ├── Dockerfile                 # Sync service container
│   └── workspace-sync.sh          # Git sync automation
└── scripts/                       # Management utilities
    ├── setup-workspace.sh         # Workspace initialization
    ├── manage-containers.sh        # Container orchestration
    └── preview-integration.js     # Preview service bridge
```

## Key Features

### 🤖 Claude Agent Containers
- **Isolated Execution**: Each agent runs in its own container with proper resource limits
- **Shared Workspace**: All agents access the same `/workspace` volume with consistent UID/GID (1000:1000)
- **Real-time Communication**: HTTP API and WebSocket connectivity to the main Covibes service
- **Development Tools**: Pre-installed with Node.js, Python, Git, and common development utilities

### 🔄 Dynamic Preview System
- **Auto-Detection**: Automatically detects project type (React, Next.js, Node.js, Python, Static)
- **Framework-Specific**: Uses optimized containers for each framework type
- **Hot Reload**: File watching with `CHOKIDAR_USEPOLLING` for Docker compatibility
- **Port Management**: Dynamic port allocation and health checking

### 📁 Shared Workspace Management
- **Git Integration**: Automatic repository cloning, syncing, and change tracking
- **File Permissions**: Consistent UID/GID across all containers for seamless file sharing
- **Volume Structure**: Organized workspace layout with proper directory structure
- **Conflict Resolution**: Smart merge strategies for multi-agent collaboration

### 🚀 Container Orchestration
- **Template-Based**: Dynamic Docker Compose generation from templates
- **Environment Management**: Flexible environment variable configuration
- **Resource Limits**: Proper CPU and memory constraints to prevent resource conflicts
- **Health Monitoring**: Built-in health checks and restart policies

## Quick Start

### 1. Environment Setup

```bash
# Set required environment variables
export CLAUDE_API_KEY="your-claude-api-key"
export SSH_KEY_PATH="/path/to/ssh/key"  # Optional, for private repositories
export WORKSPACE_BASE="~/.covibes/workspaces"  # Optional, default location
```

### 2. Create Team Environment

```bash
# Create a new team workspace and start containers
./scripts/manage-containers.sh start team123 https://github.com/user/repo.git main

# This will:
# - Create workspace at ~/.covibes/workspaces/team123
# - Clone the repository
# - Detect project type
# - Generate Docker Compose configuration
# - Start Claude agent and preview containers
```

### 3. Access Services

```bash
# Check environment status
./scripts/manage-containers.sh status team123

# View running containers
./scripts/manage-containers.sh list

# Access preview (port auto-allocated)
curl http://localhost:5123/  # Example port

# Interact with Claude agent API
curl http://localhost:8080/health  # Agent health check
```

## Container Types

### Claude Agent Container

**Purpose**: Executes Claude agents with shared workspace access

**Key Features**:
- Node.js 20 runtime with Claude CLI pre-installed
- Development tools (git, ssh, curl, editors)
- HTTP API service on port 8080
- File system monitoring and change notifications
- Proper user permissions (UID/GID 1000:1000)

**Environment Variables**:
```bash
CLAUDE_API_KEY          # Required: Claude API key
CLAUDE_AGENT_ID         # Agent identifier
CLAUDE_AGENT_TYPE       # Agent type (code-writer, general)
WORKSPACE_PATH          # Workspace mount point (/workspace)
TEAM_ID                # Team identifier
REPOSITORY_URL          # Git repository URL
GIT_BRANCH             # Git branch to work with
```

**API Endpoints**:
- `GET /health` - Health check
- `GET /status` - Agent status and task history
- `POST /execute` - Execute task with Claude
- `POST /stop` - Stop current task

### Preview Containers

**Purpose**: Run development servers for different project types

#### React/Vite Container (`Dockerfile.react`)
- Auto-detects Vite or Create React App
- Hot module replacement with file watching
- Port 5173 (default) or configured port
- NPM dependency management

#### Next.js Container (`Dockerfile.nextjs`)
- Next.js development server
- Automatic page refresh on changes
- Port 3000 (default)
- Built-in optimization and bundling

#### Node.js Container (`Dockerfile.node`)
- Generic Node.js applications and APIs
- Auto-detects start scripts in package.json
- Nodemon for development mode
- Port 3000 (default)

#### Python Container (`Dockerfile.python`)
- Django, Flask, FastAPI support
- Auto-detects framework and runs appropriately
- Virtual environment handling
- Port 8000 (default)

#### Static Container (`Dockerfile.static`)
- Nginx-based static file server
- CORS support for development
- SPA fallback routing
- Port 8080

### Workspace Sync Container

**Purpose**: Handles Git synchronization and workspace management

**Features**:
- Automatic git fetch/merge from remote
- Local change detection and commits
- File system watching with inotify
- Conflict resolution strategies
- Configurable sync intervals

## Volume Structure

### Workspace Layout
```
~/.covibes/workspaces/{team_id}/
├── .git/                    # Git repository
├── .covibes.yml          # Workspace configuration
├── .gitignore              # Git ignore patterns
├── README.md               # Team workspace documentation
├── src/                    # Source code
├── docs/                   # Documentation
├── tests/                  # Test files
└── config/                 # Configuration files
```

### Volume Types
- **`workspace_{team_id}`**: Shared workspace volume (bind mount)
- **`agent_temp_{agent_id}`**: Agent-specific temporary storage
- **`preview_cache_{team_id}_{branch}`**: Preview build cache
- **`preview_modules_{team_id}_{branch}`**: Node modules cache

## Network Architecture

### Networks
- **`covibes_agent_network`**: Internal network for agents and sync services
- **`covibes_preview_network`**: External network for preview services

### Port Allocation
- **Claude Agents**: 8080 (internal API)
- **Preview Services**: 5000-8999 range (auto-allocated)
- **Health Checks**: HTTP-based monitoring

## Management Scripts

### `setup-workspace.sh`
Creates and initializes team workspaces with proper permissions and Git configuration.

```bash
./scripts/setup-workspace.sh create team123 https://github.com/user/repo.git main
./scripts/setup-workspace.sh permissions ~/.covibes/workspaces/team123
```

### `manage-containers.sh`
Complete container lifecycle management for team environments.

```bash
./scripts/manage-containers.sh start team123    # Start environment
./scripts/manage-containers.sh stop team123     # Stop environment
./scripts/manage-containers.sh status team123   # Check status
./scripts/manage-containers.sh list            # List all environments
./scripts/manage-containers.sh cleanup team123  # Clean up resources
```

### `preview-integration.js`
Bridges existing preview service with Docker containers.

```bash
./scripts/preview-integration.js create team123 main https://github.com/user/repo.git 5123
./scripts/preview-integration.js status team123 main
./scripts/preview-integration.js stop team123 main
```

## Security Considerations

### Container Security
- **Non-root execution**: All containers run as user 1000:1000
- **Resource limits**: CPU and memory constraints prevent resource exhaustion
- **Read-only containers**: Where possible, containers run with read-only filesystems
- **Security options**: `no-new-privileges` and other security hardening

### Network Security
- **Internal networks**: Agents communicate through isolated Docker networks
- **Port restrictions**: Only necessary ports are exposed
- **CORS configuration**: Development-appropriate CORS settings

### Data Security
- **Volume permissions**: Proper file ownership and access controls
- **SSH key handling**: Secure mounting of SSH keys for Git operations
- **API key management**: Environment variable injection with secrets support

## Monitoring and Logging

### Health Checks
All containers include comprehensive health checks:
- **HTTP endpoints**: Service availability monitoring
- **Process monitoring**: Container process health
- **Resource usage**: Memory and CPU utilization
- **Custom checks**: Service-specific health validation

### Logging
- **Structured logging**: JSON-formatted log output
- **Log rotation**: Automatic log file rotation and cleanup
- **Centralized collection**: Compatible with log aggregation systems
- **Debug modes**: Detailed logging for troubleshooting

## Troubleshooting

### Common Issues

#### Permission Problems
```bash
# Fix workspace permissions
./scripts/setup-workspace.sh permissions ~/.covibes/workspaces/team123

# Check container user mapping
docker exec -it covibes_agent_team123_agent-1 id
```

#### Port Conflicts
```bash
# Check port allocation
netstat -tulpn | grep 5123

# Stop conflicting containers
./scripts/manage-containers.sh stop team123
```

#### File Watching Issues
```bash
# Verify CHOKIDAR_USEPOLLING is set
docker exec -it container_name env | grep CHOKIDAR

# Check inotify limits
cat /proc/sys/fs/inotify/max_user_watches
```

#### Git Synchronization Problems
```bash
# Check sync container logs
docker logs covibes_sync_team123

# Manual git operations
docker exec -it covibes_sync_team123 git status
```

### Debug Mode

Enable verbose logging:
```bash
export DEBUG="covibes:*"
./scripts/manage-containers.sh start team123
```

## Development and Extension

### Adding New Project Types

1. **Create Dockerfile**: Add `Dockerfile.{type}` in `preview/`
2. **Add Start Script**: Create `start-{type}.sh` for the framework
3. **Update Detection**: Modify project type detection logic
4. **Test Integration**: Verify with sample projects

### Custom Agent Types

1. **Extend Base Image**: Modify `claude-agent/Dockerfile`
2. **Add Agent Scripts**: Create agent-specific wrappers
3. **Update Templates**: Modify `docker-compose.template.yml`
4. **Configure Environment**: Add new environment variables

### Integration Points

The Docker infrastructure integrates with:
- **Covibes Server**: WebSocket communication and API calls
- **Preview Service**: Container orchestration bridge
- **SSH Service**: VM deployment coordination
- **Database**: Container metadata and status tracking

## Production Deployment

### Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Sufficient disk space for workspaces and images
- Network access for Claude API and Git repositories

### Configuration
- Use Docker secrets for API keys
- Configure log aggregation
- Set up monitoring and alerting
- Implement backup strategies for workspaces

### Scaling
- Horizontal scaling through multiple VM instances
- Load balancing for preview services
- Resource quotas and limits per team
- Container orchestration with Kubernetes (future)

This Docker infrastructure provides a robust, scalable foundation for Covibes's multi-agent collaborative development environment, ensuring isolation, security, and seamless integration with the existing platform.