/**
 * Live Rendering Screenshot Demo
 * 
 * This script demonstrates and captures screenshots of the live rendering functionality.
 * It uses Playwright to:
 * 1. Register a user
 * 2. Navigate through the UI
 * 3. Spawn an agent
 * 4. Capture screenshots showing live updates
 * 5. Document the complete flow
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function createScreenshotDemo() {
    console.log('🚀 Starting Live Rendering Screenshot Demo...\n');
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots', 'live-rendering-demo');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Launch browser
    const browser = await chromium.launch({ 
        headless: false, // Run in headed mode so we can see what's happening
        slowMo: 1000    // Slow down actions for better visibility
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    try {
        console.log('📱 Opening CoVibe application...');
        
        // Step 1: Navigate to the application
        await page.goto('http://localhost:3001/app.html');
        await page.screenshot({ 
            path: path.join(screenshotsDir, '01-initial-load.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 1: Initial application load');
        
        // Step 2: Register a user directly via the frontend
        console.log('👤 Creating test user account...');
        
        // Look for register tab/link and click it
        try {
            await page.click('text=Create Team', { timeout: 5000 });
        } catch {
            try {
                await page.click('[href*="register"], [onclick*="register"], .register-tab', { timeout: 2000 });
            } catch {
                console.log('ℹ️  Registration tab not found, might be on login screen');
            }
        }
        
        await page.screenshot({ 
            path: path.join(screenshotsDir, '02-registration-screen.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 2: Registration screen');
        
        // Fill registration form (try different field selectors)
        const timestamp = Date.now();
        const teamName = `LiveDemo_${timestamp}`;
        const userName = `DemoUser_${timestamp}`;
        const email = `demo_${timestamp}@example.com`;
        
        try {
            // Try multiple selectors for form fields
            await page.fill('#teamName, #registerTeamName, input[name*="team"], input[placeholder*="team"]', teamName);
            await page.fill('#userName, #registerUserName, input[name*="user"], input[placeholder*="user"]', userName);
            await page.fill('#email, #registerEmail, input[type="email"], input[placeholder*="email"]', email);
            await page.fill('#password, #registerPassword, input[type="password"], input[placeholder*="password"]', 'demo123');
            
            await page.screenshot({ 
                path: path.join(screenshotsDir, '03-registration-filled.png'),
                fullPage: true 
            });
            console.log('📸 Screenshot 3: Registration form filled');
            
            // Submit registration
            await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Create")');
            
            // Wait for successful registration/redirect
            await page.waitForTimeout(3000);
            
        } catch (error) {
            console.log('⚠️  Registration form interaction failed:', error.message);
            console.log('🔄 Trying alternative authentication method...');
            
            // Alternative: Set authentication directly in localStorage
            await page.evaluate(() => {
                // Mock authentication
                window.localStorage.setItem('token', 'demo-token-' + Date.now());
                window.localStorage.setItem('user', JSON.stringify({
                    id: 'demo-user',
                    name: 'Demo User',
                    email: 'demo@example.com'
                }));
                window.localStorage.setItem('team', JSON.stringify({
                    id: 'demo-team',
                    name: 'Demo Team',
                    inviteCode: 'DEMO123'
                }));
            });
            
            await page.reload();
            await page.waitForTimeout(2000);
        }
        
        // Step 3: Main dashboard
        await page.screenshot({ 
            path: path.join(screenshotsDir, '04-main-dashboard.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 4: Main dashboard');
        
        // Step 4: Look for and interact with UI elements
        console.log('🎯 Looking for interactive elements...');
        
        // Try to find spawn agent button
        let spawnButtonFound = false;
        const spawnSelectors = [
            'button:has-text("Spawn Agent")',
            '#spawnAgentBtn',
            'button[onclick*="spawn"]',
            '.spawn-agent',
            'button:has-text("New Agent")',
            'button:has-text("Create Agent")'
        ];
        
        for (const selector of spawnSelectors) {
            try {
                const button = page.locator(selector).first();
                if (await button.isVisible({ timeout: 1000 })) {
                    console.log(`✅ Found spawn button with selector: ${selector}`);
                    await button.click();
                    spawnButtonFound = true;
                    break;
                }
            } catch {
                // Continue trying other selectors
            }
        }
        
        if (spawnButtonFound) {
            await page.screenshot({ 
                path: path.join(screenshotsDir, '05-spawn-agent-modal.png'),
                fullPage: true 
            });
            console.log('📸 Screenshot 5: Spawn agent modal opened');
            
            // Try to fill agent task
            try {
                const taskSelectors = [
                    '#agentTask',
                    'input[placeholder*="task"]',
                    'textarea[placeholder*="task"]',
                    'input[name*="task"]',
                    '.task-input'
                ];
                
                for (const selector of taskSelectors) {
                    try {
                        const taskInput = page.locator(selector).first();
                        if (await taskInput.isVisible({ timeout: 1000 })) {
                            await taskInput.fill('Demonstrate live output streaming with multiple lines of real-time updates');
                            console.log('✅ Filled agent task');
                            break;
                        }
                    } catch {
                        continue;
                    }
                }
                
                // Submit the agent spawn
                await page.click('button[type="submit"], button:has-text("Spawn"), button:has-text("Start"), button:has-text("Create")');
                await page.waitForTimeout(2000);
                
                await page.screenshot({ 
                    path: path.join(screenshotsDir, '06-agent-spawning.png'),
                    fullPage: true 
                });
                console.log('📸 Screenshot 6: Agent spawning process');
                
            } catch (error) {
                console.log('⚠️  Agent spawn form interaction failed:', error.message);
            }
        } else {
            console.log('⚠️  Spawn agent button not found, capturing available UI elements');
        }
        
        // Step 5: Look for agent list or output areas
        await page.waitForTimeout(3000);
        
        // Try to find and click on any agent items
        const agentSelectors = [
            '.agent-item',
            '[onclick*="selectAgent"]',
            '[onclick*="agent"]',
            '.agent-card',
            '.agent-row'
        ];
        
        let agentFound = false;
        for (const selector of agentSelectors) {
            try {
                const agentElement = page.locator(selector).first();
                if (await agentElement.isVisible({ timeout: 2000 })) {
                    console.log(`✅ Found agent with selector: ${selector}`);
                    await agentElement.click();
                    agentFound = true;
                    break;
                }
            } catch {
                continue;
            }
        }
        
        await page.screenshot({ 
            path: path.join(screenshotsDir, '07-agent-list.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 7: Agent list view');
        
        if (agentFound) {
            await page.waitForTimeout(2000);
            await page.screenshot({ 
                path: path.join(screenshotsDir, '08-agent-output-modal.png'),
                fullPage: true 
            });
            console.log('📸 Screenshot 8: Agent output modal');
        }
        
        // Step 6: Test chat functionality
        try {
            const chatSelectors = [
                '#chatInput',
                'input[placeholder*="message"]',
                'input[placeholder*="chat"]',
                '.chat-input'
            ];
            
            for (const selector of chatSelectors) {
                try {
                    const chatInput = page.locator(selector).first();
                    if (await chatInput.isVisible({ timeout: 1000 })) {
                        await chatInput.fill('Testing live chat updates! This should appear in real-time 💬🚀');
                        await chatInput.press('Enter');
                        console.log('✅ Sent chat message');
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch {
                    continue;
                }
            }
        } catch (error) {
            console.log('⚠️  Chat functionality test failed:', error.message);
        }
        
        await page.screenshot({ 
            path: path.join(screenshotsDir, '09-with-chat.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 9: Application with chat');
        
        // Step 7: Final overview
        await page.screenshot({ 
            path: path.join(screenshotsDir, '10-final-overview.png'),
            fullPage: true 
        });
        console.log('📸 Screenshot 10: Final application overview');
        
        // Step 8: Capture page HTML for analysis
        const htmlContent = await page.content();
        fs.writeFileSync(path.join(screenshotsDir, 'page-content.html'), htmlContent);
        console.log('💾 Saved page HTML content');
        
        // Step 9: Capture console logs
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString()
            });
        });
        
        await page.waitForTimeout(2000);
        fs.writeFileSync(
            path.join(screenshotsDir, 'console-logs.json'), 
            JSON.stringify(consoleMessages, null, 2)
        );
        console.log('💾 Saved console logs');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
        await page.screenshot({ 
            path: path.join(screenshotsDir, 'error-state.png'),
            fullPage: true 
        });
    } finally {
        console.log('\n🎉 Live Rendering Demo Complete!');
        console.log(`📁 Screenshots saved to: ${screenshotsDir}`);
        console.log('\n📋 Generated Files:');
        
        // List all generated files
        const files = fs.readdirSync(screenshotsDir);
        files.forEach(file => {
            console.log(`   📄 ${file}`);
        });
        
        await browser.close();
    }
}

// Run the demo
if (require.main === module) {
    createScreenshotDemo().catch(console.error);
}

module.exports = { createScreenshotDemo };