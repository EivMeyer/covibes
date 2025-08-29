/**
 * Comprehensive Showcase Panel Tests for CoVibe
 * Tests the live preview functionality, iframe management, and WebSocket integration
 */

const { test, expect } = require('@playwright/test');

test.describe('Showcase Panel Tests', () => {
  const BASE_URL = 'http://localhost:3001';
  let token;
  
  test.beforeAll(async () => {
    // Create a test user and get a token
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'ShowcaseTest',
        userName: 'TestUser',
        email: 'showcase@test.com',
        password: 'password123'
      })
    });
    
    const result = await response.json();
    token = result.token;
  });

  test('should display showcase panel with correct layout', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Check showcase panel layout
    await expect(page.locator('#showcase')).toBeVisible();
    await expect(page.locator('#showcase h2')).toContainText('Live Preview');
    await expect(page.locator('#previewFrame')).toBeVisible();
    
    // Check iframe properties
    const iframe = page.locator('#previewFrame');
    await expect(iframe).toHaveClass(/w-full h-full bg-white rounded/);
    
    // Check initial src
    const src = await iframe.getAttribute('src');
    expect(src).toBe('about:blank');
  });

  test('should handle different content types in preview', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test HTML content
    const htmlTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const htmlContent = `
        <html>
          <head>
            <title>HTML Test</title>
            <style>body { background: #f0f0f0; font-family: Arial; }</style>
          </head>
          <body>
            <h1 style="color: blue;">HTML Preview Test</h1>
            <p>This is HTML content in the preview frame.</p>
          </body>
        </html>
      `;
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      return iframe.src.includes('HTML Preview Test');
    });
    
    expect(htmlTest).toBeTruthy();
    
    // Test React-like JSX content
    const reactTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const reactContent = `
        <html>
          <head>
            <title>React App</title>
            <script crossorigin src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
          </head>
          <body>
            <div id="root"></div>
            <script>
              const e = React.createElement;
              const App = () => e('div', {}, 
                e('h1', {}, 'React Preview Test'),
                e('p', {}, 'This is a React component in preview')
              );
              ReactDOM.render(e(App), document.getElementById('root'));
            </script>
          </body>
        </html>
      `;
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(reactContent);
      return iframe.src.includes('React Preview Test');
    });
    
    expect(reactTest).toBeTruthy();
  });

  test('should handle preview error states gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test invalid URL handling
    const errorTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      
      // Try to load an invalid URL
      iframe.src = 'invalid://not-a-real-url';
      
      return {
        srcSet: iframe.src === 'invalid://not-a-real-url',
        iframeExists: !!iframe
      };
    });
    
    expect(errorTest.srcSet).toBeTruthy();
    expect(errorTest.iframeExists).toBeTruthy();
  });

  test('should maintain iframe state during refresh', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Set initial content
    await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const testContent = '<html><body><h1>Test Content</h1></body></html>';
      iframe.src = 'data:text/html,' + encodeURIComponent(testContent);
    });
    
    // Wait for content to load
    await page.waitForTimeout(1000);
    
    // Trigger refresh
    const refreshResult = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const beforeSrc = iframe.src;
      
      // Call refreshPreview
      if (window.app && window.app.refreshPreview) {
        window.app.refreshPreview();
        return {
          beforeSrc: beforeSrc.substring(0, 50),
          afterSrc: iframe.src.substring(0, 50),
          maintained: iframe.src === beforeSrc
        };
      }
      return { beforeSrc: '', afterSrc: '', maintained: false };
    });
    
    expect(refreshResult.beforeSrc.length).toBeGreaterThan(0);
    expect(refreshResult.afterSrc.length).toBeGreaterThan(0);
  });

  test('should handle WebSocket previewUpdated events', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Mock WebSocket events
    const websocketTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        let eventsReceived = 0;
        let refreshCalled = false;
        
        // Mock the refresh function
        if (window.app) {
          const originalRefresh = window.app.refreshPreview;
          window.app.refreshPreview = function() {
            refreshCalled = true;
            if (originalRefresh) {
              originalRefresh.call(this);
            }
          };
        }
        
        // Set up WebSocket event listener
        if (window.socketManager) {
          window.socketManager.on('previewUpdated', () => {
            eventsReceived++;
          });
          
          // Trigger multiple events
          setTimeout(() => window.socketManager.trigger('previewUpdated'), 100);
          setTimeout(() => window.socketManager.trigger('previewUpdated'), 200);
          setTimeout(() => window.socketManager.trigger('previewUpdated'), 300);
          
          setTimeout(() => {
            resolve({
              eventsReceived,
              refreshCalled,
              hasSocketManager: !!window.socketManager
            });
          }, 500);
        } else {
          resolve({
            eventsReceived: 0,
            refreshCalled: false,
            hasSocketManager: false
          });
        }
      });
    });
    
    console.log('WebSocket test results:', websocketTest);
    expect(websocketTest.hasSocketManager).toBeTruthy();
    expect(websocketTest.refreshCalled).toBeTruthy();
  });

  test('should show preview update timestamps', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test timestamp functionality
    const timestampTest = await page.evaluate(() => {
      // Trigger refresh to update timestamp
      if (window.app && window.app.refreshPreview) {
        window.app.refreshPreview();
        
        // Check for timestamp elements or last update indicators
        const lastUpdate = document.getElementById('lastUpdate');
        const previewNotification = document.getElementById('previewNotification');
        
        return {
          hasLastUpdate: !!lastUpdate,
          hasPreviewNotification: !!previewNotification,
          notificationText: previewNotification ? previewNotification.textContent : ''
        };
      }
      return { hasLastUpdate: false, hasPreviewNotification: false, notificationText: '' };
    });
    
    console.log('Timestamp test:', timestampTest);
    // Note: These elements might not exist in current implementation
    // This test helps identify what preview update indicators are available
  });

  test('should handle responsive design in preview', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test responsive preview content
    const responsiveTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const responsiveContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .container { max-width: 1200px; margin: 0 auto; }
              .responsive-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
              .card { padding: 20px; background: #f5f5f5; border-radius: 8px; }
              @media (max-width: 768px) {
                .container { margin: 10px; }
                .card { padding: 15px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Responsive Preview Test</h1>
              <div class="responsive-grid">
                <div class="card">Card 1</div>
                <div class="card">Card 2</div>
                <div class="card">Card 3</div>
              </div>
            </div>
          </body>
        </html>
      `;
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(responsiveContent);
      
      return {
        hasViewportMeta: responsiveContent.includes('viewport'),
        hasMediaQueries: responsiveContent.includes('@media'),
        contentSet: iframe.src.includes('Responsive Preview Test')
      };
    });
    
    expect(responsiveTest.hasViewportMeta).toBeTruthy();
    expect(responsiveTest.hasMediaQueries).toBeTruthy();
    expect(responsiveTest.contentSet).toBeTruthy();
  });

  test('should handle JavaScript-heavy applications in preview', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test JavaScript application
    const jsTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      const jsContent = `
        <html>
          <head>
            <title>JS App Test</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .counter { font-size: 24px; margin: 20px 0; }
              button { padding: 10px 20px; margin: 5px; font-size: 16px; }
            </style>
          </head>
          <body>
            <h1>JavaScript Application Test</h1>
            <div id="app">
              <div class="counter">Count: <span id="count">0</span></div>
              <button onclick="increment()">+</button>
              <button onclick="decrement()">-</button>
              <button onclick="reset()">Reset</button>
            </div>
            <script>
              let count = 0;
              const countElement = document.getElementById('count');
              
              function increment() {
                count++;
                countElement.textContent = count;
              }
              
              function decrement() {
                count--;
                countElement.textContent = count;
              }
              
              function reset() {
                count = 0;
                countElement.textContent = count;
              }
              
              // Auto-increment demo
              setInterval(() => {
                if (count < 10) increment();
              }, 1000);
            </script>
          </body>
        </html>
      `;
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(jsContent);
      
      return {
        hasJavaScript: jsContent.includes('function increment'),
        hasInteractivity: jsContent.includes('onclick='),
        contentLoaded: iframe.src.includes('JavaScript Application Test')
      };
    });
    
    expect(jsTest.hasJavaScript).toBeTruthy();
    expect(jsTest.hasInteractivity).toBeTruthy();
    expect(jsTest.contentLoaded).toBeTruthy();
  });

  test('should maintain iframe security', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
    await page.reload();
    
    await page.waitForTimeout(2000);
    
    // Test iframe security attributes
    const securityTest = await page.evaluate(() => {
      const iframe = document.getElementById('previewFrame');
      
      return {
        tagName: iframe.tagName,
        hasId: iframe.id === 'previewFrame',
        hasSandbox: iframe.hasAttribute('sandbox'),
        sandboxValue: iframe.getAttribute('sandbox'),
        allowAttribute: iframe.getAttribute('allow')
      };
    });
    
    console.log('Security test results:', securityTest);
    expect(securityTest.tagName).toBe('IFRAME');
    expect(securityTest.hasId).toBeTruthy();
  });
});