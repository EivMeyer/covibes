#!/usr/bin/env node
/**
 * Preview Service Docker Integration
 * 
 * Bridges the existing preview service with the new Docker-based preview system.
 * Handles dynamic Dockerfile generation and container orchestration for preview instances.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const config = {
    dockerDir: path.join(__dirname, '..'),
    workspaceBase: process.env.WORKSPACE_BASE || require('os').homedir() + '/.covibes/workspaces',
    generatedDir: path.join(__dirname, '..', 'generated'),
    previewServicePath: path.join(__dirname, '../../server/services/preview-service.ts')
};

// Logging utility
const log = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        service: 'preview-docker-integration',
        message,
        ...data
    }));
};

/**
 * Project type detection (enhanced version of preview service logic)
 */
async function detectProjectType(projectDir) {
    try {
        // Check for package.json (Node.js projects)
        const packageJsonPath = path.join(projectDir, 'package.json');
        try {
            const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            // Enhanced detection logic
            if (deps.next) {
                return {
                    type: 'nextjs',
                    dockerfile: 'Dockerfile.nextjs',
                    defaultPort: 3000,
                    envPort: 'PORT'
                };
            }
            
            if (deps.react || deps.vite) {
                return {
                    type: 'react',
                    dockerfile: 'Dockerfile.react',
                    defaultPort: 5173,
                    envPort: 'VITE_PORT'
                };
            }
            
            if (deps.vue) {
                return {
                    type: 'vue',
                    dockerfile: 'Dockerfile.react', // Vue can use same setup as React
                    defaultPort: 8080,
                    envPort: 'PORT'
                };
            }
            
            // Generic Node.js
            return {
                type: 'node',
                dockerfile: 'Dockerfile.node',
                defaultPort: 3000,
                envPort: 'PORT'
            };
        } catch (error) {
            // package.json not found or invalid, continue detection
        }
        
        // Python projects
        try {
            await fs.access(path.join(projectDir, 'requirements.txt'));
            return {
                type: 'python',
                dockerfile: 'Dockerfile.python',
                defaultPort: 8000,
                envPort: 'PORT'
            };
        } catch {}
        
        // Check for Django
        try {
            const files = await fs.readdir(projectDir);
            if (files.includes('manage.py')) {
                return {
                    type: 'python',
                    dockerfile: 'Dockerfile.python',
                    defaultPort: 8000,
                    envPort: 'PORT'
                };
            }
        } catch {}
        
        // Static HTML
        try {
            await fs.access(path.join(projectDir, 'index.html'));
            return {
                type: 'static',
                dockerfile: 'Dockerfile.static',
                defaultPort: 8080,
                envPort: 'PORT'
            };
        } catch {}
        
        // Default to static
        return {
            type: 'static',
            dockerfile: 'Dockerfile.static',
            defaultPort: 8080,
            envPort: 'PORT'
        };
        
    } catch (error) {
        log('error', 'Project type detection failed', { error: error.message, projectDir });
        return {
            type: 'static',
            dockerfile: 'Dockerfile.static',
            defaultPort: 8080,
            envPort: 'PORT'
        };
    }
}

/**
 * Generate dynamic Dockerfile based on project type
 */
async function generateDockerfile(projectType, projectDir, outputDir) {
    const templatePath = path.join(config.dockerDir, 'preview', projectType.dockerfile);
    const outputPath = path.join(outputDir, 'Dockerfile');
    
    try {
        // Copy base Dockerfile
        await fs.copyFile(templatePath, outputPath);
        
        // Copy associated start scripts
        const scriptName = `start-${projectType.type}.sh`;
        const scriptPath = path.join(config.dockerDir, 'preview', scriptName);
        const outputScriptPath = path.join(outputDir, scriptName);
        
        try {
            await fs.copyFile(scriptPath, outputScriptPath);
            await fs.chmod(outputScriptPath, 0o755);
        } catch (error) {
            // Script might not exist for all types
            log('warn', 'Start script not found', { scriptName, projectType: projectType.type });
        }
        
        log('info', 'Generated Dockerfile', { 
            projectType: projectType.type, 
            dockerfile: projectType.dockerfile,
            outputPath 
        });
        
        return outputPath;
        
    } catch (error) {
        log('error', 'Failed to generate Dockerfile', { 
            error: error.message, 
            projectType: projectType.type,
            templatePath
        });
        throw error;
    }
}

/**
 * Create Docker container for preview
 */
async function createPreviewContainer(teamId, branch, repositoryUrl, port) {
    log('info', 'Creating preview container', { teamId, branch, port });
    
    const workspacePath = path.join(config.workspaceBase, teamId);
    const containerOutputDir = path.join(config.generatedDir, teamId, `preview-${branch}`);
    
    try {
        // Ensure directories exist
        await fs.mkdir(containerOutputDir, { recursive: true });
        
        // Detect project type
        const projectType = await detectProjectType(workspacePath);
        log('info', 'Detected project type', { projectType, workspacePath });
        
        // Generate Dockerfile
        const dockerfilePath = await generateDockerfile(projectType, workspacePath, containerOutputDir);
        
        // Create docker-compose.yml for the preview
        const composeContent = `version: '3.8'

services:
  preview:
    build:
      context: ${containerOutputDir}
      dockerfile: Dockerfile
    container_name: colabvibe_preview_${teamId}_${branch}
    restart: unless-stopped
    environment:
      - PROJECT_TYPE=${projectType.type}
      - PROJECT_NAME=${teamId}
      - REPOSITORY_URL=${repositoryUrl}
      - GIT_BRANCH=${branch}
      - PORT=${port}
      - ${projectType.envPort}=${port}
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=1000
      - TEAM_ID=${teamId}
    ports:
      - "${port}:${port}"
    volumes:
      - ${workspacePath}:/workspace:ro
      - preview_cache_${teamId}_${branch}:/app/.cache:rw
      - preview_modules_${teamId}_${branch}:/app/node_modules:rw
    networks:
      - colabvibe_preview_network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}/"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

volumes:
  preview_cache_${teamId}_${branch}:
  preview_modules_${teamId}_${branch}:

networks:
  colabvibe_preview_network:
    external: true
`;
        
        const composePath = path.join(containerOutputDir, 'docker-compose.yml');
        await fs.writeFile(composePath, composeContent);
        
        // Start the container
        const { stdout, stderr } = await execAsync(`cd ${containerOutputDir} && docker-compose up -d`, {
            env: { ...process.env, COMPOSE_PROJECT_NAME: `colabvibe-preview-${teamId}-${branch}` }
        });
        
        log('info', 'Preview container started', { 
            teamId, 
            branch, 
            port, 
            containerOutputDir,
            stdout: stdout.trim(),
            stderr: stderr.trim()
        });
        
        return {
            success: true,
            port,
            projectType: projectType.type,
            containerDir: containerOutputDir,
            composePath
        };
        
    } catch (error) {
        log('error', 'Failed to create preview container', { 
            error: error.message,
            teamId,
            branch,
            port,
            workspacePath
        });
        throw error;
    }
}

/**
 * Stop preview container
 */
async function stopPreviewContainer(teamId, branch) {
    log('info', 'Stopping preview container', { teamId, branch });
    
    const containerOutputDir = path.join(config.generatedDir, teamId, `preview-${branch}`);
    const composePath = path.join(containerOutputDir, 'docker-compose.yml');
    
    try {
        // Check if compose file exists
        await fs.access(composePath);
        
        // Stop and remove containers
        const { stdout, stderr } = await execAsync(`cd ${containerOutputDir} && docker-compose down`, {
            env: { ...process.env, COMPOSE_PROJECT_NAME: `colabvibe-preview-${teamId}-${branch}` }
        });
        
        log('info', 'Preview container stopped', { 
            teamId, 
            branch,
            stdout: stdout.trim(),
            stderr: stderr.trim()
        });
        
        return { success: true };
        
    } catch (error) {
        log('error', 'Failed to stop preview container', { 
            error: error.message,
            teamId,
            branch,
            composePath
        });
        throw error;
    }
}

/**
 * Get preview container status
 */
async function getPreviewStatus(teamId, branch) {
    const containerOutputDir = path.join(config.generatedDir, teamId, `preview-${branch}`);
    const composePath = path.join(containerOutputDir, 'docker-compose.yml');
    
    try {
        // Check if compose file exists
        await fs.access(composePath);
        
        // Get container status
        const { stdout } = await execAsync(`cd ${containerOutputDir} && docker-compose ps --services --filter "status=running"`, {
            env: { ...process.env, COMPOSE_PROJECT_NAME: `colabvibe-preview-${teamId}-${branch}` }
        });
        
        const runningServices = stdout.trim().split('\n').filter(s => s.length > 0);
        const isRunning = runningServices.length > 0;
        
        return {
            status: isRunning ? 'running' : 'stopped',
            services: runningServices,
            containerDir: containerOutputDir
        };
        
    } catch (error) {
        return {
            status: 'not-found',
            error: error.message
        };
    }
}

/**
 * Command line interface
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'create': {
                const [teamId, branch, repositoryUrl, port] = args.slice(1);
                if (!teamId || !branch || !repositoryUrl || !port) {
                    throw new Error('Usage: create <teamId> <branch> <repositoryUrl> <port>');
                }
                const result = await createPreviewContainer(teamId, branch, repositoryUrl, parseInt(port));
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            
            case 'stop': {
                const [teamId, branch] = args.slice(1);
                if (!teamId || !branch) {
                    throw new Error('Usage: stop <teamId> <branch>');
                }
                const result = await stopPreviewContainer(teamId, branch);
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            
            case 'status': {
                const [teamId, branch] = args.slice(1);
                if (!teamId || !branch) {
                    throw new Error('Usage: status <teamId> <branch>');
                }
                const result = await getPreviewStatus(teamId, branch);
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            
            case 'detect': {
                const [projectDir] = args.slice(1);
                if (!projectDir) {
                    throw new Error('Usage: detect <projectDir>');
                }
                const result = await detectProjectType(projectDir);
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            
            default:
                console.error('Usage: preview-integration.js <create|stop|status|detect> [...args]');
                process.exit(1);
        }
    } catch (error) {
        log('error', 'Command failed', { error: error.message, command, args });
        console.error(error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    detectProjectType,
    generateDockerfile,
    createPreviewContainer,
    stopPreviewContainer,
    getPreviewStatus
};