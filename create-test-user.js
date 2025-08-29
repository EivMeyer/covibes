// Create a test user for preview testing
const { PrismaClient } = require('./server/node_modules/@prisma/client');
const bcrypt = require('./server/node_modules/bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Use the team ID that has content
    const teamId = 'cmeihs047000paujsynv3j0y5';
    
    // Check if team exists, create if not
    let team = await prisma.team.findUnique({
      where: { id: teamId }
    });
    
    if (!team) {
      team = await prisma.team.create({
        data: {
          id: teamId,
          name: 'Test Team',
          inviteCode: 'TEST123'
        }
      });
      console.log('Created team:', team.name);
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash('test123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'test@preview.com',
        password: hashedPassword,
        userName: 'testuser',
        teamId: teamId
      }
    });
    
    console.log('Created user:', user.email);
    console.log('Team ID:', teamId);
    console.log('Password: test123');
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('User already exists');
    } else {
      console.error('Error:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();