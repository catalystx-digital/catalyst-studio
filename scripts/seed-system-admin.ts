/**
 * Seed script to create the first system admin.
 *
 * Usage: npx tsx scripts/seed-system-admin.ts <email>
 * Example: npx tsx scripts/seed-system-admin.ts kikuxuzac@mailinator.com
 */

import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/seed-system-admin.ts <email>');
    process.exit(1);
  }

  // Find the user
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    console.error(`User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (id: ${user.id})`);

  // Check if already a system admin
  const existingAdmin = await prisma.systemAdmin.findUnique({
    where: { userId: user.id }
  });

  if (existingAdmin) {
    if (existingAdmin.isActive) {
      console.log('User is already an active system admin');
    } else {
      // Reactivate
      await prisma.systemAdmin.update({
        where: { userId: user.id },
        data: { isActive: true, grantedAt: new Date() }
      });
      console.log('Reactivated system admin status');
    }
  } else {
    // Create new system admin
    await prisma.systemAdmin.create({
      data: {
        userId: user.id,
        isActive: true,
      }
    });
    console.log('Created system admin');
  }

  console.log(`\n✅ ${email} is now a system admin!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
