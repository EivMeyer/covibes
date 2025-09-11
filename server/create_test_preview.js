import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestPreview() {
  try {
    await prisma.previewDeployments.upsert({
      where: { teamId: 'demo-team-001' },
      create: {
        id: 'preview-test-001',
        teamId: 'demo-team-001',
        containerId: 'preview-demo-team-001-hmr',
        containerName: 'preview-demo-team-001-hmr',
        port: 8001,
        proxyPort: 8001,
        status: 'running',
        projectType: 'react'
      },
      update: {
        containerId: 'preview-demo-team-001-hmr',
        containerName: 'preview-demo-team-001-hmr',
        port: 8001,
        proxyPort: 8001,
        status: 'running',
        projectType: 'react'
      }
    });
    console.log('✅ Preview deployment created in database');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPreview();
