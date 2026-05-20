const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function detailedVerification() {
  try {
    console.log('=== DETAILED SEED DATA VERIFICATION ===\n');
    
    // 1. Check all component types
    const allComponents = await prisma.cMSComponent.findMany({
      select: { type: true, category: true }
    });
    
    const componentsByCategory = {};
    allComponents.forEach(comp => {
      if (!componentsByCategory[comp.category]) {
        componentsByCategory[comp.category] = new Set();
      }
      componentsByCategory[comp.category].add(comp.type);
    });
    
    console.log('📊 COMPONENT DISTRIBUTION BY CATEGORY:');
    Object.entries(componentsByCategory).forEach(([category, types]) => {
      console.log(`  ${category}: ${types.size} unique types`);
    });
    
    // 2. Look for deeply nested components
    console.log('\n🔍 SEARCHING FOR NESTED COMPONENTS:');
    const componentsWithContent = await prisma.cMSComponent.findMany({
      where: {
        content: {
          not: null
        }
      },
      select: {
        id: true,
        type: true,
        content: true
      }
    });
    
    let maxDepth = 0;
    let deepestComponent = null;
    
    componentsWithContent.forEach(comp => {
      try {
        const depth = calculateDepth(comp.content);
        if (depth > maxDepth) {
          maxDepth = depth;
          deepestComponent = comp;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    console.log(`  Maximum nesting depth found: ${maxDepth} levels`);
    if (deepestComponent) {
      console.log(`  Deepest component: ${deepestComponent.type} (ID: ${deepestComponent.id})`);
    }
    
    // 3. Check for specific test scenarios
    console.log('\n✅ TEST SCENARIO VERIFICATION:');
    
    // Basic scenarios
    const basicComponents = await prisma.cMSComponent.findMany({
      where: {
        type: {
          startsWith: 'basic-'
        }
      }
    });
    console.log(`  Basic Components: ${basicComponents.length} found`);
    
    // Complex multi-level
    const complexComponents = await prisma.cMSComponent.findMany({
      where: {
        OR: [
          { type: { contains: 'level' } },
          { type: { contains: 'nested' } },
          { type: { contains: 'deep' } },
          { type: { contains: 'complex' } }
        ]
      }
    });
    console.log(`  Complex/Nested Components: ${complexComponents.length} found`);
    
    // Circular references
    const circularComponents = await prisma.cMSComponent.findMany({
      where: {
        type: { contains: 'circular' }
      }
    });
    console.log(`  Circular Reference Components: ${circularComponents.length} found`);
    
    // 4. Content Items with components
    console.log('\n📄 CONTENT ITEMS WITH COMPONENTS:');
    const contentWithComponents = await prisma.contentItem.findMany();
    
    let itemsWithComponents = 0;
    let totalComponentRefs = 0;
    
    for (const item of contentWithComponents) {
      try {
        const content = JSON.parse(JSON.stringify(item.content));
        const componentCount = countComponentRefs(content);
        if (componentCount > 0) {
          itemsWithComponents++;
          totalComponentRefs += componentCount;
        }
      } catch (e) {
        // Skip invalid content
      }
    }
    
    console.log(`  Items with components: ${itemsWithComponents}/${contentWithComponents.length}`);
    console.log(`  Total component references: ${totalComponentRefs}`);
    
    // 5. Check specific acceptance criteria
    console.log('\n🎯 ACCEPTANCE CRITERIA DETAILED CHECK:');
    
    // AC3: Complex nested structures up to 25 levels
    const targetDepths = [1, 5, 10, 15, 20, 25];
    for (const depth of targetDepths) {
      const hasDepth = maxDepth >= depth;
      console.log(`  ${depth}-level nesting: ${hasDepth ? '✅' : '❌'} (max found: ${maxDepth})`);
    }
    
    // AC6: Test case distribution
    const testCaseBreakdown = {
      basic: basicComponents.length,
      complex: complexComponents.length,
      edgeCases: circularComponents.length + await prisma.cMSComponent.count({
        where: {
          OR: [
            { type: { contains: 'orphan' } },
            { type: { contains: 'invalid' } },
            { type: { contains: 'empty' } },
            { type: { contains: 'max' } }
          ]
        }
      })
    };
    
    console.log('\n📈 TEST CASE BREAKDOWN:');
    console.log(`  Basic scenarios: ${testCaseBreakdown.basic} (target: 20+)`);
    console.log(`  Complex scenarios: ${testCaseBreakdown.complex} (target: 15+)`);
    console.log(`  Edge cases: ${testCaseBreakdown.edgeCases} (target: 10+)`);
    console.log(`  Total: ${testCaseBreakdown.basic + testCaseBreakdown.complex + testCaseBreakdown.edgeCases} (target: 45+)`);
    
    // 6. Performance test data
    console.log('\n⚡ PERFORMANCE TEST DATA:');
    const largeCollections = await prisma.contentItem.groupBy({
      by: ['contentTypeId'],
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 50
          }
        }
      }
    });
    
    if (largeCollections.length > 0) {
      console.log(`  Found ${largeCollections.length} content types with 50+ items`);
      largeCollections.forEach(col => {
        console.log(`    - ContentType ${col.contentTypeId}: ${col._count.id} items`);
      });
    } else {
      console.log('  No large collections (50+ items) found');
    }
    
    // Final summary
    console.log('\n=== FINAL VERIFICATION SUMMARY ===');
    const allCriteriaMet = 
      testCaseBreakdown.basic >= 20 &&
      testCaseBreakdown.complex >= 15 &&
      testCaseBreakdown.edgeCases >= 10 &&
      contentWithComponents.length >= 45;
    
    console.log(`Overall Status: ${allCriteriaMet ? '✅ ALL CRITERIA MET' : '⚠️ SOME CRITERIA NOT MET'}`);
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function calculateDepth(obj, currentDepth = 0) {
  if (!obj || typeof obj !== 'object') return currentDepth;
  
  let maxDepth = currentDepth;
  
  // Check for nested components
  if (obj.nested || obj.children || obj.components || obj.content) {
    const nested = obj.nested || obj.children || obj.components || obj.content;
    if (Array.isArray(nested)) {
      nested.forEach(item => {
        const depth = calculateDepth(item, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      });
    } else if (typeof nested === 'object') {
      const depth = calculateDepth(nested, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  
  return maxDepth;
}

function countComponentRefs(obj, count = 0) {
  if (!obj || typeof obj !== 'object') return count;
  
  // Check if this looks like a component reference
  if (obj.type && (obj.props || obj.content)) {
    count++;
  }
  
  // Recursively check all properties
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object') {
        count = countComponentRefs(obj[key], count);
      }
    }
  }
  
  return count;
}

detailedVerification();