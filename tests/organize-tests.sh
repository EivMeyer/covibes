#!/bin/bash

# Test Organization Script for Covibes
# This script reorganizes tests into a cleaner directory structure

echo "🧹 Organizing Covibes Tests..."

# Create new directory structure
echo "📁 Creating organized directory structure..."

mkdir -p unit
mkdir -p integration/{backend,websocket,database}
mkdir -p e2e/{smoke,full,manual}
mkdir -p playwright/{auth,agents,collaboration,chat,showcase}
mkdir -p visual/{screenshots/{capture,output},videos/{generators,output}}
mkdir -p frontend
mkdir -p fixtures
mkdir -p utils
mkdir -p config
mkdir -p results/{reports,coverage}

# Move unit tests
echo "📦 Organizing unit tests..."
[ -f "unit-tests.js" ] && cp unit-tests.js unit/

# Move integration tests
echo "🔗 Organizing integration tests..."
[ -f "backend-integration-test.js" ] && cp backend-integration-test.js integration/backend/api.test.js
[ -f "backend-preview-integration.test.js" ] && cp backend-preview-integration.test.js integration/backend/preview.test.js
[ -f "test-websocket.js" ] && cp test-websocket.js integration/websocket/connection.test.js
[ -f "test-direct-persistence.js" ] && cp test-direct-persistence.js integration/database/persistence.test.js

# Move E2E tests
echo "🚀 Organizing E2E tests..."
[ -f "quick-e2e-test.js" ] && cp quick-e2e-test.js e2e/smoke/quick-test.js
[ -f "e2e-test.js" ] && cp e2e-test.js e2e/full/complete-flow.test.js
[ -f "test-fixed-app.js" ] && cp test-fixed-app.js e2e/full/app-functionality.test.js
[ -f "manual-live-test.js" ] && cp manual-live-test.js e2e/manual/manual-scenarios.js

# Move Playwright tests
echo "🎭 Organizing Playwright tests..."
[ -f "playwright-e2e.test.js" ] && cp playwright-e2e.test.js playwright/auth/authentication.spec.js
[ -f "playwright-comprehensive-e2e.test.js" ] && cp playwright-comprehensive-e2e.test.js playwright/auth/comprehensive.spec.js

# Agent tests
[ -f "playwright-agent-basic.test.js" ] && cp playwright-agent-basic.test.js playwright/agents/basic.spec.js
[ -f "playwright-agent-comprehensive.test.js" ] && cp playwright-agent-comprehensive.test.js playwright/agents/comprehensive.spec.js
[ -f "playwright-agent-list.test.js" ] && cp playwright-agent-list.test.js playwright/agents/list.spec.js
[ -f "playwright-agent-spawn.test.js" ] && cp playwright-agent-spawn.test.js playwright/agents/spawn.spec.js
[ -f "playwright-agent-spawn-simple.test.js" ] && cp playwright-agent-spawn-simple.test.js playwright/agents/spawn-simple.spec.js

# Collaboration tests
[ -f "playwright-live-rendering.test.js" ] && cp playwright-live-rendering.test.js playwright/collaboration/live-rendering.spec.js
[ -f "playwright-live-rendering-acceptance.test.js" ] && cp playwright-live-rendering-acceptance.test.js playwright/collaboration/live-rendering-acceptance.spec.js
[ -f "playwright-multiuser-preview.test.js" ] && cp playwright-multiuser-preview.test.js playwright/collaboration/multiuser-preview.spec.js
[ -f "playwright-preview-content.test.js" ] && cp playwright-preview-content.test.js playwright/collaboration/preview-content.spec.js

# Chat tests
[ -f "test-chat-persistence.js" ] && cp test-chat-persistence.js playwright/chat/persistence.spec.js
[ -f "test-mobile-chat.js" ] && cp test-mobile-chat.js playwright/chat/mobile.spec.js
[ -f "test-simple-message.js" ] && cp test-simple-message.js playwright/chat/simple-message.spec.js

# Showcase tests
[ -f "playwright-showcase.test.js" ] && cp playwright-showcase.test.js playwright/showcase/demo.spec.js

# Move visual tests
echo "📸 Organizing visual tests..."
[ -f "capture-screenshots.js" ] && cp capture-screenshots.js visual/screenshots/capture/basic.js
[ -f "capture-app-screenshots.js" ] && cp capture-app-screenshots.js visual/screenshots/capture/app.js
[ -f "capture-mobile-screenshots.js" ] && cp capture-mobile-screenshots.js visual/screenshots/capture/mobile.js
[ -f "screenshot-demo.js" ] && cp screenshot-demo.js visual/screenshots/capture/demo.js
[ -f "simple-screenshots.js" ] && cp simple-screenshots.js visual/screenshots/capture/simple.js

# Move video generators
[ -f "create-mobile-demo-mp4.js" ] && cp create-mobile-demo-mp4.js visual/videos/generators/mobile-mp4.js
[ -f "create-mobile-demo-video.js" ] && cp create-mobile-demo-video.js visual/videos/generators/mobile-video.js

# Move frontend tests
echo "🌐 Organizing frontend tests..."
[ -f "frontend-test.html" ] && cp frontend-test.html frontend/test.html
[ -f "frontend-test.js" ] && cp frontend-test.js frontend/test.js

# Move config files
echo "⚙️ Moving configuration files..."
[ -f "playwright.config.js" ] && cp playwright.config.js config/

# Copy existing screenshots and videos to output directories
echo "📷 Moving existing screenshots and videos..."
[ -d "screenshots" ] && cp -r screenshots/* visual/screenshots/output/ 2>/dev/null || true
[ -d "videos" ] && cp -r videos/* visual/videos/output/ 2>/dev/null || true

# Move test results
echo "📊 Moving test results..."
[ -f "test-results.json" ] && cp test-results.json results/
[ -d "test-results" ] && cp -r test-results/* results/reports/ 2>/dev/null || true
[ -d "playwright-report" ] && cp -r playwright-report/* results/reports/ 2>/dev/null || true

echo "✅ Test organization complete!"
echo ""
echo "📋 New structure created in parallel to existing tests."
echo "   Original files have been preserved."
echo "   Review the new structure and delete originals when ready."
echo ""
echo "🚀 To run tests with new structure:"
echo "   - Unit tests: npm test unit/**/*.js"
echo "   - Integration: npm test integration/**/*.test.js"
echo "   - E2E: npm test e2e/**/*.test.js"
echo "   - Playwright: npx playwright test playwright/**/*.spec.js"
echo "   - All tests: npm test"