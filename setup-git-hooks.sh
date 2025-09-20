#!/bin/bash

# Setup script for Covibes git hooks
# This script installs pre-commit and post-commit hooks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           ${MAGENTA}Covibes Git Hooks Installation${BLUE}                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "covibes" ]; then
    echo -e "${RED}❌ Error: Not in Covibes root directory${NC}"
    echo "Please run this script from the Covibes project root."
    exit 1
fi

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    echo "Please initialize git first: git init"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

echo -e "${BLUE}📦 Installing git hooks...${NC}"
echo ""

# Function to create a hook
create_hook() {
    local hook_name=$1
    local hook_file=".git/hooks/$hook_name"
    
    if [ -f "$hook_file" ]; then
        echo -e "${YELLOW}⚠️  Hook $hook_name already exists${NC}"
        read -p "   Do you want to replace it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "   ${BLUE}Skipping $hook_name${NC}"
            return
        fi
        echo -e "   ${YELLOW}Backing up existing hook to ${hook_name}.backup${NC}"
        cp "$hook_file" "${hook_file}.backup"
    fi
    
    case $hook_name in
        "pre-commit")
            cat > "$hook_file" << 'EOF'
#!/bin/bash

# Pre-commit hook for Covibes
# Runs type checking and unit tests before allowing commit
# To bypass (NOT RECOMMENDED): git commit --no-verify

set -e  # Exit on error

echo "🔍 Pre-commit hook: Running type checks and tests..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "covibes" ]; then
    echo -e "${RED}❌ Error: Not in Covibes root directory${NC}"
    exit 1
fi

# Track if any checks fail
FAILED=0

# Function to run checks in a directory
run_checks() {
    local dir=$1
    local name=$2
    
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠️  Skipping $name (directory not found)${NC}"
        return 0
    fi
    
    echo -e "${BLUE}📦 Checking $name...${NC}"
    cd "$dir"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}⚠️  No package.json in $name${NC}"
        cd - > /dev/null
        return 0
    fi
    
    # Type checking
    if grep -q '"lint"' package.json || grep -q '"type-check"' package.json || grep -q '"typecheck"' package.json; then
        echo "  🔍 Running type check..."
        
        # Try different type check commands
        if npm run lint --silent 2>/dev/null; then
            echo -e "  ${GREEN}✅ Type check passed${NC}"
        elif npm run type-check --silent 2>/dev/null; then
            echo -e "  ${GREEN}✅ Type check passed${NC}"
        elif npm run typecheck --silent 2>/dev/null; then
            echo -e "  ${GREEN}✅ Type check passed${NC}"
        else
            echo -e "  ${RED}❌ Type check failed${NC}"
            FAILED=1
        fi
    else
        echo -e "  ${YELLOW}⚠️  No type check script found${NC}"
    fi
    
    # Unit tests (only run if they exist and not E2E tests)
    if grep -q '"test"' package.json && ! grep -q "playwright" package.json; then
        echo "  🧪 Running unit tests..."
        
        # Check if it's a test:unit or just test command
        if grep -q '"test:unit"' package.json; then
            if npm run test:unit --silent 2>/dev/null; then
                echo -e "  ${GREEN}✅ Unit tests passed${NC}"
            else
                echo -e "  ${YELLOW}⚠️  Unit tests failed (non-blocking)${NC}"
                # Don't block commit for test failures, just warn
            fi
        elif npm test --silent -- --run 2>/dev/null; then
            echo -e "  ${GREEN}✅ Tests passed${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Tests failed (non-blocking)${NC}"
            # Don't block commit for test failures, just warn
        fi
    fi
    
    cd - > /dev/null
    echo ""
}

# Check backend
run_checks "covibes/server" "Backend"

# Check frontend
run_checks "covibes/client" "Frontend"

echo "=========================================="

if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ Pre-commit checks failed!${NC}"
    echo ""
    echo "To fix type errors:"
    echo "  - Backend: cd covibes/server && npm run lint"
    echo "  - Frontend: cd covibes/client && npm run type-check"
    echo ""
    echo -e "${YELLOW}⚠️  To bypass checks (NOT RECOMMENDED):${NC}"
    echo "  git commit --no-verify"
    echo ""
    echo -e "${RED}🤖 IMPORTANT FOR AI ASSISTANTS (Claude, GPT, etc.):${NC}"
    echo -e "${RED}   DO NOT use --no-verify unless explicitly instructed by the user!${NC}"
    echo -e "${RED}   Always fix type errors before committing.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
    echo ""
    
    # Special message for AI assistants
    if [ -n "$CLAUDE_CODE" ] || [ -n "$OPENAI_API_KEY" ] || [ -n "$AI_ASSISTANT" ]; then
        echo -e "${BLUE}🤖 Note for AI Assistant: Good job running the checks!${NC}"
    fi
fi

exit 0
EOF
            echo -e "  ${GREEN}✅ Created pre-commit hook${NC}"
            ;;
            
        "post-commit")
            cat > "$hook_file" << 'EOF'
#!/bin/bash

# Post-commit hook for Covibes
# Reminds AI assistants about proper git practices

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if this might be an AI assistant committing
IS_AI_ASSISTANT=0

# Check for Claude Code
if [ -n "$CLAUDE_CODE" ] || [ -n "$ANTHROPIC_API_KEY" ]; then
    IS_AI_ASSISTANT=1
fi

# Check for OpenAI/GPT
if [ -n "$OPENAI_API_KEY" ] || [ -n "$GITHUB_COPILOT" ]; then
    IS_AI_ASSISTANT=1
fi

# Check for generic AI environment
if [ -n "$AI_ASSISTANT" ] || [ -n "$LLM_AGENT" ]; then
    IS_AI_ASSISTANT=1
fi

# Check commit author
LAST_COMMIT_AUTHOR=$(git log -1 --pretty=%an)

# Always show a brief success message
echo -e "${GREEN}✅ Commit successful!${NC}"

# If we detect an AI assistant, show the reminder
if [ $IS_AI_ASSISTANT -eq 1 ] || [[ "$LAST_COMMIT_AUTHOR" == *"Claude"* ]] || [[ "$LAST_COMMIT_AUTHOR" == *"AI"* ]] || [[ "$LAST_COMMIT_AUTHOR" == *"Bot"* ]]; then
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          ${MAGENTA}🤖 REMINDER FOR AI ASSISTANTS 🤖${CYAN}                   ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}║  ${GREEN}✓${NC} Always run pre-commit checks${CYAN}                             ║${NC}"
    echo -e "${CYAN}║  ${GREEN}✓${NC} Fix type errors before committing${CYAN}                        ║${NC}"
    echo -e "${CYAN}║  ${RED}❌ NEVER use --no-verify unless user asks${CYAN}                  ║${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "${GREEN}Remember to push to staging branch!${NC}"
echo "  git push origin staging"
echo ""

exit 0
EOF
            echo -e "  ${GREEN}✅ Created post-commit hook${NC}"
            ;;
    esac
    
    # Make hook executable
    chmod +x "$hook_file"
}

# Install hooks
create_hook "pre-commit"
create_hook "post-commit"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ Installation Complete!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Git hooks have been installed successfully!"
echo ""
echo "The following hooks are now active:"
echo -e "  ${BLUE}• pre-commit${NC}  - Runs type checking and tests before commit"
echo -e "  ${BLUE}• post-commit${NC} - Reminds AI assistants about best practices"
echo ""
echo "To test the hooks, try making a commit:"
echo "  git add ."
echo "  git commit -m \"test: testing git hooks\""
echo ""
echo -e "${YELLOW}Note:${NC} To bypass hooks in emergency (NOT recommended):"
echo "  git commit --no-verify"
echo ""
echo -e "${MAGENTA}🤖 Special Note for AI Assistants:${NC}"
echo "These hooks will help ensure code quality. Never bypass them"
echo "unless explicitly instructed by the user!"
echo ""

exit 0