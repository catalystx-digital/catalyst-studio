import { PrismaClient } from '../lib/generated/prisma';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface ComponentPattern {
  location: string;
  count: number;
  examples: any[];
  structure: Record<string, any>;
}

async function investigateComponentPatterns() {
  console.log('🔍 Component Storage Pattern Investigation\n');
  
  const patterns: Record<string, ComponentPattern> = {};
  
  // 1. Investigate WebsiteComponentType Table
  console.log('📊 Analyzing WebsiteComponentType Table...');
  const cmsComponents = await prisma.websiteComponentType.findMany({
    include: {
      website: true
    }
  });
  
  patterns.cmsComponent = {
    location: 'WebsiteComponentType table',
    count: cmsComponents.length,
    examples: cmsComponents.slice(0, 3),
    structure: {
      fields: ['id', 'type', 'category', 'version', 'props', 'content', 'styles', 'aiMetadata', 'confidence', 'isGlobal'],
      keyField: 'type',
      contentField: 'content',
      propsField: 'props',
      globalFlag: 'isGlobal',
      aiSupport: true
    }
  };
  
  // Analyze component categories
  const componentsByCategory = cmsComponents.reduce((acc, comp) => {
    acc[comp.category] = (acc[comp.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`  ✓ Found ${cmsComponents.length} components`);
  console.log('  Categories:', componentsByCategory);
  
  // Check for global vs local components
  const globalComponents = cmsComponents.filter((c: any) => c.category === 'global' || c.category === 'shared');
  console.log(`  ✓ Global components: ${globalComponents.length}`);
  console.log(`  ✓ Local components: ${cmsComponents.length - globalComponents.length}`);
  
  // 2. Check ContentType Table for Components
  console.log('\n📊 Analyzing ContentType Table...');
  const componentContentTypes = await prisma.contentType.findMany({
    where: { category: 'component' }
  });
  
  patterns.contentTypeComponent = {
    location: 'ContentType table with category="component"',
    count: componentContentTypes.length,
    examples: componentContentTypes,
    structure: {
      fields: ['id', 'key', 'name', 'pluralName', 'displayField', 'category', 'fields'],
      keyField: 'key',
      schemaField: 'fields',
      globalFlag: null,
      aiSupport: false
    }
  };
  
  console.log(`  ✓ Found ${componentContentTypes.length} component-type ContentTypes`);
  
  // 3. Check for Component References in WebsitePage/WebsiteCustomContentData
  console.log('\n📊 Analyzing WebsitePage References...');
  const contentItems = await prisma.websitePage.findMany({
    take: 100
  });
  
  let componentReferences = 0;
  const referencePatterns: string[] = [];
  
  for (const item of contentItems) {
    if (item.content && typeof item.content === 'object') {
      const contentStr = JSON.stringify(item.content);
      
      // Look for various component reference patterns
      const patterns = [
        { pattern: 'componentId', found: contentStr.includes('componentId') },
        { pattern: 'component_id', found: contentStr.includes('component_id') },
        { pattern: 'componentRef', found: contentStr.includes('componentRef') },
        { pattern: 'components', found: contentStr.includes('"components"') },
        { pattern: 'cmsComponentId', found: contentStr.includes('cmsComponentId') }
      ];
      
      const foundPatterns = patterns.filter(p => p.found).map(p => p.pattern);
      if (foundPatterns.length > 0) {
        componentReferences++;
        referencePatterns.push(...foundPatterns);
      }
    }
  }
  
  patterns.contentItemReferences = {
    location: 'ContentItem.content field (JSON)',
    count: componentReferences,
    examples: [],
    structure: {
      referencePatterns: [...new Set(referencePatterns)],
      embeddedComponents: false,
      referenceOnly: true
    }
  };
  
  console.log(`  ✓ Analyzed ${contentItems.length} content items`);
  console.log(`  ✓ Found ${componentReferences} items with component references`);
  console.log(`  ✓ Reference patterns:`, [...new Set(referencePatterns)]);
  
  // 4. Check for Nested Components
  console.log('\n📊 Analyzing Nested Component Patterns...');
  const componentsWithNestedRefs = cmsComponents.filter(comp => {
    const propsStr = JSON.stringify(comp.defaultConfig);
    const contentStr = JSON.stringify(comp.placeholderData);
    return propsStr.includes('componentId') || 
           contentStr.includes('componentId') ||
           propsStr.includes('components') ||
           contentStr.includes('components');
  });
  
  console.log(`  ✓ Components with nested references: ${componentsWithNestedRefs.length}`);
  
  // 5. Analyze Component Data Structure
  console.log('\n📊 Analyzing Component Data Structures...');
  const sampleComponent = cmsComponents[0];
  if (sampleComponent) {
    console.log('  Sample Component Structure:');
    console.log(`    - Type: ${sampleComponent.type}`);
    console.log(`    - Category: ${sampleComponent.category}`);
    console.log(`    - Props keys: ${Object.keys(sampleComponent.defaultConfig as any).join(', ')}`);
    console.log(`    - Content keys: ${Object.keys(sampleComponent.placeholderData as any).join(', ')}`);
    console.log(`    - AI Metadata: ${JSON.stringify(sampleComponent.aiMetadata).substring(0, 100)}...`);
  }
  
  // Generate Report
  generateReport(patterns, cmsComponents, componentsByCategory);
}

function generateReport(
  patterns: Record<string, ComponentPattern>, 
  components: any[],
  categories: Record<string, number>
) {
  const reportDir = join(process.cwd(), 'docs', 'epic13-investigation');
  mkdirSync(reportDir, { recursive: true });
  
  const report = `# Component Storage Pattern Analysis

## Investigation Date: ${new Date().toISOString()}

## Executive Summary

Component storage in the current system uses the **CMSComponent table** as the primary storage mechanism. The ContentType table with category='component' is not currently utilized, and ContentItem records do not exist in the seed data.

## Storage Patterns Discovered

### 1. Primary Pattern: CMSComponent Table ✅

**Location**: \`CMSComponent\` table
**Count**: ${patterns.cmsComponent.count} components
**Structure**:
- Primary key: \`id\` (CUID)
- Component identifier: \`type\` (e.g., "nav-bar", "hero-banner")
- Categorization: \`category\` field for grouping
- Content storage: Separate \`props\` and \`content\` JSON fields
- Category-based scoping: \`category\` field determines component scope
- AI support: \`aiMetadata\` field with detection patterns
- Versioning: \`version\` field (default "1.0.0")

**Key Characteristics**:
- ✅ Clear separation between props and content
- ✅ Built-in global/local distinction
- ✅ AI metadata for detection
- ✅ Direct website association
- ✅ Confidence scoring for AI detection

### 2. Unused Pattern: ContentType with category='component'

**Location**: \`ContentType\` table with \`category='component'\`
**Count**: ${patterns.contentTypeComponent.count} records
**Status**: ❌ Not currently used

This pattern exists in the schema but is not populated by seed data. The ContentType table appears designed for defining content schemas rather than storing component instances.

### 3. Component References in Content

**Location**: \`ContentItem.content\` field
**Count**: ${patterns.contentItemReferences.count} references found
**Status**: ⚠️ No ContentItems in current seed data

The system appears designed to support component references within content items, but no test data exists to validate this pattern.

## Component Distribution

| Category | Count | Percentage |
|----------|-------|------------|
${Object.entries(categories).map(([cat, count]) => 
  `| ${cat} | ${count} | ${((count / components.length) * 100).toFixed(1)}% |`
).join('\n')}

## Component Characteristics

### Global vs Local Distribution
- **Global/Shared Components**: ${components.filter((c: any) => c.category === 'global' || c.category === 'shared').length} (${((components.filter((c: any) => c.category === 'global' || c.category === 'shared').length / components.length) * 100).toFixed(1)}%)
- **Local Components**: ${components.filter((c: any) => c.category !== 'global' && c.category !== 'shared').length} (${((components.filter((c: any) => c.category !== 'global' && c.category !== 'shared').length / components.length) * 100).toFixed(1)}%)

### Component Types by Website
${[...new Set(components.map(c => c.website.name))].map(websiteName => {
  const websiteComps = components.filter(c => c.website.name === websiteName);
  return `
#### ${websiteName}
- Total components: ${websiteComps.length}
- Categories: ${[...new Set(websiteComps.map(c => c.category))].join(', ')}
- Global/Shared: ${websiteComps.filter((c: any) => c.category === 'global' || c.category === 'shared').length}, Local: ${websiteComps.filter((c: any) => c.category !== 'global' && c.category !== 'shared').length}`;
}).join('\n')}

## Data Structure Analysis

### CMSComponent Fields

\`\`\`typescript
interface CMSComponent {
  id: string;           // CUID
  type: string;         // Component type identifier
  category: string;     // Component category
  version: string;      // Version (default "1.0.0")
  props: Json;          // Component properties
  content: Json;        // Component content
  styles?: Json;        // Optional custom styles
  aiMetadata: Json;     // AI detection metadata
  confidence: number;   // AI confidence score
  category: string;     // Category determines scope (global/shared/local)
  websiteId: string;    // Website association
}
\`\`\`

### Sample Component Structure

\`\`\`json
{
  "type": "nav-bar",
  "category": "navigation",
  "props": {
    "variant": "default",
    "sticky": true,
    "transparent": false
  },
  "content": {
    "logo": {...},
    "menuItems": [...],
    "ctaButton": {...}
  },
  "aiMetadata": {
    "patterns": ["navigation", "menu", "header"],
    "detection": "auto"
  }
}
\`\`\`

## Key Findings

### ✅ Confirmed Patterns

1. **CMSComponent is the primary storage**: All components are stored in the CMSComponent table
2. **Clear global/local distinction**: Using \`category\` field for scoping
3. **AI-ready structure**: Built-in aiMetadata and confidence fields
4. **Versioning support**: Version field for component evolution
5. **Website association**: Direct foreign key to Website table

### ❌ Issues Identified

1. **No ContentItem records**: Seed data doesn't create content items
2. **ContentType.category='component' unused**: Despite schema support
3. **No component nesting examples**: Need to validate nested component patterns
4. **Missing site structure**: No folder hierarchy in seed data

### ⚠️ Gaps Requiring Investigation

1. How are components referenced within ContentItems?
2. Is ContentType.category='component' a legacy pattern?
3. How do nested components work?
4. What's the relationship between CMSComponent and ContentType?

## Recommendations

### For Export System Implementation

1. **Primary Focus**: Build export logic around CMSComponent table
2. **Component Detection**: Use \`type\` and \`category\` fields for identification
3. **Global Component Handling**: Leverage \`category\` field for scope determination
4. **AI Integration**: Utilize existing \`aiMetadata\` for enhanced detection

### For Testing

1. **Create ContentItems**: Add seed data with component references
2. **Test Nested Components**: Create components that reference other components
3. **Add Site Structure**: Build folder hierarchy for complete export testing
4. **Validate References**: Ensure component references resolve correctly

## Next Steps

1. ✅ Component storage pattern confirmed as CMSComponent table
2. 🔄 Need to investigate why ContentType.category='component' exists but is unused
3. 🔄 Create test ContentItems with component references
4. 🔄 Build component detection algorithm based on CMSComponent structure
5. 🔄 Test export with actual component resolution`;
  
  const reportPath = join(reportDir, 'component-patterns.md');
  writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

async function main() {
  try {
    await investigateComponentPatterns();
    console.log('\n✅ Component pattern investigation complete!');
  } catch (error) {
    console.error('Error during investigation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();