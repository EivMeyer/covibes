#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedDemoData() {
  try {
    console.log('🌱 Seeding demo data...');
    
    // Create demo team
    const team = await prisma.team.upsert({
      where: { name: 'DemoTeam' },
      update: {},
      create: {
        name: 'DemoTeam',
        repositoryUrl: 'https://github.com/demo/example-project.git'
      }
    });
    
    console.log('✅ Created team:', team.name, '(ID:', team.id, ')');
    
    // Create demo users
    const users = [
      { name: 'Demo User', email: 'demo@covibes.ai', password: 'demo123' },
      { name: 'Alice Developer', email: 'alice@covibes.ai', password: 'alice123' },
      { name: 'Bob Coder', email: 'bob@covibes.ai', password: 'bob123' },
      { name: 'Charlie Smith', email: 'charlie@covibes.ai', password: 'charlie123' },
      { name: 'Diana Jones', email: 'diana@covibes.ai', password: 'diana123' }
    ];
    
    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          teamId: team.id
        }
      });
      
      console.log('✅ Created user:', user.name, '(' + user.email + ')');
    }
    
    // Create a sample message
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@covibes.ai' }
    });
    
    if (demoUser) {
      await prisma.message.upsert({
        where: { 
          id: 'demo-message-1' 
        },
        update: {},
        create: {
          id: 'demo-message-1',
          content: 'Welcome to CoVibe! This is a demo team. Try spawning some agents!',
          userId: demoUser.id,
          teamId: team.id
        }
      });
      
      console.log('✅ Created welcome message');
    }
    
    console.log('\n🎉 Demo data seeded successfully!');
    console.log('\n🚀 You can now login with any of these accounts:');
    console.log('   📧 demo@covibes.ai / 🔑 demo123');
    console.log('   📧 alice@covibes.ai / 🔑 alice123');
    console.log('   📧 bob@covibes.ai / 🔑 bob123');
    console.log('   📧 charlie@covibes.ai / 🔑 charlie123');
    console.log('   📧 diana@covibes.ai / 🔑 diana123');
    console.log('\n   🏢 Team: DemoTeam');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData();