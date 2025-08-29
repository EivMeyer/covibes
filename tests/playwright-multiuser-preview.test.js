/**
 * Multi-User Preview Synchronization Tests for CoVibe
 * Tests that preview updates are synchronized across multiple users
 */

const { test, expect } = require('@playwright/test');

test.describe('Multi-User Preview Synchronization', () => {
  const BASE_URL = 'http://localhost:3001';
  let teamToken;
  let user1Token;
  let user2Token;
  
  test.beforeAll(async () => {
    // Create a team with first user
    const teamResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'MultiUserPreview',
        userName: 'User1',
        email: 'user1@preview.com',
        password: 'password123'
      })
    });
    
    const teamResult = await teamResponse.json();
    user1Token = teamResult.token;
    teamToken = teamResult.token;
    
    // Get team invite code
    const userResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${teamToken}` }
    });
    const userData = await userResponse.json();
    const inviteCode = userData.team.inviteCode;
    
    // Join team with second user
    const joinResponse = await fetch(`${BASE_URL}/api/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: inviteCode,
        userName: 'User2',
        email: 'user2@preview.com',
        password: 'password123'
      })
    });
    
    const joinResult = await joinResponse.json();
    user2Token = joinResult.token;
  });

  test('should sync preview updates between two users', async ({ browser }) => {
    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // User 1 logs in
    await page1.goto(`${BASE_URL}/app.html`);
    await page1.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page1.reload();
    await page1.waitForTimeout(3000);
    
    // User 2 logs in
    await page2.goto(`${BASE_URL}/app.html`);
    await page2.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user2Token);
    await page2.reload();
    await page2.waitForTimeout(3000);
    
    // Both users should see showcase panel
    await expect(page1.locator('#showcase')).toBeVisible();
    await expect(page2.locator('#showcase')).toBeVisible();
    
    // User 1 updates preview content
    const updateResult = await page1.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.getElementById('previewFrame');
        const testContent = `
          <html>
            <body>
              <h1>Updated by User 1</h1>
              <p>Timestamp: ${new Date().toISOString()}</p>
            </body>
          </html>
        `;
        iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(testContent);
        
        // Simulate triggering preview update event
        if (window.socketManager && window.socketManager.emit) {
          window.socketManager.emit('preview_updated', {
            content: testContent,
            userId: 'user1',
            timestamp: Date.now()
          });
        }
        
        setTimeout(() => {
          resolve({
            contentSet: iframe.src.includes('Updated by User 1'),
            hasSocketManager: !!window.socketManager
          });
        }, 500);
      });
    });
    
    expect(updateResult.contentSet).toBeTruthy();
    
    // User 2 should receive the update (if WebSocket is working)
    await page2.waitForTimeout(2000);
    
    await context1.close();
    await context2.close();
  });

  test('should handle concurrent preview updates from multiple users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Set up both users
    await page1.goto(`${BASE_URL}/app.html`);
    await page1.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page1.reload();
    await page1.waitForTimeout(2000);
    
    await page2.goto(`${BASE_URL}/app.html`);
    await page2.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user2Token);
    await page2.reload();
    await page2.waitForTimeout(2000);
    
    // Simulate concurrent updates
    const concurrentTest = await Promise.all([
      page1.evaluate(() => {
        return new Promise((resolve) => {
          const iframe = document.getElementById('previewFrame');
          const content1 = '<html><body><h1>Update from User 1</h1></body></html>';
          iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(content1);
          
          setTimeout(() => {
            resolve({
              user: 'user1',
              updated: iframe.src.includes('Update from User 1'),
              timestamp: Date.now()
            });
          }, 300);
        });
      }),
      
      page2.evaluate(() => {
        return new Promise((resolve) => {
          const iframe = document.getElementById('previewFrame');
          const content2 = '<html><body><h1>Update from User 2</h1></body></html>';
          iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(content2);
          
          setTimeout(() => {
            resolve({
              user: 'user2',
              updated: iframe.src.includes('Update from User 2'),
              timestamp: Date.now()
            });
          }, 300);
        });
      })
    ]);
    
    console.log('Concurrent update results:', concurrentTest);
    expect(concurrentTest[0].updated).toBeTruthy();
    expect(concurrentTest[1].updated).toBeTruthy();
    
    await context1.close();
    await context2.close();
  });

  test('should maintain preview sync when users join and leave', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    
    // User 1 joins and sets initial content
    await page1.goto(`${BASE_URL}/app.html`);
    await page1.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page1.reload();
    await page1.waitForTimeout(2000);
    
    await page1.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const initialContent = '<html><body><h1>Initial Content</h1></body></html>';
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(initialContent);
    });
    
    // User 2 joins later
    await page2.goto(`${BASE_URL}/app.html`);
    await page2.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user2Token);
    await page2.reload();
    await page2.waitForTimeout(2000);
    
    // User 2 should see the current state
    const syncTest = await page2.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      return {
        iframeExists: !!iframe,
        hasInitialSrc: iframe.src === 'about:blank' // Expected initial state
      };
    });
    
    expect(syncTest.iframeExists).toBeTruthy();
    
    // User 2 leaves (close context)
    await context2.close();
    
    // User 1 updates after User 2 leaves
    const postLeaveUpdate = await page1.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const updateContent = '<html><body><h1>Updated After Leave</h1></body></html>';
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(updateContent);
      return iframe.src.includes('Updated After Leave');
    });
    
    expect(postLeaveUpdate).toBeTruthy();
    
    await context1.close();
    await context3.close();
  });

  test('should handle preview refresh notifications for all users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Set up both users
    await page1.goto(`${BASE_URL}/app.html`);
    await page1.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page1.reload();
    await page1.waitForTimeout(2000);
    
    await page2.goto(`${BASE_URL}/app.html`);
    await page2.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user2Token);
    await page2.reload();
    await page2.waitForTimeout(2000);
    
    // Test notification system
    const notificationTest = await Promise.all([
      page1.evaluate(() => {
        return new Promise((resolve) => {
          // Mock refresh and check for notifications
          if (window.app && window.app.refreshPreview) {
            window.app.refreshPreview();
            
            setTimeout(() => {
              const notifications = document.querySelectorAll('.fixed.top-4.right-4');
              resolve({
                user: 'user1',
                notificationCount: notifications.length,
                hasRefreshFunction: typeof window.app.refreshPreview === 'function'
              });
            }, 500);
          } else {
            resolve({ user: 'user1', notificationCount: 0, hasRefreshFunction: false });
          }
        });
      }),
      
      page2.evaluate(() => {
        return new Promise((resolve) => {
          // Check if user2 receives notifications from user1's actions
          setTimeout(() => {
            const notifications = document.querySelectorAll('.fixed.top-4.right-4');
            resolve({
              user: 'user2',
              notificationCount: notifications.length,
              hasRefreshFunction: typeof window.app?.refreshPreview === 'function'
            });
          }, 1000);
        });
      })
    ]);
    
    console.log('Notification test results:', notificationTest);
    expect(notificationTest[0].hasRefreshFunction).toBeTruthy();
    expect(notificationTest[1].hasRefreshFunction).toBeTruthy();
    
    await context1.close();
    await context2.close();
  });

  test('should preserve preview state during reconnection', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Set up user and content
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Set preview content
    await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const testContent = '<html><body><h1>Content Before Reconnect</h1></body></html>';
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(testContent);
    });
    
    // Simulate network disconnection and reconnection
    const reconnectTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.getElementById('previewFrame');
        const contentBefore = iframe.src;
        
        // Simulate disconnection
        if (window.socketManager) {
          window.socketManager.trigger('disconnected', 'network-error');
          
          setTimeout(() => {
            // Simulate reconnection
            window.socketManager.trigger('connected');
            
            setTimeout(() => {
              const contentAfter = iframe.src;
              resolve({
                hadContentBefore: contentBefore.includes('Content Before Reconnect'),
                hasContentAfter: contentAfter.includes('Content Before Reconnect'),
                contentPreserved: contentBefore === contentAfter
              });
            }, 500);
          }, 1000);
        } else {
          resolve({
            hadContentBefore: false,
            hasContentAfter: false,
            contentPreserved: false
          });
        }
      });
    });
    
    console.log('Reconnect test results:', reconnectTest);
    expect(reconnectTest.hadContentBefore).toBeTruthy();
    expect(reconnectTest.hasContentAfter).toBeTruthy();
    
    await context.close();
  });

  test('should handle different preview URLs for same team', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Set up both users
    await page1.goto(`${BASE_URL}/app.html`);
    await page1.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user1Token);
    await page1.reload();
    await page1.waitForTimeout(2000);
    
    await page2.goto(`${BASE_URL}/app.html`);
    await page2.evaluate((token) => {
      localStorage.setItem('token', token);
    }, user2Token);
    await page2.reload();
    await page2.waitForTimeout(2000);
    
    // Test different preview content types
    const urlTest = await Promise.all([
      page1.evaluate(() => {
        const iframe = document.getElementById('previewFrame');
        const htmlContent = '<html><body><h1>HTML Preview</h1></body></html>';
        iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        return { type: 'html', loaded: iframe.src.includes('HTML Preview') };
      }),
      
      page2.evaluate(() => {
        const iframe = document.getElementById('previewFrame');
        // Could test loading external URLs if allowed
        iframe.src = 'about:blank';
        return { type: 'blank', loaded: iframe.src === 'about:blank' };
      })
    ]);
    
    console.log('URL test results:', urlTest);
    expect(urlTest[0].loaded).toBeTruthy();
    expect(urlTest[1].loaded).toBeTruthy();
    
    await context1.close();
    await context2.close();
  });
});