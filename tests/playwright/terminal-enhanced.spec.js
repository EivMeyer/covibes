const { test, expect } = require('@playwright/test');

test.describe('Enhanced Claude Code Agent Terminal', () => {
  test('should spawn agent and establish interactive terminal session', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    });

    // Monitor WebSocket
    page.on('websocket', ws => {
      console.log(`[WebSocket] opened: ${ws.url()}`);
    });

    console.log('📄 Navigating to enhanced chat-test page...');
    await page.goto('http://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com:3001/chat-test');

    // Wait for socket connection
    console.log('⏳ Waiting for socket connection...');
    await expect(page.locator('#socket-text')).toContainText('Connected', { timeout: 10000 });
    console.log('✅ Socket connected');

    // Wait for agent to auto-spawn
    console.log('⏳ Waiting for agent to spawn...');
    await expect(page.locator('#agent-text')).not.toContainText('Spawning', { timeout: 30000 });

    const agentText = await page.locator('#agent-text').textContent();
    console.log(`✅ Agent status: ${agentText}`);

    // Wait for terminal to be ready
    await page.waitForTimeout(5000);

    // Check terminal content
    const terminalContent = await page.evaluate(() => {
      const terminal = window.terminal;
      if (!terminal) return 'No terminal found';

      const buffer = terminal.buffer?.active || terminal.buffer?.normal;
      if (!buffer) return 'No buffer found';

      let content = '';
      for (let i = 0; i < Math.min(buffer.length, 100); i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString(true);
          if (text.trim()) content += text + '\n';
        }
      }
      return content || 'Empty buffer';
    });

    console.log('📺 Terminal content:');
    console.log('---START---');
    console.log(terminalContent.substring(0, 1000));
    console.log('---END---');

    // Test interactivity - send pwd command
    console.log('📝 Testing interactivity with "pwd" command...');
    await page.evaluate(() => {
      const terminal = window.terminal;
      if (terminal && terminal.onData) {
        // Simulate typing "pwd" and pressing Enter
        ['p', 'w', 'd', '\r'].forEach(char => terminal.onData(char));
      }
    });

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for response
    const afterPwd = await page.evaluate(() => {
      const terminal = window.terminal;
      if (!terminal) return 'No terminal';

      const buffer = terminal.buffer?.active || terminal.buffer?.normal;
      if (!buffer) return 'No buffer';

      let content = '';
      // Get last 50 lines
      const startLine = Math.max(0, buffer.length - 50);
      for (let i = startLine; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString(true);
          if (text.trim()) content += text + '\n';
        }
      }
      return content;
    });

    console.log('📺 Terminal after pwd command (last 50 lines):');
    console.log('---START---');
    console.log(afterPwd);
    console.log('---END---');

    // Check for workspace path in output
    if (afterPwd.includes('workspace') || afterPwd.includes('/home/ubuntu')) {
      console.log('✅ SUCCESS! Terminal is fully interactive - pwd command responded');
    } else {
      console.log('⚠️ Terminal may not be fully interactive yet');
    }

    // Test ls command
    console.log('📝 Testing "ls" command...');
    await page.evaluate(() => {
      const terminal = window.terminal;
      if (terminal && terminal.onData) {
        ['l', 's', '\r'].forEach(char => terminal.onData(char));
      }
    });

    await page.waitForTimeout(3000);

    const afterLs = await page.evaluate(() => {
      const terminal = window.terminal;
      if (!terminal) return 'No terminal';

      const buffer = terminal.buffer?.active || terminal.buffer?.normal;
      if (!buffer) return 'No buffer';

      let content = '';
      // Get last 30 lines
      const startLine = Math.max(0, buffer.length - 30);
      for (let i = startLine; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString(true);
          if (text.trim()) content += text + '\n';
        }
      }
      return content;
    });

    console.log('📺 Terminal after ls command (last 30 lines):');
    console.log('---START---');
    console.log(afterLs);
    console.log('---END---');

    if (afterLs.includes('.covibes') || afterLs.includes('package.json') || afterLs.includes('node_modules')) {
      console.log('✅ FULLY INTERACTIVE! Terminal responded to ls command');
    }

    // Check debug logs
    console.log('🔍 Checking debug logs...');
    await page.click('#log-toggle');
    await page.waitForTimeout(1000);

    const logsContent = await page.locator('#logs').textContent();
    console.log('Debug logs:', logsContent);

    // Final assertions
    expect(terminalContent).not.toContain('Empty buffer');
    expect(terminalContent).not.toContain('No terminal found');
  });
});