import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // Check all memberships
  const memberships = await prisma.accountMembership.findMany({
    include: {
      user: true,
      account: {
        include: { websites: true }
      }
    }
  });

  console.log('=== MEMBERSHIPS ===');
  for (const m of memberships) {
    console.log(`\nUser: ${m.user?.email} (userId: ${m.userId})`);
    console.log(`  Account: ${m.account.name} (accountId: ${m.accountId})`);
    console.log(`  Role: ${m.role}, WebsiteAccess: ${m.websiteAccess}`);
    console.log(`  Websites in account: ${m.account.websites.length}`);
    m.account.websites.forEach(w => console.log(`    - ${w.name}`));
  }

  // Check all websites
  console.log('\n=== ALL WEBSITES ===');
  const websites = await prisma.website.findMany({
    include: { account: true }
  });
  websites.forEach(w => console.log(`  - ${w.name} | accountId: ${w.accountId} | account: ${w.account?.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
