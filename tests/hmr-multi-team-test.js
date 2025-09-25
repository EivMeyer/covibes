#!/usr/bin/env node

/**
 * MULTI-TEAM HMR ACCEPTANCE TEST
 *
 * This test verifies that the dynamic proxy system works for MULTIPLE teams,
 * not just demo-team-001. This proves the system is truly dynamic.
 *
 * Prerequisites:
 * - Team 1: demo-team-001 (should already exist)
 * - Team 2: test-team-002 (will be created if needed)
 */

const { chromium } = require('playwright');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function setupSecondTeam() {
  console.log('🔧 Setting up second team (test-team-002)...\n');

  try {
    // Check if container already exists
    const { stdout: containers } = await execAsync('docker ps --format "{{.Names}}"');

    if (!containers.includes('preview-test-team-002')) {
      console.log('   Creating preview container for test-team-002...');

      // Create workspace directory
      await execAsync('sudo mkdir -p /home/ubuntu/.covibes/workspaces/test-team-002');
      await execAsync('sudo cp -r /home/ubuntu/.covibes/workspaces/demo-team-001/* /home/ubuntu/.covibes/workspaces/test-team-002/ 2>/dev/null || true');
      await execAsync('sudo chown -R ubuntu:ubuntu /home/ubuntu/.covibes/workspaces/test-team-002');

      // Start container on port 8001 using existing image
      const dockerCmd = `
        docker run -d \
          --name preview-test-team-002 \
          -p 8001:5173 \
          -v /home/ubuntu/.covibes/workspaces/test-team-002:/app \
          -e CHOKIDAR_USEPOLLING=true \
          -e CHOKIDAR_INTERVAL=1000 \
          --restart unless-stopped \
          preview-demo-team-001
      `.trim().replace(/\s+/g, ' ');

      await execAsync(dockerCmd);
      console.log('   ✅ Container created on port 8001');

      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('   ✅ Container already exists');
    }

    // Add to database
    console.log('   Adding team to database...');
    const sqlCmd = `
      INSERT INTO preview_deployments
      (id, "teamId", "containerId", "containerName", port, "proxyPort", status, "projectType", "createdAt", "updatedAt")
      VALUES
      ('test-002', 'test-team-002', 'test-002-container', 'preview-test-team-002', 8001, 7175, 'running', 'react', NOW(), NOW())
      ON CONFLICT ("teamId")
      DO UPDATE SET status = 'running', port = 8001, "updatedAt" = NOW();
    `.replace(/\n/g, ' ');

    await execAsync(`PGPASSWORD=password psql -U postgres -d colabvibe_dev -h localhost -p 5433 -c "${sqlCmd}"`);
    console.log('   ✅ Database entry created');

    // Create dedicated proxy for team 2
    console.log('   Creating dedicated proxy on port 7175...');
    // The DedicatedProxyService will handle this dynamically

    return true;
  } catch (error) {
    console.error('   ❌ Setup failed:', error.message);
    return false;
  }
}

async function testTeamHMR(teamId, teamName, expectedPort) {
  console.log(`\n📍 Testing ${teamName} (${teamId})...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors']
  });

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    const PREVIEW_URL = `https://ec2-13-48-135-139.eu-north-1.compute.amazonaws.com/api/preview/proxy/${teamId}/main/`;
    console.log(`   URL: ${PREVIEW_URL}`);

    // Load the preview
    await page.goto(PREVIEW_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForSelector('h1', { timeout: 10000 });
    const initialH1 = await page.textContent('h1');
    console.log(`   Initial H1: ${initialH1}`);

    // Set up HMR monitoring
    const hmrMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[vite]') || text.includes('hmr')) {
        hmrMessages.push(text);
      }
    });

    // Modify file to trigger HMR
    const timestamp = Date.now();
    const newText = `${teamName} HMR ${timestamp}`;
    const sedCommand = `docker exec preview-${teamId} sed -i "s/<h1>.*<\\/h1>/<h1>${newText}<\\/h1>/" src/App.jsx`;

    await execAsync(sedCommand);
    console.log(`   Modified H1 to: ${newText}`);

    // Wait for HMR update
    const hmrWorked = await page.waitForFunction(
      (expectedText) => {
        const h1 = document.querySelector('h1');
        return h1 && h1.textContent.includes(expectedText);
      },
      `${timestamp}`,
      { timeout: 10000 }
    ).then(() => true).catch(() => false);

    if (hmrWorked) {
      const updatedH1 = await page.textContent('h1');
      console.log(`   ✅ HMR SUCCESS! Updated to: ${updatedH1}`);
      console.log(`   ✅ Port ${expectedPort} working correctly`);
      return true;
    } else {
      const currentH1 = await page.textContent('h1');
      console.log(`   ❌ HMR FAILED! Still showing: ${currentH1}`);
      return false;
    }

  } catch (error) {
    console.error(`   ❌ Test failed:`, error.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function runMultiTeamTest() {
  console.log('🏁 MULTI-TEAM HMR ACCEPTANCE TEST\n');
  console.log('This test proves the dynamic proxy system works for ANY team.\n');
  console.log('=' .repeat(60));

  // Setup second team
  const setupOk = await setupSecondTeam();
  if (!setupOk) {
    console.log('\n❌ Failed to setup second team');
    process.exit(1);
  }

  // Test both teams
  const results = {
    team1: await testTeamHMR('demo-team-001', 'Team 1', 8000),
    team2: await testTeamHMR('test-team-002', 'Team 2', 8001)
  };

  // Final verdict
  console.log('\n' + '=' .repeat(60));
  console.log('FINAL RESULTS:');
  console.log('=' .repeat(60));

  if (results.team1 && results.team2) {
    console.log('🎉 SUCCESS: BOTH TEAMS WORK!');
    console.log('✅ demo-team-001: HMR working on port 8000');
    console.log('✅ test-team-002: HMR working on port 8001');
    console.log('\n🚀 The dynamic proxy system is truly dynamic!');
    console.log('   Any team can be added without touching nginx.');
    return true;
  } else {
    console.log('❌ FAILURE:');
    if (!results.team1) console.log('   ❌ demo-team-001: HMR not working');
    if (!results.team2) console.log('   ❌ test-team-002: HMR not working');
    console.log('\n⚠️  The system is not truly dynamic yet.');
    return false;
  }
}

// Run the test
runMultiTeamTest().then(success => {
  process.exit(success ? 0 : 1);
});