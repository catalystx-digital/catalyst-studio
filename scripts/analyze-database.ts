import { PrismaClient, Prisma } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function analyzeDatabase() {
  console.log('🔍 Analyzing Database Contents...\n');
  
  // Count all tables
  const websites = await prisma.website.count();
  const contentTypes = await prisma.contentType.count();
  const contentItems = await prisma.websitePage.count();
  const siteStructures = await prisma.websiteStructure.count();
  const cmsComponents = await prisma.websiteComponentType.count();
  
  console.log('📊 Table Counts:');
  console.log(`  • Websites: ${websites}`);
  console.log(`  • ContentTypes: ${contentTypes}`);
  console.log(`  • WebsitePages: ${contentItems}`);
  console.log(`  • WebsiteStructures: ${siteStructures}`);
  console.log(`  • WebsiteComponentTypes: ${cmsComponents}`);
  
  // Check for component types in ContentType
  const componentTypes = await prisma.contentType.findMany({
    where: { category: 'component' },
    select: { 
      name: true, 
      websiteId: true,
      fields: true
    }
  });
  
  console.log(`\n🧩 ContentTypes with category='component': ${componentTypes.length}`);
  componentTypes.slice(0, 5).forEach(ct => {
    console.log(`  • ${ct.name}`);
  });
  
  // Check WebsiteComponentType table
  const components = await prisma.websiteComponentType.findMany({
    select: {
      type: true,
      category: true,
      websiteId: true
    },
    take: 10
  });
  
  console.log(`\n🎨 WebsiteComponentTypes (first 10):`);
  components.forEach(c => {
    console.log(`  • Type: ${c.type} [${c.category}] - Website: ${c.websiteId}`);
  });
  
  // Analyze ContentTypes by category
  const categories = await prisma.contentType.groupBy({
    by: ['category'],
    _count: true
  });
  
  console.log('\n📁 ContentTypes by Category:');
  categories.forEach(cat => {
    console.log(`  • ${cat.category}: ${cat._count}`);
  });
  
  // Check for website content
  const websitesWithContent = await prisma.website.findMany({
    select: {
      name: true,
      _count: {
        select: {
          websitePages: true,
          contentTypes: true,
          websiteComponentTypes: true,
          websiteStructures: true
        }
      }
    }
  });
  
  console.log('\n🌐 Websites Detail:');
  websitesWithContent.forEach(w => {
    console.log(`  • ${w.name}:`);
    console.log(`    - ContentTypes: ${w._count.contentTypes}`);
    console.log(`    - WebsitePages: ${w._count.websitePages}`);
    console.log(`    - WebsiteComponentTypes: ${w._count.websiteComponentTypes}`);
    console.log(`    - WebsiteStructures: ${w._count.websiteStructures}`);
  });
  
  // Check for components with data field references
  const componentsWithData = await prisma.websiteComponentType.findMany({
    where: {
      placeholderData: {
        not: Prisma.JsonNullValueInput.JsonNull
      }
    },
    select: {
      type: true,
      category: true,
      placeholderData: true,
      defaultConfig: true
    },
    take: 3
  });
  
  console.log('\n🔍 Components with Content/Props (checking for references):');
  componentsWithData.forEach(c => {
    const contentStr = JSON.stringify(c.placeholderData);
    const propsStr = JSON.stringify(c.defaultConfig);
    const hasRefs = contentStr.includes('componentId') || 
                   contentStr.includes('component_id') || 
                   contentStr.includes('componentRef') ||
                   propsStr.includes('componentId') ||
                   propsStr.includes('componentRef');
    console.log(`  • ${c.type} [${c.category}]: ${hasRefs ? '✓ Has component references' : '✗ No references found'}`);
    if (hasRefs) {
      console.log(`    Content preview: ${contentStr.substring(0, 100)}...`);
    }
  });
  
  process.exit(0);
}

analyzeDatabase().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});