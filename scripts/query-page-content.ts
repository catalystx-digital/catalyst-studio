#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function main() {
  const websiteId = process.argv[2];
  if (!websiteId) {
    console.error('Usage: npx tsx scripts/query-page-content.ts <websiteId>');
    process.exit(1);
  }

  // Dynamic import to avoid module hoisting issues
  const { PrismaClient } = await import('../lib/generated/prisma');
  const prisma = new PrismaClient();

  // Query page structures with their pages
  const structures = await prisma.websiteStructure.findMany({
    where: { websiteId },
    include: { websitePage: true }
  });

  console.log('=== Page Content ===');
  for (const structure of structures) {
    console.log('\n--- Page:', structure.fullPath, '(slug:', structure.slug, ') ---');
    const page = structure.websitePage;
    if (!page) {
      console.log('No page data');
      continue;
    }
    const content = page.content as Record<string, unknown>;
    console.log('Raw content:', JSON.stringify(content, null, 2).slice(0, 5000));
    if (content?.components && Array.isArray(content.components)) {
      console.log('\nComponents:', content.components.length);
      for (const comp of content.components) {
        const c = comp as Record<string, unknown>;
        const props = c.props as Record<string, unknown> | undefined;
        console.log('  -', c.type);
        console.log('    Props:', JSON.stringify(props || {}, null, 2).slice(0, 500));
      }
    } else {
      console.log('No components found');
    }
  }

  // Also check design system (separate table now)
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { name: true }
  });

  const designSystem = await prisma.websiteDesignSystem.findFirst({
    where: { websiteId }
  });

  if (website) {
    console.log('\n=== Website:', website.name, '===');
  }

  if (designSystem) {
    console.log('\n=== Design System ===');
    console.log('Full record:', JSON.stringify(designSystem, null, 2));
  } else {
    console.log('\n=== NO Design System found ===');
  }

  await prisma.$disconnect();
}
main();
