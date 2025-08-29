/**
 * Playwright configuration for CoVibe E2E tests
 */

module.exports = {
  testDir: '.',
  testMatch: '**/playwright-*.test.js',
  timeout: 30000,
  retries: 1,
  workers: 1,
  
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
      },
    },
    {
      name: 'firefox',
      use: { 
        browserName: 'firefox',
      },
    },
    {
      name: 'webkit',
      use: { 
        browserName: 'webkit',
      },
    },
  ],
  
  webServer: {
    command: 'cd ../server && npm run dev:src',
    port: 3001,
    timeout: 120000,
    reuseExistingServer: true,
  },
  
  reporter: [
    ['html'],
    ['line'],
    ['json', { outputFile: 'test-results.json' }]
  ],
};