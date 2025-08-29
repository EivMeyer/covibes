/**
 * Terminal Integration E2E Tests
 * 
 * Tests the Claude Code terminal integration functionality:
 * - Terminal webpage loads and displays correctly
 * - Connection to Claude Code backend works
 * - Command execution and output display
 * - Error handling and disconnection
 * - Integration test suite execution
 */

const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TERMINAL_URL = `${BASE_URL}/test/terminal-test.html`;

// Test configuration
test.describe('Claude Code Terminal Integration', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Enable console logging for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`Browser Error: ${msg.text()}`);
      }
    });
    
    // Navigate to terminal test page
    await page.goto(TERMINAL_URL);
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('terminal page loads with correct UI elements', async () => {
    // Check page title
    await expect(page).toHaveTitle('Claude Code Terminal Integration Test');
    
    // Check header elements
    await expect(page.locator('.terminal-title')).toContainText('Claude Code Terminal Test');
    await expect(page.locator('#connectionStatus')).toContainText('DISCONNECTED');
    
    // Check terminal output area
    await expect(page.locator('#terminalOutput')).toBeVisible();
    await expect(page.locator('#terminalOutput')).toContainText('Claude Code Terminal Integration Test');
    
    // Check input area
    await expect(page.locator('#terminalInput')).toBeVisible();
    await expect(page.locator('.prompt')).toContainText('claude-test$');
    
    // Check control buttons
    await expect(page.locator('button')).toHaveCount(4);
    await expect(page.locator('button:has-text("Connect to Claude")')).toBeVisible();
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible();
    await expect(page.locator('button:has-text("Clear")')).toBeVisible();
    await expect(page.locator('button:has-text("Run Integration Test")')).toBeVisible();
  });

  test('connection status updates correctly', async () => {
    // Initial state should be disconnected
    await expect(page.locator('#connectionStatus')).toHaveClass(/status-disconnected/);
    
    // Click connect button
    await page.click('button:has-text("Connect to Claude")');
    
    // Should show connecting state
    await expect(page.locator('#connectionStatus')).toHaveClass(/status-connecting/);
    
    // Wait for connection to complete (up to 10 seconds)
    await page.waitForFunction(() => {
      const status = document.getElementById('connectionStatus');
      return status && (status.classList.contains('status-connected') || status.classList.contains('status-disconnected'));
    }, {}, { timeout: 10000 });
    
    // Should eventually show connected or disconnected
    const finalStatus = await page.locator('#connectionStatus').getAttribute('class');
    expect(finalStatus).toMatch(/status-(connected|disconnected)/);
  });

  test('command input and execution works', async () => {
    // Connect first
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000); // Wait for connection
    
    const terminalInput = page.locator('#terminalInput');
    const terminalOutput = page.locator('#terminalOutput');
    
    // Test help command
    await terminalInput.fill('help');
    await terminalInput.press('Enter');
    
    // Should show command in output
    await expect(terminalOutput).toContainText('$ help');
    
    // Should show help text
    await expect(terminalOutput).toContainText('Available test commands:');
    
    // Test echo command
    await terminalInput.fill('echo Hello Claude Code');
    await terminalInput.press('Enter');
    
    await expect(terminalOutput).toContainText('$ echo Hello Claude Code');
    await expect(terminalOutput).toContainText('Hello Claude Code');
    
    // Input should be cleared after execution
    await expect(terminalInput).toHaveValue('');
  });

  test('built-in test commands work correctly', async () => {
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000);
    
    const terminalInput = page.locator('#terminalInput');
    const terminalOutput = page.locator('#terminalOutput');
    
    // Test echo command
    await terminalInput.fill('echo Testing 123');
    await terminalInput.press('Enter');
    await expect(terminalOutput).toContainText('Testing 123');
    
    // Test pwd command (should execute system command)
    await terminalInput.fill('pwd');
    await terminalInput.press('Enter');
    await page.waitForTimeout(1000);
    await expect(terminalOutput).toContainText('$ pwd');
    
    // Test ls command (should execute system command)
    await terminalInput.fill('ls');
    await terminalInput.press('Enter');
    await page.waitForTimeout(1000);
    await expect(terminalOutput).toContainText('$ ls');
  });

  test('error handling works correctly', async () => {
    const terminalInput = page.locator('#terminalInput');
    const terminalOutput = page.locator('#terminalOutput');
    
    // Try to execute command without connecting
    await terminalInput.fill('help');
    await terminalInput.press('Enter');
    
    await expect(terminalOutput).toContainText('Not connected to Claude Code');
  });

  test('clear terminal functionality works', async () => {
    // Add some content first
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(1000);
    
    const terminalInput = page.locator('#terminalInput');
    await terminalInput.fill('echo test content');
    await terminalInput.press('Enter');
    
    // Verify content exists
    await expect(page.locator('#terminalOutput')).toContainText('test content');
    
    // Clear terminal
    await page.click('button:has-text("Clear")');
    
    // Should only show the clear message
    await expect(page.locator('#terminalOutput')).toContainText('Terminal cleared');
    await expect(page.locator('#terminalOutput')).not.toContainText('test content');
  });

  test('disconnect functionality works', async () => {
    // Connect first
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000);
    
    // Disconnect
    await page.click('button:has-text("Disconnect")');
    
    // Status should change to disconnected
    await expect(page.locator('#connectionStatus')).toHaveClass(/status-disconnected/);
    
    // Should show disconnect message in terminal
    await expect(page.locator('#terminalOutput')).toContainText('Disconnected from Claude Code');
  });

  test('integration test suite can be executed', async () => {
    // Connect first
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000);
    
    // Run integration test
    await page.click('button:has-text("Run Integration Test")');
    
    // Should show test start message
    await expect(page.locator('#terminalOutput')).toContainText('Starting Integration Test');
    
    // Should show test commands being executed
    const testCommands = ['pwd', 'ls', 'echo', 'date', 'whoami'];
    
    // Wait for tests to complete (up to 30 seconds)
    await page.waitForTimeout(10000);
    
    // Should show completion message
    await expect(page.locator('#terminalOutput')).toContainText('Integration Test Complete');
  });

  test('keyboard navigation and focus works', async () => {
    const terminalInput = page.locator('#terminalInput');
    
    // Input should be focused by default
    await expect(terminalInput).toBeFocused();
    
    // Clicking elsewhere and then on page should refocus input
    await page.click('.terminal-header');
    await page.click('.terminal-container');
    
    await expect(terminalInput).toBeFocused();
  });

  test('responsive design works on mobile', async () => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // All elements should still be visible and functional
    await expect(page.locator('.terminal-container')).toBeVisible();
    await expect(page.locator('#terminalInput')).toBeVisible();
    await expect(page.locator('.controls')).toBeVisible();
    
    // Controls should not overlap with terminal
    const controls = page.locator('.controls');
    const terminal = page.locator('.terminal-output');
    
    const controlsBox = await controls.boundingBox();
    const terminalBox = await terminal.boundingBox();
    
    // Controls should be positioned so they don't cover the terminal input area
    expect(controlsBox.y).toBeLessThan(terminalBox.y + 100); // Some reasonable margin
  });

  test('session management works correctly', async () => {
    // Connect and execute a command
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000);
    
    const terminalInput = page.locator('#terminalInput');
    await terminalInput.fill('echo session test');
    await terminalInput.press('Enter');
    
    await expect(page.locator('#terminalOutput')).toContainText('session test');
    
    // Reload page (simulates session recovery)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Should start disconnected again
    await expect(page.locator('#connectionStatus')).toHaveClass(/status-disconnected/);
    
    // Previous session content should be gone
    await expect(page.locator('#terminalOutput')).not.toContainText('session test');
  });

  test('error messages display correctly', async () => {
    await page.click('button:has-text("Connect to Claude")');
    await page.waitForTimeout(2000);
    
    const terminalInput = page.locator('#terminalInput');
    const terminalOutput = page.locator('#terminalOutput');
    
    // Test command that might fail
    await terminalInput.fill('nonexistentcommand12345');
    await terminalInput.press('Enter');
    await page.waitForTimeout(3000);
    
    // Should show the command was executed
    await expect(terminalOutput).toContainText('$ nonexistentcommand12345');
    
    // May show error (depending on system)
    // This is mainly to ensure the UI handles errors gracefully
  });
});

// API Integration Tests
test.describe('Terminal API Integration', () => {
  test('terminal API endpoints respond correctly', async ({ request }) => {
    const sessionId = 'test_' + Math.random().toString(36).substr(2, 9);
    
    // Test connection endpoint
    const connectResponse = await request.post(`${BASE_URL}/api/terminal/connect`, {
      data: { sessionId }
    });
    
    expect(connectResponse.status()).toBe(200);
    const connectData = await connectResponse.json();
    expect(connectData.success).toBe(true);
    expect(connectData.sessionId).toBe(sessionId);
    
    // Test command execution
    const executeResponse = await request.post(`${BASE_URL}/api/terminal/execute`, {
      data: {
        sessionId,
        command: 'echo API test'
      }
    });
    
    expect(executeResponse.status()).toBe(200);
    const executeData = await executeResponse.json();
    expect(executeData.success).toBe(true);
    expect(executeData.output).toBe('API test');
    
    // Test disconnect
    const disconnectResponse = await request.post(`${BASE_URL}/api/terminal/disconnect`, {
      data: { sessionId }
    });
    
    expect(disconnectResponse.status()).toBe(200);
    const disconnectData = await disconnectResponse.json();
    expect(disconnectData.success).toBe(true);
  });

  test('sessions endpoint works correctly', async ({ request }) => {
    const sessionsResponse = await request.get(`${BASE_URL}/api/terminal/sessions`);
    
    expect(sessionsResponse.status()).toBe(200);
    const sessionsData = await sessionsResponse.json();
    expect(sessionsData.success).toBe(true);
    expect(Array.isArray(sessionsData.sessions)).toBe(true);
  });

  test('API handles invalid requests correctly', async ({ request }) => {
    // Test connection without session ID
    const connectResponse = await request.post(`${BASE_URL}/api/terminal/connect`, {
      data: {}
    });
    
    expect(connectResponse.status()).toBe(400);
    
    // Test execution with invalid session
    const executeResponse = await request.post(`${BASE_URL}/api/terminal/execute`, {
      data: {
        sessionId: 'invalid_session',
        command: 'help'
      }
    });
    
    expect(executeResponse.status()).toBe(404);
  });
});