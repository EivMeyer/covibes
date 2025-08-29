import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
const prisma = new PrismaClient();
class AgentChatService {
    constructor() {
        this.io = null;
    }
    setSocketServer(io) {
        this.io = io;
    }
    async sendAgentMessage(data) {
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
                this.io.to(data.teamId).emit('chat-message', messageData);
            }
            return message;
        }
        catch (error) {
            console.error('Error sending agent message:', error);
            throw error;
        }
    }
    // Helper methods for common agent messages
    async sendAgentStartMessage(agentId, task) {
        const agent = await prisma.agents.findUnique({
            where: { id: agentId }
        });
        if (!agent)
            return;
        await this.sendAgentMessage({
            agentId,
            agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
            message: `🚀 Starting task: ${task}`,
            teamId: agent.teamId,
            type: 'info'
        });
    }
    async sendAgentProgressMessage(agentId, progress) {
        const agent = await prisma.agents.findUnique({
            where: { id: agentId }
        });
        if (!agent)
            return;
        await this.sendAgentMessage({
            agentId,
            agentName: agent.agentName || `Agent ${agentId.slice(-6)}`,
            message: `⚡ ${progress}`,
            teamId: agent.teamId,
            type: 'progress'
        });
    }
    async sendAgentCompletedMessage(agentId, summary) {
        const agent = await prisma.agents.findUnique({
            where: { id: agentId }
        });
        if (!agent)
            return;
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
    async sendAgentErrorMessage(agentId, error) {
        const agent = await prisma.agents.findUnique({
            where: { id: agentId }
        });
        if (!agent)
            return;
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
