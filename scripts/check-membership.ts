import { PrismaClient } from '../lib/generated/prisma';
const prisma = new PrismaClient();

async function check() {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email: 'test-aria-7@mailinator.com' }
  });
  console.log('User:', JSON.stringify(user, null, 2));

  if (user) {
    // Get all memberships for this user
    const memberships = await prisma.accountMembership.findMany({
      where: { userId: user.id },
      include: {
        account: { select: { id: true, name: true } }
      }
    });
    console.log('\nMemberships:', JSON.stringify(memberships, null, 2));
  }

  // Also check recent invitations
  const invitations = await prisma.invitation.findMany({
    where: { email: { contains: 'test-aria-7' } },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log('\nInvitations:', JSON.stringify(invitations, null, 2));

  await prisma.$disconnect();
}

check().catch(console.error);
