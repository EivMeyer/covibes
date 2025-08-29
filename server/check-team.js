import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTeam() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true, 
      repositoryUrl: true
    }
  });
  console.log('Teams:', JSON.stringify(teams, null, 2));
  await prisma.$disconnect();
}

checkTeam();
