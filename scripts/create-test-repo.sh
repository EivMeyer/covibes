#!/bin/bash

# Create a test repository for Covibes testing
# This sets up a local git repository with a simple project

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_REPO_DIR="$SCRIPT_DIR/../test-repo"

echo "🧪 Creating test repository for Covibes..."

# Clean up existing test repo
if [ -d "$TEST_REPO_DIR" ]; then
    rm -rf "$TEST_REPO_DIR"
fi

# Create test repository
mkdir -p "$TEST_REPO_DIR"
cd "$TEST_REPO_DIR"

# Initialize git
git init

# Configure git for test repo
git config user.name "Covibes Test"
git config user.email "test@covibes.local"

# Create a simple web project structure
mkdir -p src css js docs tests

# Create package.json
cat > package.json << 'EOF'
{
  "name": "covibes-test-project",
  "version": "1.0.0",
  "description": "A simple test project for Covibes agent collaboration",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "test": "node tests/test.js",
    "build": "echo 'Building project...' && mkdir -p dist && cp src/* dist/",
    "dev": "echo 'Starting dev server...' && node src/app.js"
  },
  "keywords": ["covibes", "test", "collaboration"],
  "author": "Covibes",
  "license": "MIT"
}
EOF

# Create main application file
cat > src/app.js << 'EOF'
// Simple Node.js web application for testing Covibes
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Covibes Test App</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                    <h1>🤝 Covibes Test Application</h1>
                    <p>This is a simple test application for demonstrating agent collaboration.</p>
                    <div class="features">
                        <h2>Features to Add:</h2>
                        <ul id="feature-list">
                            <li>✅ Basic HTML structure</li>
                            <li>⏳ CSS styling</li>
                            <li>⏳ JavaScript interactivity</li>
                            <li>⏳ API endpoints</li>
                            <li>⏳ User authentication</li>
                            <li>⏳ Database integration</li>
                        </ul>
                    </div>
                    <div class="agents">
                        <h2>Agent Tasks:</h2>
                        <p>Multiple Claude agents can work on this project simultaneously!</p>
                    </div>
                </div>
                <script src="/app.js"></script>
            </body>
            </html>
        `);
    } else if (req.url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('/* CSS will be added by agents */\nbody { font-family: Arial, sans-serif; margin: 20px; }');
    } else if (req.url === '/app.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('// JavaScript functionality will be added by agents\nconsole.log("Covibes Test App loaded");');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Covibes Test App running on http://localhost:${PORT}`);
    console.log('📝 This app is designed for agent collaboration testing');
});

module.exports = server;
EOF

# Create CSS file
cat > css/style.css << 'EOF'
/* Basic styling for Covibes test app */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
    color: #333;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    color: #2563eb;
    text-align: center;
    margin-bottom: 30px;
}

.features, .agents {
    margin: 30px 0;
    padding: 20px;
    background: #f8fafc;
    border-radius: 6px;
    border-left: 4px solid #2563eb;
}

#feature-list li {
    margin: 10px 0;
    padding: 5px 0;
}

/* Agents can enhance this CSS */
EOF

# Create JavaScript file
cat > js/app.js << 'EOF'
// Client-side JavaScript for Covibes test app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Covibes Test App initialized');
    
    // Add some basic interactivity that agents can enhance
    const featureList = document.getElementById('feature-list');
    if (featureList) {
        featureList.addEventListener('click', function(e) {
            if (e.target.tagName === 'LI') {
                e.target.style.backgroundColor = '#e0f2fe';
                setTimeout(() => {
                    e.target.style.backgroundColor = '';
                }, 1000);
            }
        });
    }
    
    // Agent collaboration marker
    window.COLABVIBE_AGENTS = [];
    window.addAgentContribution = function(agentName, contribution) {
        window.COLABVIBE_AGENTS.push({
            agent: agentName,
            contribution: contribution,
            timestamp: new Date().toISOString()
        });
        console.log(`📝 Agent ${agentName} contributed: ${contribution}`);
    };
});
EOF

# Create README
cat > README.md << 'EOF'
# Covibes Test Project

This is a simple web application designed for testing Covibes agent collaboration features.

## Purpose

Multiple Claude agents can work on this project simultaneously to demonstrate:
- Collaborative coding
- Real-time updates
- Git integration
- Task distribution

## Project Structure

```
test-project/
├── src/           # Source code
├── css/           # Stylesheets  
├── js/            # Client-side JavaScript
├── tests/         # Test files
├── docs/          # Documentation
└── package.json   # Project configuration
```

## Getting Started

```bash
npm start          # Start the application
npm test           # Run tests
npm run build      # Build for production
npm run dev        # Start development server
```

## Agent Tasks

Agents can work on various aspects of this project:

1. **Frontend Development**
   - Enhance HTML structure
   - Improve CSS styling
   - Add JavaScript functionality

2. **Backend Development** 
   - Add API endpoints
   - Implement authentication
   - Add database integration

3. **Testing**
   - Write unit tests
   - Add integration tests
   - Create end-to-end tests

4. **Documentation**
   - Update README
   - Add code comments
   - Create API documentation

## Collaboration Guidelines

- Each agent should work on a specific feature or component
- Use descriptive commit messages
- Test changes before committing
- Document any new functionality

## Development Log

Agents should add their contributions here:

<!-- Agent contributions will be logged below -->
EOF

# Create a simple test file
cat > tests/test.js << 'EOF'
// Simple tests for the Covibes test application
const http = require('http');
const assert = require('assert');

function testHomePage() {
    return new Promise((resolve, reject) => {
        const req = http.request('http://localhost:3000/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                assert(res.statusCode === 200, 'Home page should return 200');
                assert(data.includes('Covibes'), 'Home page should contain Covibes');
                console.log('✅ Home page test passed');
                resolve();
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Running Covibes Test Suite...');
    
    try {
        await testHomePage();
        console.log('🎉 All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests, testHomePage };
EOF

# Create documentation
cat > docs/AGENTS.md << 'EOF'
# Agent Collaboration Guide

This document outlines how multiple Claude agents can collaborate on this test project.

## Agent Roles

### Frontend Agent
- Responsible for HTML, CSS, and client-side JavaScript
- Focus on user interface and user experience
- Can modify files in `css/`, `js/`, and HTML templates

### Backend Agent  
- Handles server-side logic and APIs
- Works on `src/app.js` and server functionality
- Manages data processing and business logic

### DevOps Agent
- Manages build processes and deployment
- Updates `package.json` scripts
- Handles testing and CI/CD setup

### Documentation Agent
- Maintains README and documentation
- Updates code comments and API docs
- Ensures project documentation is current

## Collaboration Workflow

1. **Pull Latest Changes**: Always start by pulling the latest code
2. **Work on Specific Features**: Focus on your assigned area
3. **Test Your Changes**: Run tests before committing
4. **Commit with Clear Messages**: Use descriptive commit messages
5. **Push and Coordinate**: Share progress with other agents

## Communication

Agents can communicate through:
- Git commit messages
- Code comments
- Documentation updates
- Console log messages

## Best Practices

- Make small, focused commits
- Test changes locally
- Document new features
- Follow existing code style
- Coordinate on shared files
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# Runtime data
pids
*.pid
*.seed
logs
*.log

# Build outputs
dist/
build/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
EOF

# Initial commit
git add .
git commit -m "Initial commit: Covibes test project setup

- Added basic Node.js web application
- Created project structure with src/, css/, js/, tests/, docs/
- Added package.json with development scripts
- Created README with agent collaboration guidelines
- Set up testing framework
- Added documentation for agent roles and workflow

This project is ready for multi-agent collaboration testing."

# Create a few additional commits to simulate development history
echo "/* Enhanced styling for better UX */" >> css/style.css
git add css/style.css
git commit -m "style: enhance CSS with better styling comments"

echo "// Added TODO comments for agent collaboration" >> js/app.js
git add js/app.js
git commit -m "feat: add collaboration markers in JavaScript"

echo "Project created on $(date)" >> README.md
git add README.md
git commit -m "docs: add creation timestamp to README"

# Show repository status
echo ""
echo "✅ Test repository created successfully!"
echo "📍 Location: $TEST_REPO_DIR"
echo "📊 Repository status:"
git log --oneline -5
echo ""
echo "🔧 Repository is ready for Covibes agent testing"
echo ""
echo "Next steps:"
echo "1. Configure Covibes team to use this repository"
echo "2. Set repository URL to: file://$TEST_REPO_DIR"
echo "3. Test with multiple agents working on different features"