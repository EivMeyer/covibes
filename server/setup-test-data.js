#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTestData() {
  try {
    console.log('🔧 Setting up test data...');

    const teamId = 'cmeiha047000paujsynv3j0y5';
    const userId = 'cmeihs04a000raujsjjwufbev';

    // Create team if it doesn't exist
    let team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      team = await prisma.team.create({
        data: {
          id: teamId,
          name: 'Test Team',
          teamCode: 'test-invite',
          repositoryUrl: 'https://github.com/test/repo.git'
        }
      });
      console.log(`✅ Created team: ${team.name}`);
    } else {
      console.log(`✅ Team exists: ${team.name}`);
    }

    // Create user if it doesn't exist
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: 'test@example.com',
          userName: 'Test User',
          teamId: teamId
        }
      });
      console.log(`✅ Created user: ${user.userName}`);
    } else {
      console.log(`✅ User exists: ${user.userName}`);
    }

    // Create a preview container record if it doesn't exist
    const existingContainer = await prisma.containerInstance.findFirst({
      where: {
        teamId: teamId,
        type: 'preview',
        status: { in: ['running', 'starting'] }
      }
    });

    if (!existingContainer) {
      const container = await prisma.containerInstance.create({
        data: {
          teamId: teamId,
          userId: userId,
          type: 'preview',
          status: 'running',
          containerId: 'test-preview-container-123',
          previewPort: 8160,
          metadata: {
            projectType: 'react',
            branch: 'main',
            startCommand: 'npm run dev'
          }
        }
      });
      console.log(`✅ Created preview container: ${container.id}`);
    } else {
      console.log(`✅ Preview container exists: ${existingContainer.id}`);
    }

    console.log('🎉 Test data setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestData();