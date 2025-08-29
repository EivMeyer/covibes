import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';

const prisma = new PrismaClient();

async function checkUserStatus() {
  console.log('🔍 Checking status for user: eiv.meyer@gmail.com\n');
  
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: 'eiv.meyer@gmail.com' },
      include: { 
        team: {
          include: {
            PreviewDeployment: true,
            members: true
          }
        }
      }
    });
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('👤 USER INFO:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);  
    console.log(`   Email: ${user.email}`);
    console.log(`   Team ID: ${user.teamId}`);
    console.log(`   Created: ${user.createdAt}`);
    
    if (user.team) {
      console.log('\n🏠 TEAM INFO:');
      console.log(`   Name: ${user.team.name}`);
      console.log(`   Invite Code: ${user.team.inviteCode}`);
      console.log(`   Repository: ${user.team.repositoryUrl || 'Not set'}`);
      console.log(`   Members: ${user.team.members.length}`);
      
      if (user.team.PreviewDeployment) {
        console.log('\n🖼️ PREVIEW DEPLOYMENT:');
        const preview = user.team.PreviewDeployment;
        console.log(`   Container ID: ${preview.containerId}`);
        console.log(`   Container Name: ${preview.containerName}`);
        console.log(`   Port: ${preview.port}`);
        console.log(`   Proxy Port: ${preview.proxyPort}`);
        console.log(`   Status: ${preview.status}`);
        console.log(`   Project Type: ${preview.projectType}`);
        console.log(`   Last Health Check: ${preview.lastHealthCheck || 'Never'}`);
        console.log(`   Error: ${preview.errorMessage || 'None'}`);
        console.log(`   Created: ${preview.createdAt}`);
        console.log(`   Updated: ${preview.updatedAt}`);
        
        // Check if container actually exists
        console.log('\n🐳 CONTAINER STATUS CHECK:');
        const dockerPs = spawn('docker', ['ps', '--filter', `name=${preview.containerName}`, '--format', 'table {{.Names}}\t{{.Status}}\t{{.Ports}}']);
        
        dockerPs.stdout.on('data', (data) => {
          console.log(`${data.toString().trim()}`);
        });
        
        dockerPs.on('close', (code) => {
          if (code !== 0) {
            console.log(`   ❌ Docker command failed with code ${code}`);
          }
        });
        
        // Wait a bit for docker command to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else {
        console.log('\n❌ NO PREVIEW DEPLOYMENT found in database');
      }
    }
    
    // Check workspace config
    console.log('\n📊 WORKSPACE CONFIG:');
    console.log(`   Tiles: ${user.team.tiles ? JSON.stringify(user.team.tiles).substring(0, 100) + '...' : 'None'}`);
    console.log(`   Layouts: ${user.team.layouts ? 'Present' : 'None'}`);
    console.log(`   Sidebar Width: ${user.team.sidebarWidth || 'Default'}`);
    
  } catch (error) {
    console.error('❌ Error checking user status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserStatus();