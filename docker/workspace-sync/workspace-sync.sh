#!/bin/bash
#
# Workspace Synchronization Script
#
# Handles automatic git synchronization for multi-agent workspaces

set -euo pipefail

# Configuration
TEAM_ID="${TEAM_ID:-default}"
REPOSITORY_URL="${REPOSITORY_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SYNC_INTERVAL="${SYNC_INTERVAL:-5}"
WORKSPACE_PATH="/workspace"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SYNC:$TEAM_ID] $1" >&2
}

# Initialize workspace
initialize_workspace() {
    log "Initializing workspace for team $TEAM_ID"
    
    cd "$WORKSPACE_PATH"
    
    # If repository URL is provided and we don't have a git repo
    if [[ -n "$REPOSITORY_URL" ]] && [[ ! -d ".git" ]]; then
        log "Cloning repository: $REPOSITORY_URL"
        
        # Clone with specific branch
        if git clone --branch "$GIT_BRANCH" --single-branch "$REPOSITORY_URL" temp_repo; then
            # Move contents to workspace root
            mv temp_repo/.git .git
            mv temp_repo/* . 2>/dev/null || true
            mv temp_repo/.* . 2>/dev/null || true
            rm -rf temp_repo
            
            # Set up git configuration
            git config user.name "$GIT_AUTHOR_NAME"
            git config user.email "$GIT_AUTHOR_EMAIL"
            
            log "Repository cloned successfully"
        else
            log "Failed to clone repository, continuing with empty workspace"
        fi
    elif [[ -d ".git" ]]; then
        log "Git repository already exists, configuring..."
        
        # Set up git configuration
        git config user.name "$GIT_AUTHOR_NAME"
        git config user.email "$GIT_AUTHOR_EMAIL"
        
        # Ensure we're on the right branch
        if git show-ref --verify --quiet "refs/heads/$GIT_BRANCH"; then
            git checkout "$GIT_BRANCH" 2>/dev/null || log "Failed to checkout $GIT_BRANCH"
        else
            log "Branch $GIT_BRANCH does not exist locally"
        fi
    else
        log "No repository URL provided, initializing empty git repository"
        git init
        git config user.name "$GIT_AUTHOR_NAME"
        git config user.email "$GIT_AUTHOR_EMAIL"
        
        # Create initial commit if no files exist
        if [[ ! -f "README.md" ]]; then
            echo "# $TEAM_ID Workspace" > README.md
            git add README.md
            git commit -m "Initial workspace setup"
        fi
    fi
}

# Fetch latest changes from remote
fetch_changes() {
    if [[ -d ".git" ]] && [[ -n "$REPOSITORY_URL" ]]; then
        log "Fetching latest changes from remote"
        
        if git fetch origin "$GIT_BRANCH" 2>/dev/null; then
            # Check if there are new commits
            local local_hash=$(git rev-parse HEAD)
            local remote_hash=$(git rev-parse "origin/$GIT_BRANCH" 2>/dev/null || echo "$local_hash")
            
            if [[ "$local_hash" != "$remote_hash" ]]; then
                log "New changes detected, merging..."
                
                # Stash local changes if any
                if ! git diff --quiet || ! git diff --cached --quiet; then
                    log "Stashing local changes"
                    git stash push -m "Auto-stash before sync $(date)"
                fi
                
                # Merge remote changes
                if git merge "origin/$GIT_BRANCH" --no-edit; then
                    log "Successfully merged remote changes"
                    
                    # Pop stash if we stashed changes
                    if git stash list | grep -q "Auto-stash before sync"; then
                        log "Restoring local changes"
                        git stash pop || log "Failed to restore local changes, manual resolution may be needed"
                    fi
                else
                    log "Merge conflict detected, manual resolution required"
                fi
            fi
        else
            log "Failed to fetch from remote"
        fi
    fi
}

# Commit and push local changes
push_changes() {
    if [[ -d ".git" ]]; then
        # Check for local changes
        if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git status --porcelain)" ]]; then
            log "Local changes detected, committing..."
            
            # Add all changes
            git add -A
            
            # Create commit with timestamp
            local commit_message="Auto-sync: $(date '+%Y-%m-%d %H:%M:%S') - Team $TEAM_ID"
            git commit -m "$commit_message" || log "No changes to commit"
            
            # Push if repository URL is configured
            if [[ -n "$REPOSITORY_URL" ]]; then
                log "Pushing changes to remote"
                if git push origin "$GIT_BRANCH"; then
                    log "Successfully pushed changes"
                else
                    log "Failed to push changes, will retry later"
                fi
            fi
        fi
    fi
}

# File system watcher
start_file_watcher() {
    log "Starting file system watcher"
    
    # Watch for file changes using inotifywait
    inotifywait -m -r -e modify,create,delete,move \
        --exclude '(\.git/|node_modules/|\.DS_Store|\.swp$|\.tmp$)' \
        "$WORKSPACE_PATH" |
    while read -r path event file; do
        log "File change detected: $event $path$file"
        
        # Debounce rapid changes (wait a bit for more changes)
        sleep 2
        
        # Commit and push changes
        push_changes
    done &
    
    local watcher_pid=$!
    echo $watcher_pid > /tmp/watcher.pid
    log "File watcher started with PID $watcher_pid"
}

# Periodic sync function
periodic_sync() {
    while true; do
        log "Running periodic sync"
        
        # Fetch changes first
        fetch_changes
        
        # Then push any local changes
        push_changes
        
        log "Sync completed, sleeping for ${SYNC_INTERVAL}m"
        sleep "${SYNC_INTERVAL}m"
    done
}

# Cleanup function
cleanup() {
    log "Received termination signal, cleaning up"
    
    # Kill file watcher if running
    if [[ -f /tmp/watcher.pid ]]; then
        local watcher_pid=$(cat /tmp/watcher.pid)
        kill "$watcher_pid" 2>/dev/null || true
        rm -f /tmp/watcher.pid
    fi
    
    # Final sync before exit
    log "Performing final sync before shutdown"
    push_changes
    
    log "Workspace sync stopped"
    exit 0
}

# Signal handling
trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log "Starting workspace synchronization service"
    log "Team ID: $TEAM_ID"
    log "Repository: ${REPOSITORY_URL:-none}"
    log "Branch: $GIT_BRANCH"
    log "Sync interval: ${SYNC_INTERVAL}m"
    
    # Initialize workspace
    initialize_workspace
    
    # Start file watcher in background
    start_file_watcher
    
    # Start periodic sync (blocks)
    periodic_sync
}

# Run main function
main