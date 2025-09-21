import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface AgentChatMessage {
  agentId: string;
  agentName: string;
  message: string;
  teamId: string;
  type: 'info' | 'success' | 'error' | 'progress';
}

class AgentChatService {
  private io: SocketIOServer | null = null;

  setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  async sendAgentMessage(data: AgentChatMessage) {
    try {
      // Get agent details
      const agent = await prisma.agents.findUnique({
        where: { id: data.agentId },
        include: { users: true }
      });

      if (!agent) {
        throw new Error('Agent not found');
      }

      // Save message to database with agent indicator
      const message = await prisma.messages.create({
        data: {
          id: randomUUID(),
          content: `[AGENT:${data.agentName}:${data.type}] ${data.message}`,
          userId: agent.userId,
          teamId: data.teamId
        }
      });

      // Broadcast to team via WebSocket
      if (this.io) {
        const messageData = {
          id: message.id,
          userId: `agent-${agent.id}`, // Use special agent userId format
          user: {
            userName: data.agentName
          },
          content: data.message,
          createdAt: message.createdAt.toISOString(),
          teamId: data.teamId,
          isAgent: true,
          agentId: agent.id,
          agentType: agent.type,
          messageType: data.type,
          type: 'agent' // Explicitly set message type
        };

        // Emit agent-specific message event instead of general chat-message
        // This prevents agents from posting to the team chat
        this.io.to(data.teamId).emit('agent-message', messageData);
      }

      return message;
    } catch (error) {
      console.error('Error sending agent message:', error);
      throw error;
    }
  }

  // Helper methods for common agent messages
  async sendAgentStartMessage(agentId: string, task: string) {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    await this.sendAgentMessage({
      agentId,
      agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
      message: `🚀 Starting task: ${task}`,
      teamId: agent.teamId,
      type: 'info'
    });
  }

  async sendAgentProgressMessage(agentId: string, progress: string) {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    await this.sendAgentMessage({
      agentId,
      agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
      message: `⚡ ${progress}`,
      teamId: agent.teamId,
      type: 'progress'
    });
  }

  async sendAgentCompletedMessage(agentId: string, summary?: string) {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    const message = summary 
      ? `✅ Task completed: ${summary}`
      : '✅ Task completed successfully!';

    await this.sendAgentMessage({
      agentId,
      agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
      message,
      teamId: agent.teamId,
      type: 'success'
    });
  }

  async sendAgentErrorMessage(agentId: string, error: string) {
    const agent = await prisma.agents.findUnique({
      where: { id: agentId }
    });

    if (!agent) return;

    await this.sendAgentMessage({
      agentId,
      agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
      message: `❌ Error: ${error}`,
      teamId: agent.teamId,
      type: 'error'
    });
  }
}

export const agentChatService = new AgentChatService();