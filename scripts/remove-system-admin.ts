/**
 * Script to remove a system admin.
 *
 * Usage: npx tsx scripts/remove-system-admin.ts <email>
 * Example: npx tsx scripts/remove-system-admin.ts kikuxuzac@mailinator.com
 */

import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/remove-system-admin.ts <email>');
    process.exit(1);
  }

  // Find the user
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (id: ${user.id})`);

  // Check if they're a system admin
  const systemAdmin = await prisma.systemAdmin.findUnique({
    where: { userId: user.id }
  });

  if (!systemAdmin) {
    console.log('User is not a system admin');
    process.exit(0);
  }

  if (!systemAdmin.isActive) {
    console.log('User is already deactivated as system admin');
    process.exit(0);
  }

  // Deactivate (soft delete) the system admin
  await prisma.systemAdmin.update({
    where: { userId: user.id },
    data: { isActive: false }
  });

  console.log(`\n✅ ${email} has been removed as system admin!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
