import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAgent() {
  const agent = await prisma.agent.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });
  
  console.log('Latest Agent:');
  console.log('  ID:', agent.id);
  console.log('  Status:', agent.status);
  console.log('  User ID:', agent.userId);
  console.log('  User Name:', agent.user.userName);
  console.log('  Task:', agent.task);
  
  await prisma.$disconnect();
}

checkAgent();