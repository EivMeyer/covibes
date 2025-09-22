import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export type AgentState = 'initializing' | 'available' | 'working' | 'error' | 'offline';

interface QueuedMessage {
  id: string;
  message: string;
  timestamp: Date;
  userId: string;
}

export class AgentStateManager {
  private io: SocketIOServer | null = null;
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private startupTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly HEARTBEAT_TIMEOUT = 15000; // 15 seconds to consider offline
  private readonly STARTUP_TIMEOUT = 30000; // 30 seconds for agent to be ready

  setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Initialize agent after spawn
   */
  async initializeAgent(agentId: string): Promise<void> {
    console.log(`🚀 [AGENT-STATE] Initializing agent ${agentId}`);

    // Set initial state
    await this.updateAgentState(agentId, 'initializing');

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring(agentId);

    // Set startup timeout
    const timeoutId = setTimeout(async () => {
      const agent = await prisma.agents.findUnique({
        where: { id: agentId }
      });

      if (agent && !agent.isReady) {
        console.error(`⏱️ [AGENT-STATE] Agent ${agentId} failed to become ready within timeout`);
        await this.updateAgentState(agentId, 'error');
        await this.addToAgentLog(agentId, 'Agent failed to start within 30 seconds');
      }
    }, this.STARTUP_TIMEOUT);

    this.startupTimeouts.set(agentId, timeoutId);
  }

  /**
   * Mark agent as ready and available
   */
  async markAgentReady(agentId: string): Promise<void> {
    console.log(`✅ [AGENT-STATE] Agent ${agentId} is ready`);

    // Clear startup timeout
    const timeoutId = this.startupTimeouts.get(agentId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.startupTimeouts.delete(agentId);
    }

    // Update state to available
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        isReady: true,
        agentState: 'available',
        lastHeartbeat: new Date()
      }
    });

    // Notify via WebSocket
    await this.emitStateChange(agentId, 'initializing', 'available');

    // Process any queued messages
    await this.processQueuedMessages(agentId);
  }

  /**
   * Update agent state with transition rules
   */
  async updateAgentState(agentId: string, newState: AgentState): Promise<boolean> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      console.error(`[AGENT-STATE] Agent ${agentId} not found`);
      return false;
    }

    const oldState = agent.agentState as AgentState;

    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[AGENT-STATE] Invalid transition from ${oldState} to ${newState}`);
      return false;
    }

    // Update database
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        agentState: newState,
        lastHeartbeat: new Date()
      }
    });

    // Emit state change event
    await this.emitStateChange(agentId, oldState, newState);

    console.log(`🔄 [AGENT-STATE] Agent ${agentId}: ${oldState} -> ${newState}`);
    return true;
  }

  /**
   * Handle incoming message for agent
   */
  async handleIncomingMessage(agentId: string, message: string, userId: string): Promise<{
    success: boolean;
    queued?: boolean;
    queuePosition?: number;
    error?: string;
  }> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const state = agent.agentState as AgentState;

    // Check agent state
    if (state === 'initializing') {
      // Queue message for when agent is ready
      await this.queueMessage(agentId, message, userId);
      const queueLength = await this.getQueueLength(agentId);
      return {
        success: true,
        queued: true,
        queuePosition: queueLength,
        error: 'Agent is still starting up. Your message has been queued.'
      };
    }

    if (state === 'working') {
      // Queue message for when agent is available
      await this.queueMessage(agentId, message, userId);
      const queueLength = await this.getQueueLength(agentId);
      return {
        success: true,
        queued: true,
        queuePosition: queueLength,
        error: 'Agent is currently processing another request. Your message has been queued.'
      };
    }

    if (state === 'error' || state === 'offline') {
      return {
        success: false,
        error: `Agent is currently ${state}. Please wait for it to recover or spawn a new agent.`
      };
    }

    // Agent is available - mark as working
    await this.updateAgentState(agentId, 'working');

    // Update current task
    const taskId = randomUUID();
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        currentTaskId: taskId,
        lastHeartbeat: new Date()
      }
    });

    return { success: true };
  }

  /**
   * Mark task as complete and process queue
   */
  async markTaskComplete(agentId: string): Promise<void> {
    console.log(`✅ [AGENT-STATE] Task complete for agent ${agentId}`);

    // Update state back to available
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        agentState: 'available',
        currentTaskId: null,
        lastHeartbeat: new Date()
      }
    });

    await this.emitStateChange(agentId, 'working', 'available');

    // Process next queued message if any
    await this.processQueuedMessages(agentId);
  }

  /**
   * Queue a message for later processing
   */
  private async queueMessage(agentId: string, message: string, userId: string): Promise<void> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    const queue = (agent.messageQueue as QueuedMessage[]) || [];
    queue.push({
      id: randomUUID(),
      message,
      timestamp: new Date(),
      userId
    });

    await prisma.agents.update({
      where: { id: agentId },
      data: {
        messageQueue: queue
      }
    });

    // Notify about queued message
    if (this.io) {
      this.io.to(agent.teamId).emit('message-queued', {
        agentId,
        queuePosition: queue.length
      });
    }
  }

  /**
   * Process queued messages when agent becomes available
   */
  private async processQueuedMessages(agentId: string): Promise<void> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent || agent.agentState !== 'available') return;

    const queue = (agent.messageQueue as QueuedMessage[]) || [];

    if (queue.length === 0) return;

    // Get next message
    const nextMessage = queue.shift();

    if (!nextMessage) return;

    // Update queue in database
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        messageQueue: queue,
        agentState: 'working',
        currentTaskId: randomUUID()
      }
    });

    console.log(`📨 [AGENT-STATE] Processing queued message for agent ${agentId}`);

    // Emit event to process the message
    if (this.io) {
      this.io.to(agent.teamId).emit('process-queued-message', {
        agentId,
        message: nextMessage.message,
        userId: nextMessage.userId,
        remainingQueue: queue.length
      });
    }
  }

  /**
   * Get queue length for an agent
   */
  private async getQueueLength(agentId: string): Promise<number> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return 0;

    const queue = (agent.messageQueue as QueuedMessage[]) || [];
    return queue.length;
  }

  /**
   * Start heartbeat monitoring for an agent
   */
  private startHeartbeatMonitoring(agentId: string): void {
    // Clear existing interval if any
    this.stopHeartbeatMonitoring(agentId);

    const intervalId = setInterval(async () => {
      const agent = await prisma.agents.findUnique({
        where: { id: agentId }
      });

      if (!agent) {
        this.stopHeartbeatMonitoring(agentId);
        return;
      }

      // Check if heartbeat is stale
      if (agent.lastHeartbeat) {
        const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT && agent.agentState !== 'offline') {
          console.warn(`💔 [AGENT-STATE] Agent ${agentId} heartbeat timeout`);
          await this.updateAgentState(agentId, 'offline');
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(agentId, intervalId);
  }

  /**
   * Stop heartbeat monitoring for an agent
   */
  stopHeartbeatMonitoring(agentId: string): void {
    const intervalId = this.heartbeatIntervals.get(agentId);
    if (intervalId) {
      clearInterval(intervalId);
      this.heartbeatIntervals.delete(agentId);
    }
  }

  /**
   * Update heartbeat timestamp
   */
  async updateHeartbeat(agentId: string): Promise<void> {
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        lastHeartbeat: new Date()
      }
    });

    // If agent was offline, mark as available
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (agent && agent.agentState === 'offline' && agent.isReady) {
      await this.updateAgentState(agentId, 'available');
    }
  }

  /**
   * Validate state transitions
   */
  private isValidTransition(from: AgentState, to: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      'initializing': ['available', 'error', 'offline'],
      'available': ['working', 'offline', 'error'],
      'working': ['available', 'error', 'offline'],
      'error': ['initializing', 'available', 'offline'],
      'offline': ['initializing', 'available', 'error']
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Emit state change event via WebSocket
   */
  private async emitStateChange(agentId: string, oldState: AgentState, newState: AgentState): Promise<void> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId },
      include: { users: true }
    });

    if (!agent || !this.io) return;

    this.io.to(agent.teamId).emit('agent-state-change', {
      agentId,
      agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
      oldState,
      newState,
      isReady: agent.isReady,
      queueLength: await this.getQueueLength(agentId)
    });
  }

  /**
   * Add log entry for agent
   */
  private async addToAgentLog(agentId: string, message: string): Promise<void> {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    const updatedOutput = agent.output + `\n[SYSTEM] ${new Date().toISOString()}: ${message}`;

    await prisma.agents.update({
      where: { id: agentId },
      data: {
        output: updatedOutput
      }
    });
  }

  /**
   * Clean up agent resources
   */
  async cleanupAgent(agentId: string): Promise<void> {
    console.log(`🧹 [AGENT-STATE] Cleaning up agent ${agentId}`);

    // Stop monitoring
    this.stopHeartbeatMonitoring(agentId);

    // Clear timeouts
    const timeoutId = this.startupTimeouts.get(agentId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.startupTimeouts.delete(agentId);
    }

    // Update final state
    await prisma.agents.update({
      where: { id: agentId },
      data: {
        agentState: 'offline',
        status: 'stopped'
      }
    });
  }
}

// Export singleton instance
export const agentStateManager = new AgentStateManager();