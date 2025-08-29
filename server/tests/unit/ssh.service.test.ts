/**
 * SSH Service Unit Tests
 * Tests SSH connection management and command execution
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { SSHService, loadSSHKey, createEC2Connection } from '../../services/ssh';
import { readFileSync } from 'fs';

// Mock dependencies
jest.mock('ssh2');
jest.mock('fs');

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

// Mock SSH2 Client
class MockClient extends EventEmitter {
  connect = jest.fn();
  exec = jest.fn();
  end = jest.fn();
}

describe('SSHService', () => {
  let sshService: SSHService;
  let mockClient: MockClient;

  beforeEach(() => {
    sshService = new SSHService();
    mockClient = new MockClient();
    
    // Mock SSH2 Client constructor
    const { Client } = require('ssh2');
    Client.mockImplementation(() => mockClient);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    sshService.disconnectAll();
  });

  describe('connect', () => {
    const connectionConfig = {
      host: 'test.example.com',
      username: 'testuser',
      privateKey: 'test-private-key'
    };

    it('should successfully connect to SSH server', async () => {
      const connectPromise = sshService.connect('vm-1', connectionConfig);
      
      // Simulate successful connection
      setTimeout(() => mockClient.emit('ready'), 10);
      
      const result = await connectPromise;
      
      expect(result).toBe(true);
      expect(mockClient.connect).toHaveBeenCalledWith({
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-private-key',
        passphrase: '',
        port: 22,
        readyTimeout: 8000
      });
      expect(sshService.isConnected('vm-1')).toBe(true);
    });

    it('should handle connection errors', async () => {
      const connectPromise = sshService.connect('vm-1', connectionConfig);
      
      // Simulate connection error
      setTimeout(() => mockClient.emit('error', new Error('Connection refused')), 10);
      
      await expect(connectPromise).rejects.toThrow('SSH connection failed for VM vm-1: Connection refused');
      expect(sshService.isConnected('vm-1')).toBe(false);
    });

    it('should timeout on slow connections', async () => {
      const connectPromise = sshService.connect('vm-1', connectionConfig);
      
      // Don't emit ready - let it timeout
      await expect(connectPromise).rejects.toThrow('SSH connection timeout for VM vm-1');
    }, 15000);

    it('should use custom port when provided', async () => {
      const customConfig = { ...connectionConfig, port: 2222 };
      const connectPromise = sshService.connect('vm-1', customConfig);
      
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
      
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({ port: 2222 })
      );
    });

    it('should emit connected event on successful connection', async () => {
      const connectedSpy = jest.fn();
      sshService.on('connected', connectedSpy);
      
      const connectPromise = sshService.connect('vm-1', connectionConfig);
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
      
      expect(connectedSpy).toHaveBeenCalledWith('vm-1');
    });

    it('should clean up on disconnect', async () => {
      const disconnectedSpy = jest.fn();
      sshService.on('disconnected', disconnectedSpy);
      
      const connectPromise = sshService.connect('vm-1', connectionConfig);
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
      
      // Simulate disconnect
      mockClient.emit('close');
      
      expect(disconnectedSpy).toHaveBeenCalledWith('vm-1');
      expect(sshService.isConnected('vm-1')).toBe(false);
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      // Set up a connection first
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
    });

    it('should execute command successfully', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        
        // Simulate command output
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('Hello World'));
          mockStream.emit('close', 0);
        }, 10);
      });

      const result = await sshService.executeCommand('vm-1', {
        command: 'echo "Hello World"'
      });

      expect(result).toEqual({
        success: true,
        stdout: 'Hello World',
        stderr: '',
        exitCode: 0,
        error: undefined
      });
      expect(mockClient.exec).toHaveBeenCalledWith('echo "Hello World"', expect.any(Function));
    });

    it('should handle command with working directory', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => mockStream.emit('close', 0), 10);
      });

      await sshService.executeCommand('vm-1', {
        command: 'ls',
        workingDirectory: '/home/user'
      });

      expect(mockClient.exec).toHaveBeenCalledWith('cd "/home/user" && ls', expect.any(Function));
    });

    it('should handle command execution errors', async () => {
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(new Error('Execution failed'));
      });

      await expect(sshService.executeCommand('vm-1', {
        command: 'invalid-command'
      })).rejects.toThrow('Failed to execute command on VM vm-1: Execution failed');
    });

    it('should handle non-zero exit codes', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => {
          mockStream.stderr.emit('data', Buffer.from('Command not found'));
          mockStream.emit('close', 127);
        }, 10);
      });

      const result = await sshService.executeCommand('vm-1', {
        command: 'nonexistent-command'
      });

      expect(result).toEqual({
        success: false,
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        error: 'Command exited with code 127'
      });
    });

    it('should timeout on long-running commands', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        // Don't emit close - let it timeout
      });

      await expect(sshService.executeCommand('vm-1', {
        command: 'sleep 60',
        timeout: 100
      })).rejects.toThrow('Command execution timeout for VM vm-1');
    });

    it('should emit command-output events', async () => {
      const outputSpy = jest.fn();
      sshService.on('command-output', outputSpy);
      
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('stdout data'));
          mockStream.stderr.emit('data', Buffer.from('stderr data'));
          mockStream.emit('close', 0);
        }, 10);
      });

      await sshService.executeCommand('vm-1', { command: 'test' });

      expect(outputSpy).toHaveBeenCalledWith('vm-1', 'stdout data', 'stdout');
      expect(outputSpy).toHaveBeenCalledWith('vm-1', 'stderr data', 'stderr');
    });

    it('should reject when VM is not connected', async () => {
      await expect(sshService.executeCommand('vm-nonexistent', {
        command: 'test'
      })).rejects.toThrow('No SSH connection found for VM vm-nonexistent');
    });
  });

  describe('executeAgentCommand', () => {
    beforeEach(async () => {
      // Set up connection
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
    });

    it('should execute general agent command', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => mockStream.emit('close', 0), 10);
      });

      await sshService.executeAgentCommand('vm-1', 'general', 'Fix the bug in main.js');

      expect(mockClient.exec).toHaveBeenCalledWith(
        'cd "/home/ubuntu/workspace" && claude --mode general --task "Fix the bug in main.js"',
        expect.any(Function)
      );
    });

    it('should execute code-writer agent with repository', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => mockStream.emit('close', 0), 10);
      });

      // Mock the clone command execution
      const originalExecuteCommand = sshService.executeCommand;
      jest.spyOn(sshService, 'executeCommand').mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      await sshService.executeAgentCommand(
        'vm-1', 
        'code-writer', 
        'Add new feature', 
        'https://github.com/user/repo.git'
      );

      // Should call clone command first
      expect(sshService.executeCommand).toHaveBeenCalledWith('vm-1', {
        command: 'mkdir -p /home/ubuntu/projects && cd /home/ubuntu/projects && git clone "https://github.com/user/repo.git" "repo" 2>/dev/null || echo "Repository already exists or clone failed"',
        timeout: 60000
      });
    });
  });

  describe('streamCommand', () => {
    beforeEach(async () => {
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
    });

    it('should stream command output in real-time', async () => {
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      const onOutput = jest.fn();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('line 1\n'));
          mockStream.emit('data', Buffer.from('line 2\n'));
          mockStream.emit('close', 0);
        }, 10);
      });

      const result = await sshService.streamCommand('vm-1', {
        command: 'echo -e "line 1\\nline 2"'
      }, onOutput);

      expect(onOutput).toHaveBeenCalledWith('line 1\n', 'stdout');
      expect(onOutput).toHaveBeenCalledWith('line 2\n', 'stdout');
      expect(result.stdout).toBe('line 1\nline 2\n');
    });

    it('should emit stream-output events', async () => {
      const streamOutputSpy = jest.fn();
      sshService.on('stream-output', streamOutputSpy);
      
      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('streaming data'));
          mockStream.emit('close', 0);
        }, 10);
      });

      await sshService.streamCommand('vm-1', { command: 'test' }, () => {});

      expect(streamOutputSpy).toHaveBeenCalledWith('vm-1', 'streaming data', 'stdout');
    });
  });

  describe('connection management', () => {
    it('should track connected VMs', async () => {
      expect(sshService.getConnectedVMs()).toEqual([]);
      
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
      
      expect(sshService.getConnectedVMs()).toEqual(['vm-1']);
      expect(sshService.isConnected('vm-1')).toBe(true);
      expect(sshService.isConnected('vm-2')).toBe(false);
    });

    it('should disconnect specific VM', async () => {
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;
      
      expect(sshService.isConnected('vm-1')).toBe(true);
      
      sshService.disconnect('vm-1');
      
      expect(mockClient.end).toHaveBeenCalled();
      expect(sshService.isConnected('vm-1')).toBe(false);
    });

    it('should disconnect all VMs', async () => {
      // Connect to multiple VMs
      const clients = [];
      for (let i = 1; i <= 3; i++) {
        const mockClient = new MockClient();
        clients.push(mockClient);
        
        const { Client } = require('ssh2');
        Client.mockImplementationOnce(() => mockClient);
        
        const connectPromise = sshService.connect(`vm-${i}`, {
          host: `test${i}.example.com`,
          username: 'testuser',
          privateKey: 'test-key'
        });
        setTimeout(() => mockClient.emit('ready'), 10);
        await connectPromise;
      }
      
      expect(sshService.getConnectedVMs()).toHaveLength(3);
      
      sshService.disconnectAll();
      
      clients.forEach(client => {
        expect(client.end).toHaveBeenCalled();
      });
      expect(sshService.getConnectedVMs()).toEqual([]);
    });
  });

  describe('utility functions', () => {
    it('should extract repository name from URL', async () => {
      const connectPromise = sshService.connect('vm-1', {
        host: 'test.example.com',
        username: 'testuser',
        privateKey: 'test-key'
      });
      setTimeout(() => mockClient.emit('ready'), 10);
      await connectPromise;

      const mockStream = new EventEmitter();
      mockStream.stderr = new EventEmitter();
      
      mockClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
        setTimeout(() => mockStream.emit('close', 0), 10);
      });

      // Mock executeCommand to verify repo name extraction
      jest.spyOn(sshService, 'executeCommand').mockResolvedValueOnce({
        success: true, stdout: '', stderr: '', exitCode: 0
      });

      await sshService.executeAgentCommand(
        'vm-1', 
        'code-writer', 
        'test task', 
        'https://github.com/user/my-repo.git'
      );

      expect(sshService.executeCommand).toHaveBeenCalledWith('vm-1', 
        expect.objectContaining({
          command: expect.stringContaining('"my-repo"')
        })
      );
    });
  });
});

describe('SSH utility functions', () => {
  describe('loadSSHKey', () => {
    it('should load SSH key from file', () => {
      mockReadFileSync.mockReturnValue('ssh-private-key-content');
      
      const key = loadSSHKey('/path/to/key.pem');
      
      expect(key).toBe('ssh-private-key-content');
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/key.pem', 'utf8');
    });

    it('should throw error when file cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      expect(() => loadSSHKey('/nonexistent/key.pem')).toThrow(
        'Failed to load SSH key from /nonexistent/key.pem: File not found'
      );
    });
  });

  describe('createEC2Connection', () => {
    it('should create EC2 connection configuration', () => {
      mockReadFileSync.mockReturnValue('ec2-private-key');
      
      const connection = createEC2Connection('ec2.example.com', '/path/to/ec2.pem');
      
      expect(connection).toEqual({
        host: 'ec2.example.com',
        username: 'ubuntu',
        privateKey: 'ec2-private-key',
        port: 22
      });
    });
  });
});