/**
 * Simple Docker Preview Service
 * A straightforward implementation for running preview containers
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SimpleDockerPreview {
  constructor() {
    this.previews = new Map();
    this.basePort = 8000;
  }

  async startPreview(teamId) {
    console.log(`🚀 Starting simple Docker preview for team ${teamId}`);
    
    try {
      // Stop any existing preview
      await this.stopPreview(teamId);
      
      // Find available port
      const port = await this.findAvailablePort();
      
      // Create a simple static HTML preview
      const previewDir = path.join(os.homedir(), '.colabvibe', 'docker', `simple-${teamId}`);
      await fs.mkdir(previewDir, { recursive: true });
      
      // Create a simple HTML file
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Preview Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 1rem;
            padding: 2rem;
            margin: 2rem 0;
        }
        .counter {
            font-size: 3rem;
            margin: 2rem 0;
        }
        button {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            color: white;
            padding: 1rem 2rem;
            margin: 0 1rem;
            border-radius: 0.5rem;
            font-size: 1.2rem;
            cursor: pointer;
            transition: all 0.3s;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Live Preview Demo</h1>
        <div class="card">
            <h2>Welcome to Your Preview</h2>
            <p>This is a demo preview running in an isolated Docker container</p>
            <p>Team ID: ${teamId}</p>
        </div>
        <div class="card">
            <h2>Interactive Counter</h2>
            <div class="counter" id="counter">0</div>
            <button onclick="decrease()">-</button>
            <button onclick="reset()">Reset</button>
            <button onclick="increase()">+</button>
        </div>
        <div class="card">
            <h2>Current Time</h2>
            <div id="time"></div>
        </div>
    </div>
    <script>
        let count = 0;
        const counterEl = document.getElementById('counter');
        const timeEl = document.getElementById('time');
        
        function increase() {
            count++;
            counterEl.textContent = count;
        }
        
        function decrease() {
            count--;
            counterEl.textContent = count;
        }
        
        function reset() {
            count = 0;
            counterEl.textContent = count;
        }
        
        function updateTime() {
            timeEl.textContent = new Date().toLocaleTimeString();
        }
        
        updateTime();
        setInterval(updateTime, 1000);
    </script>
</body>
</html>`;
      
      await fs.writeFile(path.join(previewDir, 'index.html'), htmlContent);
      
      // Create a simple Dockerfile
      const dockerfile = `FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80`;
      
      await fs.writeFile(path.join(previewDir, 'Dockerfile'), dockerfile);
      
      // Build the Docker image
      console.log('🔨 Building Docker image...');
      await execAsync(`docker build -t preview-${teamId} .`, { cwd: previewDir });
      
      // Run the container
      console.log(`🐳 Starting container on port ${port}...`);
      const { stdout } = await execAsync(
        `docker run -d --rm --name preview-${teamId} -p ${port}:80 preview-${teamId}`
      );
      
      const containerId = stdout.trim();
      
      // Store preview info
      this.previews.set(teamId, {
        running: true,
        port,
        containerId
      });
      
      console.log(`✅ Preview running on port ${port}`);
      
      return {
        port,
        url: `/api/preview/${teamId}/workspace/`
      };
      
    } catch (error) {
      console.error('Failed to start simple preview:', error);
      throw error;
    }
  }
  
  async findAvailablePort() {
    for (let port = this.basePort; port < this.basePort + 100; port++) {
      try {
        await execAsync(`lsof -i :${port}`);
        // Port is in use, try next
      } catch {
        // Port is available
        return port;
      }
    }
    throw new Error('No available ports');
  }
  
  async stopPreview(teamId) {
    try {
      await execAsync(`docker stop preview-${teamId}`);
      console.log(`Stopped preview for ${teamId}`);
    } catch {
      // Container might not exist
    }
    this.previews.delete(teamId);
  }
  
  getPreviewStatus(teamId) {
    return this.previews.get(teamId) || null;
  }
}

export const simpleDockerPreview = new SimpleDockerPreview();