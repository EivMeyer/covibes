#!/bin/bash
#
# Claude Agent Wrapper Script
#
# This script provides a standardized interface for running Claude agents
# within Docker containers with proper environment setup and error handling

set -euo pipefail

# Configuration from environment variables
AGENT_ID="${CLAUDE_AGENT_ID:-default}"
AGENT_TYPE="${CLAUDE_AGENT_TYPE:-code-writer}"
WORKSPACE_PATH="${WORKSPACE_PATH:-/workspace}"
TEAM_ID="${TEAM_ID:-default}"
REPOSITORY_URL="${REPOSITORY_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SOCKET_URL="${SOCKET_URL:-}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$AGENT_ID] $1" >&2
}

# Error handling
handle_error() {
    local exit_code=$?
    log "ERROR: Agent execution failed with exit code $exit_code"
    exit $exit_code
}

trap handle_error ERR

# Initialize function
initialize_workspace() {
    log "Initializing workspace for agent $AGENT_ID"
    
    # Ensure workspace exists
    mkdir -p "$WORKSPACE_PATH"
    cd "$WORKSPACE_PATH"
    
    # Clone repository if URL provided and not already cloned
    if [[ -n "$REPOSITORY_URL" && ! -d ".git" ]]; then
        log "Cloning repository: $REPOSITORY_URL"
        git clone --branch "$GIT_BRANCH" --single-branch "$REPOSITORY_URL" . || {
            log "Repository clone failed, continuing with empty workspace"
        }
    fi
    
    # Set up git configuration
    if [[ -d ".git" ]]; then
        git config user.name "Claude Agent $AGENT_ID"
        git config user.email "agent-$AGENT_ID@colabvibe.dev"
        
        # Fetch latest changes
        log "Syncing with remote repository"
        git fetch origin "$GIT_BRANCH" 2>/dev/null || log "Failed to fetch from remote"
        git checkout "$GIT_BRANCH" 2>/dev/null || log "Failed to checkout branch $GIT_BRANCH"
    fi
    
    log "Workspace initialized at $WORKSPACE_PATH"
}

# Main execution function
execute_agent() {
    local task="$1"
    local mode="$2"
    
    log "Starting Claude agent with task: $task"
    log "Agent type: $AGENT_TYPE, Mode: $mode"
    
    # Prepare Claude command based on agent type and mode
    local claude_cmd="claude"
    local claude_args=""
    
    case "$mode" in
        interactive)
            claude_args="--mode interactive"
            ;;
        code)
            claude_args="--mode code --task \"$task\""
            ;;
        general)
            claude_args="--mode general --task \"$task\""
            ;;
        *)
            claude_args="--task \"$task\""
            ;;
    esac
    
    # Add repository context if available
    if [[ -n "$REPOSITORY_URL" ]]; then
        claude_args="$claude_args --repository \"$REPOSITORY_URL\""
    fi
    
    # Execute Claude with proper environment
    log "Executing: $claude_cmd $claude_args"
    
    # Set environment for Claude execution
    export CLAUDE_API_KEY="$CLAUDE_API_KEY"
    export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"  # Fallback
    
    # Run Claude with output capture
    eval "$claude_cmd $claude_args" 2>&1 | while IFS= read -r line; do
        echo "$line"
        # Send output to backend service if socket URL provided
        if [[ -n "$SOCKET_URL" ]]; then
            curl -s -X POST "$SOCKET_URL/api/agents/$AGENT_ID/output" \
                -H "Content-Type: application/json" \
                -d "{\"output\": \"$line\", \"timestamp\": \"$(date -Iseconds)\"}" \
                >/dev/null 2>&1 || true
        fi
    done
}

# Health check function
health_check() {
    log "Performing health check"
    
    # Check Claude CLI availability
    if ! command -v claude >/dev/null 2>&1; then
        log "ERROR: Claude CLI not found"
        exit 1
    fi
    
    # Check workspace accessibility
    if [[ ! -d "$WORKSPACE_PATH" || ! -w "$WORKSPACE_PATH" ]]; then
        log "ERROR: Workspace not accessible: $WORKSPACE_PATH"
        exit 1
    fi
    
    # Check API key presence
    if [[ -z "${CLAUDE_API_KEY:-}" ]]; then
        log "ERROR: CLAUDE_API_KEY not set"
        exit 1
    fi
    
    log "Health check passed"
    echo "OK"
}

# File watcher function
watch_files() {
    log "Starting file watcher"
    
    # Use inotifywait if available, fallback to polling
    if command -v inotifywait >/dev/null 2>&1; then
        while inotifywait -r -e modify,create,delete "$WORKSPACE_PATH" 2>/dev/null; do
            log "File change detected in workspace"
            # Notify backend service
            if [[ -n "$SOCKET_URL" ]]; then
                curl -s -X POST "$SOCKET_URL/api/agents/$AGENT_ID/file-change" \
                    -H "Content-Type: application/json" \
                    -d "{\"timestamp\": \"$(date -Iseconds)\", \"workspace\": \"$WORKSPACE_PATH\"}" \
                    >/dev/null 2>&1 || true
            fi
        done
    else
        log "File watching not available (inotifywait not found)"
    fi
}

# Signal handling
cleanup() {
    log "Received termination signal, cleaning up"
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    log "Agent $AGENT_ID stopped"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main entry point
main() {
    local command="${1:-execute}"
    
    case "$command" in
        init)
            initialize_workspace
            ;;
        health)
            health_check
            ;;
        watch)
            watch_files
            ;;
        execute)
            local task="${2:-}"
            local mode="${3:-general}"
            initialize_workspace
            execute_agent "$task" "$mode"
            ;;
        service)
            # Run as a service (daemon mode)
            log "Starting agent service"
            initialize_workspace
            
            # Start file watcher in background
            watch_files &
            
            # Wait for tasks or handle interactive mode
            while true; do
                sleep 30
                log "Agent service running (heartbeat)"
            done
            ;;
        *)
            log "Usage: $0 {init|health|watch|execute|service} [task] [mode]"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"