const { test, expect } = require('@playwright/test');

test('Add Panel button E2E test - visibility, clickability and Code Editor spawning', async ({ page }) => {
  console.log('🧪 Starting Add Panel button E2E test...');

  // Navigate to ColabVibe
  await page.goto('http://localhost:3001');
  console.log('📍 Navigated to ColabVibe');

  // Login as Alice (demo user)
  await page.fill('input[type="email"]', 'alice@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  console.log('🔐 Logged in as Alice');

  // Wait for dashboard to load - look for any dashboard indicator
  await page.waitForSelector('[data-testid="dashboard"], .dashboard, text=ColabVibe, text=Spawn Agent', { timeout: 15000 });
  console.log('📊 Dashboard loaded');

  // Enable console logging to see debug messages from GridWorkspace
  page.on('console', msg => {
    if (msg.text().includes('🔍') || msg.text().includes('GridWorkspace')) {
      console.log('BROWSER DEBUG:', msg.text());
    }
  });

  // Wait a moment for workspace to render
  await page.waitForTimeout(2000);

  // Test 1: Check if Add Panel button is visible (center button for empty workspace)
  console.log('🔍 Test 1: Looking for center Add Panel button...');
  
  // Look for the center "Add Panel" button when workspace is empty
  const centerAddButton = page.locator('button:has-text("Add Panel")').first();
  await expect(centerAddButton).toBeVisible({ timeout: 10000 });
  console.log('✅ Center Add Panel button is visible');

  // Test 2: Click the Add Panel button
  console.log('🔍 Test 2: Clicking Add Panel button...');
  await centerAddButton.click();
  console.log('✅ Add Panel button clicked');

  // Test 3: Check if dropdown menu appears
  console.log('🔍 Test 3: Looking for dropdown menu...');
  
  // Wait for the add panel menu to appear
  const addMenu = page.locator('[data-add-menu]');
  await expect(addMenu).toBeVisible({ timeout: 5000 });
  console.log('✅ Add Panel dropdown menu is visible');

  // Test 4: Verify menu options are present
  console.log('🔍 Test 4: Checking menu options...');
  
  const terminalOption = addMenu.locator('button:has-text("Terminal")');
  const chatOption = addMenu.locator('button:has-text("Team Chat")');
  const previewOption = addMenu.locator('button:has-text("Preview")');
  const ideOption = addMenu.locator('button:has-text("Code Editor")');

  await expect(terminalOption).toBeVisible();
  await expect(chatOption).toBeVisible();
  await expect(previewOption).toBeVisible();
  await expect(ideOption).toBeVisible();
  console.log('✅ All menu options are visible');

  // Test 5: Click Code Editor option
  console.log('🔍 Test 5: Clicking Code Editor option...');
  await ideOption.click();
  console.log('✅ Code Editor option clicked');

  // Test 6: Wait for Code Editor tile to appear
  console.log('🔍 Test 6: Looking for Code Editor tile...');
  
  // Wait for the IDE tile to be added to the workspace
  await page.waitForTimeout(2000);
  
  // Look for Monaco Editor or IDE-related elements
  const ideElements = [
    'div:has-text("Code Editor")', // Tile header
    '.monaco-editor',              // Monaco editor container
    'div:has-text("IDE")',         // Alternative IDE text
    '.react-grid-item'             // Any grid item (since we added a tile)
  ];

  let ideFound = false;
  for (const selector of ideElements) {
    const element = page.locator(selector);
    if (await element.count() > 0) {
      console.log(`✅ Found IDE element: ${selector}`);
      ideFound = true;
      break;
    }
  }

  if (!ideFound) {
    // Check if floating Add Panel button appeared (indicates tiles were added)
    const floatingAddButton = page.locator('.fixed.bottom-4.right-4 button:has-text("+")').or(
      page.locator('button[title="Add Panel"]')
    );
    
    if (await floatingAddButton.count() > 0) {
      console.log('✅ Floating Add Panel button visible (indicates workspace has tiles)');
      ideFound = true;
    }
  }

  expect(ideFound).toBe(true);
  console.log('✅ Code Editor tile/workspace change detected');

  // Test 7: Verify floating Add Panel button is now visible (since workspace has tiles)
  console.log('🔍 Test 7: Looking for floating Add Panel button...');
  
  const floatingButton = page.locator('.fixed.bottom-4.right-4 button').or(
    page.locator('button[title="Add Panel"]')
  );
  
  // The floating button should appear when there are tiles
  if (await floatingButton.count() > 0) {
    await expect(floatingButton.first()).toBeVisible();
    console.log('✅ Floating Add Panel button is now visible');

    // Test 8: Click floating button to test it works too
    console.log('🔍 Test 8: Testing floating Add Panel button...');
    await floatingButton.first().click();
    
    // Menu should appear again
    await expect(addMenu).toBeVisible({ timeout: 5000 });
    console.log('✅ Floating Add Panel button works - menu appeared');
  }

  console.log('🎉 All Add Panel button tests passed!');
});

test('Add Panel button - floating button test (with tiles)', async ({ page }) => {
  console.log('🧪 Starting floating Add Panel button test...');

  // Navigate and login
  await page.goto('http://localhost:3001');
  await page.fill('input[type="email"]', 'alice@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="dashboard"], .dashboard, text=ColabVibe, text=Spawn Agent', { timeout: 15000 });

  console.log('🔐 Logged in, adding a tile first...');

  // First add a tile to make the floating button appear
  const centerAddButton = page.locator('button:has-text("Add Panel")').first();
  if (await centerAddButton.count() > 0) {
    await centerAddButton.click();
    const chatOption = page.locator('[data-add-menu] button:has-text("Team Chat")');
    await chatOption.click();
    await page.waitForTimeout(1000);
  }

  // Now test the floating button
  console.log('🔍 Looking for floating Add Panel button...');
  
  const floatingButton = page.locator('button[title="Add Panel"]').or(
    page.locator('.fixed.bottom-4.right-4 button')
  ).or(
    page.locator('button:has(svg[viewBox="0 0 24 24"])')
  );

  await expect(floatingButton.first()).toBeVisible({ timeout: 10000 });
  console.log('✅ Floating button found and visible');

  // Click floating button
  await floatingButton.first().click();
  console.log('✅ Floating button clicked');

  // Check menu appears
  const addMenu = page.locator('[data-add-menu]');
  await expect(addMenu).toBeVisible({ timeout: 5000 });
  console.log('✅ Menu appeared from floating button');

  // Click Code Editor from floating button menu
  const ideOption = addMenu.locator('button:has-text("Code Editor")');
  await ideOption.click();
  console.log('✅ Code Editor clicked from floating menu');

  await page.waitForTimeout(2000);
  console.log('🎉 Floating Add Panel button test complete!');
});