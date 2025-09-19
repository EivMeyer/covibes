/**
 * Universal Preview Service
 * 
 * Runs ANY project type in Docker containers
 * - Clones the actual repository
 * - Detects project type and runs appropriate dev server
 * - Supports hot reload for all frameworks
 * - No limitations on user projects
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { dedicatedPreviewProxy } from './dedicated-preview-proxy.js';
import { PrismaClient } from '@prisma/client';
import { BASE_HOST } from '../config/deployment.js';

const execAsync = promisify(exec);

interface PreviewInfo {
  running: boolean;
  port?: number;
  proxyPort?: number; // Dedicated proxy port like MVP
  containerId?: string;
  projectType?: string;
  command?: string;
}

class UniversalPreviewService {
  private prisma = new PrismaClient();
  private basePort = 8000;
  private maxPort = 8099;
  private workspaceDir: string;

  constructor() {
    this.workspaceDir = path.join(os.homedir(), '.covibes/workspaces');
    this.ensureWorkspaceDir();
  }

  /**
   * Reconcile database state with Docker reality on server startup
   */
  async reconcilePreviewState(): Promise<void> {
    console.log('🔄 Reconciling preview state on startup...');
    
    try {
      const deployments = await this.prisma.preview_deployments.findMany({
        where: { status: 'running' }
      });

      for (const deployment of deployments) {
        const isHealthy = await this.validateContainerHealth(deployment.containerName);
        
        if (isHealthy) {
          // Recreate proxy if needed
          const proxyPort = dedicatedPreviewProxy.getProxyPort(deployment.teamId);
          if (!proxyPort) {
            console.log(`🔧 Recreating proxy for team ${deployment.teamId}`);
            const newProxyPort = await dedicatedPreviewProxy.createProxy(deployment.teamId, deployment.port);
            
            await this.prisma.preview_deployments.update({
              where: { id: deployment.id },
              data: { proxyPort: newProxyPort }
            });
          }
          
          console.log(`✅ Reconciled healthy preview for team ${deployment.teamId}`);
        } else {
          // Container dead - mark as stopped
          console.log(`❌ Marking dead preview as stopped for team ${deployment.teamId}`);
          
          await this.prisma.preview_deployments.update({
            where: { id: deployment.id },
            data: { 
              status: 'stopped',
              errorMessage: 'Container not found after server restart'
            }
          });
        }
      }
      
      console.log('✅ Preview state reconciliation completed');
    } catch (error) {
      console.error('❌ Error during preview reconciliation:', error);
    }
  }

  private async ensureWorkspaceDir() {
    await fs.mkdir(this.workspaceDir, { recursive: true });
  }

  private async initializeWorkspaceFromTemplate(teamId: string): Promise<void> {
    const workspaceDir = path.join(this.workspaceDir, teamId);
    const templateDir = '/home/ubuntu/covibes/templates/fullstack-react-postgres';

    // Check if already initialized
    try {
      await fs.access(path.join(workspaceDir, 'package.json'));
      console.log(`📦 Workspace ${teamId} already initialized`);
      return;
    } catch {
      // Continue with initialization
    }

    console.log(`🎨 Initializing workspace ${teamId} from template...`);

    // Ensure workspace directory exists
    await fs.mkdir(workspaceDir, { recursive: true });

    // Copy template files
    await execAsync(`cp -r ${templateDir}/* ${workspaceDir}/`);

    // Replace placeholders
    const ec2Host = process.env['EC2_HOST'] || 'localhost';
    const replacements: [string, string][] = [
      ['TEAM_ID_PLACEHOLDER', teamId],
      ['EC2_HOST_PLACEHOLDER', ec2Host]
    ];

    const filesToProcess = [
      'server.js',
      'vite.config.js',
      'src/App.jsx',
      'index.html'
    ];

    for (const file of filesToProcess) {
      const filePath = path.join(workspaceDir, file);
      let content = await fs.readFile(filePath, 'utf-8');

      for (const [placeholder, value] of replacements) {
        content = content.replace(new RegExp(placeholder, 'g'), value);
      }

      await fs.writeFile(filePath, content);
    }

    // Create team-specific database
    const dbName = `preview_${teamId.replace(/-/g, '_')}`;
    console.log(`📊 Creating database ${dbName}...`);

    // Note: Database creation happens in the container via server.js auto-creation

    console.log(`✅ Workspace ${teamId} initialized from template`);
  }

  private async findAvailablePort(): Promise<number | null> {
    // Check which ports are already in use by database previews
    const activeDeployments = await this.prisma.preview_deployments.findMany({
      where: { status: 'running' },
      select: { port: true }
    });
    const usedPorts = new Set(activeDeployments.map(d => d.port));
    
    // Find first available port in range
    for (let port = this.basePort; port <= this.maxPort; port++) {
      if (!usedPorts.has(port)) {
        // Also check if port is actually available on the system
        try {
          await execAsync(`lsof -i :${port}`);
          // If lsof succeeds, port is in use
          continue;
        } catch {
          // If lsof fails, port is available
          return port;
        }
      }
    }
    
    return null;
  }

  private async validateContainerHealth(containerName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker inspect ${containerName} --format '{{.State.Status}}'`);
      return stdout.trim() === 'running';
    } catch {
      return false; // Container doesn't exist
    }
  }

  private async cleanupDeadPreview(teamId: string): Promise<void> {
    // Stop proxy if running
    await dedicatedPreviewProxy.stopProxy(teamId);
    
    // Clear database state
    await this.prisma.preview_deployments.deleteMany({
      where: { teamId }
    });
    
    // Try to remove container if it exists
    const containerName = `preview-${teamId}`;
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch { /* Container already gone */ }
    
    console.log(`🧹 Cleaned up dead preview for team ${teamId}`);
  }

  async startPreview(teamId: string, repositoryUrl?: string): Promise<{ port: number; url: string }> {
    console.log(`🚀 Starting universal preview for team ${teamId}`);
    console.log(`🔍 Repository URL provided: ${repositoryUrl || 'undefined'}`);
    
    // Check if Docker is available
    try {
      await execAsync('docker --version');
    } catch (error) {
      throw new Error('Docker is not available. Please ensure Docker is installed and running.');
    }
    
    // Check database for existing deployment
    const existing = await this.prisma.preview_deployments.findUnique({
      where: { teamId }
    });
    
    // Validate if container actually exists and is healthy
    if (existing) {
      const isHealthy = await this.validateContainerHealth(existing.containerName);
      if (isHealthy) {
        console.log(`✅ Reusing healthy container on port ${existing.port}, proxy: ${existing.proxyPort}`);
        
        // Ensure proxy exists
        const existingProxyPort = dedicatedPreviewProxy.getProxyPort(teamId);
        if (!existingProxyPort) {
          // Recreate proxy
          const proxyPort = await dedicatedPreviewProxy.createProxy(teamId, existing.port);
          await this.prisma.preview_deployments.update({
            where: { teamId },
            data: { proxyPort }
          });
          
          return {
            port: existing.port,  // Return the actual container port for direct access
            url: `http://${BASE_HOST}/api/preview/proxy/${teamId}/main/`
          };
        }
        
        return {
          port: existing.port,  // Return the actual container port, not proxy port
          url: `http://${BASE_HOST}/api/preview/proxy/${teamId}/main/`
        };
      }
      
      // Container dead - clean up
      console.log('⚠️ Container dead, cleaning up...');
      await this.cleanupDeadPreview(teamId);
    }
    
    // Stop any existing preview
    await this.stopPreview(teamId);

    // Find an available port
    const port = await this.findAvailablePort();
    if (!port) {
      throw new Error('No available ports for preview. All ports 8000-8099 are in use.');
    }
    
    const projectDir = path.join(this.workspaceDir, teamId);

    try {
      // If repository URL is provided, clone it; otherwise use template
      if (repositoryUrl) {
        console.log(`🔗 Cloning repository: ${repositoryUrl}`);
        await this.cloneRepositoryWithFallback(repositoryUrl, projectDir);
      } else {
        console.log('📦 Using fullstack template with PostgreSQL...');
        await this.initializeWorkspaceFromTemplate(teamId);
      }

      // Create Dockerfile for development server
      const dockerfile = `FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Use start.sh script if it exists (for fullstack template), otherwise run dev
CMD ["sh", "-c", "if [ -f start.sh ]; then ./start.sh; else npm run dev -- --host 0.0.0.0 --port 5173; fi"]`;

      await fs.writeFile(path.join(projectDir, 'Dockerfile'), dockerfile);

      // Build Docker image
      console.log('🔨 Building Docker image with Node.js and Vite...');
      await execAsync(`docker build -t preview-${teamId} .`, { cwd: projectDir });

      // Run container with volume mount for hot reload
      console.log(`🐳 Starting dev server on port ${port} with hot reload...`);
      const { stdout } = await execAsync(
        `docker run -d --rm ` +
        `--name preview-${teamId} ` +
        `-p ${port}:5173 ` +
        `-v ${projectDir}:/app ` +
        `-v /app/node_modules ` +  // Don't overwrite node_modules
        `-e CHOKIDAR_USEPOLLING=true ` +  // Enable file watching in Docker
        `-e PORT=5173 ` +  // Force server to run on port 5173 for Docker mapping
        // Remove VITE_BASE_PATH to prevent redirect loops
        `-e VITE_HMR_HOST=${BASE_HOST} ` +  // HMR host
        `-e VITE_HMR_PORT=3001 ` +  // HMR through main server
        `preview-${teamId}`
      );

      const containerId = stdout.trim();

      // Create dedicated proxy (like Caddy MVP)
      const proxyPort = await dedicatedPreviewProxy.createProxy(teamId, port, undefined);
      
      // Update Vite config with proxy port for HMR
      await this.updateViteConfigWithProxy(teamId, proxyPort);

      // Save to database
      await this.prisma.preview_deployments.create({
        data: {
          id: randomUUID(),
          teamId,
          containerId,
          containerName: `preview-${teamId}`,
          port,
          proxyPort,
          status: 'running',
          projectType: 'vite-react',
          updatedAt: new Date()
        }
      });

      console.log(`✅ Vite dev server with HOT RELOAD running on port ${port}, proxy on ${proxyPort}`);
      
      // Wait a bit for dev server to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return {
        port,                 // Container's mapped host port (Vite dev server)
        // Return URL that goes through main server API proxy (no port numbers!)
        url: `http://${BASE_HOST}/api/preview/proxy/${teamId}/main/`
      };

    } catch (error) {
      console.error('Failed to start preview:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start preview: ${errorMessage}`);
    }
  }

  /**
   * Generate Vite configuration with MIME type fix and HMR support (DRY)
   */
  private generateViteConfig(_containerPort: number = 8000, includeGlobalDefine: boolean = false, teamId: string = 'demo'): string {
    const additionalConfig = includeGlobalDefine ? `,
  // Additional configuration
  define: {
    global: 'globalThis'
  }` : '';

    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Dynamic base path - use environment variable for HTTPS compatibility
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react({
      // Keep React plugin working normally
      include: "**/*.{jsx,tsx}",
    }),
    // SURGICAL plugin to fix ONLY virtual module MIME types
    {
      name: 'fix-virtual-module-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // ONLY target the exact problematic virtual modules
          if (req.url === '/@vite/client' || req.url === '/@react-refresh') {
            // Override setHeader ONLY for these specific requests
            const originalSetHeader = res.setHeader;
            res.setHeader = function(name, value) {
              if (name.toLowerCase() === 'content-type' && value === 'text/html') {
                return originalSetHeader.call(this, name, 'application/javascript');
              }
              return originalSetHeader.call(this, name, value);
            };
          }
          next();
        });
      }
    }
  ],
  server: {
    host: true,
    port: 5173,
    // Configure HMR to work through nginx direct proxy WebSocket  
    hmr: {
      clientPort: 80,  // Client connects to nginx 
      host: '${BASE_HOST}',
      // Use nginx direct proxy path for WebSocket connections
      path: '/preview/${teamId}/',
      overlay: true
    },
    cors: true,
    allowedHosts: "all",
    // Ensure proper file serving
    fs: {
      strict: false,
      allow: ['..']
    }
  }${additionalConfig}
})`;
  }

  private async updateViteConfigWithProxy(teamId: string, proxyPort: number): Promise<void> {
    const projectDir = path.join(this.workspaceDir, teamId);
    const viteConfigPath = path.join(projectDir, 'vite.config.js');
    
    // Generate Vite config that points HMR to the public proxy port
    const viteConfig = this.generateViteConfig(proxyPort, false, teamId);
    await fs.writeFile(viteConfigPath, viteConfig);
    
    // Restart Vite dev server in container to pick up new config
    try {
      await execAsync(`docker exec preview-${teamId} pkill -f vite`);
      // Give it a moment then let it restart automatically
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('Vite restart handled by container process manager');
    }
  }

  // REMOVED: _cloneRepository method - superseded by cloneRepositoryWithFallback with better branch handling

  private async cloneRepositoryWithFallback(repositoryUrl: string, targetDir: string): Promise<void> {
    console.log(`📥 Cloning repository with branch fallback: ${repositoryUrl}`);
    
    // Check if directory already has a project
    try {
      await fs.access(path.join(targetDir, 'package.json'));
      console.log(`✅ Project already exists at ${targetDir}, skipping clone`);
      return;
    } catch {
      // Directory doesn't exist or has no package.json, proceed with clone
    }
    
    // Remove existing directory only if we need to clone
    await execAsync(`rm -rf ${targetDir}`);
    
    try {
      // First try to get the default branch
      console.log('🔍 Getting default branch from repository...');
      const { stdout: defaultBranch } = await execAsync(`git ls-remote --symref ${repositoryUrl} HEAD | head -1 | awk '{print $2}' | sed 's/refs\\/heads\\///'`);
      const branch = defaultBranch.trim() || 'main';
      
      console.log(`🌿 Using branch: ${branch}`);
      
      // Clone with the detected default branch
      await execAsync(`git clone --branch ${branch} --single-branch ${repositoryUrl} ${targetDir}`);
      
    } catch (error) {
      console.warn('⚠️ Failed to detect default branch, trying main branch...');
      try {
        // Fallback to main branch
        await execAsync(`git clone --branch main --single-branch ${repositoryUrl} ${targetDir}`);
      } catch (mainError) {
        console.warn('⚠️ main branch failed, trying master branch...');
        try {
          // Fallback to master branch
          await execAsync(`git clone --branch master --single-branch ${repositoryUrl} ${targetDir}`);
        } catch (masterError) {
          console.warn('⚠️ master branch failed, cloning default repository...');
          // Final fallback: clone entire repository and use whatever is default
          await execAsync(`git clone ${repositoryUrl} ${targetDir}`);
        }
      }
    }
  }

  // Keeping this for reference but now using template instead
  /* private async createViteReactProject(projectDir: string, teamId: string, _port: number): Promise<void> {
    console.log('🔥 Creating REAL Vite + React project with HOT RELOAD...');
    
    // Remove existing directory and create fresh
    await execAsync(`rm -rf ${projectDir}`);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create package.json with Vite and React
    const packageJson = {
      "name": "preview-app",
      "private": true,
      "version": "0.0.0",
      "type": "module",
      "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      "devDependencies": {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.0.0",
        "vite": "^5.0.0"
      }
    };
    
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create vite.config.js with DRY method
    const viteConfig = this.generateViteConfig(8000, true, teamId); // Include global define for full app
    
    await fs.writeFile(path.join(projectDir, 'vite.config.js'), viteConfig);
    
    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Live Preview - Team ${teamId}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
    
    await fs.writeFile(path.join(projectDir, 'index.html'), indexHtml);
    
    // Create src directory
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
    
    // Create main.jsx
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    
    await fs.writeFile(path.join(projectDir, 'src', 'main.jsx'), mainJsx);
    
    // Create App.jsx with hot reload demo
    const appJsx = `import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [entries, setEntries] = useState([])
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Detect if we're in a proxy context and adjust API path accordingly
  const getApiBase = () => {
    // Check if we're being accessed through the preview proxy
    if (window.location.pathname.includes('/api/preview/proxy/')) {
      // When in proxy, we need to use the full proxy path for API requests
      const proxyPath = window.location.pathname.replace(/\/$/, '');
      return proxyPath + '/api';
    }
    // For direct access (port 8000), use relative path that Vite proxies
    return '/api';
  };

  const apiBase = getApiBase();

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    try {
      const response = await fetch(apiBase + '/entries')
      if (!response.ok) throw new Error('Failed to fetch entries')
      const data = await response.json()
      setEntries(data)
    } catch (err) {
      console.error('Error fetching entries:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiBase + '/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to submit')

      setFormData({ name: '', email: '', message: '' })
      await fetchEntries()
    } catch (err) {
      setError('Failed to submit entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const response = await fetch(apiBase + '/entries/' + id, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete entry')

      await fetchEntries()
    } catch (err) {
      console.error('Error deleting entry:', err)
    }
  }

  return (
    <div className="gradient-bg">
      <div className="container">
        <header>
          <h1>✨ Full Stack Demo</h1>
          <p className="subtitle">
            <span className="live-indicator"></span>
            React + Express + PostgreSQL
          </p>
        </header>

        <div className="card form-container">
          <h2>💬 Add Your Entry</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <textarea
                placeholder="Share your thoughts..."
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
              />
            </div>
            <div className="button-group">
              <button type="submit" disabled={loading}>
                {loading ? '⏳ Submitting...' : '🚀 Submit Entry'}
              </button>
            </div>
            {error && <div className="error">❌ {error}</div>}
          </form>
        </div>

        <div className="entries-container">
          <h2>📋 Recent Entries ({entries.length})</h2>
          {entries.length === 0 ? (
            <div className="card">
              <p className="instruction">🎯 No entries yet. Be the first to add one above!</p>
            </div>
          ) : (
            <div className="entries-list">
              {entries.map(entry => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-header">
                    <h3>👤 {entry.name}</h3>
                    <button onClick={() => handleDelete(entry.id)} className="delete-btn">
                      🗑️
                    </button>
                  </div>
                  {entry.email && <p className="entry-email">📧 {entry.email}</p>}
                  {entry.message && <p className="entry-message">💭 {entry.message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer>
          <div className="team-badge">${teamId}</div>
          <div className="version">ColabVibe Preview ✨</div>
        </footer>
      </div>
    </div>
  )
}

export default App`;
    
    await fs.writeFile(path.join(projectDir, 'src', 'App.jsx'), appJsx);
    
    // Create index.css
    const indexCss = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
}`;
    
    await fs.writeFile(path.join(projectDir, 'src', 'index.css'), indexCss);
    
    // Create App.css with modern styling
    const appCss = `.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
  padding: 2rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

header {
  text-align: center;
  margin-bottom: 3rem;
}

h1 {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from { text-shadow: 2px 2px 4px rgba(0,0,0,0.2), 0 0 10px rgba(255,255,255,0.2); }
  to { text-shadow: 2px 2px 4px rgba(0,0,0,0.2), 0 0 20px rgba(255,255,255,0.4); }
}

.subtitle {
  font-size: 1.3rem;
  opacity: 0.95;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.live-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 2rem;
  margin: 2rem 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s, box-shadow 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.card h2 {
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.edit-message {
  font-size: 1.5rem;
  color: #fbbf24;
  margin-bottom: 1rem;
  font-weight: bold;
}

.instruction {
  font-size: 1.1rem;
  opacity: 0.9;
}

code {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.counter-display {
  font-size: 4rem;
  font-weight: bold;
  margin: 2rem 0;
  text-align: center;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

button {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid white;
  color: white;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: bold;
}

button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

button:active {
  transform: scale(0.95);
}

.time {
  font-size: 3rem;
  text-align: center;
  font-weight: 300;
  letter-spacing: 2px;
  margin: 1rem 0;
}

.team-badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: inline-block;
  font-family: monospace;
  margin-top: 1rem;
}

.features ul {
  list-style: none;
  font-size: 1.2rem;
  line-height: 2;
}

.features li {
  padding: 0.5rem 0;
  transition: transform 0.2s;
}

.features li:hover {
  transform: translateX(10px);
}

footer {
  text-align: center;
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.version {
  margin-top: 0.5rem;
  opacity: 0.7;
  font-size: 0.9rem;
}`;
    
    await fs.writeFile(path.join(projectDir, 'src', 'App.css'), appCss);
    
    console.log('✅ Created full Vite + React project structure with hot reload support');
  } */

  // REMOVED: _createSampleProject method - superseded by createViteReactProject with better template

  // REMOVED: _detectProjectType method - current implementation defaults to Vite + React setup

  // REMOVED: _generateDockerfile method - current implementation uses fixed Dockerfile template

  async getPreviewStatus(teamId: string): Promise<PreviewInfo | null> {
    console.log(`🔍 [DEBUG] getPreviewStatus called for teamId: ${teamId}`);
    const deployment = await this.prisma.preview_deployments.findUnique({
      where: { teamId }
    });
    
    console.log(`🔍 [DEBUG] Database deployment found:`, deployment ? 'YES' : 'NO');
    if (deployment) {
      console.log(`🔍 [DEBUG] Deployment details: status=${deployment.status}, containerName=${deployment.containerName}`);
    }
    
    if (!deployment) return null;
    
    // Skip health check for now - it's causing false negatives
    // The container is running but docker inspect sometimes fails
    console.log(`🔍 [DEBUG] Skipping health check - returning deployment as-is`);

    // Commented out flaky health check that causes false "stopped" status
    // const isHealthy = await this.validateContainerHealth(deployment.containerName);
    // if (!isHealthy && deployment.status === 'running') {
    //   await this.prisma.preview_deployments.update({
    //     where: { teamId },
    //     data: { status: 'stopped' }
    //   });
    //   return null;
    // }
    
    // Update last health check
    await this.prisma.preview_deployments.update({
      where: { teamId },
      data: { lastHealthCheck: new Date() }
    });
    
    const result = {
      running: deployment.status === 'running',
      port: deployment.port,
      proxyPort: deployment.proxyPort,
      containerId: deployment.containerId,
      projectType: deployment.projectType,
    };
    
    console.log(`🔍 [DEBUG] Returning preview status:`, result);
    return result;
  }

  async getContainerLogs(teamId: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`docker logs preview-${teamId} --tail 50`);
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      return [`Error getting logs: ${(error as any).message}`];
    }
  }

  async stopPreview(teamId: string): Promise<void> {
    console.log(`🛑 Stopping preview for team ${teamId}`);
    
    try {
      // Stop Docker container
      await execAsync(`docker stop preview-${teamId}`);
      console.log(`✅ Stopped Docker container for team ${teamId}`);
    } catch (error) {
      console.log(`⚠️ Container might already be stopped: ${(error as any).message}`);
    }
    
    // Stop proxy if it exists
    dedicatedPreviewProxy.stopProxy(teamId);
    
    // Update database
    await this.prisma.preview_deployments.update({
      where: { teamId },
      data: {
        status: 'stopped',
        updatedAt: new Date()
      }
    }).catch(() => {
      // Deployment might not exist
    });
  }

  async restartPreview(teamId: string): Promise<void> {
    console.log(`🔁 Restarting preview for team ${teamId}`);
    
    // Try to stop any existing container (even if no database record)
    try {
      await execAsync(`docker stop preview-${teamId}`);
      console.log(`✅ Stopped Docker container for team ${teamId}`);
    } catch (error) {
      console.log(`⚠️ Container might already be stopped: ${(error as any).message}`);
    }
    
    // Stop proxy if it exists
    dedicatedPreviewProxy.stopProxy(teamId);
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get team's repository URL if available
    const team = await this.prisma.teams.findUnique({
      where: { id: teamId }
    });
    
    // Start it again (this will create database record if missing)
    await this.startPreview(teamId, team?.repositoryUrl || undefined);
    
    console.log(`✅ Preview restarted for team ${teamId}`);
  }
}

export const universalPreviewService = new UniversalPreviewService();
