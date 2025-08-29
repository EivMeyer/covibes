/**
 * Screen PTY Manager
 *
 * Uses GNU Screen for persistent sessions with better ANSI sequence handling than tmux
 * Screen is simpler and has less terminal emulation interference
 */
import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class ScreenPtyManager extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.SESSION_PREFIX = 'colabvibe_';
        console.log('🖥️  ScreenPtyManager initialized (GNU Screen for persistent sessions)');
    }
    async spawnTerminal(options) {
        const sessionName = `${this.SESSION_PREFIX}${options.agentId.substring(0, 8)}`;
        try {
            // Check if screen session exists
            const { stdout } = await execAsync('screen -ls');
            const sessionExists = stdout.includes(sessionName);
            const workspaceDir = path.join(os.homedir(), '.colabvibes', options.teamId);
            // Ensure workspace exists
            await execAsync(`mkdir -p ${workspaceDir}`);
            let ptyProcess;
            if (!sessionExists) {
                console.log(`Creating new screen session: ${sessionName}`);
                // Create new screen session and immediately attach
                // -D -m: Start in detached mode and create new session
                // -S: Session name
                // -T: Terminal type
                // -a: Force all capabilities
                ptyProcess = pty.spawn('screen', [
                    '-D', '-m', // Detached mode, create new
                    '-S', sessionName, // Session name
                    '-T', 'xterm-256color', // Terminal type
                    '-a', // All capabilities
                    '-A', // Adapt window size
                ], {
                    name: 'xterm-256color',
                    cols: 80,
                    rows: 24,
                    cwd: workspaceDir,
                    env: {
                        ...process.env,
                        TERM: 'xterm-256color',
                        SCREENDIR: '/tmp', // Use /tmp for screen sockets
                        SHELL: '/bin/bash'
                    }
                });
                // Send initial Claude command if task provided
                if (options.task) {
                    setTimeout(() => {
                        const claudeCmd = `claude "${options.task.replace(/"/g, '\\"')}"\\r`;
                        ptyProcess.write(claudeCmd);
                    }, 500);
                }
            }
            else {
                console.log(`Reattaching to existing screen session: ${sessionName}`);
                // Reattach to existing session
                // -r: Reattach
                // -x: Multi-attach mode (allows multiple connections)
                ptyProcess = pty.spawn('screen', [
                    '-r', sessionName, // Reattach
                    '-x', // Multi-attach mode
                ], {
                    name: 'xterm-256color',
                    cols: 80,
                    rows: 24,
                    cwd: workspaceDir,
                    env: {
                        ...process.env,
                        TERM: 'xterm-256color',
                        SCREENDIR: '/tmp'
                    }
                });
            }
            const session = {
                agentId: options.agentId,
                location: 'local',
                isolation: 'none', // Screen provides isolation but acts like direct PTY
                process: ptyProcess,
                status: 'running',
                createdAt: new Date(),
                metadata: {
                    sessionName,
                    manager: 'screen'
                }
            };
            this.sessions.set(options.agentId, session);
            this.setupPtyEventHandlers(options.agentId, ptyProcess);
            this.emit('terminal-ready', session);
            console.log(`✅ Screen session ready: ${sessionName}`);
            return session;
        }
        catch (error) {
            throw new Error(`Failed to spawn screen terminal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    setupPtyEventHandlers(agentId, ptyProcess) {
        ptyProcess.onData((data) => {
            // Screen passes through ANSI sequences more faithfully than tmux
            this.emit('terminal-data', agentId, data);
        });
        ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`Screen PTY exited for agent ${agentId}: code=${exitCode}, signal=${signal}`);
            const session = this.sessions.get(agentId);
            if (session) {
                session.status = 'stopped';
            }
            this.emit('terminal-exit', agentId, exitCode, signal?.toString());
        });
    }
    sendInput(agentId, data) {
        const session = this.sessions.get(agentId);
        if (session?.process && session.status === 'running') {
            session.process.write(data);
            return true;
        }
        return false;
    }
    resizeTerminal(agentId, cols, rows) {
        const session = this.sessions.get(agentId);
        if (session?.process && session.status === 'running') {
            session.process.resize(cols, rows);
            // Also tell screen about the resize
            // Screen will adapt automatically when PTY resizes
            return true;
        }
        return false;
    }
    killTerminal(agentId) {
        const session = this.sessions.get(agentId);
        if (session) {
            try {
                // Quit the screen session
                if (session.metadata?.['sessionName']) {
                    exec(`screen -S ${session.metadata['sessionName']} -X quit`, () => { });
                }
                // Kill the PTY process
                if (session.process) {
                    session.process.kill();
                }
                session.status = 'stopped';
                this.sessions.delete(agentId);
                console.log(`💀 Killed screen session for agent: ${agentId}`);
                return true;
            }
            catch (error) {
                console.error(`Error killing screen terminal for agent ${agentId}:`, error);
                return false;
            }
        }
        return false;
    }
    getSession(agentId) {
        return this.sessions.get(agentId) || null;
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'running');
    }
    isReady(agentId) {
        const session = this.sessions.get(agentId);
        return session?.status === 'running' && !!session.process;
    }
    async cleanup() {
        // Clean up all sessions
        const agentIds = Array.from(this.sessions.keys());
        for (const agentId of agentIds) {
            this.killTerminal(agentId);
        }
        // Clean up orphaned screen sessions
        try {
            const { stdout } = await execAsync('screen -ls');
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes(this.SESSION_PREFIX)) {
                    const match = line.match(/(\S+)\s+\(Detached\)/);
                    if (match) {
                        console.log(`Cleaning up orphaned screen session: ${match[1]}`);
                        await execAsync(`screen -S ${match[1]} -X quit`).catch(() => { });
                    }
                }
            }
        }
        catch (error) {
            // Screen might not be installed or no sessions exist
        }
    }
}
