# Claude Agent Container
# This container provides a development environment with Claude CLI pre-installed
# Users authenticate by running `claude login` directly in their container

FROM node:18-alpine

# Install required system packages including SSH server
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    openssh-server \
    curl \
    nano \
    vim \
    python3 \
    py3-pip \
    build-base \
    linux-headers \
    tmux \
    sudo

# Create a non-root user for development
RUN adduser -D -s /bin/bash developer && \
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    echo "developer:developer" | chpasswd

# Configure SSH server
RUN ssh-keygen -A && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    mkdir -p /home/developer/.ssh && \
    chown developer:developer /home/developer/.ssh && \
    chmod 700 /home/developer/.ssh

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set up workspace directory
RUN mkdir -p /workspace && \
    chown developer:developer /workspace

# Create tmux configuration for better terminal experience
RUN echo 'set -g default-terminal "screen-256color"' > /etc/tmux.conf && \
    echo 'set -g mouse on' >> /etc/tmux.conf && \
    echo 'set -g history-limit 10000' >> /etc/tmux.conf

# Set up git configuration template (users will override with their own)
RUN git config --global init.defaultBranch main && \
    git config --global user.name "Claude Agent" && \
    git config --global user.email "agent@colabvibe.dev"

# Install common development tools
RUN npm install -g \
    typescript \
    ts-node \
    eslint \
    prettier \
    @types/node

# Install Python development tools
RUN pip3 install --break-system-packages \
    requests \
    black \
    pylint \
    pytest

# Set up SSH keys for passwordless access (optional)
# Note: In production, you would mount SSH keys as volumes

# Switch to developer user for final setup
USER developer
WORKDIR /workspace

# Create a welcome message for new sessions
RUN echo 'echo "🚀 ColabVibe Claude Agent Container"' >> /home/developer/.bashrc && \
    echo 'echo "📁 Workspace: /workspace"' >> /home/developer/.bashrc && \
    echo 'echo "🤖 Claude CLI: $(claude --version 2>/dev/null || echo 'Run: claude login')"' >> /home/developer/.bashrc && \
    echo 'echo "📋 List tmux sessions: tmux list-sessions"' >> /home/developer/.bashrc && \
    echo 'echo "🔗 Attach to session: tmux attach-session -t <session-name>"' >> /home/developer/.bashrc && \
    echo 'echo ""' >> /home/developer/.bashrc

# Switch back to root for service management
USER root

# Expose SSH port and web server ports
EXPOSE 22 3000 3001 8000 8080

# Default command starts SSH daemon and keeps container running
CMD ["/bin/sh", "-c", "/usr/sbin/sshd -D"]