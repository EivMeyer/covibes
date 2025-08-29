/**
 * VM Manager Service Unit Tests
 * Tests VM assignment and management functionality
 */

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { VMManager, createVMManager, type VMInstance } from '../../services/vm-manager';

// Mock dependencies
jest.mock('fs');
jest.mock('@prisma/client');

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  }
} as unknown as PrismaClient;

describe('VMManager', () => {
  let vmManager: VMManager;
  const testConfigPath = '/test/config/vm-instances.json';

  const mockVMConfig = {
    instances: [
      {
        id: 'vm-001',
        host: 'vm1.example.com',
        region: 'us-east-1',
        instanceType: 't3.medium',
        status: 'available',
        sshKeyPath: '/path/to/vm1.pem',
        maxUsers: 5,
        currentUsers: 0
      },
      {
        id: 'vm-002',
        host: 'vm2.example.com',
        region: 'us-west-2',
        instanceType: 't3.large',
        status: 'assigned',
        assignedUserId: 'user-123',
        sshKeyPath: '/path/to/vm2.pem',
        maxUsers: 10,
        currentUsers: 3
      },
      {
        id: 'vm-003',
        host: 'vm3.example.com',
        region: 'eu-west-1',
        instanceType: 't3.small',
        status: 'maintenance',
        sshKeyPath: '/path/to/vm3.pem',
        maxUsers: 2,
        currentUsers: 0
      }
    ],
    defaultSSHKeyPath: '/path/to/default.pem',
    maxConnectionsPerVM: 5
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful config loading
    mockReadFileSync.mockReturnValue(JSON.stringify(mockVMConfig));
    
    vmManager = new VMManager(mockPrisma, testConfigPath);
  });

  describe('constructor and config loading', () => {
    it('should load VM configuration from file', () => {
      expect(mockReadFileSync).toHaveBeenCalledWith(testConfigPath, 'utf8');
      expect(vmManager.getAllVMs()).toHaveLength(3);
    });

    it('should use default config when file loading fails', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const vmManagerWithDefaults = new VMManager(mockPrisma, '/nonexistent/path');
      const vms = vmManagerWithDefaults.getAllVMs();
      
      expect(vms).toHaveLength(1);
      expect(vms[0].id).toBe('vm-dev-001');
      expect(vms[0].host).toBe('localhost');
    });

    it('should use default config when validation fails', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ invalidConfig: true }));
      
      // Should not throw, but use default configuration
      const vmManager = new VMManager(mockPrisma, testConfigPath);
      const vms = vmManager.getAllVMs();
      
      expect(vms).toHaveLength(1);
      expect(vms[0].id).toBe('vm-dev-001');
      expect(vms[0].host).toBe('localhost');
    });

    it('should apply default values to config', () => {
      const minimalConfig = {
        instances: [{
          id: 'vm-test',
          host: 'test.com',
          region: 'us-east-1',
          instanceType: 't3.micro',
          status: 'available',
          sshKeyPath: '/test.pem'
        }]
      };
      
      mockReadFileSync.mockReturnValue(JSON.stringify(minimalConfig));
      const vmManagerMinimal = new VMManager(mockPrisma, testConfigPath);
      const vms = vmManagerMinimal.getAllVMs();
      
      expect(vms[0]).toEqual(expect.objectContaining({
        id: 'vm-test',
        host: 'test.com',
        region: 'us-east-1',
        instanceType: 't3.micro',
        status: 'available',
        sshKeyPath: '/test.pem'
      }));
    });
  });

  describe('assignVMToUser', () => {
    const mockUser = {
      id: 'user-456',
      vmId: null,
      userName: 'TestUser',
      email: 'test@example.com',
      teamId: 'team-1'
    };

    beforeEach(() => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      mockPrisma.user.update = jest.fn().mockResolvedValue({ ...mockUser, vmId: 'vm-001' });
    });

    it('should assign available VM to user', async () => {
      const assignedVM = await vmManager.assignVMToUser('user-456');
      
      expect(assignedVM).toBeTruthy();
      expect(assignedVM?.id).toBe('vm-001');
      expect(assignedVM?.status).toBe('assigned');
      expect(assignedVM?.assignedUserId).toBe('user-456');
      expect(assignedVM?.currentUsers).toBe(1);
      
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { vmId: 'vm-001' }
      });
    });

    it('should return existing VM if user already assigned', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        ...mockUser,
        vmId: 'vm-002'
      });
      
      const assignedVM = await vmManager.assignVMToUser('user-456');
      
      expect(assignedVM?.id).toBe('vm-002');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should reassign VM if previously assigned VM no longer exists', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        ...mockUser,
        vmId: 'vm-nonexistent'
      });
      
      const assignedVM = await vmManager.assignVMToUser('user-456');
      
      expect(assignedVM?.id).toBe('vm-001');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { vmId: 'vm-001' }
      });
    });

    it('should return null when no VMs available', async () => {
      // Mock config with no available VMs
      const noAvailableConfig = {
        instances: [{
          id: 'vm-full',
          host: 'full.example.com',
          region: 'us-east-1',
          instanceType: 't3.micro',
          status: 'assigned',
          sshKeyPath: '/test.pem',
          maxUsers: 1,
          currentUsers: 1
        }],
        defaultSSHKeyPath: '/default.pem',
        maxConnectionsPerVM: 5
      };
      
      mockReadFileSync.mockReturnValue(JSON.stringify(noAvailableConfig));
      const vmManagerFull = new VMManager(mockPrisma, testConfigPath);
      
      const assignedVM = await vmManagerFull.assignVMToUser('user-456');
      expect(assignedVM).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);
      
      await expect(vmManager.assignVMToUser('nonexistent-user'))
        .rejects.toThrow('User not found: nonexistent-user');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      
      await expect(vmManager.assignVMToUser('user-456'))
        .rejects.toThrow('Database connection failed');
    });

    it('should assign to partially loaded VM when available VM is full', async () => {
      // Make the first VM (available) temporarily full for this test
      const vm001 = vmManager.getVMById('vm-001');
      if (vm001) {
        vm001.status = 'assigned';
        vm001.currentUsers = 5;
      }
      
      const assignedVM = await vmManager.assignVMToUser('user-456');
      
      // Should assign to vm-002 which has capacity (3/10 users)
      expect(assignedVM?.id).toBe('vm-002');
      expect(assignedVM?.currentUsers).toBe(4);
    });
  });

  describe('getUserVM', () => {
    it('should return user\'s assigned VM', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-123',
        vmId: 'vm-002',
        userName: 'TestUser',
        email: 'test@example.com',
        teamId: 'team-1'
      });
      
      const vm = await vmManager.getUserVM('user-123');
      
      expect(vm?.id).toBe('vm-002');
      expect(vm?.host).toBe('vm2.example.com');
    });

    it('should return null for user with no VM assigned', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-456',
        vmId: null,
        userName: 'TestUser',
        email: 'test@example.com',
        teamId: 'team-1'
      });
      
      const vm = await vmManager.getUserVM('user-456');
      expect(vm).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);
      
      const vm = await vmManager.getUserVM('nonexistent-user');
      expect(vm).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const vm = await vmManager.getUserVM('user-123');
      expect(vm).toBeNull();
    });
  });

  describe('releaseVMFromUser', () => {
    it('should release VM and update user record', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-123',
        vmId: 'vm-002',
        userName: 'TestUser',
        email: 'test@example.com',
        teamId: 'team-1'
      });
      mockPrisma.user.update = jest.fn().mockResolvedValue({});
      
      const released = await vmManager.releaseVMFromUser('user-123');
      
      expect(released).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { vmId: null }
      });
      
      const vm = vmManager.getVMById('vm-002');
      expect(vm?.currentUsers).toBe(2); // Decreased from 3 to 2
    });

    it('should make VM available when last user is released', async () => {
      // Set up VM with only 1 user
      const vm001 = vmManager.getVMById('vm-001');
      if (vm001) {
        vm001.status = 'assigned';
        vm001.currentUsers = 1;
        vm001.assignedUserId = 'user-only';
      }
      
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-only',
        vmId: 'vm-001',
        userName: 'OnlyUser',
        email: 'only@example.com',
        teamId: 'team-1'
      });
      mockPrisma.user.update = jest.fn().mockResolvedValue({});
      
      await vmManager.releaseVMFromUser('user-only');
      
      expect(vm001?.status).toBe('available');
      expect(vm001?.assignedUserId).toBeUndefined();
      expect(vm001?.currentUsers).toBe(0);
    });

    it('should return true for user with no VM assigned', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-novmr',
        vmId: null,
        userName: 'NoVMUser',
        email: 'novm@example.com',
        teamId: 'team-1'
      });
      
      const released = await vmManager.releaseVMFromUser('user-novm');
      expect(released).toBe(true);
    });

    it('should return true for non-existent user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);
      
      const released = await vmManager.releaseVMFromUser('nonexistent-user');
      expect(released).toBe(true);
    });

    it('should handle database errors', async () => {
      mockPrisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const released = await vmManager.releaseVMFromUser('user-123');
      expect(released).toBe(false);
    });
  });

  describe('VM status and statistics', () => {
    it('should return all VMs', () => {
      const vms = vmManager.getAllVMs();
      expect(vms).toHaveLength(3);
      expect(vms.map(vm => vm.id)).toEqual(['vm-001', 'vm-002', 'vm-003']);
    });

    it('should return available VMs', () => {
      const availableVMs = vmManager.getAvailableVMs();
      
      // vm-001 is available, vm-002 is assigned but has capacity (3/10)
      expect(availableVMs).toHaveLength(2);
      expect(availableVMs.map(vm => vm.id)).toEqual(['vm-001', 'vm-002']);
    });

    it('should return VM statistics', () => {
      const stats = vmManager.getVMStats();
      
      expect(stats).toEqual({
        total: 3,
        available: 1,
        assigned: 1,
        maintenance: 1,
        totalUsers: 3
      });
    });

    it('should find VM by ID', () => {
      const vm = vmManager.getVMById('vm-002');
      expect(vm?.host).toBe('vm2.example.com');
      
      const nonexistent = vmManager.getVMById('vm-999');
      expect(nonexistent).toBeNull();
    });

    it('should update VM status', () => {
      const updated = vmManager.updateVMStatus('vm-001', 'maintenance');
      expect(updated).toBe(true);
      
      const vm = vmManager.getVMById('vm-001');
      expect(vm?.status).toBe('maintenance');
      
      const notUpdated = vmManager.updateVMStatus('vm-999', 'available');
      expect(notUpdated).toBe(false);
    });
  });

  describe('SSH connection creation', () => {
    it('should create SSH connection details', () => {
      const connection = vmManager.createSSHConnection('vm-002');
      
      expect(connection).toEqual({
        host: 'vm2.example.com',
        username: 'ubuntu',
        privateKeyPath: '/path/to/vm2.pem',
        port: 22
      });
    });

    it('should use default SSH key path when VM key path not specified', () => {
      // Create VM without sshKeyPath
      const vmWithoutKey: VMInstance = {
        id: 'vm-nokey',
        host: 'nokey.example.com',
        region: 'us-east-1',
        instanceType: 't3.micro',
        status: 'available',
        sshKeyPath: ''
      };
      
      // Add to config temporarily
      const configWithNoKey = {
        ...mockVMConfig,
        instances: [...mockVMConfig.instances, vmWithoutKey]
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configWithNoKey));
      
      const vmManagerWithNoKey = new VMManager(mockPrisma, testConfigPath);
      const connection = vmManagerWithNoKey.createSSHConnection('vm-nokey');
      
      expect(connection?.privateKeyPath).toBe('/path/to/default.pem');
    });

    it('should return null for non-existent VM', () => {
      const connection = vmManager.createSSHConnection('vm-nonexistent');
      expect(connection).toBeNull();
    });
  });

  describe('config reloading', () => {
    it('should reload configuration from file', () => {
      const newConfig = {
        instances: [{
          id: 'vm-new',
          host: 'new.example.com',
          region: 'us-central-1',
          instanceType: 't3.xlarge',
          status: 'available',
          sshKeyPath: '/path/to/new.pem'
        }],
        defaultSSHKeyPath: '/path/to/new-default.pem',
        maxConnectionsPerVM: 10
      };
      
      mockReadFileSync.mockReturnValue(JSON.stringify(newConfig));
      
      vmManager.reloadConfig();
      
      const vms = vmManager.getAllVMs();
      expect(vms).toHaveLength(1);
      expect(vms[0].id).toBe('vm-new');
    });
  });
});

describe('createVMManager factory function', () => {
  it('should create VMManager instance with default config path', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      instances: [],
      defaultSSHKeyPath: '/test.pem',
      maxConnectionsPerVM: 5
    }));
    
    const manager = createVMManager(mockPrisma);
    expect(manager).toBeInstanceOf(VMManager);
  });

  it('should create VMManager instance with custom config path', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      instances: [],
      defaultSSHKeyPath: '/test.pem',
      maxConnectionsPerVM: 5
    }));
    
    const customPath = '/custom/path/vm-config.json';
    const manager = createVMManager(mockPrisma, customPath);
    expect(manager).toBeInstanceOf(VMManager);
  });
});