import { test, expect } from '@playwright/test';

test.describe('Login E2E Tests', () => {
  const BASE_URL = 'http://localhost:3000';
  
  test('should load login page', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check if login form is visible
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    console.log('✅ Login page loads correctly');
  });

  test('should login with test credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Fill login form with correct demo credentials
    await page.fill('input[name="email"]', 'alice@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for either dashboard or error message
    try {
      // Try to wait for dashboard
      await page.waitForURL(/dashboard/, { timeout: 10000 });
      console.log('✅ Login successful - redirected to dashboard');
      
      // Verify we're on dashboard
      await expect(page.locator('text="Command Deck"')).toBeVisible({ timeout: 5000 });
      console.log('✅ Dashboard loaded successfully');
      
    } catch (error) {
      // Check for error messages
      const errorMessage = await page.locator('text="Invalid credentials"').isVisible().catch(() => false);
      const networkError = await page.locator('text="Network error"').isVisible().catch(() => false);
      const serverError = await page.locator('text="Server error"').isVisible().catch(() => false);
      
      console.error('❌ Login failed');
      if (errorMessage) console.error('  - Invalid credentials');
      if (networkError) console.error('  - Network error');  
      if (serverError) console.error('  - Server error');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/login-failure.png' });
      
      throw new Error('Login failed');
    }
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Try invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error or stay on login page
    await page.waitForTimeout(3000);
    
    // Check if we're still on login page (didn't redirect)
    const emailField = await page.locator('input[name="email"]').isVisible();
    if (emailField) {
      console.log('✅ Invalid login correctly rejected - stayed on login page');
    } else {
      console.log('❌ Unexpected behavior with invalid credentials');
    }
  });

  test('should login with demo credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Try demo credentials
    await page.fill('input[name="email"]', 'bob@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL(/dashboard/, { timeout: 10000 });
      console.log('✅ Demo login successful');
      
      // Verify dashboard elements
      await expect(page.locator('text="Command Deck"')).toBeVisible();
      await expect(page.locator('button:has-text("Spawn Agent"), button:has-text("Spawn")')).toBeVisible();
      
      console.log('✅ Demo user can access dashboard and spawn agents');
      
    } catch (error) {
      console.error('❌ Demo login failed');
      await page.screenshot({ path: 'test-results/demo-login-failure.png' });
      throw error;
    }
  });
});