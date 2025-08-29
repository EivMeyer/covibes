#!/bin/bash
#
# Container Management Script
#
# Orchestrates Docker containers for ColabVibe multi-agent environments
# Handles dynamic container creation, project type detection, and lifecycle management

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_BASE="/var/colabvibe/workspaces"
GENERATED_DIR="$DOCKER_DIR/generated"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CONTAINER-MGR] $1" >&2
}

# Detect project type from workspace
detect_project_type() {
    local workspace_path="$1"
    
    log "Detecting project type in: $workspace_path"
    
    # Check for package.json (Node.js projects)
    if [[ -f "$workspace_path/package.json" ]]; then
        local package_content
        package_content=$(cat "$workspace_path/package.json")
        
        # Check for specific frameworks
        if echo "$package_content" | grep -q '"next"'; then
            echo "nextjs"
            return
        elif echo "$package_content" | grep -q '"react"' || echo "$package_content" | grep -q '"vite"'; then
            echo "react"
            return
        elif echo "$package_content" | grep -q '"vue"'; then
            echo "vue"
            return
        else
            echo "node"
            return
        fi
    fi
    
    # Check for Python projects
    if [[ -f "$workspace_path/requirements.txt" ]] || [[ -f "$workspace_path/setup.py" ]] || [[ -f "$workspace_path/pyproject.toml" ]]; then
        echo "python"
        return
    fi
    
    # Check for specific Python frameworks
    if find "$workspace_path" -name "manage.py" -o -name "settings.py" | head -1 | grep -q .; then
        echo "python"  # Django
        return
    fi
    
    if find "$workspace_path" -name "*.py" -exec grep -l "Flask\|app = Flask" {} \; | head -1 | grep -q .; then
        echo "python"  # Flask
        return
    fi
    
    # Check for Go projects
    if [[ -f "$workspace_path/go.mod" ]] || [[ -f "$workspace_path/go.sum" ]]; then
        echo "go"
        return
    fi
    
    # Check for Rust projects
    if [[ -f "$workspace_path/Cargo.toml" ]]; then
        echo "rust"
        return
    fi
    
    # Check for HTML/Static content
    if find "$workspace_path" -maxdepth 2 -name "index.html" | head -1 | grep -q .; then
        echo "static"
        return
    fi
    
    # Default to static
    echo "static"
}

# Generate Docker Compose file from template
generate_compose_file() {
    local team_id="$1"
    local project_name="$2"
    local repository_url="$3"
    local git_branch="$4"
    local project_type="$5"
    local workspace_path="$6"
    local preview_port="$7"
    local agent_id="${8:-agent-1}"
    local agent_type="${9:-code-writer}"
    
    log "Generating Docker Compose file for team: $team_id"
    
    # Create generated directory
    mkdir -p "$GENERATED_DIR/$team_id"
    
    local compose_file="$GENERATED_DIR/$team_id/docker-compose.yml"
    
    # Read template and substitute variables
    local template_content
    template_content=$(cat "$DOCKER_DIR/docker-compose.template.yml")
    
    # Substitute variables
    template_content="${template_content//\${TEAM_ID}/$team_id}"
    template_content="${template_content//\${PROJECT_NAME}/$project_name}"
    template_content="${template_content//\${REPOSITORY_URL}/$repository_url}"
    template_content="${template_content//\${GIT_BRANCH}/$git_branch}"
    template_content="${template_content//\${PROJECT_TYPE}/$project_type}"
    template_content="${template_content//\${WORKSPACE_PATH}/$workspace_path}"
    template_content="${template_content//\${PREVIEW_PORT}/$preview_port}"
    template_content="${template_content//\${AGENT_ID}/$agent_id}"
    template_content="${template_content//\${AGENT_TYPE}/$agent_type}"
    
    # Handle optional variables
    template_content="${template_content//\${CLAUDE_API_KEY}/${CLAUDE_API_KEY:-}}"
    template_content="${template_content//\${SSH_KEY_PATH}/${SSH_KEY_PATH:-/dev/null}}"
    template_content="${template_content//\${NODE_VERSION}/${NODE_VERSION:-20}}"
    
    # Write the generated file
    echo "$template_content" > "$compose_file"
    
    log "Generated compose file: $compose_file"
    echo "$compose_file"
}

# Generate environment file
generate_env_file() {
    local team_id="$1"
    local project_name="$2"
    local repository_url="$3"
    local git_branch="$4"
    local project_type="$5"
    local workspace_path="$6"
    local preview_port="$7"
    
    local env_file="$GENERATED_DIR/$team_id/.env"
    
    cat > "$env_file" <<EOF
# Generated environment file for team $team_id
# Created: $(date -Iseconds)

# Team Configuration
TEAM_ID=$team_id
PROJECT_NAME=$project_name
PROJECT_TYPE=$project_type

# Repository Configuration
REPOSITORY_URL=$repository_url
GIT_BRANCH=$git_branch

# Workspace Configuration
WORKSPACE_PATH=$workspace_path

# Preview Configuration
PREVIEW_PORT=$preview_port

# Node.js Configuration
NODE_VERSION=${NODE_VERSION:-20}
NODE_ENV=development

# File Watching
CHOKIDAR_USEPOLLING=true
CHOKIDAR_INTERVAL=1000

# Claude Configuration
CLAUDE_API_KEY=${CLAUDE_API_KEY:-}

# SSH Configuration
SSH_KEY_PATH=${SSH_KEY_PATH:-}

# Git Configuration
GIT_CONFIG_PATH=${GIT_CONFIG_PATH:-}
EOF
    
    log "Generated environment file: $env_file"
    echo "$env_file"
}

# Start team environment
start_team_environment() {
    local team_id="$1"
    local repository_url="${2:-}"
    local git_branch="${3:-main}"
    local agent_count="${4:-1}"
    
    log "Starting environment for team: $team_id"
    
    # Determine workspace path
    local workspace_path="$WORKSPACE_BASE/$team_id"
    
    # Create workspace if it doesn't exist
    if [[ ! -d "$workspace_path" ]]; then
        log "Creating workspace for team: $team_id"
        "$SCRIPT_DIR/setup-workspace.sh" create "$team_id" "$repository_url" "$git_branch"
    fi
    
    # Detect project type
    local project_type
    project_type=$(detect_project_type "$workspace_path")
    log "Detected project type: $project_type"
    
    # Generate project name (sanitize team ID)
    local project_name
    project_name=$(echo "$team_id" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    # Allocate preview port (simple allocation - could be enhanced)
    local preview_port=$((5000 + $(echo "$team_id" | sum | cut -d' ' -f1) % 1000))
    
    # Generate Docker Compose configuration
    local compose_file
    compose_file=$(generate_compose_file "$team_id" "$project_name" "$repository_url" \
                                       "$git_branch" "$project_type" "$workspace_path" \
                                       "$preview_port")
    
    # Generate environment file
    generate_env_file "$team_id" "$project_name" "$repository_url" \
                     "$git_branch" "$project_type" "$workspace_path" "$preview_port"
    
    # Start containers
    log "Starting containers for team: $team_id"
    cd "$(dirname "$compose_file")"
    
    if docker-compose -f "$compose_file" up -d; then
        log "Successfully started environment for team: $team_id"
        
        # Display status
        echo "Team Environment Started Successfully!"
        echo "Team ID: $team_id"
        echo "Project Type: $project_type"
        echo "Workspace: $workspace_path"
        echo "Preview URL: http://localhost:$preview_port"
        echo "Compose File: $compose_file"
    else
        log "Failed to start environment for team: $team_id"
        return 1
    fi
}

# Stop team environment
stop_team_environment() {
    local team_id="$1"
    
    log "Stopping environment for team: $team_id"
    
    local compose_file="$GENERATED_DIR/$team_id/docker-compose.yml"
    
    if [[ -f "$compose_file" ]]; then
        cd "$(dirname "$compose_file")"
        
        if docker-compose -f "$compose_file" down; then
            log "Successfully stopped environment for team: $team_id"
        else
            log "Failed to stop environment for team: $team_id"
            return 1
        fi
    else
        log "No compose file found for team: $team_id"
        return 1
    fi
}

# Get status of team environment
get_team_status() {
    local team_id="$1"
    
    local compose_file="$GENERATED_DIR/$team_id/docker-compose.yml"
    
    if [[ -f "$compose_file" ]]; then
        cd "$(dirname "$compose_file")"
        echo "=== Team $team_id Status ==="
        docker-compose -f "$compose_file" ps
    else
        echo "No environment found for team: $team_id"
    fi
}

# List all team environments
list_team_environments() {
    echo "=== ColabVibe Team Environments ==="
    echo
    
    if [[ -d "$GENERATED_DIR" ]]; then
        for team_dir in "$GENERATED_DIR"/*; do
            if [[ -d "$team_dir" ]]; then
                local team_id
                team_id=$(basename "$team_dir")
                echo "Team: $team_id"
                
                local compose_file="$team_dir/docker-compose.yml"
                if [[ -f "$compose_file" ]]; then
                    cd "$team_dir"
                    local status
                    status=$(docker-compose ps --services --filter "status=running" | wc -l)
                    echo "  Status: $status containers running"
                    echo "  Config: $compose_file"
                else
                    echo "  Status: No configuration"
                fi
                echo
            fi
        done
    else
        echo "No team environments found"
    fi
}

# Clean up team environment
cleanup_team_environment() {
    local team_id="$1"
    local remove_volumes="${2:-false}"
    
    log "Cleaning up environment for team: $team_id"
    
    # Stop containers first
    stop_team_environment "$team_id" || true
    
    # Remove generated files
    local team_dir="$GENERATED_DIR/$team_id"
    if [[ -d "$team_dir" ]]; then
        rm -rf "$team_dir"
        log "Removed generated files for team: $team_id"
    fi
    
    # Optionally remove volumes
    if [[ "$remove_volumes" == "true" ]]; then
        log "Removing volumes for team: $team_id"
        docker volume rm "workspace_$team_id" 2>/dev/null || true
    fi
    
    log "Cleanup completed for team: $team_id"
}

# Show usage information
show_usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  start <team_id> [repository_url] [branch] [agents]  Start team environment
  stop <team_id>                                      Stop team environment
  status <team_id>                                    Show team environment status
  list                                                List all team environments
  cleanup <team_id> [remove-volumes]                 Clean up team environment
  detect <workspace_path>                             Detect project type

Examples:
  $0 start team123
  $0 start team123 https://github.com/user/repo.git main 2
  $0 stop team123
  $0 status team123
  $0 list
  $0 cleanup team123 true
  $0 detect /var/colabvibe/workspaces/team123

Environment Variables:
  CLAUDE_API_KEY    Claude API key for agents
  SSH_KEY_PATH      Path to SSH private key
  NODE_VERSION      Node.js version for containers (default: 20)
  WORKSPACE_BASE    Base directory for workspaces
EOF
}

# Main function
main() {
    local command="${1:-}"
    
    case "$command" in
        start)
            local team_id="${2:-}"
            local repository_url="${3:-}"
            local git_branch="${4:-main}"
            local agent_count="${5:-1}"
            
            if [[ -z "$team_id" ]]; then
                echo "Error: Team ID is required" >&2
                show_usage
                exit 1
            fi
            
            start_team_environment "$team_id" "$repository_url" "$git_branch" "$agent_count"
            ;;
            
        stop)
            local team_id="${2:-}"
            
            if [[ -z "$team_id" ]]; then
                echo "Error: Team ID is required" >&2
                show_usage
                exit 1
            fi
            
            stop_team_environment "$team_id"
            ;;
            
        status)
            local team_id="${2:-}"
            
            if [[ -z "$team_id" ]]; then
                echo "Error: Team ID is required" >&2
                show_usage
                exit 1
            fi
            
            get_team_status "$team_id"
            ;;
            
        list)
            list_team_environments
            ;;
            
        cleanup)
            local team_id="${2:-}"
            local remove_volumes="${3:-false}"
            
            if [[ -z "$team_id" ]]; then
                echo "Error: Team ID is required" >&2
                show_usage
                exit 1
            fi
            
            cleanup_team_environment "$team_id" "$remove_volumes"
            ;;
            
        detect)
            local workspace_path="${2:-}"
            
            if [[ -z "$workspace_path" ]]; then
                echo "Error: Workspace path is required" >&2
                show_usage
                exit 1
            fi
            
            detect_project_type "$workspace_path"
            ;;
            
        *)
            echo "Error: Unknown command '$command'" >&2
            show_usage
            exit 1
            ;;
    esac
}

# Ensure required directories exist
mkdir -p "$GENERATED_DIR" "$WORKSPACE_BASE"

# Run main function
main "$@"