# Workspace Synchronization Container
#
# Handles git synchronization and workspace management

FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    bash \
    inotify-tools \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create sync user
RUN addgroup -g 1000 sync && \
    adduser -D -s /bin/bash -u 1000 -G sync sync

# Create directories
RUN mkdir -p /workspace /home/sync/.ssh && \
    chown -R sync:sync /workspace /home/sync

# Switch to sync user
USER sync
WORKDIR /workspace

# Set up SSH configuration
RUN echo "Host *" > /home/sync/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /home/sync/.ssh/config && \
    echo "    UserKnownHostsFile /dev/null" >> /home/sync/.ssh/config && \
    echo "    LogLevel ERROR" >> /home/sync/.ssh/config && \
    chmod 600 /home/sync/.ssh/config

# Copy sync script
COPY --chown=sync:sync workspace-sync.sh /usr/local/bin/workspace-sync.sh
RUN chmod +x /usr/local/bin/workspace-sync.sh

# Environment variables
ENV SYNC_INTERVAL=5
ENV GIT_AUTHOR_NAME="ColabVibe Sync"
ENV GIT_AUTHOR_EMAIL="sync@colabvibe.dev"
ENV GIT_COMMITTER_NAME="ColabVibe Sync"
ENV GIT_COMMITTER_EMAIL="sync@colabvibe.dev"

# Default command
CMD ["/usr/local/bin/workspace-sync.sh"]