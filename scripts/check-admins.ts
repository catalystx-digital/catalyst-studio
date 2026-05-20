import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.systemAdmin.findMany({ include: { user: true } });
  console.log('System Admins:', admins.length);
  admins.forEach(a => console.log('  -', a.user?.email, '| isActive:', a.isActive));

  // Also check if user kikuxuzac@mailinator.com exists
  const user = await prisma.user.findFirst({ where: { email: 'kikuxuzac@mailinator.com' } });
  console.log('\nUser kikuxuzac@mailinator.com:', user ? 'EXISTS (id: ' + user.id + ')' : 'NOT FOUND');
}

main().catch(console.error).finally(() => prisma.$disconnect());
