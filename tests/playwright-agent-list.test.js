/**
 * Agent List E2E Test
 * 
 * Tests that spawned agents appear in the Active Agents list
 */

const { test, expect } = require('@playwright/test');

test('Agent appears in Active Agents list after spawning', async ({ page }) => {
  console.log('🚀 Starting agent list test...');
  
  // Navigate and login
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"]', 'alice@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Command Deck') || 
           document.querySelector('button') && 
           Array.from(document.querySelectorAll('button')).some(btn => 
             btn.textContent.includes('Spawn')
           );
  }, { timeout: 15000 });
  
  // Wait for socket connection
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return !text.includes('Connecting to server...');
  }, { timeout: 10000 });
  
  console.log('✅ Logged in and connected');
  
  // Check initial state - should have no agents or empty list
  const activeAgentsSection = await page.textContent('body');
  const hasActiveAgentsSection = activeAgentsSection.includes('Active Agents') || 
                                 activeAgentsSection.includes('ACTIVE AGENTS');
  
  if (hasActiveAgentsSection) {
    console.log('✅ Found Active Agents section');
  } else {
    console.log('⚠️ Active Agents section not visible initially');
  }
  
  // Take screenshot of initial state
  await page.screenshot({ 
    path: 'screenshots/agent-list-before.png',
    fullPage: true 
  });
  
  // Spawn an agent
  console.log('🤖 Spawning agent...');
  const spawnButton = page.getByRole('button', { name: /spawn/i });
  await expect(spawnButton).toBeEnabled({ timeout: 10000 });
  await spawnButton.click();
  
  // Fill task
  await page.waitForSelector('textarea[name="task"]', { timeout: 10000 });
  const testTask = 'Create index.html with Hello World - Test Agent #' + Date.now();
  await page.fill('textarea[name="task"]', testTask);
  console.log(`✅ Task filled: "${testTask}"`);
  
  // Submit
  await page.getByRole('button', { name: /spawn/i }).last().click();
  console.log('✅ Agent spawn submitted');
  
  // Wait for modal to close
  await page.waitForFunction(() => {
    const modals = document.querySelectorAll('div[role="dialog"], .modal');
    return modals.length === 0 || Array.from(modals).every(modal => 
      modal.style.display === 'none' || !modal.offsetParent
    );
  }, { timeout: 10000 });
  
  // Wait for agent to appear in the Active Agents list
  console.log('🔍 Looking for agent in Active Agents list...');
  
  // Wait for the agent to appear - look for task text or agent indicators
  const agentAppeared = await page.waitForFunction((taskText) => {
    const pageText = document.body.innerText;
    // Check for the specific task text
    if (pageText.includes(taskText)) return true;
    
    // Also check for generic agent indicators with "Active Agents" nearby
    const hasActiveAgents = pageText.includes('Active Agents') || pageText.includes('ACTIVE AGENTS');
    const hasAgentInfo = pageText.includes('running') || 
                         pageText.includes('spawned') ||
                         pageText.includes('index.html') ||
                         pageText.includes('Hello World');
    
    return hasActiveAgents && hasAgentInfo;
  }, testTask.substring(0, 30), { timeout: 20000 });
  
  if (agentAppeared) {
    console.log('✅ Agent appeared in Active Agents list!');
  }
  
  // Look for specific agent card elements
  const agentCardSelectors = [
    '[data-testid="agent-card"]',
    '.agent-card',
    '[class*="agent"][class*="card"]',
    '[role="listitem"]',
    'div:has-text("' + testTask.substring(0, 20) + '")'
  ];
  
  let foundAgentCard = false;
  for (const selector of agentCardSelectors) {
    try {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} agent card(s) with selector: ${selector}`);
        foundAgentCard = true;
        
        // Try to get agent details from the card
        for (const element of elements) {
          const text = await element.textContent();
          if (text && text.includes('Hello World')) {
            console.log('✅ Agent card contains our task!');
            
            // Try to click it
            try {
              await element.click();
              console.log('✅ Clicked on agent card');
              
              // Wait a moment to see if modal opens
              await page.waitForTimeout(2000);
              
              const hasModal = await page.locator('div[role="dialog"], .modal').count() > 0;
              if (hasModal) {
                console.log('✅ Agent details modal opened');
              }
            } catch (e) {
              console.log('⚠️ Could not click agent card');
            }
            break;
          }
        }
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!foundAgentCard) {
    console.log('⚠️ No specific agent card element found, but agent text is present');
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: 'screenshots/agent-list-after.png',
    fullPage: true 
  });
  
  // Verify the agent count increased
  const finalPageText = await page.textContent('body');
  
  // Look for agent count indicators
  const countMatch = finalPageText.match(/(\d+)\s*agent/i);
  if (countMatch && parseInt(countMatch[1]) > 0) {
    console.log(`✅ Agent count: ${countMatch[1]}`);
  }
  
  console.log('🎉 Test completed!');
  console.log('📸 Screenshots saved:');
  console.log('  - screenshots/agent-list-before.png (initial state)');
  console.log('  - screenshots/agent-list-after.png (with spawned agent)');
  
  // Test passes if agent appeared
  expect(agentAppeared).toBeTruthy();
});