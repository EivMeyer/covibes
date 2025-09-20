/**
 * Claude Configuration Manager
 * 
 * Manages per-user Claude configuration directories to enable isolated
 * Claude sessions with different API keys and settings per user.
 * 
 * Based on CLAUDE_CONFIG_DIR environment variable support:
 * https://github.com/anthropics/claude-code/issues/261
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { PrismaClient } from '@prisma/client';

export class ClaudeConfigManager {
  private prisma = new PrismaClient();
  private readonly CONFIG_BASE_DIR = path.join(os.homedir(), '.covibes', 'claude-configs');
  private readonly DEFAULT_CLAUDE_DIR = path.join(os.homedir(), '.claude');
  private readonly SYSTEM_PROMPT_FILE = path.join(process.cwd(), 'config', 'agent-system-prompt.txt');
  private AGENT_SYSTEM_PROMPT: string = '';

  private readonly TEAM_COORDINATION_PROMPT = `
TEAM COORDINATION:

1. CHECK: cat .covibes/active.json

2. MANDATORY REGISTER - NO EXCEPTIONS:
Step A: Find your WORKER CALLSIGN at the top of this prompt (e.g., "WORKER CALLSIGN: River Compiler")
Step B: Run this command BUT replace "YOUR_CALLSIGN_HERE" with your actual callsign and "WHAT_YOU_ARE_DOING" with your task:

python3 -c "import json; data=json.load(open('.covibes/active.json')) if open('.covibes/active.json').read().strip() else {}; data['YOUR_CALLSIGN_HERE']='WHAT_YOU_ARE_DOING'; json.dump(data,open('.covibes/active.json','w'),indent=2)"

REAL EXAMPLE: If your callsign is "River Compiler" and you're making background blue:
python3 -c "import json; data=json.load(open('.covibes/active.json')) if open('.covibes/active.json').read().strip() else {}; data['River Compiler']='making background blue'; json.dump(data,open('.covibes/active.json','w'),indent=2)"

3. MANDATORY UNREGISTER when done - NO EXCEPTIONS:
Replace "YOUR_CALLSIGN_HERE" with your actual callsign:
python3 -c "import json; data=json.load(open('.covibes/active.json')); data.pop('YOUR_CALLSIGN_HERE',None); json.dump(data,open('.covibes/active.json','w'),indent=2)"

When you see other agents working:
1. MANDATORY STOP for CONTRADICTORY tasks:
   - If agent is setting property A to value X, DON'T set property A to value Y
   - If agent is adding feature X, DON'T remove feature X
   - If agent is implementing approach A, DON'T implement conflicting approach B
   - If two tasks would overwrite each other's changes, it's CONTRADICTORY

2. ALWAYS ASK USER: "Agent [NAME] is already [TASK]. This conflicts with your request. Should I wait or do something else?"

3. NO EXCEPTIONS - Even if user asks directly, CHECK FIRST and STOP for contradictions
`;

  constructor() {
    this.ensureBaseDirectory();
    this.loadSystemPrompt();
  }

  private loadSystemPrompt(): void {
    try {
      // Load system prompt from file - required
      if (fsSync.existsSync(this.SYSTEM_PROMPT_FILE)) {
        this.AGENT_SYSTEM_PROMPT = fsSync.readFileSync(this.SYSTEM_PROMPT_FILE, 'utf-8').trim();
        console.log(`📄 Loaded agent system prompt from: ${this.SYSTEM_PROMPT_FILE}`);
      } else {
        console.error(`❌ System prompt file not found at ${this.SYSTEM_PROMPT_FILE}`);
        this.AGENT_SYSTEM_PROMPT = 'Covibes Agent Online'; // Minimal fallback
      }
    } catch (error) {
      console.error('Failed to load system prompt file:', error);
      this.AGENT_SYSTEM_PROMPT = 'Covibes Agent Online'; // Minimal fallback
    }
  }

  /**
   * Get the Claude config directory path for a user
   */
  getUserConfigDir(userId: string): string {
    return path.join(this.CONFIG_BASE_DIR, `user-${userId}`);
  }

  /**
   * Initialize Claude configuration for a user
   */
  async initializeUserConfig(userId: string, teamId?: string): Promise<string> {
    const userConfigDir = this.getUserConfigDir(userId);
    
    try {
      // Create user config directory
      await fs.mkdir(userConfigDir, { recursive: true });
      
      // Check if config already exists
      const hasExistingConfig = await this.hasValidConfig(userConfigDir);
      if (hasExistingConfig) {
        console.log(`📋 Claude config already exists for user ${userId}`);
        return userConfigDir;
      }

      // Copy default config if available
      await this.copyDefaultConfig(userConfigDir);

      // Create basic settings if none exist
      await this.createBasicSettings(userConfigDir, teamId);
      
      console.log(`✅ Initialized Claude config for user ${userId}: ${userConfigDir}`);
      return userConfigDir;
      
    } catch (error: any) {
      console.error(`Failed to initialize Claude config for user ${userId}:`, error);
      throw new Error(`Failed to initialize Claude configuration: ${error.message}`);
    }
  }

  /**
   * Check if user has valid Claude configuration
   */
  async hasValidConfig(userConfigDir: string): Promise<boolean> {
    try {
      // Check for essential files
      const credentialsPath = path.join(userConfigDir, '.credentials.json');
      const settingsPath = path.join(userConfigDir, 'settings.json');
      
      const [credentialsExists, settingsExists] = await Promise.all([
        this.fileExists(credentialsPath),
        this.fileExists(settingsPath)
      ]);
      
      return credentialsExists || settingsExists;
    } catch {
      return false;
    }
  }

  /**
   * Get Claude configuration status for a user
   */
  async getUserConfigStatus(userId: string): Promise<{
    configDir: string;
    exists: boolean;
    hasCredentials: boolean;
    hasSettings: boolean;
  }> {
    const userConfigDir = this.getUserConfigDir(userId);
    const credentialsPath = path.join(userConfigDir, '.credentials.json');
    const settingsPath = path.join(userConfigDir, 'settings.json');
    
    const [dirExists, hasCredentials, hasSettings] = await Promise.all([
      this.fileExists(userConfigDir),
      this.fileExists(credentialsPath),
      this.fileExists(settingsPath)
    ]);
    
    return {
      configDir: userConfigDir,
      exists: dirExists,
      hasCredentials,
      hasSettings
    };
  }

  /**
   * Update user's Claude configuration
   */
  async updateUserConfig(userId: string, config: {
    apiKey?: string;
    settings?: Record<string, any>;
  }): Promise<void> {
    const userConfigDir = this.getUserConfigDir(userId);
    await fs.mkdir(userConfigDir, { recursive: true });
    
    try {
      // Update credentials if provided
      if (config.apiKey) {
        const credentialsPath = path.join(userConfigDir, '.credentials.json');
        const credentials = {
          apiKey: config.apiKey,
          updatedAt: new Date().toISOString()
        };
        await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
        console.log(`🔑 Updated Claude credentials for user ${userId}`);
      }
      
      // Update settings if provided
      if (config.settings) {
        const settingsPath = path.join(userConfigDir, 'settings.json');
        const existingSettings = await this.loadJsonFile(settingsPath).catch(() => ({}));
        const mergedSettings = { ...existingSettings, ...config.settings };
        await fs.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));
        console.log(`⚙️ Updated Claude settings for user ${userId}`);
      }
      
    } catch (error: any) {
      console.error(`Failed to update Claude config for user ${userId}:`, error);
      throw new Error(`Failed to update Claude configuration: ${error.message}`);
    }
  }

  /**
   * Remove user's Claude configuration
   */
  async removeUserConfig(userId: string): Promise<void> {
    const userConfigDir = this.getUserConfigDir(userId);
    
    try {
      await fs.rm(userConfigDir, { recursive: true, force: true });
      console.log(`🗑️ Removed Claude config for user ${userId}`);
    } catch (error: any) {
      console.warn(`Warning: Could not remove config for user ${userId}:`, error.message);
    }
  }

  /**
   * Get environment variables for Claude execution
   */
  getClaudeEnvironment(userId: string): Record<string, string> {
    const userConfigDir = this.getUserConfigDir(userId);
    
    return {
      CLAUDE_CONFIG_DIR: userConfigDir,
      // Ensure Claude has access to standard paths
      PATH: process.env['PATH'] || '',
      HOME: process.env['HOME'] || os.homedir(),
      USER: process.env['USER'] || 'developer'
      // Note: No ANTHROPIC_API_KEY - let Claude prompt user for their own key
    };
  }

  /**
   * Build Claude command with proper configuration
   */
  async buildClaudeCommand(userId: string, options: {
    task?: string;
    teamId?: string;
    skipPermissions?: boolean;
    interactive?: boolean;
    appendSystemPrompt?: boolean | string;
    agentName?: string;
    mode?: 'terminal' | 'chat';
    sessionId?: string;
  } = {}): Promise<{ command: string; args: string[]; env: Record<string, string> }> {
    const command = 'claude';
    const args: string[] = [];

    // Add print mode for chat agents
    if (options.mode === 'chat') {
      args.push('--print');
      args.push('--output-format', 'text');

      // Add session ID for conversation continuity
      if (options.sessionId) {
        args.push('--session-id', options.sessionId);
      }
    }

    // Add dangerous skip permissions flag for sandbox safety
    if (options.skipPermissions !== false) {
      args.push('--dangerously-skip-permissions');
    }

    // Add task if provided (but not for chat mode with --print, since we send via stdin)
    if (options.task && options.task.trim() && options.mode !== 'chat') {
      args.push(options.task.trim());
    }

    // Add system prompt for agent guidelines
    if (options.appendSystemPrompt) {
      // Reload system prompt from file to pick up any changes
      this.loadSystemPrompt();

      let systemPrompt = typeof options.appendSystemPrompt === 'string'
        ? options.appendSystemPrompt
        : this.AGENT_SYSTEM_PROMPT;

      // Check if context sharing is enabled for the team
      if (options.teamId) {
        try {
          const team = await this.prisma.teams.findUnique({
            where: { id: options.teamId },
            select: { enableContextSharing: true }
          });

          // ADD the TEAM COORDINATION section when context sharing is enabled
          if (team && team.enableContextSharing) {
            // Find the position to insert the coordination section
            // Insert it after the FULL-STACK DEVELOPMENT APPROACH section
            const lines = systemPrompt.split('\n');
            const insertIndex = lines.findIndex(line =>
              line.includes('THEN IMPLEMENT BACKEND')
            );

            if (insertIndex !== -1) {
              // Insert the TEAM COORDINATION section after the current section
              lines.splice(insertIndex + 1, 0, '', this.TEAM_COORDINATION_PROMPT);
              systemPrompt = lines.join('\n');
              console.log('✅ Context sharing enabled - added TEAM COORDINATION section to system prompt');
            } else {
              // Fallback: append to the end if we can't find the insertion point
              systemPrompt = systemPrompt + '\n' + this.TEAM_COORDINATION_PROMPT;
              console.log('✅ Context sharing enabled - appended TEAM COORDINATION section to system prompt');
            }
          } else {
            console.log('🚫 Context sharing disabled - TEAM COORDINATION section not included');
          }
        } catch (error) {
          console.error('Failed to check context sharing setting:', error);
          // Default to NOT including the coordination section if we can't check
          console.log('⚠️ Could not verify context sharing setting - TEAM COORDINATION section not included');
        }
      }

      // Inject worker callsign if provided
      console.log(`🔍 buildClaudeCommand received agentName: ${options.agentName}`);
      if (options.agentName) {
        systemPrompt = `WORKER CALLSIGN: ${options.agentName}

${systemPrompt}`;
        console.log(`✅ Injected WORKER CALLSIGN: ${options.agentName} into system prompt`);
      }

      // Add template context if teamId provided
      if (options.teamId) {
        const templateContext = `
WORKSPACE TEMPLATE STRUCTURE:
- Frontend: React + Vite on port 5173 (dev server with HMR)
- Backend: Express on port 3002
- Database: PostgreSQL (team-isolated: preview_${options.teamId.replace(/-/g, '_')})
- Main files: /src/App.jsx, /server.js, /package.json, /vite.config.js
- Build system: Vite bundler
- Workspace path: /home/ubuntu/.covibes/workspaces/${options.teamId}/
- Package manager: npm

DEVELOPMENT COMMANDS:
- Frontend dev: npm run dev (runs on port 5173)
- Backend: npm run server (runs on port 3002)
- Full stack: npm run dev:fullstack (runs both)
`;
        systemPrompt = templateContext + '\n' + systemPrompt;
      }

      args.push('--append-system-prompt', systemPrompt);
    }

    // Get user environment
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([_key, value]) => value !== undefined
        ) as [string, string][]
      ),
      ...this.getClaudeEnvironment(userId)
    };
    
    return { command, args, env };
  }

  // Private helper methods

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.CONFIG_BASE_DIR, { recursive: true });
      console.log(`📁 Claude config base directory: ${this.CONFIG_BASE_DIR}`);
    } catch (error: any) {
      console.error('Failed to create Claude config base directory:', error);
    }
  }

  private async copyDefaultConfig(userConfigDir: string): Promise<void> {
    try {
      // Check if user has a default Claude config to copy from
      const defaultConfigExists = await this.fileExists(this.DEFAULT_CLAUDE_DIR);
      if (!defaultConfigExists) {
        console.log('📋 No default Claude config found, will create basic config');
        return;
      }

      // Copy essential files from default config (but NOT settings.json - use workspace settings instead)
      const filesToCopy = ['.credentials.json', 'CLAUDE.md'];

      for (const fileName of filesToCopy) {
        const srcPath = path.join(this.DEFAULT_CLAUDE_DIR, fileName);
        const destPath = path.join(userConfigDir, fileName);

        try {
          await fs.copyFile(srcPath, destPath);
          console.log(`📋 Copied ${fileName} to user config`);
        } catch {
          // File doesn't exist in default config, skip
          console.log(`📋 Skipped ${fileName} (not found in default config)`);
        }
      }
      
    } catch (error: any) {
      console.warn('Warning: Could not copy default Claude config:', error.message);
    }
  }

  private async createBasicSettings(userConfigDir: string, teamId?: string): Promise<void> {
    const settingsPath = path.join(userConfigDir, 'settings.json');

    // Only create if settings don't exist
    const settingsExist = await this.fileExists(settingsPath);
    if (settingsExist) {
      return;
    }

    // Check team's context sharing setting
    let enableContextSharing = true; // Default to true
    if (teamId) {
      try {
        const team = await this.prisma.teams.findUnique({
          where: { id: teamId },
          select: { enableContextSharing: true }
        });
        if (team) {
          enableContextSharing = team.enableContextSharing;
        }
      } catch (error) {
        console.warn('Could not fetch team settings, using default:', error);
      }
    }

    const basicSettings: any = {
      "version": "1.0",
      "createdBy": "Covibes",
      "createdAt": new Date().toISOString(),
      "allowDangerousCommands": true,
      "allowSudo": true,  // Enable sudo for customer-owned VMs
      "allowSystemPackages": true,  // Allow apt-get, npm -g, etc.
      "sandbox": {
        "enabled": false,  // Disable sandbox for full permissions
        "skipPermissions": true
      }
    };

    // Only add context sharing hooks if enabled
    if (enableContextSharing) {
      basicSettings.hooks = {
        "UserPromptSubmit": [{
          "hooks": [{
            "type": "command",
            "command": "cat .covibes/active.json 2>/dev/null | jq -r 'to_entries | map(\"\\(.key): \\(.value)\") | \"Team activity: \" + join(\" | \")' || echo ''"
          }]
        }],
        "Stop": [{
          "hooks": [{
            "type": "command",
            "command": "jq 'del(.\"'$USER'-'$$'\")' .covibes/active.json > tmp && mv tmp .covibes/active.json 2>/dev/null || true"
          }]
        }]
      };
    }

    try {
      await fs.writeFile(settingsPath, JSON.stringify(basicSettings, null, 2));
      console.log(`⚙️ Created basic Claude settings with team coordination hooks`);
    } catch (error: any) {
      console.warn('Warning: Could not create basic settings:', error.message);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadJsonFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
}

// Export singleton instance
export const claudeConfigManager = new ClaudeConfigManager();
