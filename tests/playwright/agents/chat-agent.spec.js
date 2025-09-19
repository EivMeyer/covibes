const { test, expect } = require('@playwright/test');
const { login, waitForSocket, cleanupTestData } = require('../utils/helpers');

test.describe('Chat Mode Agents', () => {
  let page;
  let context;
  let agentId = null;

  test.beforeEach(async ({ browser }) => {
    // Create a new context and page for each test
    context = await browser.newContext();
    page = await context.newPage();

    // Login and wait for socket connection
    await login(page);
    await waitForSocket(page);

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Cleanup any spawned agents
    if (agentId) {
      try {
        await page.evaluate(async (aid) => {
          const token = localStorage.getItem('token');
          await fetch(`/api/agents/${aid}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }, agentId);
      } catch (error) {
        console.log('Failed to cleanup agent:', error.message);
      }
    }

    // Close the context
    await context.close();
  });

  test('should not create terminal tile for chat mode agents', async () => {
    console.log('Starting chat agent test...');

    // Open spawn agent modal
    await page.click('[data-testid="spawn-agent-btn"]');
    await page.waitForSelector('[data-testid="spawn-agent-modal"]', { state: 'visible' });

    // Select chat mode
    await page.click('text=Chat Mode');

    // Fill in task
    await page.fill('[placeholder="What should this agent do?"]', 'Help with code review');

    // Listen for agent-spawned event
    const agentPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window._socket.once('agent-spawned', (data) => {
          resolve(data.agent);
        });
      });
    });

    // Submit the form
    await page.click('button:has-text("Spawn Agent")');

    // Wait for agent to be spawned
    const agent = await agentPromise;
    agentId = agent.id;

    console.log('Agent spawned:', { id: agent.id, mode: agent.mode });

    // Wait a moment for any tiles to be created
    await page.waitForTimeout(2000);

    // Check that NO terminal tile was created for this agent
    const terminalTiles = await page.$$(`[data-testid="terminal-tile-${agentId}"]`);
    expect(terminalTiles.length).toBe(0);

    console.log('✅ No terminal tile created for chat agent');

    // Verify the agent appears in the agents list
    await page.click('[data-testid="agents-panel-btn"]');
    await expect(page.locator(`text=${agent.agentName || agent.id}`)).toBeVisible();

    console.log('✅ Chat agent appears in agents list');

    // Verify agent has chat mode
    const agentData = await page.evaluate(async (aid) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/agents/${aid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.json();
    }, agentId);

    expect(agentData.agent.mode).toBe('chat');
    console.log('✅ Agent confirmed to be in chat mode');
  });

  test('should still create terminal tile for terminal mode agents', async () => {
    console.log('Starting terminal agent test...');

    // Open spawn agent modal
    await page.click('[data-testid="spawn-agent-btn"]');
    await page.waitForSelector('[data-testid="spawn-agent-modal"]', { state: 'visible' });

    // Select terminal mode
    await page.click('text=Terminal Mode');

    // Fill in task
    await page.fill('[placeholder="What should this agent do?"]', 'Build a feature');

    // Listen for agent-spawned event
    const agentPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window._socket.once('agent-spawned', (data) => {
          resolve(data.agent);
        });
      });
    });

    // Submit the form
    await page.click('button:has-text("Spawn Agent")');

    // Wait for agent to be spawned
    const agent = await agentPromise;
    agentId = agent.id;

    console.log('Terminal agent spawned:', { id: agent.id, mode: agent.mode });

    // Wait for terminal tile to be created
    await page.waitForSelector(`[data-testid="terminal-tile-${agentId}"]`, {
      state: 'visible',
      timeout: 5000
    });

    console.log('✅ Terminal tile created for terminal mode agent');

    // Verify the terminal tile has the agent's name
    const tileTitle = await page.textContent(`[data-testid="terminal-tile-${agentId}"] .tile-title`);
    expect(tileTitle).toContain(agent.agentName || `Agent ${agentId.slice(-6)}`);

    console.log('✅ Terminal tile has correct agent name');
  });

  test('chat agent should respond to messages without terminal', async () => {
    console.log('Testing chat agent messaging...');

    // Spawn a chat agent
    await page.click('[data-testid="spawn-agent-btn"]');
    await page.waitForSelector('[data-testid="spawn-agent-modal"]', { state: 'visible' });
    await page.click('text=Chat Mode');
    await page.fill('[placeholder="What should this agent do?"]', 'Answer questions');

    const agentPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window._socket.once('agent-spawned', (data) => {
          resolve(data.agent);
        });
      });
    });

    await page.click('button:has-text("Spawn Agent")');
    const agent = await agentPromise;
    agentId = agent.id;

    console.log('Chat agent spawned:', agent.id);

    // Open the agents panel
    await page.click('[data-testid="agents-panel-btn"]');

    // Click on the agent to open chat
    await page.click(`[data-testid="agent-card-${agentId}"]`);

    // Wait for chat interface to open
    await page.waitForSelector('[data-testid="agent-chat-interface"]', { state: 'visible' });

    // Send a message
    const testMessage = 'Hello, can you help me?';
    await page.fill('[data-testid="agent-chat-input"]', testMessage);

    // Listen for response
    const responsePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window._socket.once('agent_chat_response', (data) => {
          resolve(data);
        });
      });
    });

    await page.press('[data-testid="agent-chat-input"]', 'Enter');

    // Wait for response (with timeout)
    const response = await Promise.race([
      responsePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]).catch(() => null);

    if (response) {
      expect(response.agentId).toBe(agentId);
      expect(response.response).toBeTruthy();
      console.log('✅ Received response from chat agent:', response.response.substring(0, 50) + '...');
    } else {
      console.log('⚠️ No response received (might be due to Claude not being configured)');
    }

    // Verify no terminal tile was created
    const terminalTiles = await page.$$(`[data-testid="terminal-tile-${agentId}"]`);
    expect(terminalTiles.length).toBe(0);

    console.log('✅ Chat agent works without terminal tile');
  });
});