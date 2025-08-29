# CoVibe Test Suite Documentation

## 🧪 Overview

The CoVibe test suite provides comprehensive testing coverage including unit tests, integration tests, end-to-end tests, and visual regression tests.

## 📁 Test Organization

```
tests/
├── unit/                    # Unit tests for individual functions
├── integration/             # API and service integration tests
│   ├── backend/            # Backend API tests
│   ├── websocket/          # WebSocket connection tests
│   └── database/           # Database persistence tests
├── e2e/                    # End-to-end user flow tests
│   ├── smoke/              # Quick smoke tests
│   ├── full/               # Complete user journeys
│   └── manual/             # Manual test scenarios
├── playwright/             # Browser automation tests
│   ├── auth/               # Authentication flows
│   ├── agents/             # Agent functionality
│   ├── collaboration/      # Multi-user features
│   ├── chat/               # Chat and messaging
│   └── showcase/           # Demo scenarios
├── visual/                 # Visual regression tests
│   ├── screenshots/        # Screenshot tests
│   └── videos/             # Video generation
├── frontend/               # Frontend-specific tests
├── fixtures/               # Test data and mocks
├── utils/                  # Test utilities
├── config/                 # Test configuration
└── results/                # Test results and reports
```

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
npx playwright install  # Install browsers for Playwright
```

### Run All Tests
```bash
npm test                 # Run complete test suite
```

### Run Specific Test Categories
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:playwright  # All Playwright tests
npm run test:chat        # Chat functionality tests
npm run test:agents      # Agent-related tests
npm run test:visual      # Visual/screenshot tests
```

## 📋 Test Commands

### Core Testing
| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:quick` | Quick smoke test |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:verbose` | Verbose output |
| `npm run test:coverage` | Generate coverage report |

### Specific Test Suites
| Command | Description |
|---------|-------------|
| `npm run test:unit` | Unit tests |
| `npm run test:integration` | Integration tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:playwright` | Playwright browser tests |
| `npm run test:chat` | Chat feature tests |
| `npm run test:agents` | Agent feature tests |
| `npm run test:persistence` | Message persistence tests |
| `npm run test:websocket` | WebSocket connection tests |

### Visual Testing
| Command | Description |
|---------|-------------|
| `npm run screenshots` | Generate screenshots |
| `npm run screenshots:mobile` | Mobile screenshots |
| `npm run video:mobile` | Generate mobile demo video |

### Playwright UI
| Command | Description |
|---------|-------------|
| `npm run test:playwright:ui` | Open Playwright UI |
| `npm run test:playwright:headed` | Run with visible browser |

### Maintenance
| Command | Description |
|---------|-------------|
| `npm run organize` | Organize tests into new structure |
| `npm run clean` | Clean test artifacts |
| `npm run help` | Show test runner help |

## 🎯 Test Categories

### Unit Tests (`unit/`)
- Individual function testing
- No external dependencies
- Fast execution
- Example: `unit-tests.js`

### Integration Tests (`integration/`)
- **Backend**: API endpoint testing
- **WebSocket**: Real-time connection tests
- **Database**: Persistence and query tests
- Example: `backend-integration-test.js`

### End-to-End Tests (`e2e/`)
- Complete user workflows
- Multi-step scenarios
- Browser automation
- Example: `e2e-test.js`

### Playwright Tests (`playwright/`)
- **Authentication**: Login, registration, team joining
- **Agents**: Spawning, management, output streaming
- **Collaboration**: Multi-user, real-time updates
- **Chat**: Messaging, persistence, notifications
- Example: `playwright-comprehensive-e2e.test.js`

### Visual Tests (`visual/`)
- Screenshot capture
- Visual regression
- Mobile responsive testing
- Video generation
- Example: `screenshot-demo.js`

## 🔧 Configuration

### Test Runner Options
```bash
node test-runner.js [suite] [options]

Options:
  -v, --verbose   Show detailed output
  -w, --watch     Run tests in watch mode
  -c, --coverage  Generate coverage report
  -h, --help      Show help message
```

### Environment Variables
```bash
# .env.test
TEST_SERVER_URL=http://localhost:3001
TEST_TIMEOUT=30000
HEADLESS=true
```

## 📊 Test Results

Test results are saved in the `results/` directory:
- `test-report.json` - JSON test report
- `coverage/` - Code coverage reports
- `screenshots/` - Visual test outputs

## 🧪 Writing New Tests

### Unit Test Template
```javascript
// unit/example.test.js
const assert = require('assert');
const { functionToTest } = require('../src/module');

describe('Function Name', () => {
  it('should do something', () => {
    const result = functionToTest(input);
    assert.strictEqual(result, expected);
  });
});
```

### Playwright Test Template
```javascript
// playwright/feature/example.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.click('button');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### E2E Test Template
```javascript
// e2e/full/example.test.js
async function testScenario() {
  console.log('🧪 Testing scenario...');
  
  // Setup
  const response = await fetch('http://localhost:3001/api/endpoint');
  
  // Assert
  if (response.status !== 200) {
    throw new Error('Test failed');
  }
  
  console.log('✅ Test passed');
}

testScenario().catch(console.error);
```

## 🐛 Debugging Tests

### Debug Playwright Tests
```bash
# Run with UI mode
npm run test:playwright:ui

# Run with headed browser
npm run test:playwright:headed

# Debug specific test
PWDEBUG=1 npx playwright test path/to/test.spec.js
```

### Debug Node Tests
```bash
# Use Node debugger
node --inspect test-file.js

# Use console.log
node test-file.js --verbose
```

## 📈 Coverage Reports

Generate and view coverage:
```bash
npm run test:coverage
open results/coverage/index.html
```

## 🔄 Continuous Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npx playwright install
      - run: npm test
```

## 📝 Best Practices

1. **Isolation**: Tests should not depend on each other
2. **Cleanup**: Always clean up test data
3. **Assertions**: Use clear, specific assertions
4. **Naming**: Use descriptive test names
5. **Speed**: Keep tests fast (< 10s per test)
6. **Reliability**: Avoid flaky tests
7. **Coverage**: Aim for > 80% code coverage

## 🆘 Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout: `TEST_TIMEOUT=60000 npm test`
- Check server is running: `curl http://localhost:3001/health`

**Playwright browser not found**
- Install browsers: `npx playwright install`

**Database connection errors**
- Check PostgreSQL is running: `docker-compose up -d`
- Reset database: `npx prisma migrate reset`

**WebSocket connection failures**
- Check server logs for errors
- Verify port 3001 is not blocked

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Node.js Assert API](https://nodejs.org/api/assert.html)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contributing

When adding new tests:
1. Place in appropriate category directory
2. Follow naming convention: `feature-name.test.js` or `feature-name.spec.js`
3. Update this README if adding new test category
4. Ensure tests pass locally before committing
5. Add to appropriate npm script in package.json

---

For questions or issues, check the main project README or open an issue on GitHub.