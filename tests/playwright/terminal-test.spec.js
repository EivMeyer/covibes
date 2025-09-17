const { test, expect } = require('@playwright/test');

test.describe('Claude Code Agent Terminal', () => {
  test('should spawn agent and display terminal output', async ({ page }) => {
    // Enable console logging to debug
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[Browser ${msg.type()}]:`, msg.text());
      }
    });

    // Monitor WebSocket frames
    page.on('websocket', ws => {
      console.log(`[WebSocket] opened: ${ws.url()}`);
      ws.on('framesent', frame => console.log(`[WS Send]:`, frame.payload?.toString().substring(0, 100)));
      ws.on('framereceived', frame => console.log(`[WS Recv]:`, frame.payload?.toString().substring(0, 100)));
    });

    // Go to the test page
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/chat-test');

    // Wait for initial connection
    await expect(page.locator('#status')).toContainText('Connected', { timeout: 10000 });

    // Wait for agent to spawn
    await expect(page.locator('#agentId')).not.toContainText('Spawning', { timeout: 30000 });

    // Get agent ID
    const agentId = await page.locator('#agentId').textContent();
    console.log('Agent spawned with ID:', agentId);

    // Wait for terminal output - Claude should show something
    await page.waitForTimeout(5000); // Give it time to connect

    // Check if terminal has any content
    const terminalContent = await page.evaluate(() => {
      const terminal = window.terminal;
      if (!terminal) return 'No terminal found';

      // Try to get buffer content
      const buffer = terminal.buffer?.active || terminal.buffer?.normal;
      if (!buffer) return 'No buffer found';

      let content = '';
      for (let i = 0; i < buffer.length && i < 50; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + '\n';
        }
      }
      return content || 'Empty buffer';
    });

    console.log('Terminal content:', terminalContent);

    // The terminal should have Claude's output
    if (terminalContent.includes('Empty buffer') || terminalContent.includes('No buffer found')) {
      throw new Error('Terminal is not receiving output from agent');
    }

    // Try sending a command
    await page.evaluate(() => {
      const terminal = window.terminal;
      if (terminal && terminal.onData) {
        // Send "pwd" command
        const command = 'pwd\r';
        for (const char of command) {
          terminal.onData(char);
        }
      }
    });

    // Wait for response
    await page.waitForTimeout(3000);

    // Check terminal again for response
    const terminalAfterCommand = await page.evaluate(() => {
      const terminal = window.terminal;
      const buffer = terminal?.buffer?.active || terminal?.buffer?.normal;
      if (!buffer) return 'No buffer';

      let content = '';
      for (let i = 0; i < buffer.length && i < 100; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + '\n';
        }
      }
      return content;
    });

    console.log('Terminal after command:', terminalAfterCommand);

    // Should contain workspace path
    expect(terminalAfterCommand).toContain('workspace');
  });
});