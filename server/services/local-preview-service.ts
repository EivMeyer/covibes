/**
 * Local Preview Service
 * 
 * Manages Vite dev servers running locally on the web server
 * Much simpler than VM/Docker approach - direct HMR support
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Get the base host from environment - FAIL if not configured
const BASE_HOST = process.env['BASE_HOST'];
if (!BASE_HOST) {
  throw new Error('BASE_HOST environment variable is required. Set it to your production domain.');
}
// import { fileURLToPath } from 'url';

// // const __filename = fileURLToPath(import.meta.url);

interface PreviewProcess {
  teamId: string;
  port: number;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  workspaceDir: string;
  startedAt: Date;
  error?: string;
}

class LocalPreviewService {
  private previews = new Map<string, PreviewProcess>();
  private portStart = 4000;
  private baseWorkspaceDir = path.join(os.homedir(), '.covibes/workspaces', 'previews');

  constructor() {
    // Ensure workspace directory exists
    this.ensureWorkspaceDir();
  }

  private async ensureWorkspaceDir() {
    try {
      await fs.mkdir(this.baseWorkspaceDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create workspace directory:', error);
    }
  }

  /**
   * Start a preview for a team
   */
  async startPreview(teamId: string): Promise<{ port: number; status: string; url: string }> {
    console.log(`🚀 Starting local preview for team ${teamId}`);

    // Stop existing preview if running
    if (this.previews.has(teamId)) {
      await this.stopPreview(teamId);
    }

    // Allocate port
    const port = this.portStart + this.previews.size;
    
    // Create workspace directory
    const workspaceDir = path.join(this.baseWorkspaceDir, teamId);
    await fs.mkdir(workspaceDir, { recursive: true });

    // Create Vite project
    await this.createViteProject(workspaceDir, port, teamId);

    // Start Vite dev server
    const viteProcess = await this.startViteServer(workspaceDir, port);

    const preview: PreviewProcess = {
      teamId,
      port,
      process: viteProcess,
      status: 'starting',
      workspaceDir,
      startedAt: new Date()
    };

    this.previews.set(teamId, preview);

    // Wait for server to be ready
    await this.waitForServer(port, 30000);
    
    preview.status = 'running';
    console.log(`✅ Local preview running for team ${teamId} on port ${port}`);

    return {
      port,
      status: 'running',
      url: `/api/preview/${teamId}/workspace/`
    };
  }

  /**
   * Stop a preview
   */
  async stopPreview(teamId: string): Promise<void> {
    const preview = this.previews.get(teamId);
    if (!preview) {
      return;
    }

    console.log(`🛑 Stopping local preview for team ${teamId}`);
    preview.status = 'stopping';

    // Kill process
    if (preview.process && !preview.process.killed) {
      preview.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!preview.process.killed) {
          preview.process.kill('SIGKILL');
        }
      }, 5000);
    }

    preview.status = 'stopped';
    this.previews.delete(teamId);
  }

  /**
   * Get preview status
   */
  getPreviewStatus(teamId: string): { status: string; port?: number; error?: string } | null {
    const preview = this.previews.get(teamId);
    if (!preview) {
      return null;
    }

    return {
      status: preview.status,
      ...(preview.port !== undefined && { port: preview.port }),
      ...(preview.error !== undefined && { error: preview.error })
    };
  }

  /**
   * Create Vite project in workspace
   */
  private async createViteProject(workspaceDir: string, port: number, _teamId: string): Promise<void> {
    console.log(`📁 Creating Vite project in ${workspaceDir}`);

    // Package.json
    const packageJson = {
      "type": "module",
      "scripts": {
        "dev": "vite"
      },
      "devDependencies": {
        "vite": "^5.0.0"
      }
    };

    await fs.writeFile(
      path.join(workspaceDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Vite config
    const viteConfig = `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: ${port},
    strictPort: true,
    hmr: {
      port: ${port},
      host: BASE_HOST
    }
  },
  base: '',
  optimizeDeps: {
    include: []
  }
})`;

    await fs.writeFile(path.join(workspaceDir, 'vite.config.js'), viteConfig);

    // Index.html with HMR demo
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Covibes Preview - Local HMR</title>
    <style>
        body {
            font-family: system-ui;
            margin: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .hmr-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .active {
            background: #4CAF50;
            box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
        }
        .inactive {
            background: #f44336;
        }
        .counter {
            font-size: 4em;
            font-weight: bold;
            text-align: center;
            margin: 40px 0;
            text-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        button {
            padding: 15px 30px;
            font-size: 18px;
            margin: 10px;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(5px);
        }
        button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .log {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 10px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            margin-top: 30px;
        }
        .pulse {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="hmr-indicator" id="hmr-indicator">🔥 HMR Loading...</div>
    
    <div class="container">
        <h1>🚀 Covibes Local Preview</h1>
        <p><strong>✨ Hot Module Replacement Active</strong></p>
        <p>🌐 Port: ${port} | 🔄 Live Reload Enabled</p>
        
        <div class="counter pulse" id="counter">0</div>
        
        <div style="text-align: center;">
            <button onclick="increment()">+ Increment</button>
            <button onclick="decrement()">- Decrement</button>
            <button onclick="reset()">🔄 Reset</button>
            <button onclick="randomize()">🎲 Random</button>
        </div>
        
        <div class="log" id="log"></div>
    </div>
    
    <script type="module">
      import('./main.js').then(() => {
        console.log('Main module loaded');
      }).catch(err => {
        console.error('Failed to load main module:', err);
      });
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(workspaceDir, 'index.html'), indexHtml);

    // Main.js with HMR functionality
    const mainJs = `let count = 0

window.increment = () => {
  count++
  updateDisplay()
  log("✨ Incremented to " + count)
}

window.decrement = () => {
  count--
  updateDisplay()
  log("⬇️ Decremented to " + count)
}

window.reset = () => {
  count = 0
  updateDisplay()
  log("🔄 Counter reset to 0")
}

window.randomize = () => {
  count = Math.floor(Math.random() * 100)
  updateDisplay()
  log("🎲 Random number: " + count)
}

function updateDisplay() {
  const counterEl = document.getElementById("counter")
  counterEl.textContent = count
  
  // Color based on value
  if (count > 50) {
    counterEl.style.color = "#FFD700"
  } else if (count < 0) {
    counterEl.style.color = "#FF6B6B"
  } else {
    counterEl.style.color = "white"
  }
}

function log(message) {
  const logDiv = document.getElementById("log")
  const p = document.createElement("p")
  p.innerHTML = "<strong>" + new Date().toLocaleTimeString() + "</strong>: " + message
  logDiv.appendChild(p)
  logDiv.scrollTop = logDiv.scrollHeight
  
  if (logDiv.children.length > 20) {
    logDiv.removeChild(logDiv.firstChild)
  }
}

// HMR integration
if (import.meta.hot) {
  const indicator = document.getElementById("hmr-indicator")
  indicator.textContent = "🔥 HMR Active"
  indicator.className = "hmr-indicator active"
  
  import.meta.hot.accept(() => {
    log("🔥 Hot module replacement triggered!")
    indicator.style.background = "#FF9800"
    setTimeout(() => {
      indicator.style.background = "#4CAF50"
    }, 2000)
  })
  
  log("🚀 Local preview application started")
  log("💡 Edit files to see instant updates!")
} else {
  document.getElementById("hmr-indicator").textContent = "❌ HMR Inactive"
  document.getElementById("hmr-indicator").className = "hmr-indicator inactive"
  log("⚠️ HMR not available")
}

// Auto-update timestamp
setInterval(() => {
  document.title = \`Covibes Preview - \${new Date().toLocaleTimeString()}\`
}, 1000)

log("✅ Application initialized successfully")`;

    await fs.writeFile(path.join(workspaceDir, 'main.js'), mainJs);

    console.log(`✅ Vite project created in ${workspaceDir}`);
  }

  /**
   * Start Vite dev server
   */
  private async startViteServer(workspaceDir: string, port: number): Promise<ChildProcess> {
    console.log(`🔨 Starting Vite dev server in ${workspaceDir} on port ${port}`);

    // First install dependencies
    await this.runCommand('npm', ['install'], workspaceDir);

    // Start Vite dev server
    const viteProcess = spawn('npm', ['run', 'dev'], {
      cwd: workspaceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: port.toString() }
    });

    viteProcess.stdout?.on('data', (data) => {
      console.log(`[Vite ${port}]: ${data.toString().trim()}`);
    });

    viteProcess.stderr?.on('data', (data) => {
      console.error(`[Vite ${port} ERROR]: ${data.toString().trim()}`);
    });

    viteProcess.on('exit', (code) => {
      console.log(`[Vite ${port}] exited with code ${code}`);
    });

    return viteProcess;
  }

  /**
   * Run command and wait for completion
   */
  private async runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { cwd, stdio: 'pipe' });
      
      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });
    });
  }

  /**
   * Wait for server to be ready
   */
  private async waitForServer(port: number, timeout: number = 30000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`http://${BASE_HOST}:${port}/`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
  }

  /**
   * Get all running previews
   */
  getAllPreviews(): Array<{ teamId: string; port: number; status: string }> {
    return Array.from(this.previews.entries()).map(([teamId, preview]) => ({
      teamId,
      port: preview.port,
      status: preview.status
    }));
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down all local previews...');
    
    const stopPromises = Array.from(this.previews.keys()).map(teamId => 
      this.stopPreview(teamId)
    );
    
    await Promise.all(stopPromises);
    console.log('✅ All local previews stopped');
  }
}

// Export singleton instance
export const localPreviewService = new LocalPreviewService();

// Cleanup on process exit
process.on('SIGTERM', () => localPreviewService.shutdown());
process.on('SIGINT', () => localPreviewService.shutdown());