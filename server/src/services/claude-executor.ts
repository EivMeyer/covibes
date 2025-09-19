/**
 * Claude Executor Service
 *
 * Handles non-interactive execution of Claude commands for chat mode agents.
 * Executes Claude with -p flag in the appropriate environment (local/remote/docker)
 * and maintains conversation context using --resume flag.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
// Import SSH service only when needed to avoid circular dependency
// import { sshService } from '../../services/ssh.js';
import { claudeConfigManager } from './claude-config-manager.js';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface ExecutionOptions {
  agentId: string;
  message: string;
  userId: string;
  teamId: string;
  sessionId?: string;
}

export class ClaudeExecutor {
  private readonly WORKSPACE_BASE = path.join(os.homedir(), '.covibes/workspaces');

  /**
   * Execute a non-interactive Claude command
   */
  async executeCommand(options: ExecutionOptions): Promise<string> {
    try {
      // Get agent details to determine execution environment
      const agent = await prisma.agents.findUnique({
        where: { id: options.agentId },
        include: { users: true }
      });

      if (!agent) {
        throw new Error('Agent not found');
      }

      // For demo mode, provide mock responses
      // TEMPORARILY DISABLED FOR REAL CLAUDE TESTING
      if (process.env.CLAUDE_DEMO_MODE === 'true' && false) {
        return this.generateMockResponse(options.message);
      }

      // Get workspace directory
      const workspaceDir = path.join(this.WORKSPACE_BASE, agent.teamId);

      // Build Claude command with proper configuration
      const { command, args, env } = claudeConfigManager.buildClaudeCommand(options.userId, {
        task: options.message,
        teamId: agent.teamId,
        skipPermissions: true,
        mode: 'chat',
        ...(options.sessionId || agent.sessionId ? { sessionId: options.sessionId || agent.sessionId || '' } : {})
      });

      console.log(`🤖 Executing Claude command for agent ${agent.id}: ${command} ${args.join(' ')}`.substring(0, 200));

      let result: string;

      // Execute based on terminal location
      if (agent.terminalLocation === 'remote') {
        // Execute on remote VM via SSH
        const user = await prisma.users.findUnique({ where: { id: options.userId } });
        if (!user?.vmId) {
          throw new Error('User does not have a configured VM');
        }

        // Dynamically import SSH service to avoid circular dependency
        const { sshService } = await import('../../services/ssh.js');
        const sshResult = await sshService.executeCommand(user.vmId, {
          command: `cd ${workspaceDir} && ${command} ${args.join(' ')}`,
          timeout: 30000 // 30 second timeout for Claude response
        });

        result = sshResult.stdout;
      } else if (agent.terminalIsolation === 'docker') {
        // Execute inside Docker container
        const containerInstance = await prisma.container_instances.findFirst({
          where: {
            agentId: agent.id,
            type: 'user-claude-agent'
          }
        });

        if (!containerInstance?.containerId) {
          throw new Error('No Docker container found for agent');
        }

        // Execute command inside container
        const dockerCmd = `docker exec ${containerInstance.containerId} sh -c "cd ${workspaceDir} && ${command} ${args.join(' ')}"`;
        const { stdout } = await execAsync(dockerCmd, {
          env: { ...process.env, ...env },
          timeout: 30000
        });

        result = stdout;
      } else {
        // Execute locally on web server using spawn to avoid shell issues
        const { spawn } = await import('child_process');

        const executeWithSpawn = (cmd: string, cmdArgs: string[], options: any, stdinInput?: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            const process = spawn(cmd, cmdArgs, options);
            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
              stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
              stderr += data.toString();
            });

            process.on('close', (code) => {
              if (code === 0) {
                resolve(stdout);
              } else {
                reject(new Error(`Claude exited with code ${code}: ${stderr}`));
              }
            });

            process.on('error', (error) => {
              reject(error);
            });

            // Send input to stdin if provided
            if (stdinInput && process.stdin) {
              process.stdin.write(stdinInput + '\n');
              process.stdin.end();
            }

            // Set timeout
            setTimeout(() => {
              process.kill();
              reject(new Error('Claude execution timeout'));
            }, 30000);
          });
        };

        // Use bash pipe approach since it works reliably
        const bashCmd = `echo "${options.message}" | /home/ubuntu/.local/bin/claude ${args.join(' ')}`;
        const { stdout } = await execAsync(bashCmd, {
          cwd: workspaceDir,
          env: {
            ...process.env,
            ...env
          },
          timeout: 30000
        });
        result = stdout;
      }

      // Clean up the result (remove any ANSI codes or extra whitespace)
      result = result.trim().replace(/\x1b\[[0-9;]*m/g, '');

      // Store the response in terminal history
      await prisma.terminal_history.create({
        data: {
          id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agentId: agent.id,
          output: result,
          type: 'output'
        }
      });

      return result;

    } catch (error) {
      console.error(`❌ Claude execution error for agent ${options.agentId}:`, error);

      // Store error in terminal history
      await prisma.terminal_history.create({
        data: {
          id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agentId: options.agentId,
          output: `Error: ${error instanceof Error ? error.message : String(error)}`,
          type: 'error'
        }
      }).catch(console.error);

      throw error;
    }
  }

  /**
   * Initialize a new chat session
   */
  async initializeSession(agentId: string, _userId: string, teamId: string): Promise<string> {
    // Generate a unique UUID session ID for this chat agent (Claude CLI requires valid UUID)
    const sessionId = randomUUID();

    // Update agent with session ID
    await prisma.agents.update({
      where: { id: agentId },
      data: { sessionId }
    });

    console.log(`💬 Initialized chat session ${sessionId} for agent ${agentId}`);
    return sessionId;
  }

  /**
   * Check if a session is still valid
   */
  async isSessionValid(_sessionId: string): Promise<boolean> {
    // For now, sessions are always valid until explicitly cleared
    // In the future, could check session age or other criteria
    return true;
  }

  /**
   * Clear a chat session
   */
  async clearSession(agentId: string): Promise<void> {
    await prisma.agents.update({
      where: { id: agentId },
      data: { sessionId: null }
    });

    console.log(`🧹 Cleared chat session for agent ${agentId}`);
  }

  /**
   * Generate a mock response for demo purposes
   */
  private generateMockResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Simple responses for common queries
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! I'm a demo chat agent. I can help you with basic questions and demonstrate the chat functionality.";
    }

    if (lowerMessage.includes('2 + 2') || lowerMessage.includes('2+2')) {
      return "2 + 2 equals 4";
    }

    if (lowerMessage.includes('what is') && lowerMessage.includes('capital') && lowerMessage.includes('france')) {
      return "The capital of France is Paris.";
    }

    if (lowerMessage.includes('help')) {
      return "I'm a demo chat agent. You can ask me simple questions, and I'll provide responses to demonstrate the chat functionality. Try asking me math questions, general knowledge, or just say hello!";
    }

    if (lowerMessage.includes('how are you')) {
      return "I'm functioning well, thank you for asking! I'm here to demonstrate the chat agent functionality.";
    }

    if (lowerMessage.includes('weather')) {
      return "I'm a demo agent and don't have access to real-time weather data. In a production environment, I could provide weather information.";
    }

    // Default response for unrecognized queries
    return `I received your message: "${message}". As a demo chat agent, I can respond to basic queries. Try asking me simple questions or saying hello!`;
  }
}

export const claudeExecutor = new ClaudeExecutor();