/**
 * VM Management Service
 * 
 * Handles VM assignment and management for users
 * Requirements:
 * - Assign VMs from a pool to users on first agent spawn
 * - Track VM availability and usage
 * - Provide VM configuration and connection details
 * - Handle VM lifecycle management
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import * as path from 'path';

interface VMInstance {
  id: string;
  host: string;
  region: string;
  instanceType: string;
  status: 'available' | 'assigned' | 'maintenance';
  assignedUserId?: string;
  sshKeyPath: string;
  maxUsers?: number;
  currentUsers?: number;
}

interface VMConfig {
  instances: VMInstance[];
  defaultSSHKeyPath: string;
  maxConnectionsPerVM: number;
}

/**
 * Service for managing VM instances and user assignments
 */
export class VMManager {
  private prisma: PrismaClient;
  private vmConfig: VMConfig;
  private configPath: string;

  constructor(prisma: PrismaClient, configPath?: string) {
    this.prisma = prisma;
    this.configPath = configPath || path.join(__dirname, '../../config/vm-instances.json');
    this.vmConfig = this.loadVMConfig();
  }

  /**
   * Load VM configuration from file
   */
  private loadVMConfig(): VMConfig {
    try {
      const configData = readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Validate configuration structure
      if (!config.instances || !Array.isArray(config.instances)) {
        throw new Error('Invalid VM config: instances array is required');
      }

      // Set defaults
      return {
        instances: config.instances,
        defaultSSHKeyPath: config.defaultSSHKeyPath || '/path/to/default/ec2-key.pem',
        maxConnectionsPerVM: config.maxConnectionsPerVM || 5
      };
    } catch (error) {
      console.warn(`Failed to load VM config from ${this.configPath}:`, error);
      
      // Return default configuration for development
      return {
        instances: [
          {
            id: 'vm-dev-001',
            host: process.env['BASE_HOST'] || 'localhost',
            region: 'us-east-1',
            instanceType: 't3.medium',
            status: 'available',
            sshKeyPath: '/dev/null',
            maxUsers: 10,
            currentUsers: 0
          }
        ],
        defaultSSHKeyPath: '/dev/null',
        maxConnectionsPerVM: 5
      };
    }
  }

  /**
   * Get or assign VM to user
   */
  async assignVMToUser(userId: string): Promise<VMInstance | null> {
    try {
      // Check if user already has a VM assigned
      const user = await this.prisma.users.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // If user already has a VM, return it
      if (user.vmId) {
        const assignedVM = this.findVMById(user.vmId);
        if (assignedVM) {
          return assignedVM;
        }
        // VM no longer exists in config, need to reassign
      }

      // Find available VM
      const availableVM = this.findAvailableVM();
      if (!availableVM) {
        console.warn('No available VMs for assignment');
        return null;
      }

      // Assign VM to user
      await this.prisma.users.update({
        where: { id: userId },
        data: { vmId: availableVM.id }
      });

      // Update VM status
      availableVM.status = 'assigned';
      availableVM.assignedUserId = userId;
      availableVM.currentUsers = (availableVM.currentUsers || 0) + 1;

      console.log(`Assigned VM ${availableVM.id} to user ${userId}`);
      return availableVM;

    } catch (error) {
      console.error('Failed to assign VM to user:', error);
      throw error;
    }
  }

  /**
   * Get user's assigned VM
   */
  async getUserVM(userId: string): Promise<VMInstance | null> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId }
      });

      if (!user || !user.vmId) {
        return null;
      }

      return this.findVMById(user.vmId);
    } catch (error) {
      console.error('Failed to get user VM:', error);
      return null;
    }
  }

  /**
   * Release VM from user (when user leaves team or is deleted)
   */
  async releaseVMFromUser(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId }
      });

      if (!user || !user.vmId) {
        return true; // No VM to release
      }

      const vm = this.findVMById(user.vmId);
      if (vm) {
        vm.currentUsers = Math.max(0, (vm.currentUsers || 1) - 1);
        
        // If no users left, make VM available again
        if (vm.currentUsers === 0) {
          vm.status = 'available';
          vm.assignedUserId = undefined;
        }
      }

      // Remove VM assignment from user
      await this.prisma.users.update({
        where: { id: userId },
        data: { vmId: null }
      });

      console.log(`Released VM ${user.vmId} from user ${userId}`);
      return true;

    } catch (error) {
      console.error('Failed to release VM from user:', error);
      return false;
    }
  }

  /**
   * Get all VM instances with their status
   */
  getAllVMs(): VMInstance[] {
    return this.vmConfig.instances;
  }

  /**
   * Get available VMs
   */
  getAvailableVMs(): VMInstance[] {
    return this.vmConfig.instances.filter(vm => 
      vm.status === 'available' || 
      (vm.status === 'assigned' && (vm.currentUsers || 0) < (vm.maxUsers || this.vmConfig.maxConnectionsPerVM))
    );
  }

  /**
   * Get VM statistics
   */
  getVMStats(): {
    total: number;
    available: number;
    assigned: number;
    maintenance: number;
    totalUsers: number;
  } {
    const stats = {
      total: this.vmConfig.instances.length,
      available: 0,
      assigned: 0,
      maintenance: 0,
      totalUsers: 0
    };

    this.vmConfig.instances.forEach(vm => {
      if (vm.status === 'available') stats.available++;
      else if (vm.status === 'assigned') stats.assigned++;
      else if (vm.status === 'maintenance') stats.maintenance++;
      
      stats.totalUsers += vm.currentUsers || 0;
    });

    return stats;
  }

  /**
   * Get VM by ID
   */
  getVMById(vmId: string): VMInstance | null {
    return this.findVMById(vmId);
  }

  /**
   * Update VM status
   */
  updateVMStatus(vmId: string, status: VMInstance['status']): boolean {
    const vm = this.findVMById(vmId);
    if (vm) {
      vm.status = status;
      return true;
    }
    return false;
  }

  /**
   * Reload VM configuration from file
   */
  reloadConfig(): void {
    this.vmConfig = this.loadVMConfig();
    console.log('VM configuration reloaded');
  }

  /**
   * Find VM by ID (private helper)
   */
  private findVMById(vmId: string): VMInstance | null {
    return this.vmConfig.instances.find(vm => vm.id === vmId) || null;
  }

  /**
   * Find available VM for assignment (private helper)
   */
  private findAvailableVM(): VMInstance | null {
    // Prefer completely available VMs
    let availableVM = this.vmConfig.instances.find(vm => vm.status === 'available');
    
    if (!availableVM) {
      // Find assigned VM with capacity
      availableVM = this.vmConfig.instances.find(vm => 
        vm.status === 'assigned' && 
        (vm.currentUsers || 0) < (vm.maxUsers || this.vmConfig.maxConnectionsPerVM)
      );
    }

    return availableVM || null;
  }

  /**
   * Create SSH connection details for VM
   */
  createSSHConnection(vmId: string): {
    host: string;
    username: string;
    privateKeyPath: string;
    port: number;
  } | null {
    const vm = this.findVMById(vmId);
    if (!vm) {
      return null;
    }

    return {
      host: vm.host,
      username: 'ubuntu', // Default EC2 username
      privateKeyPath: vm.sshKeyPath || this.vmConfig.defaultSSHKeyPath,
      port: 22
    };
  }
}

// Default configuration path
const defaultConfigPath = path.join(__dirname, '../../config/vm-instances.json');

/**
 * Create VM manager instance with Prisma client
 */
export function createVMManager(prisma: PrismaClient, configPath?: string): VMManager {
  return new VMManager(prisma, configPath || defaultConfigPath);
}

/**
 * VM instance type definitions for exports
 */
export type { VMInstance, VMConfig };

export default VMManager;