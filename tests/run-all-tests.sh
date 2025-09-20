#!/bin/bash
# Run all Covibes tests

echo "🧪 Covibes Test Suite"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    if eval $test_command; then
        echo -e "${GREEN}✅ $test_name passed${NC}\n"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name failed${NC}\n"
        ((TESTS_FAILED++))
    fi
}

# 1. Run Unit Tests
run_test "Unit Tests" "node unit-tests.js"

# 2. Run Backend E2E Tests
run_test "Backend E2E Tests" "node e2e-test.js"

# 3. Check if server is running for frontend tests
SERVER_RUNNING=false
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    SERVER_RUNNING=true
    echo -e "${GREEN}Server is running on port 3001${NC}\n"
else
    echo -e "${YELLOW}Server not running. Starting server for frontend tests...${NC}"
    cd ../server && npm run dev &
    SERVER_PID=$!
    sleep 5
    
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        SERVER_RUNNING=true
        echo -e "${GREEN}Server started successfully${NC}\n"
    else
        echo -e "${RED}Failed to start server${NC}\n"
    fi
fi

# 4. Run Frontend Browser Tests (if server is running)
if [ "$SERVER_RUNNING" = true ]; then
    echo -e "${YELLOW}Frontend tests can be run by:${NC}"
    echo "  1. Opening tests/frontend-test.html in a browser"
    echo "  2. Clicking 'Run All Tests' button"
    echo ""
fi

# 5. Run Playwright E2E Tests (if installed)
if command -v npx &> /dev/null && npx playwright --version &> /dev/null 2>&1; then
    run_test "Playwright E2E Tests" "npx playwright test --config=playwright.config.js"
else
    echo -e "${YELLOW}Playwright not installed. To run UI tests:${NC}"
    echo "  npm install -D @playwright/test"
    echo "  npx playwright install"
    echo "  npx playwright test"
    echo ""
fi

# Clean up server if we started it
if [ ! -z "$SERVER_PID" ]; then
    echo -e "${YELLOW}Stopping test server...${NC}"
    kill $SERVER_PID 2>/dev/null
fi

# Summary
echo "======================================="
echo -e "${YELLOW}Test Summary:${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All automated tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi