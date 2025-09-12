const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function debugPreviewService() {
  const teamId = 'demo-team-001';
  
  console.log('🔍 Debug Preview Service for team:', teamId);
  console.log('');
  
  try {
    // Step 1: Check database record
    console.log('📊 Step 1: Database Query');
    const deployment = await prisma.preview_deployments.findUnique({
      where: { teamId }
    });
    
    if (!deployment) {
      console.log('❌ No deployment found in database');
      return;
    }
    
    console.log('✅ Found deployment:');
    console.log('   - teamId:', deployment.teamId);
    console.log('   - containerName:', deployment.containerName);  
    console.log('   - status:', deployment.status);
    console.log('   - port:', deployment.port);
    console.log('');
    
    // Step 2: Test container health check
    console.log('🐳 Step 2: Container Health Check');
    console.log('   - Testing containerName:', deployment.containerName);
    
    try {
      const { stdout } = await execAsync(`docker inspect ${deployment.containerName} --format '{{.State.Status}}'`);
      const containerStatus = stdout.trim();
      const isHealthy = containerStatus === 'running';
      
      console.log('   - Docker status:', containerStatus);
      console.log('   - Is healthy:', isHealthy);
      console.log('');
      
      if (!isHealthy && deployment.status === 'running') {
        console.log('❌ Container is dead but database says running - would return null');
        return;
      }
      
      // Step 3: Build return object
      console.log('📦 Step 3: Return Object');
      const result = {
        running: deployment.status === 'running',
        port: deployment.port,
        proxyPort: deployment.proxyPort,
        containerId: deployment.containerId,
        projectType: deployment.projectType,
      };
      
      console.log('✅ Service would return:');
      console.log('   ', JSON.stringify(result, null, 2));
      console.log('');
      
      // Step 4: Test proxy check
      console.log('🔄 Step 4: Proxy Check');
      const previewStatus = result;
      const proxyWouldWork = previewStatus && previewStatus.running;
      
      console.log('   - previewStatus exists:', !!previewStatus);
      console.log('   - previewStatus.running:', previewStatus.running);
      console.log('   - Proxy would work:', proxyWouldWork);
      
      if (proxyWouldWork) {
        console.log('🎉 EXPRESS PROXY SHOULD WORK!');
      } else {
        console.log('❌ Express proxy would fail');
      }
      
    } catch (dockerError) {
      console.log('❌ Docker inspect failed:', dockerError.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPreviewService();