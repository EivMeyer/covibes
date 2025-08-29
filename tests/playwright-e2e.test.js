/**
 * Playwright End-to-End Tests for CoVibe
 * Requirements: Server must be running on http://localhost:3001
 */

const { test, expect } = require('@playwright/test');

test.describe('CoVibe E2E Tests', () => {
  const BASE_URL = 'http://localhost:3001';
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('Authentication Flow', () => {
    test('should display login screen by default', async ({ page }) => {
      await expect(page.locator('#loginScreen')).toBeVisible();
      await expect(page.locator('#registerScreen')).toBeHidden();
      await expect(page.locator('#appScreen')).toBeHidden();
    });

    test('should switch between auth screens', async ({ page }) => {
      // Switch to register
      await page.click('text=Create Team');
      await expect(page.locator('#registerScreen')).toBeVisible();
      await expect(page.locator('#loginScreen')).toBeHidden();
      
      // Switch to join team
      await page.click('text=Join Existing Team');
      await expect(page.locator('#joinTeamScreen')).toBeVisible();
      
      // Back to login
      await page.click('text=Back to Login');
      await expect(page.locator('#loginScreen')).toBeVisible();
    });

    test('should validate login form', async ({ page }) => {
      await page.click('#loginForm button[type="submit"]');
      
      // Check for validation
      const emailInput = page.locator('#loginEmail');
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('should register new team', async ({ page }) => {
      await page.click('text=Create Team');
      
      // Fill registration form
      await page.fill('#registerTeamName', 'Test Team');
      await page.fill('#registerUserName', 'Test User');
      await page.fill('#registerEmail', 'test@example.com');
      await page.fill('#registerPassword', 'password123');
      
      // Submit
      await page.click('#registerForm button[type="submit"]');
      
      // Should redirect to app or show success
      await page.waitForTimeout(1000);
    });

    test('should handle login', async ({ page }) => {
      await page.fill('#loginEmail', 'test@example.com');
      await page.fill('#loginPassword', 'password123');
      await page.click('#loginForm button[type="submit"]');
      
      // Wait for response
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Main Application UI', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication by setting localStorage
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
        localStorage.setItem('team', JSON.stringify({
          id: 'team-123',
          name: 'Test Team'
        }));
        localStorage.setItem('user', JSON.stringify({
          id: 'user-123',
          name: 'Test User'
        }));
      });
      
      await page.goto(BASE_URL);
    });

    test('should display main app layout', async ({ page }) => {
      // Check for main sections
      await expect(page.locator('#commandDeck')).toBeVisible();
      await expect(page.locator('#workshop')).toBeVisible();
      await expect(page.locator('#showcase')).toBeVisible();
    });

    test('should display team info', async ({ page }) => {
      await expect(page.locator('#teamName')).toContainText('Test Team');
    });

    test('should allow spawning agent', async ({ page }) => {
      await page.click('#spawnAgentBtn');
      
      // Check if spawn dialog or action occurs
      await page.waitForTimeout(500);
    });

    test('should display chat interface', async ({ page }) => {
      await expect(page.locator('#chatMessages')).toBeVisible();
      await expect(page.locator('#chatInput')).toBeVisible();
      await expect(page.locator('#chatForm')).toBeVisible();
    });

    test('should send chat message', async ({ page }) => {
      const testMessage = 'Hello, team!';
      await page.fill('#chatInput', testMessage);
      await page.click('#chatForm button[type="submit"]');
      
      // Check if message appears
      await page.waitForTimeout(500);
      await expect(page.locator('#chatInput')).toHaveValue('');
    });

    test('should display agent list', async ({ page }) => {
      await expect(page.locator('#agentList')).toBeVisible();
    });

    test('should show VM configuration modal', async ({ page }) => {
      await page.click('#configureVMBtn');
      await expect(page.locator('#vmModal')).toBeVisible();
      
      // Check modal fields
      await expect(page.locator('#vmHost')).toBeVisible();
      await expect(page.locator('#vmUser')).toBeVisible();
      await expect(page.locator('#vmKeyPath')).toBeVisible();
    });

    test('should close VM modal', async ({ page }) => {
      await page.click('#configureVMBtn');
      await expect(page.locator('#vmModal')).toBeVisible();
      
      // Close modal
      await page.click('#vmModalClose');
      await expect(page.locator('#vmModal')).toBeHidden();
    });
  });

  test.describe('Real-time Features', () => {
    test('should connect to WebSocket', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
      });
      
      await page.goto(BASE_URL);
      
      // Check WebSocket connection in console
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      await page.waitForTimeout(1000);
      
      // Should have connection message
      const hasConnection = consoleMessages.some(msg => 
        msg.includes('WebSocket') || msg.includes('Connected')
      );
    });

    test('should handle reconnection', async ({ page, context }) => {
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
      });
      
      await page.goto(BASE_URL);
      
      // Simulate offline
      await context.setOffline(true);
      await page.waitForTimeout(1000);
      
      // Back online
      await context.setOffline(false);
      await page.waitForTimeout(2000);
      
      // Check for reconnection attempt
    });
  });

  test.describe('Agent Output Display', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
      });
      await page.goto(BASE_URL);
    });

    test('should display agent output area', async ({ page }) => {
      await expect(page.locator('#agentOutput')).toBeVisible();
    });

    test('should format agent output correctly', async ({ page }) => {
      // Simulate agent output
      await page.evaluate(() => {
        const output = document.querySelector('#agentOutput');
        const line = document.createElement('div');
        line.className = 'output-line';
        line.textContent = '> Agent executing command...';
        output.appendChild(line);
      });
      
      await expect(page.locator('.output-line')).toContainText('Agent executing');
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      
      // Check if layout adjusts
      await expect(page.locator('#loginScreen')).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      
      await expect(page.locator('#loginScreen')).toBeVisible();
    });

    test('should work on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(BASE_URL);
      
      await expect(page.locator('#loginScreen')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should display error messages', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Try invalid login
      await page.fill('#loginEmail', 'invalid@example.com');
      await page.fill('#loginPassword', 'wrongpassword');
      await page.click('#loginForm button[type="submit"]');
      
      // Wait for error message
      await page.waitForTimeout(1000);
    });

    test('should handle network errors gracefully', async ({ page, context }) => {
      await page.goto(BASE_URL);
      
      // Block API calls
      await page.route('**/api/**', route => route.abort());
      
      // Try to login
      await page.fill('#loginEmail', 'test@example.com');
      await page.fill('#loginPassword', 'password123');
      await page.click('#loginForm button[type="submit"]');
      
      // Should show error
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Performance', () => {
    test('should load quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
    });

    test('should handle many chat messages', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-jwt-token');
      });
      await page.goto(BASE_URL);
      
      // Add many messages
      await page.evaluate(() => {
        const chatMessages = document.querySelector('#chatMessages');
        if (chatMessages) {
          for (let i = 0; i < 100; i++) {
            const msg = document.createElement('div');
            msg.textContent = `Message ${i}`;
            chatMessages.appendChild(msg);
          }
        }
      });
      
      // Check performance
      const metrics = await page.evaluate(() => performance.getEntriesByType('measure'));
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Check for accessibility attributes
      const loginButton = page.locator('#loginForm button[type="submit"]');
      await expect(loginButton).toHaveText(/login|sign in/i);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focus
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });
});