# CoVibe Services Layer

This directory contains the core business logic services for the CoVibe platform.

## Services Overview

### 1. SSH Service (`ssh.ts`)
Handles SSH connections to EC2 instances for agent command execution.

**Key Features:**
- Connection pooling and management
- Real-time command output streaming
- Claude agent command execution
- Repository cloning and workspace setup
- Connection timeout and error handling

**Usage:**
```typescript
import { sshService, createEC2Connection } from './services/ssh.js';

// Connect to VM
const connection = createEC2Connection('ec2-host.com', '/path/to/key.pem');
await sshService.connect('vm-001', connection);

// Execute agent command
const result = await sshService.executeAgentCommand('vm-001', 'code-writer', 'Fix bugs', 'https://github.com/repo.git');
```

### 2. VM Manager Service (`vm-manager.ts`)
Manages VM instance assignment and availability for users.

**Key Features:**
- VM pool management from configuration
- User-to-VM assignment logic
- VM availability tracking
- Connection limits per VM
- VM status monitoring

**Usage:**
```typescript
import { createVMManager } from './services/vm-manager.js';

const vmManager = createVMManager(prisma);
const vm = await vmManager.assignVMToUser('user-123');
const sshConfig = vmManager.createSSHConnection(vm.id);
```

### 3. Mock Agent Service (`mock-agent.ts`)
Simulates agent execution for development and testing.

**Key Features:**
- Realistic agent response simulation
- Progressive output streaming
- Different response types (general, code-writer)
- Configurable execution timing
- Failure scenario simulation

**Usage:**
```typescript
import { mockAgentService, createMockTask } from './services/mock-agent.js';

const task = createMockTask('agent-1', 'general', 'Test task', 'user-1', 'team-1');
await mockAgentService.spawnAgent(task);
```

### 4. Crypto Service (`crypto.ts`)
Handles encryption/decryption of sensitive data like SSH keys.

**Key Features:**
- AES-256-CBC encryption with HMAC authentication
- SSH private key encryption for database storage
- Secure key derivation from environment variables
- Input validation and error handling
- Production-ready security practices

**Usage:**
```typescript
import { cryptoService, encryptSSHKey, decryptSSHKey } from './services/crypto.js';

// Encrypt SSH key for storage
const encrypted = encryptSSHKey(privateKeyContent);

// Decrypt for use
const privateKey = decryptSSHKey(encrypted);
```

## Configuration

### Environment Variables

```bash
# Required in production
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Optional - enables mock agents for development
USE_MOCK_AGENTS=true
```

### VM Configuration (`../config/vm-instances.json`)

```json
{
  "instances": [
    {
      "id": "vm-prod-001",
      "host": "ec2-host.compute-1.amazonaws.com",
      "region": "us-east-1",
      "instanceType": "t3.large",
      "status": "available", 
      "sshKeyPath": "/path/to/key.pem",
      "maxUsers": 5,
      "currentUsers": 0
    }
  ],
  "defaultSSHKeyPath": "/path/to/default-key.pem",
  "maxConnectionsPerVM": 5
}
```

## Integration with Routes

The services integrate with the main application routes:

- **Agent Routes** use SSH and VM Manager services for spawning agents
- **Auth Routes** use Crypto service for secure token generation  
- **VM Routes** use VM Manager for status reporting
- **WebSocket handlers** use Mock Agent service in development mode

## Error Handling

All services implement comprehensive error handling:

- Connection timeouts and retries
- Validation of input parameters  
- Graceful degradation for missing configurations
- Detailed error messages for debugging
- Production-safe error responses

## Testing

Run the service integration test:

```bash
npx tsx test-services.ts
```

This verifies all services work correctly together and validates the implementation.

## Security Considerations

- SSH keys are encrypted using AES-256-CBC with HMAC authentication
- Environment variables protect production encryption keys
- Connection pooling prevents resource exhaustion
- Input validation prevents injection attacks
- Timeouts prevent indefinite resource usage