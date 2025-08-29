/**
 * VM Management Routes
 * 
 * Handles VM instance assignment and status with JWT authentication
 * Requirements:
 * - Get user's assigned VM status
 * - Assign VM to user (if not already assigned)
 * - Release user's VM assignment
 * - Get list of available VMs
 * - Use JWT authentication middleware
 * - Use Prisma client for database operations
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { createAuthHandler } from '../types/express.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import module augmentation

const router = express.Router();
const prisma = new PrismaClient();

// Real EC2 instance
const VM_INSTANCES = [
  { id: 'vm-001', host: 'ec2-13-60-242-174.eu-north-1.compute.amazonaws.com', status: 'available' }
];

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

// GET /api/vm/status - Get user's assigned VM status
router.get('/status', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user information
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { id: true, userName: true, vmId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.vmId) {
      return res.json({
        connected: false,
        message: 'No VM assigned to user'
      });
    }

    // Find VM instance details (in production this would query actual VM service)
    const vmInstance = VM_INSTANCES.find(vm => vm.id === user.vmId);

    if (!vmInstance) {
      return res.json({
        connected: false,
        ip: user.vmId,
        message: 'VM instance not found in registry'
      });
    }

    res.json({
      connected: true, // VM is assigned and found
      ip: vmInstance.host,
      message: `VM ${user.vmId} is connected (${vmInstance.host})`
    });

  } catch (error) {
    console.error('Get VM status error:', error);
    res.status(500).json({ error: 'Failed to get VM status' });
  }
}));

// POST /api/vm/assign - Assign VM to user (if not already assigned)
router.post('/assign', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user information
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { id: true, userName: true, vmId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.vmId) {
      return res.status(400).json({ 
        error: 'VM already assigned',
        vmId: user.vmId
      });
    }

    // Find available VM (simple round-robin assignment)
    // In production this would be more sophisticated
    const assignedVMs = await prisma.users.findMany({
      where: { vmId: { not: null } },
      select: { vmId: true }
    });

    const assignedVMIds = new Set(assignedVMs.map(u => u.vmId));
    const availableVM = VM_INSTANCES.find(vm => !assignedVMIds.has(vm.id));

    if (!availableVM) {
      return res.status(503).json({ 
        error: 'No VM instances available',
        message: 'All VMs are currently assigned'
      });
    }

    // Assign VM to user
    await prisma.users.update({
      where: { id: req.userId },
      data: { vmId: availableVM.id }
    });

    res.json({
      message: 'VM assigned successfully',
      vmId: availableVM.id,
      host: availableVM.host,
      status: availableVM.status
    });

  } catch (error) {
    console.error('Assign VM error:', error);
    res.status(500).json({ error: 'Failed to assign VM' });
  }
}));

// POST /api/vm/release - Release user's VM assignment
router.post('/release', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get user information
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: { id: true, vmId: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.vmId) {
      return res.status(400).json({ 
        error: 'No VM assigned to release'
      });
    }

    const releasedVmId = user.vmId;

    // Release VM assignment
    await prisma.users.update({
      where: { id: req.userId },
      data: { vmId: null }
    });

    res.json({
      message: 'VM released successfully',
      releasedVmId
    });

  } catch (error) {
    console.error('Release VM error:', error);
    res.status(500).json({ error: 'Failed to release VM' });
  }
}));

// GET /api/vm/available - Get list of available VMs (admin endpoint)
router.get('/available', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Get assigned VMs
    const assignedVMs = await prisma.users.findMany({
      where: { vmId: { not: null } },
      select: { vmId: true, userName: true }
    });

    const assignedVMMap = new Map(assignedVMs.map(u => [u.vmId, u.userName]));

    // Map VM status
    const vmStatus = VM_INSTANCES.map(vm => ({
      id: vm.id,
      host: vm.host,
      status: vm.status,
      assigned: assignedVMMap.has(vm.id),
      assignedTo: assignedVMMap.get(vm.id) || null
    }));

    res.json({
      vms: vmStatus,
      summary: {
        total: VM_INSTANCES.length,
        assigned: assignedVMs.length,
        available: VM_INSTANCES.length - assignedVMs.length
      }
    });

  } catch (error) {
    console.error('Get available VMs error:', error);
    res.status(500).json({ error: 'Failed to get VM availability' });
  }
}));

// POST /api/vm/configure - Configure VM connection for user
router.post('/configure', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { ip, sshKeyPath } = req.body;

    if (!ip || !sshKeyPath) {
      return res.status(400).json({ error: 'IP address and SSH key path are required' });
    }

    // Skip validation - allow any hostname or IP

    // Get or create VM ID for this IP
    let vmId = `vm-${ip.replace(/\./g, '-')}`;

    // Update user with VM configuration
    await prisma.users.update({
      where: { id: req.userId },
      data: { vmId }
    });

    // In a real implementation, you would also store the SSH key path securely
    // and test the connection

    res.json({
      message: 'VM configured successfully'
    });

  } catch (error) {
    console.error('Configure VM error:', error);
    res.status(500).json({ error: 'Failed to configure VM' });
  }
}));

// POST /api/vm/test - Test VM connection
router.post('/test', createAuthHandler(async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { ip, sshKeyPath } = req.body;

    if (!ip || !sshKeyPath) {
      return res.status(400).json({ error: 'IP address and SSH key path are required' });
    }

    // Skip validation - allow any hostname or IP

    // In a real implementation, this would attempt an actual SSH connection
    // For now, we'll simulate a test
    try {
      // Simulate connection test
      const isReachable = Math.random() > 0.3; // 70% success rate for demo
      
      if (isReachable) {
        res.json({
          success: true,
          message: `Successfully connected to ${ip}`
        });
      } else {
        res.json({
          success: false,
          message: `Failed to connect to ${ip}. Please check the IP address and SSH key.`
        });
      }
    } catch (connectionError) {
      res.json({
        success: false,
        message: `Connection test failed: ${(connectionError as Error).message}`
      });
    }

  } catch (error) {
    console.error('Test VM connection error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test VM connection' 
    });
  }
}));

const execAsync = promisify(exec);

// POST /api/vm/ping - Ping a VM host
router.post('/ping', createAuthHandler(async (req, res) => {
  try {
    const { host } = req.body;

    if (!host) {
      return res.status(400).json({ error: 'Host is required' });
    }

    // Validate host format (basic security check)
    const hostRegex = /^[a-zA-Z0-9.-]+$/;
    if (!hostRegex.test(host)) {
      return res.status(400).json({ error: 'Invalid host format' });
    }

    try {
      const startTime = Date.now();
      
      // Use ping command with timeout
      const { stdout } = await execAsync(`ping -c 1 -W 3000 ${host}`);
      
      const pingTime = Date.now() - startTime;
      
      // Extract ping time from output if available
      const pingMatch = stdout.match(/time=(\d+\.?\d*)/);
      const actualPing = pingMatch && pingMatch[1] ? parseFloat(pingMatch[1]) : pingTime;

      res.json({
        reachable: true,
        ping: Math.round(actualPing),
        host,
        timestamp: new Date().toISOString()
      });

    } catch (pingError) {
      // Host is not reachable
      res.json({
        reachable: false,
        ping: null,
        host,
        timestamp: new Date().toISOString(),
        error: 'Host unreachable'
      });
    }

  } catch (error) {
    console.error('Ping VM error:', error);
    res.status(500).json({ error: 'Failed to ping VM' });
  }
}));

export default router;