#!/bin/bash

# ColabVibe VM Setup Script
# 
# This script sets up individual VMs for users to run their agents
# It installs necessary tools and configures the environment for secure agent execution
# 
# Prerequisites:
# - Fresh Ubuntu 20.04+ VM
# - SSH access with sudo privileges
# - Internet connectivity

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_USER="developer"
CLAUDE_USER="claude"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Parse command line arguments
SETUP_TYPE="${1:-full}"  # full, basic, or update
TARGET_USER="${2:-$DEFAULT_USER}"

log "Starting ColabVibe VM setup (type: $SETUP_TYPE)"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    warn "Running as root. This script should be run as a regular user with sudo access."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system packages
update_system() {
    log "Updating system packages..."
    sudo apt-get update
    sudo apt-get upgrade -y
    sudo apt-get autoremove -y
    sudo apt-get autoclean
}

# Install essential development tools
install_dev_tools() {
    log "Installing development tools..."
    
    # Essential tools
    sudo apt-get install -y \
        curl \
        wget \
        git \
        vim \
        nano \
        htop \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    # Build tools
    sudo apt-get install -y \
        build-essential \
        make \
        gcc \
        g++ \
        python3 \
        python3-pip \
        python3-venv
}

# Install Node.js and npm
install_nodejs() {
    log "Installing Node.js and npm..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    log "Node.js version: $node_version"
    log "npm version: $npm_version"
    
    # Install global development tools
    sudo npm install -g \
        pm2 \
        nodemon \
        typescript \
        ts-node \
        @types/node
}

# Install Python tools
install_python_tools() {
    log "Installing Python development tools..."
    
    # pip packages
    pip3 install --user \
        virtualenv \
        pipenv \
        requests \
        jupyter \
        numpy \
        pandas
    
    # Add user pip bin to PATH
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    sudo usermod -aG docker $TARGET_USER 2>/dev/null || true
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log "Docker installed. You may need to log out and back in for group changes to take effect."
}

# Set up user environment for agents
setup_agent_environment() {
    log "Setting up agent environment..."
    
    # Create agent user if it doesn't exist
    if ! id "$CLAUDE_USER" &>/dev/null; then
        sudo useradd -m -s /bin/bash "$CLAUDE_USER"
        log "Created user: $CLAUDE_USER"
    fi
    
    # Create working directories
    sudo mkdir -p "/home/$CLAUDE_USER/workspace"
    sudo mkdir -p "/home/$CLAUDE_USER/.ssh"
    sudo chown -R "$CLAUDE_USER:$CLAUDE_USER" "/home/$CLAUDE_USER"
    
    # Set up development workspace for target user
    mkdir -p "$HOME/workspace"
    mkdir -p "$HOME/.config"
    
    # Create useful aliases
    cat >> "$HOME/.bashrc" << 'EOF'

# ColabVibe Agent Development Aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias workspace='cd ~/workspace'
alias logs='sudo journalctl -f'
alias dockerlogs='docker logs -f'

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline'

# Development shortcuts
alias py='python3'
alias pip='pip3'
alias serve='python3 -m http.server'
alias nb='jupyter notebook --ip=0.0.0.0'
EOF
}

# Configure security settings
configure_security() {
    log "Configuring security settings..."
    
    # Configure SSH (basic hardening)
    sudo sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config
    sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
    sudo sed -i 's/X11Forwarding yes/X11Forwarding no/' /etc/ssh/sshd_config
    
    # Install and configure fail2ban
    sudo apt-get install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    # Configure firewall (basic rules)
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 3000:3010/tcp  # Development servers
    sudo ufw --force enable
    
    log "Basic security configuration completed"
}

# Install development databases (optional)
install_databases() {
    log "Installing development databases..."
    
    # PostgreSQL
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    
    # Redis
    sudo apt-get install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    
    # MongoDB (optional)
    if [[ "${SETUP_TYPE}" == "full" ]]; then
        wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
        echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        sudo apt-get update
        sudo apt-get install -y mongodb-org
        sudo systemctl enable mongod
        sudo systemctl start mongod
    fi
}

# Set up monitoring tools
install_monitoring() {
    log "Installing monitoring tools..."
    
    # System monitoring
    sudo apt-get install -y \
        htop \
        iotop \
        nethogs \
        tree \
        ncdu \
        tmux \
        screen
    
    # Log monitoring
    sudo apt-get install -y logwatch
}

# Create useful scripts
create_utility_scripts() {
    log "Creating utility scripts..."
    
    # System info script
    cat > "$HOME/system-info.sh" << 'EOF'
#!/bin/bash
echo "=== System Information ==="
echo "Hostname: $(hostname)"
echo "OS: $(lsb_release -d | cut -d: -f2 | sed 's/^\t//')"
echo "Kernel: $(uname -r)"
echo "Uptime: $(uptime -p)"
echo "Load: $(uptime | awk -F'load average:' '{ print $2 }')"
echo
echo "=== Memory Usage ==="
free -h
echo
echo "=== Disk Usage ==="
df -h /
echo
echo "=== Network ==="
ip route get 8.8.8.8 | awk '{print $7}' | head -n1 | xargs -I {} echo "IP Address: {}"
EOF
    chmod +x "$HOME/system-info.sh"
    
    # Quick development setup script
    cat > "$HOME/quick-setup.sh" << 'EOF'
#!/bin/bash
# Quick setup for a new development project
if [ -z "$1" ]; then
    echo "Usage: $0 <project-name>"
    exit 1
fi

PROJECT_NAME="$1"
mkdir -p ~/workspace/"$PROJECT_NAME"
cd ~/workspace/"$PROJECT_NAME"

echo "# $PROJECT_NAME" > README.md
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "*.log" >> .gitignore

git init
git add .
git commit -m "Initial commit"

echo "Project $PROJECT_NAME created in ~/workspace/$PROJECT_NAME"
EOF
    chmod +x "$HOME/quick-setup.sh"
}

# Install code editors
install_editors() {
    log "Installing code editors..."
    
    # Install VS Code
    wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
    sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
    sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
    sudo apt-get update
    sudo apt-get install -y code
    
    # Install vim plugins manager
    if [ ! -d "$HOME/.vim/bundle/Vundle.vim" ]; then
        git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim
    fi
}

# Final system configuration
finalize_setup() {
    log "Finalizing system setup..."
    
    # Update locate database
    sudo updatedb
    
    # Create welcome message
    cat > "$HOME/WELCOME.md" << EOF
# ColabVibe VM Setup Complete! 🎉

Your development VM is now ready for ColabVibe agent execution.

## What's been installed:
- Node.js $(node --version) and npm $(npm --version)
- Python 3 with common packages
- Docker and Docker Compose
- Git and development tools
- PostgreSQL and Redis
- VS Code and vim
- Security tools (fail2ban, ufw)

## Quick commands:
- \`~/system-info.sh\` - View system information
- \`~/quick-setup.sh <project-name>\` - Create new project
- \`workspace\` - Go to workspace directory
- \`docker ps\` - List running containers
- \`sudo systemctl status <service>\` - Check service status

## Workspace:
Your main workspace is at: ~/workspace/

## Agent user:
A special user '$CLAUDE_USER' has been created for agent execution.

## Security:
- Firewall is enabled (ports 22, 3000-3010 open)
- fail2ban is running
- SSH is configured

## Next steps:
1. Log out and back in for group changes to take effect
2. Configure your SSH keys
3. Test the development environment
4. Connect this VM to your ColabVibe team

Happy coding! 🚀
EOF

    # Show final status
    echo
    log "VM setup completed successfully!"
    echo
    cat "$HOME/WELCOME.md"
}

# Main execution flow
case "$SETUP_TYPE" in
    "full")
        log "Starting full VM setup..."
        update_system
        install_dev_tools
        install_nodejs
        install_python_tools
        install_docker
        setup_agent_environment
        configure_security
        install_databases
        install_monitoring
        create_utility_scripts
        install_editors
        finalize_setup
        ;;
    "basic")
        log "Starting basic VM setup..."
        update_system
        install_dev_tools
        install_nodejs
        setup_agent_environment
        configure_security
        create_utility_scripts
        finalize_setup
        ;;
    "update")
        log "Updating existing VM setup..."
        update_system
        create_utility_scripts
        log "Update completed!"
        ;;
    *)
        error "Unknown setup type: $SETUP_TYPE"
        echo "Usage: $0 [full|basic|update] [username]"
        exit 1
        ;;
esac

log "Setup type '$SETUP_TYPE' completed successfully!"
log "You may need to log out and back in for all changes to take effect."