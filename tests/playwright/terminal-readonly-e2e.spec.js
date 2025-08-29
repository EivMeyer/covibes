// E2E test for read-only terminal viewing functionality
// Tests that non-owners can view terminals with proper width and history

import { test, expect } from '@playwright/test';

test.describe('Read-Only Terminal Viewing', () => {
  let ownerPage;
  let viewerPage;
  let ownerContext;
  let viewerContext;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for different users
    ownerContext = await browser.newContext();
    viewerContext = await browser.newContext();
    
    ownerPage = await ownerContext.newPage();
    viewerPage = await viewerContext.newPage();
  });

  test.afterAll(async () => {
    await ownerContext.close();
    await viewerContext.close();
  });

  test('should display read-only terminal with full width and history', async () => {
    // Step 1: Owner logs in and spawns agent
    await ownerPage.goto('http://localhost:3000');
    
    // Login as owner (adjust credentials)
    await ownerPage.fill('input[type="email"]', 'owner@example.com');
    await ownerPage.fill('input[type="password"]', 'password123');
    await ownerPage.click('button:has-text("Login")');
    
    // Wait for dashboard
    await ownerPage.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    
    // Spawn an agent
    await ownerPage.click('button:has-text("Spawn Agent")');
    await ownerPage.fill('textarea[placeholder*="task"]', 'echo "Testing full width display" && for i in {1..5}; do echo "Line $i: This is a test message that should span the full terminal width"; done');
    await ownerPage.click('button:has-text("Spawn")');
    
    // Wait for agent to start
    await ownerPage.waitForTimeout(2000);
    
    // Step 2: Viewer logs in with different account
    await viewerPage.goto('http://localhost:3000');
    
    // Login as viewer (different account)
    await viewerPage.fill('input[type="email"]', 'viewer@example.com');
    await viewerPage.fill('input[type="password"]', 'password123');
    await viewerPage.click('button:has-text("Login")');
    
    // Wait for dashboard
    await viewerPage.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    
    // Step 3: Verify read-only terminal display
    const terminalDisplay = await viewerPage.locator('.terminal-display, pre').first();
    
    if (await terminalDisplay.isVisible()) {
      // Check terminal width
      const box = await terminalDisplay.boundingBox();
      
      // Terminal should use significant width (not constrained to ~80px)
      expect(box.width).toBeGreaterThan(200);
      console.log('✅ Terminal width:', box.width, 'px');
      
      // Check for read-only indicator
      const readOnlyIndicator = await viewerPage.locator('text=/read-only/i').first();
      expect(await readOnlyIndicator.isVisible()).toBeTruthy();
      console.log('✅ Read-only indicator present');
      
      // Check that history is visible
      const terminalContent = await terminalDisplay.textContent();
      expect(terminalContent).toContain('Testing full width display');
      expect(terminalContent).toContain('Line 1:');
      expect(terminalContent).toContain('Line 5:');
      console.log('✅ History is visible');
      
      // Check that lines are not truncated
      const lines = terminalContent.split('\n');
      const longLines = lines.filter(line => line.length > 40);
      expect(longLines.length).toBeGreaterThan(0);
      console.log('✅ Long lines are displayed without truncation');
      
      // Verify no ANSI escape sequences are visible
      expect(terminalContent).not.toContain('\\x1b');
      expect(terminalContent).not.toContain('[0m');
      expect(terminalContent).not.toContain('[31m');
      console.log('✅ No ANSI escape sequences visible');
      
    } else {
      throw new Error('Terminal display not visible for viewer');
    }
    
    // Step 4: Test live updates
    // Owner sends new command
    await ownerPage.locator('.xterm-helper-textarea, input[type="text"]').first().fill('echo "Live update test"');
    await ownerPage.keyboard.press('Enter');
    
    // Wait for update to propagate
    await viewerPage.waitForTimeout(1000);
    
    // Verify viewer sees the update
    const updatedContent = await terminalDisplay.textContent();
    expect(updatedContent).toContain('Live update test');
    console.log('✅ Live updates working');
    
    // Step 5: Test that carriage returns work properly (no duplicate lines)
    await ownerPage.locator('.xterm-helper-textarea, input[type="text"]').first().fill('for i in {1..3}; do echo -ne "Progress: $i/3\\r"; sleep 0.5; done; echo ""');
    await ownerPage.keyboard.press('Enter');
    
    await viewerPage.waitForTimeout(3000);
    
    // Check that we don't have duplicate "Progress:" lines
    const finalContent = await terminalDisplay.textContent();
    const progressLines = finalContent.split('\n').filter(line => line.includes('Progress:'));
    
    // Should only have one final progress line, not multiple
    expect(progressLines.length).toBeLessThanOrEqual(2); // Allow for one in-progress and one final
    console.log('✅ Carriage returns handled properly (no duplicate lines)');
  });

  test('should show proper dimensions and zoom controls', async () => {
    // Check zoom controls are present
    const zoomInButton = await viewerPage.locator('button[title="Zoom in"]').first();
    const zoomOutButton = await viewerPage.locator('button[title="Zoom out"]').first();
    const resetZoomButton = await viewerPage.locator('button[title="Reset zoom"]').first();
    
    expect(await zoomInButton.isVisible()).toBeTruthy();
    expect(await zoomOutButton.isVisible()).toBeTruthy();
    expect(await resetZoomButton.isVisible()).toBeTruthy();
    
    // Test zoom functionality
    const initialFontSize = await viewerPage.locator('text=/\\d+px/').first().textContent();
    await zoomInButton.click();
    await viewerPage.waitForTimeout(100);
    const increasedFontSize = await viewerPage.locator('text=/\\d+px/').first().textContent();
    
    const initialSize = parseInt(initialFontSize);
    const increasedSize = parseInt(increasedFontSize);
    expect(increasedSize).toBeGreaterThan(initialSize);
    console.log('✅ Zoom controls working');
  });
});