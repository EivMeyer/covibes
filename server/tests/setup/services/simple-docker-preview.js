/**
 * Simple Docker Preview Service
 *
 * KISS principle: Just run a simple nginx container with static files
 * No Vite, no HMR, no complex proxy rules - just serve files
 */
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
const execAsync = promisify(exec);
class SimpleDockerPreview {
    constructor() {
        this.previews = new Map();
        this.basePort = 5000;
    }
    async startPreview(teamId) {
        // Stop any existing preview
        await this.stopPreview(teamId);
        const port = this.basePort + Array.from(this.previews.keys()).length;
        try {
            // Create a simple HTML file to serve
            const contentDir = `/tmp/preview-${teamId}`;
            await fs.mkdir(contentDir, { recursive: true });
            // Create a simple HTML page
            const html = `<!DOCTYPE html>
<html>
<head>
    <title>ColabVibe Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
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
        }
        h1 { margin-top: 0; }
        .status { 
            background: #10B981; 
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
        }
        .info {
            margin: 20px 0;
            padding: 20px;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
        }
        button {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        #counter {
            font-size: 72px;
            font-weight: bold;
            text-align: center;
            margin: 40px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ColabVibe Docker Preview</h1>
        <div class="status">✅ RUNNING</div>
        
        <div class="info">
            <p><strong>Team ID:</strong> ${teamId}</p>
            <p><strong>Port:</strong> ${port}</p>
            <p><strong>Container:</strong> nginx:alpine</p>
            <p><strong>Status:</strong> Simple, working, no complexity!</p>
        </div>

        <div id="counter">0</div>
        
        <div style="text-align: center;">
            <button onclick="increment()">➕ Increment</button>
            <button onclick="decrement()">➖ Decrement</button>
            <button onclick="reset()">🔄 Reset</button>
        </div>

        <div class="info" style="margin-top: 40px;">
            <h3>Why this works:</h3>
            <ul>
                <li>✅ Simple nginx Docker container</li>
                <li>✅ Static files served directly</li>
                <li>✅ No complex build process</li>
                <li>✅ No module resolution issues</li>
                <li>✅ Works in iframes without issues</li>
            </ul>
        </div>
    </div>

    <script>
        let count = 0;
        const counterEl = document.getElementById('counter');

        function updateCounter() {
            counterEl.textContent = count;
            counterEl.style.color = count > 0 ? '#10B981' : (count < 0 ? '#EF4444' : 'white');
        }

        function increment() {
            count++;
            updateCounter();
        }

        function decrement() {
            count--;
            updateCounter();
        }

        function reset() {
            count = 0;
            updateCounter();
        }

        // Simple auto-refresh every 30 seconds to show it's live
        setInterval(() => {
            document.title = 'ColabVibe Preview - ' + new Date().toLocaleTimeString();
        }, 1000);
    </script>
</body>
</html>`;
            await fs.writeFile(path.join(contentDir, 'index.html'), html);
            // Run nginx container
            const { stdout } = await execAsync(`docker run -d --rm --name preview-${teamId} -p ${port}:80 -v ${contentDir}:/usr/share/nginx/html:ro nginx:alpine`);
            const containerId = stdout.trim();
            this.previews.set(teamId, {
                running: true,
                port,
                containerId
            });
            console.log(`✅ Docker preview started for team ${teamId} on port ${port}`);
            return {
                port,
                url: `/api/preview/${teamId}/workspace/`
            };
        }
        catch (error) {
            console.error('Failed to start Docker preview:', error);
            throw new Error('Failed to start preview container');
        }
    }
    async stopPreview(teamId) {
        const preview = this.previews.get(teamId);
        if (!preview || !preview.running)
            return;
        try {
            await execAsync(`docker stop preview-${teamId}`);
            console.log(`✅ Stopped Docker preview for team ${teamId}`);
        }
        catch (error) {
            // Container might already be stopped
            console.log(`Preview container for ${teamId} already stopped`);
        }
        this.previews.delete(teamId);
    }
    getPreviewStatus(teamId) {
        return this.previews.get(teamId) || null;
    }
}
export const simpleDockerPreview = new SimpleDockerPreview();
