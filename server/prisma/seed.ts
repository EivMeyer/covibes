/**
 * Prisma Seed Script
 * 
 * Creates initial development data for the CoVibe application
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash demo password
  const demoPassword = await bcrypt.hash('demo123', 10);

  // Create demo team with repository
  const demoTeam = await prisma.teams.upsert({
    where: { teamCode: 'DEMO01' },
    update: {},
    create: {
      id: 'demo-team-001',
      name: 'Demo Team',
      teamCode: 'DEMO01',
      repositoryUrl: 'https://github.com/EivMeyer/covibes-test-repo',
      updatedAt: new Date(),
    },
  });

  console.log('✅ Created demo team:', demoTeam.name);

  // Create demo users - both assigned to real EC2 instance
  const demoUsers = await Promise.all([
    prisma.users.upsert({
      where: { email: 'alice@demo.com' },
      update: {},
      create: {
        id: 'demo-user-alice',
        email: 'alice@demo.com',
        userName: 'Alice',
        password: demoPassword, // "demo123"
        teamId: demoTeam.id,
        vmId: 'vm-001', // Real EC2 instance
        updatedAt: new Date(),
      },
    }),
    prisma.users.upsert({
      where: { email: 'bob@demo.com' },
      update: {},
      create: {
        id: 'demo-user-bob',
        email: 'bob@demo.com',
        userName: 'Bob',
        password: demoPassword, // "demo123"
        teamId: demoTeam.id,
        vmId: 'vm-001', // Same real EC2 instance
        updatedAt: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${demoUsers.length} demo users`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDemo Team Code: DEMO01');
  console.log('Demo Users (password: demo123):');
  console.log('  - alice@demo.com (Alice) - EC2 VM assigned');
  console.log('  - bob@demo.com (Bob) - EC2 VM assigned');
  console.log('\nEC2 Instance: ubuntu@ec2-13-48-135-139.eu-north-1.compute.amazonaws.com');
  console.log('SSH Key: ~/.ssh/ec2.pem');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });