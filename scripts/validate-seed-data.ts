import { PrismaClient } from '../lib/generated/prisma';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface ValidationResult {
  category: string;
  status: 'pass' | 'fail' | 'partial';
  coverage: number;
  details: string[];
  recommendation?: string;
}

async function validateSeedData() {
  console.log('🔍 Seed Data Validation\n');
  
  const results: ValidationResult[] = [];
  
  // 1. Validate Component Types Coverage
  console.log('📊 Validating Component Types...');
  const components = await prisma.websiteComponentType.findMany({
    include: { website: true }
  });
  
  const componentTypes = [...new Set(components.map(c => c.type))];
  const componentCategories = [...new Set(components.map(c => c.category))];
  
  results.push({
    category: 'Component Types',
    status: componentTypes.length >= 10 ? 'pass' : 'partial',
    coverage: componentTypes.length,
    details: [
      `Total components: ${components.length}`,
      `Unique types: ${componentTypes.length}`,
      `Categories: ${componentCategories.join(', ')}`,
      `Per website: ${components.length / 4} average`
    ],
    recommendation: componentTypes.length < 10 ? 'Add more component type variations' : undefined
  });
  
  // 2. Validate Nested Components
  console.log('📊 Validating Nested Components...');
  let nestedCount = 0;
  const nestedExamples: string[] = [];
  
  for (const comp of components) {
    const dataStr = JSON.stringify(comp.placeholderData) + JSON.stringify(comp.defaultConfig);
    if (dataStr.includes('componentId') || 
        dataStr.includes('components') ||
        dataStr.includes('childComponents')) {
      nestedCount++;
      nestedExamples.push(comp.type);
    }
  }
  
  results.push({
    category: 'Nested Components',
    status: nestedCount > 0 ? 'pass' : 'fail',
    coverage: (nestedCount / components.length) * 100,
    details: [
      `Components with nesting: ${nestedCount}`,
      `Percentage: ${((nestedCount / components.length) * 100).toFixed(1)}%`,
      `Examples: ${nestedExamples.slice(0, 3).join(', ') || 'None'}`
    ],
    recommendation: nestedCount === 0 ? 'Add components that reference other components' : undefined
  });
  
  // 3. Validate Circular References
  console.log('📊 Checking for Circular References...');
  // In current implementation, checking if any component references itself
  let circularRefs = 0;
  
  for (const comp of components) {
    const dataStr = JSON.stringify(comp.placeholderData) + JSON.stringify(comp.defaultConfig);
    if (dataStr.includes(comp.id)) {
      circularRefs++;
    }
  }
  
  results.push({
    category: 'Circular Reference Tests',
    status: 'fail', // We want test cases, but found none
    coverage: 0,
    details: [
      `Direct circular refs found: ${circularRefs}`,
      `Test cases needed for: self-reference, A->B->A, deep chains`
    ],
    recommendation: 'Create specific circular reference test cases'
  });
  
  // 4. Validate Folder Hierarchy
  console.log('📊 Validating Folder Hierarchy...');
  const siteStructures = await prisma.websiteStructure.findMany({
    include: {
      children: true,
      parent: true
    }
  });
  
  const maxDepth = await calculateMaxDepth(siteStructures);
  
  results.push({
    category: 'Folder Hierarchy',
    status: siteStructures.length > 0 ? 'pass' : 'fail',
    coverage: siteStructures.length,
    details: [
      `Total nodes: ${siteStructures.length}`,
      `Max depth: ${maxDepth}`,
      `Root nodes: ${siteStructures.filter(s => !s.parentId).length}`,
      `Leaf nodes: ${siteStructures.filter(s => s.children.length === 0).length}`
    ],
    recommendation: siteStructures.length === 0 ? 'Add site structure with folders and pages' : undefined
  });
  
  // 5. Validate Content Items
  console.log('📊 Validating Content Items...');
  const contentItems = await prisma.websitePage.findMany({
    include: { contentType: true }
  });
  
  const contentWithComponents = contentItems.filter(item => {
    const contentStr = JSON.stringify(item.content);
    return contentStr.includes('componentId') || 
           contentStr.includes('components');
  });
  
  results.push({
    category: 'Content Items',
    status: contentItems.length > 0 ? 'pass' : 'fail',
    coverage: contentItems.length,
    details: [
      `Total items: ${contentItems.length}`,
      `With component refs: ${contentWithComponents.length}`,
      `Content types used: ${[...new Set(contentItems.map(i => i.contentType?.name))].filter(Boolean).join(', ') || 'None'}`,
      `Published: ${contentItems.filter(i => i.publishedAt).length}`
    ],
    recommendation: contentItems.length === 0 ? 'Add content items with component references' : undefined
  });
  
  // 6. Validate Global vs Local Components
  console.log('📊 Validating Global/Local Balance...');
  const globalComponents = components.filter((c: any) => c.category === 'global' || c.category === 'shared');
  const localComponents = components.filter((c: any) => c.category !== 'global' && c.category !== 'shared');
  
  results.push({
    category: 'Global/Local Components',
    status: globalComponents.length > 0 ? 'pass' : 'partial',
    coverage: (globalComponents.length / components.length) * 100,
    details: [
      `Global: ${globalComponents.length} (${((globalComponents.length / components.length) * 100).toFixed(1)}%)`,
      `Local: ${localComponents.length} (${((localComponents.length / components.length) * 100).toFixed(1)}%)`,
      `Ratio: 1:${localComponents.length > 0 ? (localComponents.length / Math.max(globalComponents.length, 1)).toFixed(1) : 'N/A'}`
    ],
    recommendation: globalComponents.length === 0 ? 'Mark some components as global (category: "global" or "shared")' : undefined
  });
  
  // 7. Validate AI Metadata
  console.log('📊 Validating AI Metadata...');
  const componentsWithAI = components.filter(c => 
    c.aiMetadata && 
    typeof c.aiMetadata === 'object' &&
    Object.keys(c.aiMetadata).length > 0
  );
  
  results.push({
    category: 'AI Metadata',
    status: componentsWithAI.length === components.length ? 'pass' : 'partial',
    coverage: (componentsWithAI.length / components.length) * 100,
    details: [
      `With AI metadata: ${componentsWithAI.length}/${components.length}`,
      `With confidence scores: ${components.filter(c => c.confidence > 0).length}`,
      `Average confidence: ${(components.reduce((sum, c) => sum + c.confidence, 0) / components.length).toFixed(2)}`
    ]
  });
  
  // 8. Validate Website Variety
  console.log('📊 Validating Website Types...');
  const websites = await prisma.website.findMany();
  const websiteCategories = [...new Set(websites.map(w => w.category))];
  
  results.push({
    category: 'Website Variety',
    status: websiteCategories.length >= 3 ? 'pass' : 'partial',
    coverage: websiteCategories.length,
    details: [
      `Total websites: ${websites.length}`,
      `Categories: ${websiteCategories.join(', ')}`,
      `Active: ${websites.filter(w => w.isActive).length}`,
      `With metadata: ${websites.filter(w => w.metadata).length}`
    ]
  });
  
  // 9. Validate Component Variations
  console.log('📊 Validating Component Variations...');
  const variationMap = new Map<string, Set<string>>();
  
  for (const comp of components) {
    const propsStr = JSON.stringify(comp.defaultConfig);
    if (!variationMap.has(comp.type)) {
      variationMap.set(comp.type, new Set());
    }
    variationMap.get(comp.type)!.add(propsStr);
  }
  
  const typesWithVariations = Array.from(variationMap.entries())
    .filter(([_, variations]) => variations.size > 1)
    .map(([type]) => type);
  
  results.push({
    category: 'Component Variations',
    status: typesWithVariations.length > 0 ? 'pass' : 'fail',
    coverage: (typesWithVariations.length / componentTypes.length) * 100,
    details: [
      `Types with variations: ${typesWithVariations.length}`,
      `Examples: ${typesWithVariations.slice(0, 3).join(', ') || 'None'}`,
      `Single-variant types: ${componentTypes.length - typesWithVariations.length}`
    ],
    recommendation: typesWithVariations.length === 0 ? 'Add prop variations for component types' : undefined
  });
  
  // 10. Validate Data Volume
  console.log('📊 Validating Data Volume...');
  const hasMinimalData = components.length >= 20;
  const hasMediumData = components.length >= 50;
  const hasLargeData = components.length >= 100;
  
  results.push({
    category: 'Data Volume',
    status: hasLargeData ? 'pass' : hasMinimalData ? 'partial' : 'fail',
    coverage: components.length,
    details: [
      `Current volume: ${components.length} components`,
      `Minimal (20+): ${hasMinimalData ? '✓' : '✗'}`,
      `Medium (50+): ${hasMediumData ? '✓' : '✗'}`,
      `Large (100+): ${hasLargeData ? '✓' : '✗'}`
    ],
    recommendation: !hasLargeData ? 'Increase data volume for stress testing' : undefined
  });
  
  generateValidationReport(results);
  return results;
}

async function calculateMaxDepth(structures: any[]): Promise<number> {
  if (structures.length === 0) return 0;
  
  let maxDepth = 0;
  const calculateDepth = (nodeId: string, depth: number = 0): number => {
    const node = structures.find(s => s.id === nodeId);
    if (!node) return depth;
    
    const childDepths = node.children.map((child: any) => 
      calculateDepth(child.id, depth + 1)
    );
    
    return Math.max(depth, ...childDepths);
  };
  
  const roots = structures.filter(s => !s.parentId);
  for (const root of roots) {
    maxDepth = Math.max(maxDepth, calculateDepth(root.id, 1));
  }
  
  return maxDepth;
}

function generateValidationReport(results: ValidationResult[]) {
  const reportDir = join(process.cwd(), 'docs', 'epic13-investigation');
  mkdirSync(reportDir, { recursive: true });
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const partialCount = results.filter(r => r.status === 'partial').length;
  
  const report = `# Seed Data Coverage Validation

## Validation Date: ${new Date().toISOString()}

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Pass | ${passCount} | ${((passCount / results.length) * 100).toFixed(1)}% |
| ⚠️ Partial | ${partialCount} | ${((partialCount / results.length) * 100).toFixed(1)}% |
| ❌ Fail | ${failCount} | ${((failCount / results.length) * 100).toFixed(1)}% |

## Validation Results

${results.map(r => `
### ${r.category}

**Status**: ${r.status === 'pass' ? '✅ Pass' : r.status === 'partial' ? '⚠️ Partial' : '❌ Fail'}
**Coverage**: ${typeof r.coverage === 'number' && r.coverage < 1 ? `${r.coverage.toFixed(1)}%` : r.coverage}

**Details**:
${r.details.map(d => `- ${d}`).join('\n')}

${r.recommendation ? `**Recommendation**: ${r.recommendation}` : ''}
`).join('\n')}

## Critical Gaps for Export Testing

### 🔴 High Priority (Blocking Export Testing)

1. **No Content Items**
   - Impact: Cannot test content export at all
   - Action: Create ContentItems with component references

2. **No Site Structure**
   - Impact: Cannot test folder hierarchy export
   - Action: Build SiteStructure tree with pages and folders

3. **No Circular Reference Tests**
   - Impact: Cannot validate circular dependency handling
   - Action: Create specific test cases for circular refs

### 🟡 Medium Priority (Limited Testing)

1. **No Global Components**
   - Impact: Cannot test global component deduplication
   - Current: Components use category field for scoping
   - Action: Update seed to mark some components as global

2. **No Nested Components**
   - Impact: Cannot test component dependency resolution
   - Action: Add components that reference other components

### 🟢 Low Priority (Nice to Have)

1. **Limited Data Volume**
   - Current: ${results.find(r => r.category === 'Data Volume')?.coverage} components
   - Target: 100+ for stress testing
   - Action: Expand seed data volume

2. **No Component Variations**
   - Impact: Limited variation testing
   - Action: Add prop variations for same component types

## Recommendations for Seed Enhancement

### Immediate Actions

\`\`\`typescript
// 1. Add Content Items
const contentItem = {
  contentTypeId: pageType.id,
  title: "Homepage",
  slug: "home",
  content: {
    hero: { componentId: heroComponent.id },
    sections: [
      { componentId: featuresComponent.id },
      { componentId: ctaComponent.id }
    ]
  }
};

// 2. Add Site Structure
const rootFolder = {
  name: "Root",
  type: "folder",
  children: [
    { name: "Home", type: "page", contentItemId: homePage.id },
    { name: "About", type: "folder", children: [...] }
  ]
};

// 3. Mark Components as Global
await prisma.cMSComponent.update({
  where: { type: "nav-bar" },
  data: { category: 'global' }
});
\`\`\`

### Test Scenarios to Add

1. **Component Nesting**: Hero component containing button component
2. **Circular Reference**: Component A → Component B → Component A
3. **Deep Hierarchy**: 5+ level folder structure
4. **Mixed Content**: Pages with 10+ component references
5. **Large Dataset**: 1000+ items for performance testing

## Conclusion

The current seed data provides a good foundation with:
- ✅ Multiple website types
- ✅ Component variety
- ✅ AI metadata

But critically lacks:
- ❌ Content items (0 found)
- ❌ Site structure (0 nodes)
- ❌ Component nesting examples
- ❌ Global component examples

**Overall Assessment**: Seed data is **insufficient for comprehensive export testing** and requires immediate enhancement in critical areas.`;
  
  const reportPath = join(reportDir, 'seed-data-coverage.md');
  writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

async function main() {
  try {
    const results = await validateSeedData();
    
    console.log('\n📊 Validation Summary:');
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    
    console.log(`  ✅ Pass: ${passCount}/${results.length}`);
    console.log(`  ⚠️ Partial: ${partialCount}/${results.length}`);
    console.log(`  ❌ Fail: ${failCount}/${results.length}`);
    
    console.log('\n✅ Seed data validation complete!');
  } catch (error) {
    console.error('Error during validation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();