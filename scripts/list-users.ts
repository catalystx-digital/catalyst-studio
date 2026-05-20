import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  console.log('Users in database:');
  users.forEach(u => console.log('  -', u.email, '| id:', u.id, '| created:', u.createdAt));
}

main().catch(console.error).finally(() => prisma.$disconnect());
