# ✅ Simple Claude Terminal Interface

## What This Is
A **standalone HTML terminal interface** that connects directly to your EC2 Claude agent via SSH, bypassing the full CoVibe web application complexity.

## Quick Start

### 1. Start the Terminal Server
```bash
cd server
node simple-claude-server.js
```

### 2. Open Browser Terminal
Open **http://localhost:3002** in your browser

### 3. Configure & Connect
1. **Click "Config"** to set your EC2 details:
   - Host: `ec2-13-60-242-174.eu-north-1.compute.amazonaws.com`
   - Username: `ubuntu`
   - Port: `22`

2. **Click "Connect"** to establish SSH connection

3. **Click "Start Claude"** to begin interactive Claude session

## Files
- **`claude-terminal.html`** - Web terminal interface with xterm.js
- **`simple-claude-server.js`** - Simple Express server handling SSH connections
- **Port 3002** - Terminal server (separate from main CoVibe on 3001)

## Features
✅ **Direct SSH Connection** - No authentication/teams required  
✅ **Real Terminal** - Full xterm.js terminal emulation  
✅ **SSH Key Auto-Discovery** - Tries multiple key locations  
✅ **Interactive Claude** - Start and chat with Claude directly  
✅ **Simple Configuration** - Web-based connection settings  
✅ **Multiple Sessions** - Handle multiple SSH connections  

## SSH Key Discovery
The server automatically looks for SSH keys in this order:
1. `./.ssh/ec2.pem`
2. `./server/.ssh/ec2.pem`  
3. `~/.ssh/id_rsa`

## Terminal Interface
- **Green terminal** with retro styling
- **Status indicator** showing connection state
- **Configuration panel** for SSH settings
- **Command help** panel at bottom
- **Real-time SSH output** streaming

## Usage Examples

### Basic Commands
```bash
# Check environment
whoami
pwd
ls -la

# Check if Claude is installed
which claude
claude --version
```

### Start Claude
```bash
# Method 1: Click "Start Claude" button
# Method 2: Type manually
claude

# Then chat naturally:
Hello Claude, can you help me analyze this codebase?
```

### Claude Commands
```bash
# Inside Claude session
help                 # Claude help
/exit               # Exit Claude
/clear              # Clear screen
```

## How It Works

```
┌─────────────────┐     Socket.io      ┌──────────────────┐     SSH      ┌─────────────┐
│   Browser       │◄──────────────────►│ Simple Server    │◄────────────►│   EC2 VM    │
│ (claude-term.   │     Port 3002      │ (Node.js)        │   Port 22    │  (Claude)   │  
│  html)          │                    │                  │              │             │
└─────────────────┘                    └──────────────────┘              └─────────────┘
```

### Architecture
1. **HTML Frontend** loads xterm.js terminal in browser
2. **Socket.io Connection** establishes WebSocket to server
3. **SSH Connection** server connects to your EC2 instance  
4. **Bidirectional I/O** terminal input/output streams through WebSocket
5. **Claude Integration** type `claude` to start interactive session

## Current vs Full CoVibe

### ✅ Simple Terminal (This)
- **Single HTML file** + simple server
- **Direct SSH connection** to your EC2
- **No authentication** required
- **Immediate Claude access** 
- **Perfect for development/testing**

### 🔧 Full CoVibe System  
- **Complete web application** with teams/auth
- **Multi-user collaboration**
- **Agent management** and history
- **Chat persistence**
- **Production deployment ready**

## Setup for Production SSH

### 1. Ensure EC2 Instance is Running
```bash
# Check EC2 status
aws ec2 describe-instances --instance-ids i-your-instance-id
```

### 2. Place SSH Key
```bash
# Copy your EC2 key to the right location
cp /path/to/your/ec2-key.pem ./.ssh/ec2.pem
chmod 600 ./.ssh/ec2.pem
```

### 3. Install Claude on EC2
```bash
# SSH into your EC2 instance
ssh -i ./.ssh/ec2.pem ubuntu@ec2-13-60-242-174.eu-north-1.compute.amazonaws.com

# Install Claude (example)
curl -sSL https://claude.ai/install.sh | bash
claude --version
```

### 4. Test Connection
Open browser terminal and connect!

## Troubleshooting

### SSH Key Not Found
- Place key at `./.ssh/ec2.pem` 
- Check permissions: `chmod 600 ./.ssh/ec2.pem`
- Update config panel with correct host

### Connection Timeout
- Check EC2 security group allows SSH (port 22)
- Verify EC2 instance is running
- Test manual SSH: `ssh -i ./.ssh/ec2.pem ubuntu@your-host`

### Claude Not Found
- SSH into EC2 and install Claude
- Verify with: `which claude`
- Check Claude authentication setup

## Development

### Modify Terminal Interface
Edit `claude-terminal.html` - it's self-contained with all CSS/JS

### Modify Server Logic  
Edit `simple-claude-server.js` - handles SSH connections and Socket.io

### Add Features
- Multiple tab support
- Session persistence  
- File upload/download
- Terminal recording

## Next Steps

1. **✅ Working Now** - Simple direct SSH terminal to Claude
2. **🔧 Add SSH Key** - Place your EC2 key for real connections  
3. **🚀 Install Claude** - Set up Claude on your EC2 instance
4. **🎯 Production Ready** - Full terminal interface for Claude development

---

**🎉 You now have a simple, working terminal interface to connect directly to your Claude agent on EC2!**

Open **http://localhost:3002** and start coding with Claude! 🤖