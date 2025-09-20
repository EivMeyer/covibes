#!/bin/bash
#
# Workspace Setup Script
#
# Creates and configures the shared workspace volume structure
# for Covibes multi-agent environments

set -euo pipefail

# Configuration
WORKSPACE_BASE="$HOME/.covibes/workspaces"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SETUP] $1" >&2
}

# Create team workspace
create_team_workspace() {
    local team_id="$1"
    local workspace_path="$WORKSPACE_BASE/$team_id"
    
    log "Creating workspace for team: $team_id"
    log "Workspace path: $workspace_path"
    
    # Create directory structure
    mkdir -p "$workspace_path"/{.git,src,docs,tests,config}
    
    # Set proper permissions (UID/GID 1000:1000)
    if command -v chown >/dev/null 2>&1; then
        chown -R 1000:1000 "$workspace_path"
    fi
    
    chmod -R 755 "$workspace_path"
    
    # Create workspace configuration
    cat > "$workspace_path/.covibes.yml" <<EOF
# Covibes Workspace Configuration
team_id: $team_id
created_at: $(date -Iseconds)
workspace_version: "1.0"

# Directory structure
directories:
  source: src/
  documentation: docs/
  tests: tests/
  configuration: config/
  
# File watching configuration
file_watching:
  enabled: true
  poll_interval: 1000
  ignore_patterns:
    - node_modules/
    - .git/
    - "*.log"
    - "*.tmp"
    - .DS_Store

# Git configuration
git:
  auto_commit: false
  auto_push: false
  commit_prefix: "[auto]"
EOF
    
    # Create initial README
    if [[ ! -f "$workspace_path/README.md" ]]; then
        cat > "$workspace_path/README.md" <<EOF
# Team $team_id Workspace

This is a shared workspace for Covibes team \`$team_id\`.

## Structure

- \`src/\` - Source code files
- \`docs/\` - Documentation
- \`tests/\` - Test files  
- \`config/\` - Configuration files

## Usage

This workspace is shared between all team members and Claude agents. Changes made by any team member or agent will be visible to all others in real-time.

Created: $(date)
EOF
    fi
    
    # Create gitignore if it doesn't exist
    if [[ ! -f "$workspace_path/.gitignore" ]]; then
        cat > "$workspace_path/.gitignore" <<EOF
# Covibes
.covibes/
*.log

# Dependencies
node_modules/
venv/
__pycache__/
.Python
env/

# Build outputs
dist/
build/
*.egg-info/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
.cache/
EOF
    fi
    
    log "Workspace created successfully: $workspace_path"
    echo "$workspace_path"
}

# Initialize workspace with git repository
init_git_workspace() {
    local workspace_path="$1"
    local repository_url="${2:-}"
    local branch="${3:-main}"
    
    log "Initializing git workspace at: $workspace_path"
    
    cd "$workspace_path"
    
    if [[ -n "$repository_url" ]]; then
        log "Cloning repository: $repository_url"
        
        # Clone repository
        if git clone --branch "$branch" --single-branch "$repository_url" temp_clone; then
            # Move git repository to workspace root
            mv temp_clone/.git .git
            
            # Move files, handling hidden files carefully
            if [[ -n "$(ls -A temp_clone/ 2>/dev/null)" ]]; then
                cp -r temp_clone/* . 2>/dev/null || true
                cp -r temp_clone/.* . 2>/dev/null || true
            fi
            
            rm -rf temp_clone
            
            log "Repository cloned successfully"
        else
            log "Failed to clone repository, initializing empty git repository"
            git init
            git checkout -b "$branch"
        fi
    else
        log "No repository URL provided, initializing empty git repository"
        git init
        git checkout -b "$branch"
        
        # Add initial files
        git add README.md .gitignore .covibes.yml
        git commit -m "Initial workspace setup"
    fi
    
    # Configure git
    git config user.name "Covibes Workspace"
    git config user.email "workspace@covibes.ai"
    git config core.autocrlf false
    git config core.fileMode false  # Ignore file permission changes
    
    log "Git workspace initialized"
}

# Set up volume permissions
setup_volume_permissions() {
    local workspace_path="$1"
    
    log "Setting up volume permissions for: $workspace_path"
    
    # Ensure correct ownership and permissions
    if command -v chown >/dev/null 2>&1; then
        chown -R 1000:1000 "$workspace_path"
    fi
    
    # Set directory permissions
    find "$workspace_path" -type d -exec chmod 755 {} \;
    
    # Set file permissions
    find "$workspace_path" -type f -exec chmod 644 {} \;
    
    # Make scripts executable
    find "$workspace_path" -type f \( -name "*.sh" -o -name "*.py" \) -exec chmod 755 {} \;
    
    log "Permissions set successfully"
}

# Create Docker volume mapping
create_volume_mapping() {
    local team_id="$1"
    local workspace_path="$2"
    
    log "Creating Docker volume mapping for team: $team_id"
    
    # Create Docker volume configuration
    local volume_config="$DOCKER_DIR/volumes/$team_id.yml"
    mkdir -p "$(dirname "$volume_config")"
    
    cat > "$volume_config" <<EOF
# Docker Volume Configuration for Team $team_id
version: '3.8'

volumes:
  workspace_${team_id}:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: $workspace_path
EOF
    
    log "Volume mapping created: $volume_config"
}

# Usage information
show_usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  create <team_id> [repository_url] [branch]  Create new team workspace
  init <workspace_path> [repository_url]     Initialize git in existing workspace
  permissions <workspace_path>               Fix permissions for workspace
  volume <team_id> <workspace_path>          Create Docker volume mapping

Examples:
  $0 create team123
  $0 create team123 https://github.com/user/repo.git main
  $0 init ~/.covibes/workspaces/team123
  $0 permissions ~/.covibes/workspaces/team123
  $0 volume team123 ~/.covibes/workspaces/team123

Environment Variables:
  WORKSPACE_BASE   Base directory for workspaces (default: ~/.covibes/workspaces)
EOF
}

# Main function
main() {
    local command="${1:-}"
    
    case "$command" in
        create)
            local team_id="${2:-}"
            local repository_url="${3:-}"
            local branch="${4:-main}"
            
            if [[ -z "$team_id" ]]; then
                echo "Error: Team ID is required" >&2
                show_usage
                exit 1
            fi
            
            # Create workspace directory
            local workspace_path
            workspace_path=$(create_team_workspace "$team_id")
            
            # Initialize git
            init_git_workspace "$workspace_path" "$repository_url" "$branch"
            
            # Set permissions
            setup_volume_permissions "$workspace_path"
            
            # Create volume mapping
            create_volume_mapping "$team_id" "$workspace_path"
            
            log "Team workspace created successfully!"
            echo "Workspace: $workspace_path"
            echo "Volume config: $DOCKER_DIR/volumes/$team_id.yml"
            ;;
            
        init)
            local workspace_path="${2:-}"
            local repository_url="${3:-}"
            
            if [[ -z "$workspace_path" ]]; then
                echo "Error: Workspace path is required" >&2
                show_usage
                exit 1
            fi
            
            init_git_workspace "$workspace_path" "$repository_url"
            ;;
            
        permissions)
            local workspace_path="${2:-}"
            
            if [[ -z "$workspace_path" ]]; then
                echo "Error: Workspace path is required" >&2
                show_usage
                exit 1
            fi
            
            setup_volume_permissions "$workspace_path"
            ;;
            
        volume)
            local team_id="${2:-}"
            local workspace_path="${3:-}"
            
            if [[ -z "$team_id" ]] || [[ -z "$workspace_path" ]]; then
                echo "Error: Team ID and workspace path are required" >&2
                show_usage
                exit 1
            fi
            
            create_volume_mapping "$team_id" "$workspace_path"
            ;;
            
        *)
            echo "Error: Unknown command '$command'" >&2
            show_usage
            exit 1
            ;;
    esac
}

# Ensure base directory exists
mkdir -p "$WORKSPACE_BASE"

# Run main function
main "$@"