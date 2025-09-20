# Docker Infrastructure Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Covibes Docker Environment                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Team Alpha    │    │   Team Beta     │    │   Team Gamma    │         │
│  │   Environment   │    │   Environment   │    │   Environment   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Team Environment Architecture

Each team has an isolated environment with the following components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Team Environment                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Shared Workspace Volume                        │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │  .git/  │  │  src/   │  │ docs/   │  │ tests/  │  │ config/ │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│     ┌───────────────────────────┼───────────────────────────┐               │
│     │                           │                           │               │
│     │                           │                           │               │
│  ┌──▼────┐  ┌────────┐  ┌──────▼─┐  ┌──────────┐  ┌───────▼──┐            │
│  │Claude │  │Claude  │  │Preview │  │Preview   │  │Workspace │            │
│  │Agent 1│  │Agent 2 │  │Main    │  │Staging   │  │Sync      │            │
│  │       │  │        │  │Branch  │  │Branch    │  │Service   │            │
│  └───────┘  └────────┘  └────────┘  └──────────┘  └──────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Container Network Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Docker Networks                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                covibes_agent_network (172.21.0.0/16)             │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │   │
│  │  │Claude Agent │  │Claude Agent │  │     Workspace Sync          │ │   │
│  │  │   (8080)    │  │   (8080)    │  │       Service               │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    │                                       │
│  ┌─────────────────────────────────┼───────────────────────────────────┐   │
│  │            covibes_preview_network (172.22.0.0/16)             │   │
│  │                                 │                                   │   │
│  │  ┌──────────────────────────────┼──────────────────────────────────┐│   │
│  │  │          Host Network        │                                  ││   │
│  │  │                              │                                  ││   │
│  │  │  ┌─────────────┐  ┌─────────▼──┐  ┌─────────────┐              ││   │
│  │  │  │   Preview   │  │   Preview  │  │   Preview   │              ││   │
│  │  │  │   React     │  │   Node.js  │  │   Python    │              ││   │
│  │  │  │  (5173)     │  │   (3000)   │  │   (8000)    │              ││   │
│  │  │  └─────────────┘  └────────────┘  └─────────────┘              ││   │
│  │  └──────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Volume Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Volume Structure                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Host: /var/covibes/workspaces/                                           │
│  │                                                                          │
│  ├── team_alpha/                    ← Bind Mount                            │
│  │   ├── .git/                      ← workspace_team_alpha volume          │
│  │   ├── .covibes.yml                                                     │
│  │   ├── src/                                                               │
│  │   ├── docs/                                                              │
│  │   ├── tests/                                                             │
│  │   └── config/                                                            │
│  │                                                                          │
│  ├── team_beta/                     ← Bind Mount                            │
│  │   └── [similar structure]        ← workspace_team_beta volume           │
│  │                                                                          │
│  └── team_gamma/                    ← Bind Mount                            │
│      └── [similar structure]        ← workspace_team_gamma volume          │
│                                                                             │
│  Named Volumes:                                                             │
│  ├── preview_cache_team_alpha_main  ← Build cache persistence              │
│  ├── preview_modules_team_alpha_main← Node modules cache                   │
│  ├── agent_temp_agent_1             ← Agent temporary files                │
│  └── agent_temp_agent_2             ← Agent temporary files                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Container Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Container Orchestration Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   User Request  │                                                        │
│  │ "Start Team123" │                                                        │
│  └─────────┬───────┘                                                        │
│            │                                                                │
│            ▼                                                                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│  │ 1. Setup        │ → │ 2. Detect       │ → │ 3. Generate     │          │
│  │    Workspace    │   │    Project      │   │    Config       │          │
│  │                 │   │    Type         │   │                 │          │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│            │                                           │                   │
│            ▼                                           ▼                   │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│  │ 4. Build        │ ← │ 5. Start        │ ← │ 6. Health       │          │
│  │    Containers   │   │    Services     │   │    Check        │          │
│  │                 │   │                 │   │                 │          │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│                                                         │                  │
│                                                         ▼                  │
│                               ┌─────────────────────────────────────────┐  │
│                               │           Running Environment           │  │
│                               │                                         │  │
│                               │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│                               │  │ Claude  │ │Preview  │ │  Sync   │   │  │
│                               │  │ Agent   │ │Service  │ │Service  │   │  │
│                               │  └─────────┘ └─────────┘ └─────────┘   │  │
│                               └─────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Claude Agent Container Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Claude Agent Container                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Runtime Layer                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Node.js   │  │    Python   │  │     Git     │  │  SSH/Curl │  │   │
│  │  │    20.x     │  │     3.11    │  │   Client    │  │  Clients  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Service Layer                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   HTTP API  │  │  Claude CLI │  │File Watcher │  │Health Mon │  │   │
│  │  │  (Port 8080)│  │   Wrapper   │  │   Service   │  │  Service  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Volume Mounts                                │   │
│  │                                                                     │   │
│  │  /workspace → team_workspace_volume (rw)                            │   │
│  │  /tmp/agent → agent_temp_volume (rw)                                │   │
│  │  ~/.ssh/id_rsa → ssh_key (ro)                                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  User: claude (1000:1000)                                                  │
│  Resource Limits: 2GB RAM, 1 CPU                                           │
│  Security: no-new-privileges, tmpfs for /tmp                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Preview Container Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Preview Container                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Framework Runtime                                │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   React/    │  │   Next.js   │  │   Node.js   │  │  Python/  │  │   │
│  │  │   Vite      │  │   Server    │  │   Express   │  │  Django   │  │   │
│  │  │  (Port      │  │  (Port      │  │  (Port      │  │ (Port     │  │   │
│  │  │   5173)     │  │   3000)     │  │   3000)     │  │  8000)    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Development Tools                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │Hot Module   │  │File Watcher │  │Build Cache  │  │Health     │  │   │
│  │  │Replacement  │  │(Polling)    │  │Management   │  │Monitor    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Volume Mounts                                │   │
│  │                                                                     │   │
│  │  /workspace → team_workspace_volume (ro)                            │   │
│  │  /app/.cache → preview_cache_volume (rw)                            │   │
│  │  /app/node_modules → preview_modules_volume (rw)                    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  User: preview (1000:1000)                                                 │
│  Resource Limits: 1GB RAM, 0.5 CPU                                         │
│  Port Mapping: Dynamic allocation (5000-8999 range)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Permission Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Permission Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Host System                                                                │
│  ├── /var/covibes/workspaces/                                             │
│  │   └── team_alpha/            (1000:1000, 755)                           │
│  │       ├── .git/              (1000:1000, 755)                           │
│  │       ├── src/               (1000:1000, 755)                           │
│  │       └── *.files            (1000:1000, 644)                           │
│                                                                             │
│  Container Mapping:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Claude Agent Container                                            │   │
│  │   ├── User: claude (1000:1000)                                     │   │
│  │   ├── /workspace → /var/covibes/workspaces/team_alpha/ (rw)      │   │
│  │   └── Can read/write all files                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Preview Container                                                 │   │
│  │   ├── User: preview (1000:1000)                                    │   │
│  │   ├── /workspace → /var/covibes/workspaces/team_alpha/ (ro)      │   │
│  │   └── Can read all files, cannot write                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Workspace Sync Container                                          │   │
│  │   ├── User: sync (1000:1000)                                       │   │
│  │   ├── /workspace → /var/covibes/workspaces/team_alpha/ (rw)      │   │
│  │   └── Can read/write for git operations                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Security Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Container Security:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Non-root execution (UID/GID 1000:1000)                           │   │
│  │ • No new privileges (security-opt: no-new-privileges:true)         │   │
│  │ • Read-only root filesystem where possible                         │   │
│  │ • Temporary filesystem for /tmp (tmpfs)                            │   │
│  │ • Resource limits (CPU, memory)                                    │   │
│  │ • Network isolation                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Network Security:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Internal networks for agent communication                        │   │
│  │ • External network only for preview services                       │   │
│  │ • Port restrictions and firewall rules                             │   │
│  │ • CORS configuration for development                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Data Security:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Volume permissions and ownership                                  │   │
│  │ • SSH key secure mounting (read-only)                              │   │
│  │ • API key environment variable injection                           │   │
│  │ • Git repository access control                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Monitoring and Health Checks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Monitoring Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Health Check Hierarchy:                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Container Level                                  │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │   Claude    │  │   Preview   │  │  Workspace  │                 │   │
│  │  │   Agent     │  │  Service    │  │    Sync     │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ GET /health │  │ GET /       │  │ Git Status  │                 │   │
│  │  │ 30s interval│  │ 15s interval│  │ File Access │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Service Level                                    │   │
│  │                                                                     │   │
│  │  • Process health monitoring                                       │   │
│  │  • Resource utilization tracking                                   │   │
│  │  • Network connectivity checks                                     │   │
│  │  • Volume mount verification                                       │   │
│  │  • API response time monitoring                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Team Level                                       │   │
│  │                                                                     │   │
│  │  • Environment status aggregation                                  │   │
│  │  • Agent task progress tracking                                    │   │
│  │  • Preview deployment status                                       │   │
│  │  • Workspace synchronization health                                │   │
│  │  • Team resource usage metrics                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Scaling and Resource Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Resource Management                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Per-Container Resource Limits:                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Claude Agent Container                                            │   │
│  │   ├── Memory: 2GB limit, 512MB reservation                         │   │
│  │   ├── CPU: 1.0 limit, 0.25 reservation                             │   │
│  │   ├── Disk I/O: Throttled for fair sharing                         │   │
│  │   └── Network: Internal network bandwidth limits                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Preview Container                                                 │   │
│  │   ├── Memory: 1GB limit, 256MB reservation                         │   │
│  │   ├── CPU: 0.5 limit, 0.1 reservation                              │   │
│  │   ├── Build cache: 500MB volume limit                              │   │
│  │   └── Port allocation: Dynamic range management                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Workspace Sync Container                                          │   │
│  │   ├── Memory: 128MB limit (minimal requirements)                   │   │
│  │   ├── CPU: 0.1 limit (background service)                          │   │
│  │   ├── Network: Git operation bandwidth                             │   │
│  │   └── Storage: Workspace size limits                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  System-wide Management:                                                    │
│  ├── Maximum teams per host: Based on available resources               │
│  ├── Container orchestration: Docker Compose with resource limits       │
│  ├── Volume cleanup: Automatic cleanup of unused volumes                │
│  └── Log rotation: Size and time-based log management                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

This architecture provides a robust, scalable, and secure foundation for Covibes's multi-agent collaborative development environment. The design ensures proper isolation between teams while enabling seamless collaboration within team environments.