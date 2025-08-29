/**
 * Docker Manager Compatibility Shim
 *
 * Temporary compatibility layer that preserves the old dockerManager interface
 * while transitioning to the new terminal manager factory system.
 *
 * This allows existing code to continue working while we gradually migrate.
 */
import { EventEmitter } from 'events';
import { terminalManagerFactory } from './terminal-manager-factory.js';
class DockerManagerCompat extends EventEmitter {
    constructor() {
        super();
        console.log('🔄 DockerManager compatibility shim active');
        // Forward events from terminal manager factory
        terminalManagerFactory.on('terminal-ready', (session) => {
            this.emit('pty-ready', { agentId: session.agentId, ptyProcess: session.process });
        });
        terminalManagerFactory.on('terminal-data', (agentId, data) => {
            this.emit('pty-data', { agentId, data, timestamp: Date.now() });
        });
        terminalManagerFactory.on('terminal-exit', (agentId, code, signal) => {
            this.emit('pty-exit', { agentId, code, signal });
        });
        terminalManagerFactory.on('terminal-error', (agentId, error) => {
            this.emit('pty-error', { agentId, error });
        });
    }
    // Compatibility methods that delegate to terminal manager factory
    async spawnAgentInContainer(options) {
        const terminalOptions = {
            agentId: options.agentId,
            userId: options.userId,
            teamId: options.teamId,
            task: options.task,
            location: 'local', // Default to local for backward compatibility
            isolation: 'docker', // This was always Docker before
            workspaceRepo: options.workspaceRepo
        };
        const manager = terminalManagerFactory.getManagerForAgent(terminalOptions);
        const session = await manager.spawnTerminal(terminalOptions);
        // Return in expected format
        return {
            container: {
                id: session.agentId,
                containerId: session.containerId,
                type: 'user-claude-agent',
                status: session.status,
                teamId: options.teamId,
                userId: options.userId,
                metadata: session.metadata
            },
            sessionId: `agent-${session.agentId}-pty`
        };
    }
    getPTYProcess(agentId) {
        const session = terminalManagerFactory.getSession(agentId);
        return session?.process || null;
    }
    getPTYSessionInfo(agentId) {
        const session = terminalManagerFactory.getSession(agentId);
        if (!session)
            return null;
        return {
            agentId: session.agentId,
            containerId: session.containerId,
            ptyProcess: session.process,
            status: session.status,
            createdAt: session.createdAt
        };
    }
    getPTYOutputBuffer(agentId) {
        // This was used for late-joining clients
        // For now, return empty string - real implementation would need buffer
        return '';
    }
    writeToPTY(agentId, data) {
        return terminalManagerFactory.sendInput(agentId, data);
    }
    resizePTY(agentId, cols, rows) {
        return terminalManagerFactory.resizeTerminal(agentId, cols, rows);
    }
    // Placeholder methods for container management (not used in new simple PTY mode)
    async getContainerStatus(containerId) {
        return null;
    }
    async execCommand(containerId, command) {
        return { stdout: '', stderr: 'Command execution not supported in compatibility mode' };
    }
    async stopContainer(containerId) {
        // Find agent by container ID and kill terminal
        const sessions = terminalManagerFactory.getAllSessions();
        const session = sessions.find(s => s.containerId === containerId);
        if (session) {
            terminalManagerFactory.killTerminal(session.agentId);
        }
    }
    async getTeamContainers(teamId) {
        // Return empty array for now
        return [];
    }
    cleanupStoppedContainers() {
        // Delegate to factory cleanup
        terminalManagerFactory.getAllSessions().forEach(session => {
            if (session.status === 'stopped' || session.status === 'error') {
                terminalManagerFactory.killTerminal(session.agentId);
            }
        });
    }
    cleanupInactivePTYSessions() {
        // Delegate to individual manager cleanup
        const managers = ['local-none', 'local-docker'];
        managers.forEach(key => {
            try {
                const manager = terminalManagerFactory.getManager('local', key.includes('docker') ? 'docker' : 'none');
                manager.cleanup();
            }
            catch (error) {
                // Ignore - manager might not exist yet
            }
        });
    }
    async buildAgentImage() {
        console.log('🏗️ Docker image building skipped in compatibility mode');
    }
}
// Export compatibility instance
export const dockerManager = new DockerManagerCompat();
