const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
    }
  });
  console.log('Database users:', JSON.stringify(users, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
