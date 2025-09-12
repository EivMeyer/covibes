#!/usr/bin/env node

/**
 * Recreate the Alice preview container with FIXED configuration
 * This time WITHOUT the VITE_BASE_PATH that caused the redirect loop
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function createFixedPreview() {
  const teamId = 'demo-team-001';
  const port = 8000; // Use same port for consistency
  
  try {
    console.log('🧹 Cleaning up old deployment in database...');
    await prisma.preview_deployments.deleteMany({
      where: { teamId }
    });
    
    console.log('🧹 Cleaning up old Docker containers and images...');
    try {
      await execAsync(`docker rm -f preview-${teamId}`).catch(() => {});
      await execAsync(`docker rmi preview-${teamId}`).catch(() => {});
    } catch (e) {
      console.log('No existing containers to clean up');
    }
    
    // Create workspace directory structure
    const workspaceDir = path.join(os.homedir(), '.covibes/workspaces');
    const projectDir = path.join(workspaceDir, teamId);
    
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    
    console.log(`📁 Created workspace: ${projectDir}`);
    
    // Create Alice's React app structure
    const packageJson = {
      name: "alice-covibes-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.43",
        "@types/react-dom": "^18.2.17",
        "@vitejs/plugin-react": "^4.2.1",
        vite: "^5.0.8"
      }
    };
    
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
`;
    
    const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Alice's CoVibes App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
    
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
    
    const appJsx = `import React, { useState, useEffect } from 'react'

function App() {
  const [count, setCount] = useState(0)
  const [time, setTime] = useState(new Date().toLocaleTimeString())
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  
  return (
    <div style={{ 
      fontFamily: 'system-ui',
      maxWidth: '800px',
      margin: '2rem auto',
      padding: '2rem',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      color: 'white',
      textAlign: 'center'
    }}>
      <h1>🎉 Alice's CoVibes App - FIXED!</h1>
      <h2>✅ No More Redirect Loops!</h2>
      
      <div style={{ margin: '2rem 0' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
          Current time: <strong>{time}</strong>
        </p>
        
        <div style={{ margin: '2rem 0' }}>
          <button 
            onClick={() => setCount(count + 1)}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Counter: {count}
          </button>
        </div>
        
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '1rem', 
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <h3>🔧 Fix Applied:</h3>
          <p>Removed VITE_BASE_PATH environment variable</p>
          <p>Container now serves content properly at root /</p>
          <p>No more infinite redirects!</p>
        </div>
      </div>
      
      <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
        This React app demonstrates that the preview system now works correctly
        without redirect loops. Hot Module Replacement should also work!
      </p>
    </div>
  )
}

export default App
`;
    
    // Write all files
    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    await fs.writeFile(path.join(projectDir, 'vite.config.js'), viteConfig);
    await fs.writeFile(path.join(projectDir, 'index.html'), htmlTemplate);
    
    const srcDir = path.join(projectDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'main.jsx'), mainJsx);
    await fs.writeFile(path.join(srcDir, 'App.jsx'), appJsx);
    
    // Create Dockerfile (without VITE_BASE_PATH!)
    const dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port  
EXPOSE 5173

# Run dev server with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]`;
    
    await fs.writeFile(path.join(projectDir, 'Dockerfile'), dockerfile);
    
    console.log('📦 Building Docker image...');
    await execAsync(`docker build -t preview-${teamId} .`, { cwd: projectDir });
    
    console.log(`🐳 Starting container on port ${port} WITHOUT VITE_BASE_PATH...`);
    const { stdout } = await execAsync(
      `docker run -d --rm ` +
      `--name preview-${teamId} ` +
      `-p ${port}:5173 ` +
      `-v ${projectDir}:/app ` +
      `-v /app/node_modules ` +
      `-e CHOKIDAR_USEPOLLING=true ` +
      `-e PORT=5173 ` +
      // NO VITE_BASE_PATH - this was causing the redirect loop!
      `preview-${teamId}`
    );
    
    const containerId = stdout.trim();
    console.log(`✅ Container started: ${containerId}`);
    
    // Save to database
    await prisma.preview_deployments.create({
      data: {
        id: require('crypto').randomUUID(),
        teamId,
        containerId,
        containerName: `preview-${teamId}`,
        port,
        proxyPort: null, // We'll test without proxy first
        status: 'running',
        projectType: 'vite-react',
        updatedAt: new Date()
      }
    });
    
    console.log(`🎉 FIXED preview created successfully!`);
    console.log(`📱 Direct container URL: http://localhost:${port}/`);
    console.log(`🌐 Express proxy URL: http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/api/preview/proxy/${teamId}/main/`);
    console.log(`⏰ Waiting 10 seconds for container to fully start...`);
    
    // Wait and test
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log(`🧪 Testing direct container access...`);
    try {
      const testResult = await execAsync(`curl -I http://localhost:${port}/`);
      console.log(`✅ Direct container test result:\n${testResult.stdout}`);
    } catch (e) {
      console.log(`❌ Direct container test failed: ${e.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating fixed preview:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFixedPreview();