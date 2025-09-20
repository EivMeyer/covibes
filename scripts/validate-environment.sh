#!/bin/bash
# Covibes Environment Validation Script
# Run this BEFORE any deployment to catch issues early

echo "🔍 Covibes Environment Validation"
echo "=================================="

VALIDATION_FAILED=0

# Function to fail validation
fail_validation() {
    echo "❌ $1"
    VALIDATION_FAILED=1
}

# Function to pass validation
pass_validation() {
    echo "✅ $1"
}

# Function to warn
warn_validation() {
    echo "⚠️  $1"
}

# SECTION 1: Required Environment Variables
echo ""
echo "📋 Checking Required Environment Variables..."

# Critical environment variables with validation
declare -A ENV_VARS=(
    ["EC2_HOST"]="Must be EC2 hostname (e.g., ec2-13-48-135-139.eu-north-1.compute.amazonaws.com)"
    ["EC2_USERNAME"]="Must be EC2 username (usually 'ubuntu')"
    ["BASE_HOST"]="Must match EC2_HOST for proper routing"
    ["DATABASE_URL"]="Must be PostgreSQL connection string"
    ["JWT_SECRET"]="Must be secure random string (32+ chars)"
    ["ENCRYPTION_KEY"]="Must be exactly 32 characters"
)

for var in "${!ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        fail_validation "$var is not set! ${ENV_VARS[$var]}"
    else
        pass_validation "$var is set"
        
        # Additional validations
        case $var in
            "EC2_HOST"|"BASE_HOST")
                if [[ ! ${!var} =~ ^ec2-.*\.compute\.amazonaws\.com$ ]]; then
                    warn_validation "$var format looks unusual: ${!var}"
                fi
                ;;
            "ENCRYPTION_KEY")
                if [ ${#!var} -ne 32 ]; then
                    fail_validation "$var must be exactly 32 characters, got ${#!var}"
                fi
                ;;
            "JWT_SECRET")
                if [ ${#!var} -lt 32 ]; then
                    warn_validation "$var should be at least 32 characters for security"
                fi
                ;;
        esac
    fi
done

# Check if EC2_HOST matches BASE_HOST
if [ "$EC2_HOST" != "$BASE_HOST" ]; then
    warn_validation "EC2_HOST ($EC2_HOST) != BASE_HOST ($BASE_HOST) - may cause issues"
fi

# SECTION 2: System Dependencies
echo ""
echo "🔧 Checking System Dependencies..."

# Check Node.js version
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    pass_validation "Node.js installed: $NODE_VERSION"
    
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        fail_validation "Node.js version must be 18+, got $NODE_VERSION"
    fi
else
    fail_validation "Node.js not installed"
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    pass_validation "npm installed: $(npm --version)"
else
    fail_validation "npm not installed"
fi

# Check Docker
if command -v docker >/dev/null 2>&1; then
    pass_validation "Docker installed: $(docker --version)"
    
    # Check if Docker is running
    if docker info >/dev/null 2>&1; then
        pass_validation "Docker daemon running"
    else
        fail_validation "Docker daemon not running"
    fi
else
    fail_validation "Docker not installed"
fi

# Check PostgreSQL
if command -v psql >/dev/null 2>&1; then
    pass_validation "PostgreSQL client installed"
else
    warn_validation "PostgreSQL client not found (may need for debugging)"
fi

# SECTION 3: Directory Structure
echo ""
echo "📁 Checking Directory Structure..."

REQUIRED_DIRS=(
    "/home/ubuntu/covibes"
    "/home/ubuntu/covibes/server"
    "/home/ubuntu/covibes/client"
    "/home/ubuntu/covibes/server/src"
    "/home/ubuntu/covibes/client/src"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        pass_validation "Directory exists: $dir"
    else
        fail_validation "Missing directory: $dir"
    fi
done

# Check for key files
REQUIRED_FILES=(
    "/home/ubuntu/covibes/server/package.json"
    "/home/ubuntu/covibes/client/package.json"  
    "/home/ubuntu/covibes/server/src/server.ts"
    "/home/ubuntu/covibes/server/prisma/schema.prisma"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass_validation "File exists: $file"
    else
        fail_validation "Missing file: $file"
    fi
done

# SECTION 4: Port Availability
echo ""
echo "🔌 Checking Port Availability..."

REQUIRED_PORTS=(3001 5432 6379 3000)

for port in "${REQUIRED_PORTS[@]}"; do
    if lsof -i:$port >/dev/null 2>&1; then
        warn_validation "Port $port is in use (will be cleared during deployment)"
    else
        pass_validation "Port $port available"
    fi
done

# SECTION 5: Database Connectivity
echo ""
echo "🗄️  Checking Database Connectivity..."

if [ -n "$DATABASE_URL" ]; then
    # Try to connect to database
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        pass_validation "Database connection successful"
    else
        warn_validation "Cannot connect to database (may not be running yet)"
    fi
else
    fail_validation "DATABASE_URL not set, cannot test connection"
fi

# SECTION 6: Final Summary
echo ""
echo "📊 VALIDATION SUMMARY"
echo "===================="

if [ $VALIDATION_FAILED -eq 0 ]; then
    echo "🎉 ALL VALIDATIONS PASSED!"
    echo "✅ Environment is ready for deployment"
    echo ""
    echo "🚀 To deploy, run:"
    echo "   chmod +x /home/ubuntu/covibes/scripts/deploy-production.sh"
    echo "   /home/ubuntu/covibes/scripts/deploy-production.sh"
    exit 0
else
    echo "❌ VALIDATION FAILED!"
    echo "🔧 Fix the issues above before deploying"
    echo ""
    echo "💡 Common fixes:"
    echo "   export EC2_HOST=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com"
    echo "   export BASE_HOST=ec2-13-48-135-139.eu-north-1.compute.amazonaws.com" 
    echo "   export EC2_USERNAME=ubuntu"
    echo "   export DATABASE_URL=\"postgresql://postgres:password@localhost:5433/covibes_prod\""
    echo "   export JWT_SECRET=\"your-32-char-jwt-secret-key-here\""
    echo "   export ENCRYPTION_KEY=\"your-exactly-32-character-key-here!\""
    exit 1
fi