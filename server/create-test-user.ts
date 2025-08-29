import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestUser() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Check if test team exists
  let team = await prisma.teams.findUnique({
    where: { teamCode: 'TEST01' }
  });
  
  if (!team) {
    team = await prisma.teams.create({
      data: {
        name: 'Test Team',
        teamCode: 'TEST01'
      }
    });
  }
  
  // Check if test user exists
  const existing = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });
  
  if (existing) {
    console.log('Test user already exists');
  } else {
    await prisma.user.create({
      data: {
        email: 'test@example.com',
        userName: 'Test User',
        password: hashedPassword,
        teamId: team.id,
        vmId: 'vm-001'
      }
    });
    console.log('Created test user: test@example.com / password123');
  }
  
  await prisma.$disconnect();
}

createTestUser().catch(console.error);