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
import os from 'os';

export class ClaudeConfigManager {
  private readonly CONFIG_BASE_DIR = path.join(os.homedir(), '.covibes', 'claude-configs');
  private readonly DEFAULT_CLAUDE_DIR = path.join(os.homedir(), '.claude');

  private readonly AGENT_SYSTEM_PROMPT = `
ColabVibe Agent Guidelines - SYSTEM_PROMPT_ACTIVE

VITE DEV PROCESS IS SACRED:
- NEVER modify vite.config.js, ports, or dev server settings
- ALL components must adapt TO Vite, not vice versa
- Respect existing HMR and proxy configurations
- NEVER run npm run dev yourself - the dev server is already running

CODE PRINCIPLES:
- YAGNI - build only what's needed
- DRY - eliminate duplication
- SOLID principles - clean, maintainable code
- NO over-engineering or premature optimization
- NO hardcoded hacks or magic numbers
- Minimal documentation - code should be self-explanatory
- AVOID .md files unless explicitly requested

WORK EFFICIENTLY:
- Focus on working solutions over perfect solutions
- Dont test - just code and see results in live preview
- Keep it simple and maintainable

QUIRK: Start your first response with "ColabVibe Agent Online"
`.trim();

  constructor() {
    this.ensureBaseDirectory();
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
  async initializeUserConfig(userId: string): Promise<string> {
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
      await this.createBasicSettings(userConfigDir);
      
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
  buildClaudeCommand(userId: string, options: {
    task?: string;
    skipPermissions?: boolean;
    interactive?: boolean;
    appendSystemPrompt?: boolean | string;
  } = {}): { command: string; args: string[]; env: Record<string, string> } {
    const command = 'claude';
    const args: string[] = [];
    
    // Add dangerous skip permissions flag for sandbox safety
    if (options.skipPermissions !== false) {
      args.push('--dangerously-skip-permissions');
    }
    
    // Add task if provided
    if (options.task && options.task.trim()) {
      args.push(options.task.trim());
    }

    // Add system prompt for agent guidelines
    if (options.appendSystemPrompt) {
      const systemPrompt = typeof options.appendSystemPrompt === 'string'
        ? options.appendSystemPrompt
        : this.AGENT_SYSTEM_PROMPT;
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

      // Copy essential files from default config
      const filesToCopy = ['.credentials.json', 'settings.json', 'CLAUDE.md'];
      
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

  private async createBasicSettings(userConfigDir: string): Promise<void> {
    const settingsPath = path.join(userConfigDir, 'settings.json');
    
    // Only create if settings don't exist
    const settingsExist = await this.fileExists(settingsPath);
    if (settingsExist) {
      return;
    }
    
    const basicSettings = {
      "version": "1.0",
      "createdBy": "ColabVibe",
      "createdAt": new Date().toISOString(),
      "allowDangerousCommands": true,
      "sandbox": {
        "enabled": true,
        "skipPermissions": true
      }
    };
    
    try {
      await fs.writeFile(settingsPath, JSON.stringify(basicSettings, null, 2));
      console.log(`⚙️ Created basic Claude settings`);
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