/**
 * Terminal Manager Factory
 *
 * Creates appropriate terminal manager based on configuration:
 * - Local + None: LocalPtyManager (simple local PTY)
 * - Local + Docker: LocalDockerManager (existing Docker implementation)
 * - Remote + None: RemotePtyManager (SSH without Docker)
 * - Remote + Docker: RemoteDockerManager (Docker on VM)
 */
import { EventEmitter } from 'events';
import { LocalPtyManager } from './local-pty-manager.js';
import { TmuxPtyManager } from './tmux-pty-manager.js';
import { ScreenPtyManager } from './screen-pty-manager.js';
import { LocalDockerManager } from './local-docker-manager.js';
import { RemotePtyManager } from './remote-pty-manager.js';
import { RemoteDockerManager } from './remote-docker-manager.js';
export class TerminalManagerFactory extends EventEmitter {
    constructor() {
        super();
        this.managers = new Map();
        this.setupCleanupInterval();
    }
    static getInstance() {
        if (!TerminalManagerFactory.instance) {
            TerminalManagerFactory.instance = new TerminalManagerFactory();
        }
        return TerminalManagerFactory.instance;
    }
    /**
     * Get or create appropriate terminal manager for given configuration
     */
    getManager(location, isolation) {
        const key = `${location}-${isolation}`;
        if (this.managers.has(key)) {
            return this.managers.get(key);
        }
        console.log(`🏭 Creating terminal manager: ${key}`);
        let manager;
        if (location === 'local' && isolation === 'none') {
            manager = new LocalPtyManager();
        }
        else if (location === 'local' && isolation === 'tmux') {
            manager = new TmuxPtyManager();
        }
        else if (location === 'local' && isolation === 'screen') {
            manager = new ScreenPtyManager();
        }
        else if (location === 'local' && isolation === 'docker') {
            manager = new LocalDockerManager();
        }
        else if (location === 'remote' && isolation === 'none') {
            manager = new RemotePtyManager();
        }
        else if (location === 'remote' && isolation === 'docker') {
            manager = new RemoteDockerManager();
        }
        else {
            throw new Error(`Unsupported terminal configuration: ${location} + ${isolation}`);
        }
        // Forward events from manager to factory
        this.setupManagerEventForwarding(manager);
        this.managers.set(key, manager);
        return manager;
    }
    /**
     * Get appropriate manager for an agent based on options
     */
    getManagerForAgent(options) {
        return this.getManager(options.location, options.isolation);
    }
    /**
     * Get session from any manager by agent ID
     */
    getSession(agentId) {
        for (const manager of this.managers.values()) {
            const session = manager.getSession(agentId);
            if (session) {
                return session;
            }
        }
        return null;
    }
    /**
     * Send input to appropriate manager
     */
    sendInput(agentId, data) {
        for (const manager of this.managers.values()) {
            if (manager.getSession(agentId)) {
                return manager.sendInput(agentId, data);
            }
        }
        return false;
    }
    /**
     * Resize terminal in appropriate manager
     */
    resizeTerminal(agentId, cols, rows) {
        for (const manager of this.managers.values()) {
            if (manager.getSession(agentId)) {
                return manager.resizeTerminal(agentId, cols, rows);
            }
        }
        return false;
    }
    /**
     * Kill terminal in appropriate manager
     */
    killTerminal(agentId) {
        for (const manager of this.managers.values()) {
            if (manager.getSession(agentId)) {
                return manager.killTerminal(agentId);
            }
        }
        return false;
    }
    /**
     * Get all active sessions across all managers
     */
    getAllSessions() {
        const allSessions = [];
        for (const manager of this.managers.values()) {
            allSessions.push(...manager.getActiveSessions());
        }
        return allSessions;
    }
    /**
     * Get statistics about terminal usage
     */
    getStats() {
        const stats = {
            totalManagers: this.managers.size,
            managerTypes: Array.from(this.managers.keys()),
            totalSessions: 0,
            sessionsByType: {}
        };
        for (const [key, manager] of this.managers) {
            const sessions = manager.getActiveSessions();
            stats.totalSessions += sessions.length;
            stats.sessionsByType[key] = sessions.length;
        }
        return stats;
    }
    /**
     * Setup event forwarding from manager to factory
     */
    setupManagerEventForwarding(manager) {
        // Type assertion to treat manager as EventEmitter
        const emitter = manager;
        if (emitter.on && typeof emitter.on === 'function') {
            emitter.on('terminal-ready', (session) => {
                this.emit('terminal-ready', session);
            });
            emitter.on('terminal-data', (agentId, data) => {
                this.emit('terminal-data', agentId, data);
            });
            emitter.on('terminal-exit', (agentId, code, signal) => {
                this.emit('terminal-exit', agentId, code, signal);
            });
            emitter.on('terminal-error', (agentId, error) => {
                this.emit('terminal-error', agentId, error);
            });
        }
    }
    /**
     * Periodic cleanup of inactive sessions
     */
    setupCleanupInterval() {
        setInterval(() => {
            for (const manager of this.managers.values()) {
                try {
                    manager.cleanup();
                }
                catch (error) {
                    console.error('Error during manager cleanup:', error);
                }
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    /**
     * Shutdown all managers and cleanup resources
     */
    shutdown() {
        console.log('🛑 Shutting down terminal manager factory');
        for (const [key, manager] of this.managers) {
            try {
                // Kill all sessions in this manager
                const sessions = manager.getActiveSessions();
                for (const session of sessions) {
                    manager.killTerminal(session.agentId);
                }
                console.log(`✅ Cleaned up ${sessions.length} sessions from ${key} manager`);
            }
            catch (error) {
                console.error(`Error cleaning up ${key} manager:`, error);
            }
        }
        this.managers.clear();
    }
}
// Export singleton instance
export const terminalManagerFactory = TerminalManagerFactory.getInstance();
