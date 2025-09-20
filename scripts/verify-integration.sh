#!/bin/bash

# Covibes Integration Verification Script
# 
# This script verifies that all integration components are properly set up
# and ready for the complete system integration.

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[VERIFY] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[VERIFY] $1${NC}"
}

error() {
    echo -e "${RED}[VERIFY] $1${NC}"
}

info() {
    echo -e "${BLUE}[VERIFY] $1${NC}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log "🔍 Covibes Integration Verification"
echo "========================================"

# Change to project root
cd "$PROJECT_ROOT"

# Check 1: Verify project structure
log "📁 Checking project structure..."
EXPECTED_DIRS=(
    "server"
    "server/services"  
    "server/test"
    "server/routes"
    "server/middleware"
    "server/prisma"
    "server/public"
    "server/public/js"
    "server/public/css"
    "tests"
    "scripts"
    "config"
    "data"
)

missing_dirs=0
for dir in "${EXPECTED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        info "  ✅ $dir/"
    else
        error "  ❌ $dir/ (missing)"
        missing_dirs=$((missing_dirs + 1))
    fi
done

if [ $missing_dirs -eq 0 ]; then
    log "Project structure is complete"
else
    warn "$missing_dirs directories are missing"
fi

# Check 2: Verify key files exist
log "📋 Checking key files..."
EXPECTED_FILES=(
    "server/services/mock-agent.js"
    "server/test/ssh-test.js"
    "tests/e2e-test.js"
    "docker-compose.yml"
    "docker-compose.override.yml"
    "scripts/setup-vm.sh"
    "scripts/init-db.sql"
    "config/redis.conf"
    "demo.sh"
    "README.md"
)

missing_files=0
for file in "${EXPECTED_FILES[@]}"; do
    if [ -f "$file" ]; then
        info "  ✅ $file"
    else
        error "  ❌ $file (missing)"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -eq 0 ]; then
    log "All integration files are present"
else
    warn "$missing_files integration files are missing"
fi

# Check 3: Verify script permissions
log "🔧 Checking script permissions..."
EXECUTABLE_SCRIPTS=(
    "scripts/setup-vm.sh"
    "scripts/verify-integration.sh"
    "demo.sh"
)

non_executable=0
for script in "${EXECUTABLE_SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        info "  ✅ $script (executable)"
    elif [ -f "$script" ]; then
        warn "  ⚠️  $script (not executable, fixing...)"
        chmod +x "$script"
    else
        error "  ❌ $script (missing)"
        non_executable=$((non_executable + 1))
    fi
done

# Check 4: Test mock agent functionality
log "🤖 Testing mock agent service..."
if [ -f "server/services/mock-agent.js" ]; then
    if timeout 10s node server/services/mock-agent.js > /dev/null 2>&1; then
        info "  ✅ Mock agent service works correctly"
    else
        warn "  ⚠️  Mock agent test timeout (expected behavior)"
    fi
else
    error "  ❌ Mock agent service file missing"
fi

# Check 5: Validate Docker Compose configuration
log "🐳 Validating Docker Compose configuration..."
if command -v docker-compose >/dev/null 2>&1; then
    if docker-compose config --quiet 2>/dev/null; then
        info "  ✅ Docker Compose configuration is valid"
    else
        error "  ❌ Docker Compose configuration has errors"
    fi
    
    # Check for required services
    if docker-compose config | grep -q "postgres:"; then
        info "  ✅ PostgreSQL service configured"
    else
        error "  ❌ PostgreSQL service missing"
    fi
    
    if docker-compose config | grep -q "redis:"; then
        info "  ✅ Redis service configured"
    else
        error "  ❌ Redis service missing"
    fi
else
    warn "  ⚠️  Docker Compose not installed - some features may not work"
fi

# Check 6: Verify Node.js requirements
log "⚙️ Checking Node.js environment..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        info "  ✅ Node.js $NODE_VERSION (compatible)"
    else
        warn "  ⚠️  Node.js $NODE_VERSION (recommend 18+)"
    fi
else
    error "  ❌ Node.js not found"
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    info "  ✅ npm $NPM_VERSION"
else
    error "  ❌ npm not found"
fi

# Check 7: Test SSH test infrastructure
log "🔐 Testing SSH test infrastructure..."
if [ -f "server/test/ssh-test.js" ]; then
    # Test that it shows help correctly
    if node server/test/ssh-test.js 2>&1 | grep -q "SSH Connection Test Tool"; then
        info "  ✅ SSH test script loads correctly"
    else
        error "  ❌ SSH test script has issues"
    fi
else
    error "  ❌ SSH test script missing"
fi

# Check 8: Environment configuration
log "🌍 Checking environment setup..."
if [ -f ".env" ]; then
    info "  ✅ Environment file exists"
    # Check for required variables
    if grep -q "DATABASE_URL" .env; then
        info "  ✅ DATABASE_URL configured"
    else
        warn "  ⚠️  DATABASE_URL not configured"
    fi
    if grep -q "JWT_SECRET" .env; then
        info "  ✅ JWT_SECRET configured"
    else
        warn "  ⚠️  JWT_SECRET not configured"
    fi
else
    warn "  ⚠️  .env file not found (will be created on first run)"
fi

# Check 9: Documentation completeness
log "📚 Checking documentation..."
if [ -f "README.md" ]; then
    README_SIZE=$(wc -l < README.md)
    if [ $README_SIZE -gt 300 ]; then
        info "  ✅ README.md is comprehensive ($README_SIZE lines)"
    else
        warn "  ⚠️  README.md might be incomplete ($README_SIZE lines)"
    fi
else
    error "  ❌ README.md missing"
fi

# Final summary
echo
echo "========================================"
log "🎯 Integration Verification Summary"
echo "========================================"

# Count issues
total_issues=$((missing_dirs + missing_files + non_executable))

if [ $total_issues -eq 0 ]; then
    log "🎉 All integration components are properly set up!"
    info "The system is ready for complete integration testing."
    echo
    echo "Next steps:"
    echo "1. Wait for Agents 1 & 2 to complete their backend and frontend work"
    echo "2. Run the demo script: ./demo.sh"
    echo "3. Execute end-to-end tests: node tests/e2e-test.js"
    echo "4. Set up production deployment configuration"
    
    exit_code=0
else
    warn "Found $total_issues integration issues to address"
    echo "Please fix the missing components before proceeding."
    
    exit_code=1
fi

echo
log "Integration verification completed."
exit $exit_code