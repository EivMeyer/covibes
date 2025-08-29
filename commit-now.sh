#!/bin/bash

# commit-now.sh - Auto-commit script for Claude Code hooks
# Follows ColabVibe git workflow: always commit to staging branch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

COMMIT_MESSAGE="${1:-Claude Code automated commit}"

echo -e "${BLUE}🤖 Claude Code auto-commit starting...${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if there are any changes to commit
if git diff --quiet && git diff --staged --quiet; then
    echo -e "${YELLOW}ℹ️  No changes to commit${NC}"
    exit 0
fi

# Make sure we're on staging branch (as per CLAUDE.md requirements)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "staging" ]; then
    echo -e "${BLUE}📦 Switching to staging branch...${NC}"
    # Check if staging branch exists
    if git show-ref --verify --quiet refs/heads/staging; then
        git checkout staging
    else
        echo -e "${BLUE}📦 Creating staging branch...${NC}"
        git checkout -b staging
    fi
fi

# Stage all changes
echo -e "${BLUE}📦 Staging changes...${NC}"
git add .

# Commit with the provided message
echo -e "${BLUE}📦 Committing changes...${NC}"
git commit -m "$COMMIT_MESSAGE

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo -e "${GREEN}✅ Commit successful!${NC}"
echo -e "${GREEN}💡 Remember to push to staging: git push origin staging${NC}"

exit 0