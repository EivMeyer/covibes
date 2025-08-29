# Test Organization Structure

## Current Test Categories

### 1. Unit Tests
- `unit-tests.js` - Core unit tests

### 2. Integration Tests
- `backend-integration-test.js` - Backend API integration
- `backend-preview-integration.test.js` - Preview feature integration
- `test-websocket.js` - WebSocket connection tests
- `test-direct-persistence.js` - Database persistence tests

### 3. End-to-End Tests (E2E)
- `e2e-test.js` - Basic E2E flow
- `quick-e2e-test.js` - Quick smoke test
- `test-fixed-app.js` - App functionality tests
- `manual-live-test.js` - Manual testing scenarios

### 4. Playwright Tests
#### Authentication & Basic Flow
- `playwright-e2e.test.js` - Main E2E test suite
- `playwright-comprehensive-e2e.test.js` - Comprehensive user flows

#### Agent Features
- `playwright-agent-basic.test.js` - Basic agent operations
- `playwright-agent-comprehensive.test.js` - Full agent feature set
- `playwright-agent-list.test.js` - Agent list functionality
- `playwright-agent-spawn.test.js` - Agent spawning
- `playwright-agent-spawn-simple.test.js` - Simplified spawn tests

#### Live Features
- `playwright-live-rendering.test.js` - Live rendering tests
- `playwright-live-rendering-acceptance.test.js` - Acceptance criteria
- `playwright-multiuser-preview.test.js` - Multi-user preview
- `playwright-preview-content.test.js` - Preview content validation

#### Showcase
- `playwright-showcase.test.js` - Demo showcase tests

### 5. Chat & Messaging Tests
- `test-chat-persistence.js` - Chat message persistence
- `test-mobile-chat.js` - Mobile chat functionality
- `test-simple-message.js` - Basic messaging

### 6. Screenshot & Visual Tests
- `capture-screenshots.js` - Basic screenshots
- `capture-app-screenshots.js` - Application screenshots
- `capture-mobile-screenshots.js` - Mobile view screenshots
- `screenshot-demo.js` - Demo screenshots
- `simple-screenshots.js` - Simple screenshot capture

### 7. Video Generation
- `create-mobile-demo-mp4.js` - MP4 video creation
- `create-mobile-demo-video.js` - General video creation

### 8. Frontend Tests
- `frontend-test.html` - HTML test harness
- `frontend-test.js` - Frontend JavaScript tests

## Recommended Directory Structure

```
tests/
├── unit/
│   └── unit-tests.js
├── integration/
│   ├── backend/
│   │   ├── api.test.js (renamed from backend-integration-test.js)
│   │   └── preview.test.js (renamed from backend-preview-integration.test.js)
│   ├── websocket/
│   │   └── connection.test.js (renamed from test-websocket.js)
│   └── database/
│       └── persistence.test.js (renamed from test-direct-persistence.js)
├── e2e/
│   ├── smoke/
│   │   └── quick-test.js (renamed from quick-e2e-test.js)
│   ├── full/
│   │   ├── complete-flow.test.js (renamed from e2e-test.js)
│   │   └── app-functionality.test.js (renamed from test-fixed-app.js)
│   └── manual/
│       └── manual-scenarios.js (renamed from manual-live-test.js)
├── playwright/
│   ├── auth/
│   │   └── authentication.spec.js
│   ├── agents/
│   │   ├── basic.spec.js
│   │   ├── comprehensive.spec.js
│   │   ├── list.spec.js
│   │   └── spawn.spec.js
│   ├── collaboration/
│   │   ├── live-rendering.spec.js
│   │   ├── multiuser-preview.spec.js
│   │   └── preview-content.spec.js
│   ├── chat/
│   │   ├── persistence.spec.js
│   │   └── mobile.spec.js
│   └── showcase/
│       └── demo.spec.js
├── visual/
│   ├── screenshots/
│   │   ├── capture/
│   │   │   ├── app.js
│   │   │   ├── mobile.js
│   │   │   └── demo.js
│   │   └── output/
│   │       └── [screenshot files]
│   └── videos/
│       ├── generators/
│       │   ├── mobile-mp4.js
│       │   └── mobile-video.js
│       └── output/
│           └── [video files]
├── frontend/
│   ├── test.html
│   └── test.js
├── fixtures/
│   └── [test data files]
├── utils/
│   └── [helper functions]
├── config/
│   └── playwright.config.js
├── results/
│   ├── reports/
│   └── coverage/
├── package.json
├── run-tests.sh
└── README.md
```