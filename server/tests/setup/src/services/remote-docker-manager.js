/**
 * Remote Docker Manager (PLACEHOLDER)
 *
 * Docker container manager for remote VMs.
 * Currently not implemented - remote server is down.
 */
import { EventEmitter } from 'events';
export class RemoteDockerManager extends EventEmitter {
    constructor() {
        super();
        console.log('🌐🐳 RemoteDockerManager initialized (PLACEHOLDER - remote disabled)');
    }
    async spawnTerminal(options) {
        const errorMsg = 'Remote Docker terminals are currently disabled (server down)';
        console.error(`❌ ${errorMsg}`);
        const failedSession = {
            agentId: options.agentId,
            location: 'remote',
            isolation: 'docker',
            status: 'error',
            createdAt: new Date(),
            metadata: { error: errorMsg }
        };
        this.emit('terminal-error', options.agentId, errorMsg);
        throw new Error(errorMsg);
    }
    sendInput(agentId, data) {
        return false;
    }
    resizeTerminal(agentId, cols, rows) {
        return false;
    }
    killTerminal(agentId) {
        return false;
    }
    getSession(agentId) {
        return null;
    }
    getActiveSessions() {
        return [];
    }
    isReady(agentId) {
        return false;
    }
    cleanup() {
        // No-op
    }
}
