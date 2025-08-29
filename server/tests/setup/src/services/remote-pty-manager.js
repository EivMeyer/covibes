/**
 * Remote PTY Manager (PLACEHOLDER)
 *
 * SSH-based terminal manager for remote VMs without Docker.
 * Currently not implemented - remote server is down.
 */
import { EventEmitter } from 'events';
export class RemotePtyManager extends EventEmitter {
    constructor() {
        super();
        console.log('🌐 RemotePtyManager initialized (PLACEHOLDER - remote disabled)');
    }
    async spawnTerminal(options) {
        const errorMsg = 'Remote terminals are currently disabled (server down)';
        console.error(`❌ ${errorMsg}`);
        const failedSession = {
            agentId: options.agentId,
            location: 'remote',
            isolation: 'none',
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
