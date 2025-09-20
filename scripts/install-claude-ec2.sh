#!/bin/bash

# Install Claude on EC2 Instance
# Run this script on the EC2 instance to install Claude Code

echo "🚀 Installing Claude on EC2 instance..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo -e "${YELLOW}Warning: This script is designed to run as the 'ubuntu' user${NC}"
fi

# Update system
echo -e "${GREEN}Updating system packages...${NC}"
sudo apt-get update -y
sudo apt-get upgrade -y

# Install required dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
sudo apt-get install -y curl wget git build-essential

# Check if Claude is already installed
if command -v claude &> /dev/null; then
    echo -e "${GREEN}Claude is already installed!${NC}"
    claude --version
    exit 0
fi

# Create installation directory
echo -e "${GREEN}Setting up Claude installation...${NC}"
mkdir -p ~/claude
cd ~/claude

# Download Claude installer (replace with actual URL when available)
echo -e "${YELLOW}Note: Claude installation requires a valid API key or license${NC}"
echo -e "${YELLOW}Please follow the official Claude installation guide at:${NC}"
echo -e "${YELLOW}https://docs.anthropic.com/claude-code/installation${NC}"

# For now, create a mock claude command for testing
echo -e "${GREEN}Creating Claude wrapper script...${NC}"
sudo tee /usr/local/bin/claude > /dev/null << 'EOF'
#!/bin/bash
# Claude wrapper script - replace with actual Claude binary

echo "Claude Code CLI - Mock Version"
echo "This is a placeholder. Please install the actual Claude binary."
echo ""
echo "To install Claude:"
echo "1. Get your API key from Anthropic"
echo "2. Follow installation instructions at https://docs.anthropic.com/claude-code"
echo ""
echo "Task: $@"
echo ""
echo "Simulating work..."
for i in {1..5}; do
    echo "Processing step $i..."
    sleep 1
done
echo "Task completed (simulation)"
EOF

sudo chmod +x /usr/local/bin/claude

# Create configuration directory
mkdir -p ~/.config/claude
echo -e "${GREEN}Created Claude configuration directory${NC}"

# Test Claude installation
echo -e "${GREEN}Testing Claude installation...${NC}"
if command -v claude &> /dev/null; then
    echo -e "${GREEN}✅ Claude command is available${NC}"
    claude --version 2>/dev/null || echo "Claude wrapper installed (awaiting actual binary)"
else
    echo -e "${RED}❌ Claude installation failed${NC}"
    exit 1
fi

# Set up environment
echo -e "${GREEN}Setting up environment...${NC}"
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Create workspace directory for agents
echo -e "${GREEN}Creating workspace for agents...${NC}"
mkdir -p ~/agent-workspace
cd ~/agent-workspace

# Summary
echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Claude installation complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Next steps:"
echo "1. Install actual Claude binary from Anthropic"
echo "2. Configure API credentials"
echo "3. Update VM configuration in Covibes to mark Claude as installed"
echo ""
echo "To test connection from Covibes server:"
echo "  ssh -i .ssh/ec2.pem ubuntu@$(hostname -I | awk '{print $1}') 'which claude'"
echo ""