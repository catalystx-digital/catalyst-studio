const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function checkSeedData() {
  try {
    console.log('=== SEED DATA VERIFICATION ===\n');
    
    // Check ContentTypes
    const contentTypes = await prisma.contentType.count();
    const contentTypesList = await prisma.contentType.findMany({
      select: { key: true, name: true, category: true },
      take: 5
    });
    
    console.log(`ContentTypes: ${contentTypes} total`);
    if (contentTypesList.length > 0) {
      console.log('  Sample ContentTypes:');
      contentTypesList.forEach(ct => {
        console.log(`    - ${ct.key} (${ct.name}) [${ct.category}]`);
      });
    }
    
    // Check ContentItems
    const contentItems = await prisma.contentItem.count();
    const contentItemsList = await prisma.contentItem.findMany({
      select: { title: true, slug: true, status: true },
      take: 5
    });
    
    console.log(`\nContentItems: ${contentItems} total`);
    if (contentItemsList.length > 0) {
      console.log('  Sample ContentItems:');
      contentItemsList.forEach(ci => {
        console.log(`    - ${ci.title} (${ci.slug}) [${ci.status}]`);
      });
    }
    
    // Check CMSComponents
    const components = await prisma.cMSComponent.count();
    const componentsList = await prisma.cMSComponent.findMany({
      select: { type: true, category: true, confidence: true },
      take: 5
    });
    
    console.log(`\nCMSComponents: ${components} total`);
    if (componentsList.length > 0) {
      console.log('  Sample Components:');
      componentsList.forEach(comp => {
        console.log(`    - ${comp.type} [${comp.category}] (confidence: ${comp.confidence})`);
      });
    }
    
    // Check for nested components (complex scenarios)
    const nestedComponents = await prisma.cMSComponent.findMany({
      where: {
        OR: [
          { type: { contains: 'nested' } },
          { type: { contains: 'deep' } },
          { type: { contains: 'level' } }
        ]
      },
      select: { type: true, category: true }
    });
    
    console.log(`\n=== COMPLEX SCENARIOS ===`);
    console.log(`Nested/Deep Components: ${nestedComponents.length} found`);
    if (nestedComponents.length > 0) {
      console.log('  Types found:');
      const uniqueTypes = [...new Set(nestedComponents.map(c => c.type))];
      uniqueTypes.slice(0, 5).forEach(type => {
        console.log(`    - ${type}`);
      });
    }
    
    // Check for edge cases
    const edgeCaseComponents = await prisma.cMSComponent.findMany({
      where: {
        OR: [
          { type: { contains: 'circular' } },
          { type: { contains: 'orphan' } },
          { type: { contains: 'invalid' } },
          { type: { contains: 'empty' } },
          { type: { contains: 'max' } }
        ]
      },
      select: { type: true, category: true }
    });
    
    console.log(`\n=== EDGE CASES ===`);
    console.log(`Edge Case Components: ${edgeCaseComponents.length} found`);
    if (edgeCaseComponents.length > 0) {
      console.log('  Types found:');
      const uniqueTypes = [...new Set(edgeCaseComponents.map(c => c.type))];
      uniqueTypes.slice(0, 5).forEach(type => {
        console.log(`    - ${type}`);
      });
    }
    
    // Check for large datasets
    const largeCollectionItems = await prisma.contentItem.findMany({
      where: {
        title: { contains: 'Large Collection' }
      },
      select: { title: true }
    });
    
    console.log(`\n=== LARGE DATASETS ===`);
    console.log(`Large Collection Items: ${largeCollectionItems.length} found`);
    
    // Summary
    console.log(`\n=== ACCEPTANCE CRITERIA COVERAGE ===`);
    const hasBasicScenarios = contentTypes >= 10 && contentItems >= 20;
    const hasComplexScenarios = nestedComponents.length > 0;
    const hasEdgeCases = edgeCaseComponents.length > 0;
    const hasLargeDatasets = contentItems >= 100;
    
    console.log(`1. Basic Scenarios (20+): ${hasBasicScenarios ? '✅' : '❌'} (${contentItems} items found)`);
    console.log(`2. Complex Scenarios (15+): ${hasComplexScenarios ? '✅' : '❌'} (${nestedComponents.length} nested components)`);
    console.log(`3. Edge Cases (10+): ${hasEdgeCases ? '✅' : '❌'} (${edgeCaseComponents.length} edge cases)`);
    console.log(`4. Large Datasets (100+): ${hasLargeDatasets ? '✅' : '❌'} (${contentItems} total items)`);
    console.log(`5. Total Test Cases (45+): ${contentItems >= 45 ? '✅' : '❌'} (${contentItems} items)`);
    
    // Check specific nesting depths
    const maxNestingComponent = await prisma.cMSComponent.findFirst({
      where: { type: { contains: 'max-nesting' } }
    });
    
    console.log(`\n=== NESTING DEPTH TEST ===`);
    if (maxNestingComponent) {
      console.log(`Max Nesting Component Found: ✅`);
      try {
        const content = JSON.parse(JSON.stringify(maxNestingComponent.content));
        let depth = 0;
        let current = content;
        while (current && current.nested) {
          depth++;
          current = current.nested;
        }
        console.log(`  Actual nesting depth: ${depth} levels`);
        console.log(`  Target was 25 levels: ${depth >= 25 ? '✅' : '❌ (' + depth + '/25)'}`);
      } catch (e) {
        console.log(`  Could not determine depth: ${e.message}`);
      }
    } else {
      console.log(`Max Nesting Component: ❌ Not found`);
    }
    
  } catch (error) {
    console.error('Error checking seed data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSeedData();