const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSearch(q, currentUserId) {
  const queryClean = q.replace(/^@/, '').toLowerCase();
  console.log(`Searching for "${queryClean}" (original "${q}")...`);
  
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: queryClean } },
        { displayName: { contains: queryClean } },
      ],
      id: { not: currentUserId },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });
  
  console.log('Result:', users);
}

async function main() {
  const umaiseeId = "31c4ea98-b703-441a-93fe-63b2418084d8"; // umaisee
  await testSearch('idk', umaiseeId);
  await testSearch('@idk', umaiseeId);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
