/**
 * SSH Tunnel Manager for EC2 Preview Containers
 * Creates and manages SSH tunnels to forward EC2 ports to localhost
 */

import { spawn, ChildProcess } from 'child_process';
import { createConnection } from 'net';

interface TunnelInfo {
  localPort: number;
  remotePort: number;
  process: ChildProcess;
  status: 'connecting' | 'connected' | 'failed' | 'closed';
  createdAt: number;
}

export class SSHTunnelManager {
  private tunnels: Map<string, TunnelInfo> = new Map();
  private readonly EC2_HOST = (() => {
    const ec2Host = process.env['EC2_HOST'];
    if (!ec2Host) {
      throw new Error('EC2_HOST environment variable is required. Set it to your EC2 instance hostname.');
    }
    return ec2Host;
  })();
  private readonly EC2_USERNAME = (() => {
    const ec2Username = process.env['EC2_USERNAME'];
    if (!ec2Username) {
      throw new Error('EC2_USERNAME environment variable is required. Set it to your EC2 SSH username.');
    }
    return ec2Username;
  })();
  private readonly SSH_KEY_PATH = (() => {
    const sshKeyPath = process.env['EC2_SSH_KEY_PATH'];
    if (!sshKeyPath) {
      throw new Error('EC2_SSH_KEY_PATH environment variable is required. Set it to your SSH key file path.');
    }
    return sshKeyPath;
  })();
  private readonly LOCAL_PORT_START = 9000; // Start allocating local ports from 9000

  /**
   * Create an SSH tunnel for a preview container
   */
  async createTunnel(remotePort: number): Promise<number> {
    const tunnelKey = `tunnel-${remotePort}`;
    
    // Check if tunnel already exists and is working
    const existing = this.tunnels.get(tunnelKey);
    if (existing && existing.status === 'connected') {
      console.log(`Using existing SSH tunnel: localhost:${existing.localPort} -> EC2:${remotePort}`);
      return existing.localPort;
    }
    
    // Find available local port
    const localPort = await this.findAvailableLocalPort();
    
    console.log(`Creating SSH tunnel: localhost:${localPort} -> EC2:${remotePort}`);
    
    // Create SSH tunnel process
    const sshArgs = [
      '-i', this.SSH_KEY_PATH,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      '-N', // Don't execute remote command
      '-L', `${localPort}:localhost:${remotePort}`, // Local port forwarding
      `${this.EC2_USERNAME}@${this.EC2_HOST}`
    ];
    
    const sshProcess = spawn('ssh', sshArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    const tunnelInfo: TunnelInfo = {
      localPort,
      remotePort,
      process: sshProcess,
      status: 'connecting',
      createdAt: Date.now()
    };
    
    this.tunnels.set(tunnelKey, tunnelInfo);
    
    // Set up process event handlers
    sshProcess.stdout?.on('data', (data) => {
      console.log(`SSH tunnel ${tunnelKey} stdout:`, data.toString());
    });
    
    sshProcess.stderr?.on('data', (data) => {
      console.log(`SSH tunnel ${tunnelKey} stderr:`, data.toString());
    });
    
    sshProcess.on('error', (error) => {
      console.error(`SSH tunnel ${tunnelKey} error:`, error);
      tunnelInfo.status = 'failed';
    });
    
    sshProcess.on('exit', (code, signal) => {
      console.log(`SSH tunnel ${tunnelKey} exited with code ${code}, signal ${signal}`);
      tunnelInfo.status = 'closed';
      this.tunnels.delete(tunnelKey);
    });
    
    // Wait for tunnel to be ready
    const isReady = await this.waitForTunnelReady(localPort, 10000);
    
    if (isReady) {
      tunnelInfo.status = 'connected';
      console.log(`✅ SSH tunnel ready: localhost:${localPort} -> EC2:${remotePort}`);
      return localPort;
    } else {
      tunnelInfo.status = 'failed';
      this.closeTunnel(remotePort);
      throw new Error(`SSH tunnel failed to connect within timeout`);
    }
  }
  
  /**
   * Close an SSH tunnel
   */
  async closeTunnel(remotePort: number): Promise<void> {
    const tunnelKey = `tunnel-${remotePort}`;
    const tunnel = this.tunnels.get(tunnelKey);
    
    if (tunnel) {
      console.log(`Closing SSH tunnel: localhost:${tunnel.localPort} -> EC2:${remotePort}`);
      tunnel.process.kill('SIGTERM');
      this.tunnels.delete(tunnelKey);
    }
  }
  
  /**
   * Get tunnel information
   */
  getTunnel(remotePort: number): TunnelInfo | null {
    return this.tunnels.get(`tunnel-${remotePort}`) || null;
  }
  
  /**
   * Find an available local port for tunneling
   */
  private async findAvailableLocalPort(): Promise<number> {
    for (let port = this.LOCAL_PORT_START; port < this.LOCAL_PORT_START + 1000; port++) {
      if (await this.isPortFree(port)) {
        return port;
      }
    }
    throw new Error('No available local ports for SSH tunnel');
  }
  
  /**
   * Check if a local port is available
   */
  private async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const connection = createConnection({ port, host: 'localhost' }, () => {
        connection.end();
        resolve(false); // Port is in use
      });
      
      connection.on('error', () => {
        resolve(true); // Port is free
      });
    });
  }
  
  /**
   * Wait for SSH tunnel to be ready by testing the local port
   */
  private async waitForTunnelReady(localPort: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to connect to the tunneled port
        await new Promise<void>((resolve, reject) => {
          const testConnection = createConnection({ port: localPort, host: 'localhost' }, () => {
            testConnection.end();
            resolve();
          });
          
          testConnection.on('error', (error) => {
            reject(error);
          });
          
          testConnection.setTimeout(1000, () => {
            testConnection.destroy();
            reject(new Error('Connection timeout'));
          });
        });
        
        return true; // Connection successful
      } catch (error) {
        // Connection failed, wait and retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return false; // Timeout
  }
  
  /**
   * Clean up all tunnels
   */
  cleanup(): void {
    for (const [_key, tunnel] of this.tunnels) {
      tunnel.process.kill('SIGTERM');
    }
    this.tunnels.clear();
    console.log('All SSH tunnels cleaned up');
  }
  
  /**
   * Get status of all tunnels
   */
  getStatus(): { [key: string]: TunnelInfo } {
    const status: { [key: string]: TunnelInfo } = {};
    for (const [key, tunnel] of this.tunnels) {
      status[key] = { ...tunnel, process: undefined } as any; // Don't include process in status
    }
    return status;
  }
}

// Singleton instance
export const sshTunnelManager = new SSHTunnelManager();

// Cleanup on process exit
process.on('exit', () => sshTunnelManager.cleanup());
process.on('SIGINT', () => {
  sshTunnelManager.cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  sshTunnelManager.cleanup();
  process.exit(0);
});