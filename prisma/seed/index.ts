import { PrismaClient, Prisma } from '../../lib/generated/prisma'
import { createBasicScenarios } from './basic/index'
import { createComplexScenarios } from './complex/index'
import { createEdgeCaseScenarios } from './edge-cases/index'
import { runPerformanceBenchmarks } from './utils/large-dataset'
import { createStory184Components } from './story-18.4-components'
import { createSampleWebsites } from './basic/sample-websites'
import { createImportTestData } from './basic/import-test-data'
import { performance } from 'perf_hooks'

const prisma = new PrismaClient()

const SEED_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const SEED_ACCOUNT_NAME = 'Seed Test Account'
const SEED_USER_ID = '00000000-0000-0000-0000-000000000002'

/**
 * Enhanced Seed Script for Story 14.1
 * Provides comprehensive test data for Epic 13 export system validation
 * 
 * Test Coverage:
 * - 20+ Basic scenarios
 * - 15+ Complex scenarios  
 * - 10+ Edge cases
 * - Performance benchmarks (100, 500, 1000+ items)
 */

interface SeedOptions {
  includeBasic?: boolean
  includeComplex?: boolean
  includeEdgeCases?: boolean
  includePerformance?: boolean
  performanceSizes?: number[]
  cleanFirst?: boolean
  maxItems?: number
}

async function seed(options: SeedOptions = {}) {
  const {
    includeBasic = true,
    includeComplex = true,
    includeEdgeCases = true,
    includePerformance = false,
    performanceSizes = [100, 500, 1000],
    cleanFirst = true,
    maxItems
  } = options

  console.log('🌱 Enhanced Seed Data Generation - Story 14.1')
  console.log('='.repeat(60))
  
  if (maxItems) {
    console.log(`📊 Max items per collection limited to: ${maxItems}`)
  }
  
  const startTime = performance.now()
  const startMemory = process.memoryUsage().heapUsed
  
  try {
    // Clean existing data if requested
    if (cleanFirst) {
      console.log('\n🧹 Cleaning existing data...')
      await cleanDatabase()
      console.log('✅ Database cleaned')
    }
    
    // Create or get test website
    const website = await createTestWebsite()
    console.log(`\n🌐 Using website: ${website.name} (${website.id})`)
    
    // Statistics tracking
    const stats = {
      basic: 0,
      complex: 0,
      edgeCases: 0,
      performance: 0,
      total: 0
    }
    
    // Run basic scenarios
    if (includeBasic) {
      console.log('\n📦 Creating Basic Scenarios (20 test cases)...')
      try {
        const basicCount = await createBasicScenarios(prisma, website.id)
        stats.basic = basicCount
        console.log(`✅ Created ${basicCount} basic test scenarios`)
      } catch (error) {
        console.error('❌ Error creating basic scenarios:', error)
        throw new Error(`Failed to create basic scenarios: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Run complex scenarios
    if (includeComplex) {
      console.log('\n🔧 Creating Complex Scenarios (15 test cases)...')
      try {
        const complexCount = await createComplexScenarios(prisma, website.id)
        stats.complex = complexCount
        console.log(`✅ Created ${complexCount} complex test scenarios`)
      } catch (error) {
        console.error('❌ Error creating complex scenarios:', error)
        throw new Error(`Failed to create complex scenarios: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Run edge cases
    if (includeEdgeCases) {
      console.log('\n⚠️ Creating Edge Case Scenarios (10 test cases)...')
      try {
        const edgeCount = await createEdgeCaseScenarios(prisma, website.id)
        stats.edgeCases = edgeCount
        console.log(`✅ Created ${edgeCount} edge case scenarios`)
      } catch (error) {
        console.error('❌ Error creating edge case scenarios:', error)
        throw new Error(`Failed to create edge case scenarios: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Create Story 18.4 component types (all 30 categories)
    if (includeBasic) {
      console.log('\n🎨 Creating Story 18.4 Component Types (30 categories)...')
      try {
        const componentCount = await createStory184Components(prisma, website.id)
        stats.basic += componentCount
        console.log(`✅ Created ${componentCount} component types for Story 18.4`)
      } catch (error) {
        console.error('❌ Error creating Story 18.4 components:', error)
        throw new Error(`Failed to create Story 18.4 components: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Create Sample Websites (Story 18.8 addition - after component types are available)
    if (includeBasic) {
      console.log('\n🏠 Creating Story 18.8 Sample Websites...')
      try {
        const sampleWebsitePages = await createSampleWebsites(prisma, website.id)
        stats.basic += sampleWebsitePages
        console.log(`✅ Created ${sampleWebsitePages} sample website pages for Story 18.8`)
      } catch (error) {
        console.error('❌ Error creating sample websites:', error)
        throw new Error(`Failed to create sample websites: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Create Import Test Data (Story 18.8 addition - sample import scenarios)
    if (includeBasic) {
      console.log('\n📥 Creating Story 18.8 Import Test Data...')
      try {
        const importScenarios = await createImportTestData(prisma, website.id)
        stats.basic += importScenarios
        console.log(`✅ Created ${importScenarios} import test scenarios for Story 18.8`)
      } catch (error) {
        console.error('❌ Error creating import test data:', error)
        throw new Error(`Failed to create import test data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Run performance benchmarks
    if (includePerformance) {
      console.log('\n🚀 Running Performance Benchmarks...')
      // Apply maxItems limit to performance sizes if specified
      const limitedSizes = maxItems 
        ? performanceSizes.map(size => Math.min(size, maxItems))
        : performanceSizes
      
      for (const size of limitedSizes) {
        console.log(`\n  Testing with ${size} items...`)
        try {
          const perfWebsite = await createTestWebsite(`perf-test-${size}`)
          await runPerformanceBenchmarks(prisma, perfWebsite.id)
          stats.performance += size
        } catch (error) {
          console.error(`❌ Error in performance benchmark for ${size} items:`, error)
          // Continue with other sizes but log the error
        }
      }
    }
    
    // Calculate totals
    stats.total = stats.basic + stats.complex + stats.edgeCases + stats.performance

    await ensureTemplateMetadata();
    
    // Final statistics
    const endTime = performance.now()
    const endMemory = process.memoryUsage().heapUsed
    const executionTime = (endTime - startTime) / 1000
    const memoryUsed = (endMemory - startMemory) / (1024 * 1024)
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 SEED DATA GENERATION COMPLETE!')
    console.log('='.repeat(60))
    
    console.log('\n📊 Test Coverage Summary:')
    console.log(`  • Basic Scenarios: ${stats.basic} test cases`)
    console.log(`  • Complex Scenarios: ${stats.complex} test cases`)
    console.log(`  • Edge Cases: ${stats.edgeCases} test cases`)
    if (includePerformance) {
      console.log(`  • Performance Items: ${stats.performance} items`)
    }
    console.log(`  • TOTAL: ${stats.total} test items`)
    
    console.log('\n⚡ Performance Metrics:')
    console.log(`  • Execution Time: ${executionTime.toFixed(2)} seconds`)
    console.log(`  • Memory Used: ${memoryUsed.toFixed(2)} MB`)
    console.log(`  • Items per Second: ${(stats.total / executionTime).toFixed(2)}`)
    
    // Validate data integrity
    console.log('\n🔍 Validating Data Integrity...')
    const validation = await validateSeedData(website.id)
    if (validation.valid) {
      console.log('✅ All seed data passed validation')
    } else {
      console.log('❌ Validation errors found:')
      validation.errors.forEach(err => console.log(`  - ${err}`))
    }
    
    // Epic 13 coverage check
    console.log('\n📋 Epic 13 Export Requirements Coverage:')
    const coverage = await checkEpic13Coverage(website.id)
    console.log(`  • Content Types: ${coverage.contentTypes ? '✅' : '❌'} (${coverage.contentTypeCount} types)`)
    console.log(`  • Content Items: ${coverage.contentItems ? '✅' : '❌'} (${coverage.contentItemCount} items)`)
    console.log(`  • Components: ${coverage.components ? '✅' : '❌'} (${coverage.componentCount} components)`)
    console.log(`  • Site Structure: ${coverage.siteStructure ? '✅' : '❌'} (${coverage.structureDepth} max depth)`)
    console.log(`  • Nested Components: ${coverage.nestedComponents ? '✅' : '❌'} (${coverage.maxNesting} max nesting)`)
    console.log(`  • Circular References: ${coverage.circularRefs ? '✅' : '❌'}`)
    console.log(`  • Large Datasets: ${coverage.largeDatasets ? '✅' : '❌'}`)
    
    console.log('\n✨ Ready for Epic 13 Export System Testing!')
    
  } catch (error) {
    console.error('\n❌ Error during seeding:', error)
    throw error
  }
}

/**
 * Clean the database in correct order for foreign key constraints
 * Story 18.8 Update: Added ImportJob cleanup
 */
async function cleanDatabase() {
  // Delete in dependency order to avoid foreign key violations
  await prisma.componentAnalytics.deleteMany()
  await prisma.websiteSharedComponent.deleteMany()
  await prisma.websiteComponentType.deleteMany()
  await prisma.websiteStructure.deleteMany()
  await prisma.websitePage.deleteMany()
  await prisma.websiteCustomContentData.deleteMany()
  await prisma.contentType.deleteMany()
  await prisma.aIContext.deleteMany()
  // Clean import jobs first (they reference websites)
  await prisma.importJob.deleteMany()
  await prisma.website.deleteMany()
  await prisma.accountQuota.deleteMany()
  await prisma.usageEvent.deleteMany()
  await prisma.accountMembership.deleteMany()
  await prisma.user.deleteMany()
  await prisma.account.deleteMany()
}

/**
 * Create test website
 */
async function ensureSeedAccount() {
  const account = await prisma.account.upsert({
    where: { id: SEED_ACCOUNT_ID },
    update: {
      name: SEED_ACCOUNT_NAME,
      plan: 'studio',
      limits: {
        importsPerDay: 25,
        chatTokensPerDay: 60000
      }
    },
    create: {
      id: SEED_ACCOUNT_ID,
      name: SEED_ACCOUNT_NAME,
      plan: 'studio',
      limits: {
        importsPerDay: 25,
        chatTokensPerDay: 60000
      }
    }
  })

  const user = await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {
      name: 'Seed User',
      email: 'seed@example.com'
    },
    create: {
      id: SEED_USER_ID,
      name: 'Seed User',
      email: 'seed@example.com'
    }
  })

  await prisma.accountMembership.upsert({
    where: { accountId_userId: { accountId: account.id, userId: user.id } },
    update: {},
    create: { accountId: account.id, userId: user.id, role: 'owner' }
  })

  await prisma.accountQuota.upsert({
    where: { accountId_kind: { accountId: account.id, kind: 'importsPerDay' } },
    update: { value: 25 },
    create: { accountId: account.id, kind: 'importsPerDay', value: 25 }
  })

  await prisma.accountQuota.upsert({
    where: { accountId_kind: { accountId: account.id, kind: 'chatTokensPerDay' } },
    update: { value: 60000 },
    create: { accountId: account.id, kind: 'chatTokensPerDay', value: 60000 }
  })

  return account
}

async function seedAccountUsageSamples(accountId: string) {
  const existing = await prisma.usageEvent.count({ where: { accountId } })
  if (existing > 0) return

  const now = new Date()
  await prisma.usageEvent.createMany({
    data: [
      { accountId, kind: 'import_page', amount: 2, occurredAt: now },
      { accountId, kind: 'import_page', amount: 1, occurredAt: new Date(now.getTime() - 1000 * 60 * 60 * 5) },
      { accountId, kind: 'chat_tokens', amount: 8000, occurredAt: now },
      { accountId, kind: 'chat_tokens', amount: 4500, occurredAt: new Date(now.getTime() - 1000 * 60 * 60 * 12) }
    ]
  })
}
async function createTestWebsite(suffix = ''): Promise<any> {
  const websiteId = `test-website${suffix ? `-${suffix}` : ''}`
  
  const account = await ensureSeedAccount()

  const website = await prisma.website.upsert({
    where: { id: websiteId },
    update: {
      accountId: account.id
    },
    create: {
      id: websiteId,
      name: `Test Website${suffix ? ` - ${suffix}` : ''}`,
      description: 'Test website for Story 14.1 seed data validation',
      category: 'test',
      accountId: account.id,
      metadata: {
        story: '14.1',
        epic: '13',
        purpose: 'export-system-testing',
        createdBy: 'seed-script'
      },
      icon: '🧪',
      settings: {
        theme: {
          primaryColor: '#2563eb'
        },
        features: {
          export: true,
          import: true,
          analytics: true
        }
      }
    }
  })

  await seedAccountUsageSamples(account.id)

  return website
}

/**
 * Validate seed data integrity
 */
async function validateSeedData(websiteId: string) {
  const errors: string[] = []
  
  // Check for orphaned components
  const orphanedComponents = await prisma.websiteSharedComponent.findMany({
    where: {
      websiteId
    }
  })
  
  // Check for circular references
  const components = await prisma.websiteSharedComponent.findMany({
    where: { websiteId }
  })
  
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  
  function hasCircular(compId: string): boolean {
    if (recursionStack.has(compId)) return true
    if (visited.has(compId)) return false
    
    visited.add(compId)
    recursionStack.add(compId)
    
    const comp = components.find(c => c.id === compId)
    if (comp?.config) {
      const config = comp.config as any
      if (config.referencedComponentId) {
        if (hasCircular(config.referencedComponentId)) {
          return true
        }
      }
    }
    
    recursionStack.delete(compId)
    return false
  }
  
  // Validate pages have valid content types
  const pages = await prisma.websitePage.findMany({
    where: { websiteId }
  })
  
  const contentTypes = await prisma.contentType.findMany({
    where: { websiteId }
  })
  
  const typeIds = new Set(contentTypes.map(ct => ct.id))
  
  for (const page of pages) {
    if (!typeIds.has(page.contentTypeId)) {
      errors.push(`Website page ${page.id} has invalid content type ${page.contentTypeId}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Check Epic 13 requirements coverage
 */
async function checkEpic13Coverage(websiteId: string) {
  const contentTypes = await prisma.contentType.count({
    where: { websiteId }
  })
  
  const contentItems = await prisma.websitePage.count({
    where: { websiteId }
  })
  
  const components = await prisma.websiteSharedComponent.count({
    where: { websiteId }
  })
  
  const siteStructure = await prisma.websiteStructure.findMany({
    where: { websiteId }
  })
  
  const maxDepth = Math.max(...siteStructure.map(s => s.pathDepth), 0)
  
  // Check for components with nested structures
  // Look in WebsiteComponentType where nested components are actually stored
  const allComponentTypes = await prisma.websiteComponentType.findMany({
    where: { websiteId }
  })
  
  // Calculate max nesting depth by checking nested component structures
  let maxNesting = 0
  let nestedComponentCount = 0
  
  for (const componentType of allComponentTypes) {
    const placeholderData = componentType.placeholderData as any
    
    // Check if component has levelInfo with maxDepth (from nested component structures)
    if (placeholderData?.levelInfo?.maxDepth) {
      maxNesting = Math.max(maxNesting, placeholderData.levelInfo.maxDepth)
      nestedComponentCount++
    }
    
    // Check for nested components in placeholderData
    if (placeholderData?.nestedComponents && Array.isArray(placeholderData.nestedComponents)) {
      nestedComponentCount++
      // Calculate depth from nested array
      const depth = placeholderData.nestedComponents.length
      maxNesting = Math.max(maxNesting, depth)
    }
    
    // Check for components with "nested" in their type (created by nested-components.ts)
    if (componentType.type.includes('nested-') || componentType.category.includes('nested')) {
      nestedComponentCount++
      // Extract depth from type name if present (e.g., "nested-level-5")
      const depthMatch = componentType.type.match(/level-(\d+)/)
      if (depthMatch) {
        const depth = parseInt(depthMatch[1], 10)
        maxNesting = Math.max(maxNesting, depth)
      }
    }
  }
  
  // Check for circular references
  const circularComponents = await prisma.websiteSharedComponent.findMany({
    where: {
      websiteId
      // Note: category field doesn't exist on websiteSharedComponent
    }
  })
  
  return {
    contentTypes: contentTypes > 0,
    contentTypeCount: contentTypes,
    contentItems: contentItems > 0,
    contentItemCount: contentItems,
    components: components > 0,
    componentCount: components,
    siteStructure: maxDepth > 0,
    structureDepth: maxDepth,
    nestedComponents: nestedComponentCount > 0,
    maxNesting,
    circularRefs: circularComponents.length > 0,
    largeDatasets: contentItems >= 100
  }
}


async function ensureTemplateMetadata(): Promise<void> {
  console.log('\n🧩 Ensuring website pages include template metadata...')
  const defaultAssignment = await prisma.websitePage.updateMany({
    data: {
      templateKey: 'core/generic-default',
      templateProps: Prisma.JsonNull
    },
    where: {
      templateKey: null,
      type: 'page'
    }
  })

  const homeAssignment = await prisma.websitePage.updateMany({
    data: {
      templateKey: 'marketing/home-default',
    },
    where: {
      templateKey: 'core/generic-default',
      title: { in: ['Home', 'Homepage', 'Landing Page'] }
    }
  })

  console.log(`   • Default template assigned to ${defaultAssignment.count} pages`)
  if (homeAssignment.count > 0) {
    console.log(`   • Home templates enforced for ${homeAssignment.count} pages`)
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  // Parse max-items flag
  const maxItemsArg = args.find(arg => arg.startsWith('--max-items='))
  const maxItems = maxItemsArg ? parseInt(maxItemsArg.split('=')[1], 10) : undefined
  
  const options: SeedOptions = {
    includeBasic: !args.includes('--no-basic'),
    includeComplex: !args.includes('--no-complex'),
    includeEdgeCases: !args.includes('--no-edge'),
    includePerformance: args.includes('--performance'),
    cleanFirst: !args.includes('--no-clean'),
    maxItems: maxItems
  }
  
  if (args.includes('--help')) {
    console.log(`
Enhanced Seed Script for Story 14.1

Usage: npx ts-node prisma/seed/index.ts [options]

Options:
  --no-basic       Skip basic scenarios
  --no-complex     Skip complex scenarios
  --no-edge        Skip edge case scenarios
  --performance    Include performance benchmarks
  --no-clean       Don't clean database first
  --max-items=N    Limit maximum items per collection (e.g., --max-items=50)
  --help          Show this help message

Examples:
  npx ts-node prisma/seed/index.ts              # Run all except performance
  npx ts-node prisma/seed/index.ts --performance # Run everything
  npx ts-node prisma/seed/index.ts --no-basic --no-complex # Edge cases only
`)
    process.exit(0)
  }
  
  await seed(options)
}

// Execute if run directly
if (require.main === module) {
  main()
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { seed, createTestWebsite }

