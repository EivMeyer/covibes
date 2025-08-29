# Claude Agent Base Container
#
# This container provides:
# - Node.js runtime for Claude CLI
# - Development tools and utilities
# - Proper user permissions (UID/GID 1000:1000)
# - Workspace directory setup
# - SSH client for git operations
# - File watching capabilities

ARG NODE_VERSION=20
ARG CLAUDE_VERSION=latest

FROM node:${NODE_VERSION}-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    wget \
    bash \
    nano \
    vim \
    python3 \
    py3-pip \
    make \
    g++ \
    linux-headers \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=UTC

# Create claude user with UID/GID 1000:1000 for consistency
RUN addgroup -g 1000 claude && \
    adduser -D -s /bin/bash -u 1000 -G claude claude

# Create workspace and essential directories
RUN mkdir -p /workspace /home/claude/.ssh /home/claude/.config /tmp/agent && \
    chown -R claude:claude /workspace /home/claude /tmp/agent && \
    chmod 755 /workspace && \
    chmod 700 /home/claude/.ssh

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-cli@${CLAUDE_VERSION} && \
    npm cache clean --force

# Install additional development tools
RUN npm install -g \
    typescript \
    ts-node \
    nodemon \
    @types/node \
    prettier \
    eslint \
    && npm cache clean --force

# Python development tools (for Python projects)
RUN pip3 install --no-cache-dir \
    pipenv \
    poetry \
    black \
    flake8 \
    pytest

# Switch to claude user
USER claude
WORKDIR /workspace

# Set up SSH configuration
RUN echo "Host *" > /home/claude/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /home/claude/.ssh/config && \
    echo "    UserKnownHostsFile /dev/null" >> /home/claude/.ssh/config && \
    echo "    LogLevel ERROR" >> /home/claude/.ssh/config && \
    chmod 600 /home/claude/.ssh/config

# Set up git configuration defaults
RUN git config --global user.name "Claude Agent" && \
    git config --global user.email "agent@colabvibe.dev" && \
    git config --global init.defaultBranch main && \
    git config --global pull.rebase true && \
    git config --global push.autoSetupRemote true

# Create Claude agent wrapper script
COPY --chown=claude:claude claude-agent-wrapper.sh /usr/local/bin/claude-agent
RUN chmod +x /usr/local/bin/claude-agent

# Create agent service script
COPY --chown=claude:claude agent-service.js /home/claude/agent-service.js
RUN chmod +x /home/claude/agent-service.js

# Environment variables
ENV NODE_ENV=development
ENV CLAUDE_CONFIG_DIR=/home/claude/.config/claude
ENV WORKSPACE_PATH=/workspace
ENV PATH="/home/claude/.local/bin:${PATH}"

# Health check endpoint
EXPOSE 8080

# Create health check script
RUN echo '#!/bin/bash' > /home/claude/health-check.sh && \
    echo 'echo "OK" | nc -l -p 8080' >> /home/claude/health-check.sh && \
    chmod +x /home/claude/health-check.sh

# Set working directory to workspace
WORKDIR /workspace

# Default command runs the agent service
CMD ["/home/claude/agent-service.js"]