# Docker Infrastructure Integration Guide

This document explains how to integrate the new Docker-based multi-agent infrastructure with the existing Covibes system.

## Integration Overview

The Docker infrastructure extends the existing preview service and agent management with containerized environments that provide:

- **Isolated execution environments** for Claude agents
- **Dynamic preview containers** based on project type detection
- **Shared workspace management** with Git synchronization
- **Seamless integration** with existing Covibes APIs

## Integration Points

### 1. Preview Service Integration

#### Existing Service: `server/services/preview-service.ts`

The current preview service handles:
- Repository cloning and project type detection
- Port allocation and process management
- Preview instance lifecycle

#### Docker Integration: `docker/scripts/preview-integration.js`

The new integration:
- Uses existing project type detection logic
- Creates Docker containers instead of direct processes
- Maintains compatibility with existing API endpoints
- Provides enhanced isolation and scalability

#### Integration Steps:

1. **Modify Preview Service to Use Docker Backend**:

```typescript
// In server/services/preview-service.ts
import { spawn } from 'child_process';
import path from 'path';

class PreviewService extends EventEmitter {
  async createPreview(config: PreviewConfig): Promise<{ port: number; status: string }> {
    const { teamId, branch, repositoryUrl } = config;
    
    // Use Docker integration instead of direct process spawning
    const dockerIntegration = path.join(__dirname, '../../docker/scripts/preview-integration.js');
    
    try {
      const result = await this.runDockerIntegration('create', [
        teamId,
        branch,
        repositoryUrl,
        port.toString()
      ]);
      
      return {
        port: result.port,
        status: 'starting'
      };
    } catch (error) {
      // Fallback to existing implementation if Docker fails
      return this.createPreviewDirect(config);
    }
  }
  
  private async runDockerIntegration(command: string, args: string[]) {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [dockerIntegration, command, ...args], {
        stdio: 'pipe'
      });
      
      let output = '';
      process.stdout.on('data', (data) => output += data.toString());
      process.on('close', (code) => {
        if (code === 0) {
          resolve(JSON.parse(output));
        } else {
          reject(new Error(`Docker integration failed: ${output}`));
        }
      });
    });
  }
}
```

2. **Environment Variables Setup**:

Add to your `.env` file:
```bash
# Docker Integration
USE_DOCKER_PREVIEW=true
DOCKER_INTEGRATION_PATH=/path/to/docker/scripts/preview-integration.js
WORKSPACE_BASE=/var/covibes/workspaces
CLAUDE_API_KEY=your-claude-api-key-here
```

### 2. Agent Management Integration

#### Existing Agent Spawning

Current agent spawning in `server/src/routes/agents.ts`:

```typescript
app.post('/api/agents/spawn', async (req, res) => {
  const { task, agentType, repositoryUrl } = req.body;
  
  // Execute via SSH to VM
  const result = await sshService.executeAgentCommand(
    vmId, 
    agentType, 
    task, 
    repositoryUrl
  );
  
  res.json({ success: true, result });
});
```

#### Docker Integration Enhancement

Enhanced agent spawning with Docker containers:

```typescript
import { spawn } from 'child_process';
import path from 'path';

app.post('/api/agents/spawn', async (req, res) => {
  const { task, agentType, repositoryUrl, teamId } = req.body;
  
  if (process.env.USE_DOCKER_AGENTS === 'true') {
    try {
      // Start Docker-based agent environment
      const dockerManager = path.join(__dirname, '../../../docker/scripts/manage-containers.sh');
      
      const result = await new Promise((resolve, reject) => {
        const process = spawn(dockerManager, [
          'start',
          teamId,
          repositoryUrl,
          'main',
          '1' // Number of agents
        ], { stdio: 'pipe' });
        
        let output = '';
        process.stdout.on('data', (data) => output += data.toString());
        process.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(output));
        });
      });
      
      res.json({ 
        success: true, 
        method: 'docker',
        result: result.toString().trim()
      });
    } catch (error) {
      // Fallback to SSH-based execution
      const result = await sshService.executeAgentCommand(
        vmId, 
        agentType, 
        task, 
        repositoryUrl
      );
      
      res.json({ 
        success: true, 
        method: 'ssh',
        result 
      });
    }
  } else {
    // Use existing SSH-based execution
    const result = await sshService.executeAgentCommand(
      vmId, 
      agentType, 
      task, 
      repositoryUrl
    );
    
    res.json({ success: true, method: 'ssh', result });
  }
});
```

### 3. WebSocket Integration

#### Real-time Communication with Docker Containers

Extend the existing WebSocket handlers to communicate with Docker containers:

```typescript
// In server/src/server.ts
import { io } from 'socket.io-client';

// Connect to agent containers
const connectToAgentContainer = (teamId: string, agentId: string) => {
  const agentUrl = `http://covibes_agent_${teamId}_${agentId}:8080`;
  
  // Proxy agent events to main WebSocket
  const agentSocket = io(agentUrl);
  
  agentSocket.on('output', (data) => {
    socketIo.to(teamId).emit('agent-output', {
      agentId,
      ...data
    });
  });
  
  agentSocket.on('status-change', (data) => {
    socketIo.to(teamId).emit('agent-status', {
      agentId,
      ...data
    });
  });
};

// Handle team join
socketIo.on('connection', (socket) => {
  socket.on('join-team', (teamId) => {
    socket.join(teamId);
    
    // Connect to all agent containers for this team
    connectToAgentContainer(teamId, 'agent-1');
  });
});
```

### 4. Database Integration

#### Container Metadata Storage

Extend the existing database schema to track Docker containers:

```sql
-- Add to existing schema
CREATE TABLE container_environments (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  container_type VARCHAR(50) NOT NULL, -- 'agent', 'preview', 'sync'
  container_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  port INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX idx_container_environments_team_id ON container_environments(team_id);
CREATE INDEX idx_container_environments_status ON container_environments(status);
```

#### Prisma Schema Updates

```prisma
// Add to prisma/schema.prisma
model ContainerEnvironment {
  id            Int      @id @default(autoincrement())
  teamId        String   @map("team_id")
  containerType String   @map("container_type")
  containerName String   @map("container_name")
  status        String
  port          Int?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  metadata      Json     @default("{}")
  
  team Team @relation(fields: [teamId], references: [id])
  
  @@map("container_environments")
}

model Team {
  // ... existing fields
  containerEnvironments ContainerEnvironment[]
}
```

### 5. Configuration Management

#### Environment Configuration

Create a configuration service to manage Docker integration:

```typescript
// server/src/config/docker.ts
export const dockerConfig = {
  enabled: process.env.USE_DOCKER_CONTAINERS === 'true',
  dockerDir: process.env.DOCKER_DIR || path.join(__dirname, '../../../docker'),
  workspaceBase: process.env.WORKSPACE_BASE || '/var/covibes/workspaces',
  claudeApiKey: process.env.CLAUDE_API_KEY,
  sshKeyPath: process.env.SSH_KEY_PATH,
  
  // Container resource limits
  agent: {
    memoryLimit: '2g',
    cpuLimit: '1.0',
    memoryReservation: '512m',
    cpuReservation: '0.25'
  },
  
  preview: {
    memoryLimit: '1g',
    cpuLimit: '0.5',
    memoryReservation: '256m',
    cpuReservation: '0.1'
  },
  
  // Port ranges
  previewPortRange: {
    min: 5000,
    max: 8999
  },
  
  // Health check intervals
  healthCheck: {
    interval: 30000,
    timeout: 5000,
    retries: 3
  }
};
```

## Migration Strategy

### Phase 1: Parallel Operation (Recommended)

1. **Deploy Docker infrastructure alongside existing system**
2. **Use feature flags to control which teams use Docker**
3. **Monitor performance and stability**
4. **Gradually migrate teams to Docker environment**

### Phase 2: Full Migration

1. **Update all API endpoints to use Docker by default**
2. **Migrate existing team workspaces to Docker volumes**
3. **Remove SSH-based agent execution**
4. **Clean up legacy preview processes**

## Compatibility Considerations

### API Compatibility

The Docker integration maintains full API compatibility:

- **Preview endpoints** return the same response format
- **Agent spawn endpoints** include additional metadata
- **WebSocket events** remain unchanged
- **Status queries** include container-specific information

### Frontend Updates

Minimal frontend changes required:

```typescript
// Update agent spawn to include team context
const spawnAgent = async (task: string, agentType: string) => {
  const response = await fetch('/api/agents/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task,
      agentType,
      teamId: currentTeam.id, // Add team context
      repositoryUrl: currentRepo.url
    })
  });
  
  const result = await response.json();
  
  // Handle both Docker and SSH responses
  if (result.method === 'docker') {
    // Enhanced Docker-based agent feedback
    console.log('Docker agent environment started');
  }
  
  return result;
};
```

## Monitoring and Observability

### Container Health Monitoring

Integrate with existing monitoring:

```typescript
// server/src/services/monitoring.ts
import { dockerConfig } from '../config/docker';

export class ContainerMonitoringService {
  async getTeamEnvironmentStatus(teamId: string) {
    if (!dockerConfig.enabled) {
      return this.getLegacyStatus(teamId);
    }
    
    const { spawn } = require('child_process');
    const statusScript = path.join(dockerConfig.dockerDir, 'scripts/manage-containers.sh');
    
    const status = await new Promise((resolve, reject) => {
      const process = spawn(statusScript, ['status', teamId], { stdio: 'pipe' });
      
      let output = '';
      process.stdout.on('data', (data) => output += data.toString());
      process.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(output));
      });
    });
    
    return this.parseContainerStatus(status);
  }
  
  private parseContainerStatus(output: string) {
    // Parse container status output
    const lines = output.split('\n');
    const containers = [];
    
    for (const line of lines) {
      if (line.includes('covibes_')) {
        const [name, status, ports] = line.split(/\s+/);
        containers.push({ name, status, ports });
      }
    }
    
    return containers;
  }
}
```

### Logging Integration

Extend existing logging to include container events:

```typescript
// server/src/utils/logger.ts
export const containerLogger = {
  agentStarted: (teamId: string, agentId: string, containerId: string) => {
    logger.info('Docker agent started', {
      teamId,
      agentId,
      containerId,
      timestamp: new Date().toISOString()
    });
  },
  
  previewDeployed: (teamId: string, branch: string, port: number) => {
    logger.info('Docker preview deployed', {
      teamId,
      branch,
      port,
      timestamp: new Date().toISOString()
    });
  },
  
  containerError: (teamId: string, containerType: string, error: string) => {
    logger.error('Container error', {
      teamId,
      containerType,
      error,
      timestamp: new Date().toISOString()
    });
  }
};
```

## Testing Strategy

### Integration Tests

Create comprehensive integration tests:

```typescript
// tests/docker-integration.test.ts
describe('Docker Integration', () => {
  beforeAll(async () => {
    // Set up test environment
    process.env.USE_DOCKER_CONTAINERS = 'true';
    process.env.WORKSPACE_BASE = '/tmp/covibes-test';
  });
  
  afterAll(async () => {
    // Clean up test containers
    const { spawn } = require('child_process');
    await spawn('docker', ['system', 'prune', '-f']);
  });
  
  test('should create team environment', async () => {
    const teamId = 'test-team-123';
    const result = await createTeamEnvironment(teamId, 'https://github.com/test/repo.git');
    
    expect(result.success).toBe(true);
    expect(result.containers).toContain('claude-agent');
    expect(result.containers).toContain('preview');
    expect(result.containers).toContain('workspace-sync');
  });
  
  test('should spawn agent in container', async () => {
    const response = await request(app)
      .post('/api/agents/spawn')
      .send({
        teamId: 'test-team-123',
        task: 'Create a simple Hello World function',
        agentType: 'code-writer'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.method).toBe('docker');
    expect(response.body.success).toBe(true);
  });
});
```

## Rollback Plan

### Emergency Rollback

If issues occur during deployment:

1. **Set environment variable**: `USE_DOCKER_CONTAINERS=false`
2. **Restart services**: All requests fall back to SSH-based execution
3. **Stop Docker containers**: `docker-compose down` in generated directories
4. **Clean up resources**: Remove Docker volumes if needed

### Gradual Rollback

For specific teams experiencing issues:

1. **Team-specific feature flags** in database
2. **Selective container shutdown** for affected teams
3. **Data migration** from Docker volumes to SSH workspaces
4. **Monitor and adjust** based on feedback

This integration guide provides a comprehensive approach to incorporating Docker-based multi-agent environments while maintaining backward compatibility and operational stability.