/**
 * Helper script to check website content in database
 */
import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const websiteId = process.argv[2];

  if (!websiteId) {
    console.log('Usage: npx tsx scripts/check-website-content.ts <websiteId>');
    process.exit(1);
  }

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: {
      websiteStructures: true,
      websitePages: true
    }
  });

  if (!website) {
    console.log('Website not found:', websiteId);
    process.exit(1);
  }

  console.log('Website:', website.name);
  console.log('Structures:', website.websiteStructures?.length);
  console.log('Pages:', website.websitePages?.length);

  for (const page of website.websitePages || []) {
    console.log('\nPage:', page.slug);
    const content = page.content as any;
    if (content?.components) {
      console.log('  Components:', content.components.length);
      for (const c of content.components) {
        console.log('    -', c.type, c.id ? `(${c.id})` : '');
      }
    } else {
      console.log('  No components array found');
      console.log('  Content keys:', Object.keys(content || {}));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
