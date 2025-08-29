import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixTeam() {
  // Update the Demo Team's repository URL to null
  const updated = await prisma.team.update({
    where: { id: 'cme7dtl770000ilc9c4590sb7' },
    data: { repositoryUrl: null }
  });
  console.log('Updated team:', updated);
  await prisma.$disconnect();
}

fixTeam();
