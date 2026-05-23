import { PrismaClient } from '../../../lib/generated/prisma'
import { createSimpleContentTypes } from './simple-content-types'
import { createWebsitePages } from './website-pages'
import { createWebsiteStructures } from './website-structure'
import { createSingleLevelComponents } from './single-level-components'
import { createWebsiteSharedComponents } from './website-shared-components'
// import { createSampleWebsites } from './sample-websites' // Moved to main seed script after Story 18.4 components

/**
 * Creates 20 basic test scenarios for seed data validation
 * These scenarios test fundamental functionality without complexity
 */
export async function createBasicScenarios(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  // 1. ContentTypes (provides contentTypeId for pages and data)
  console.log('  📝 Creating simple content types...')
  const contentTypes = await createSimpleContentTypes(prisma, websiteId)
  
  // 2. WebsiteComponentTypes (provides types for shared components)
  console.log('  🧩 Creating single-level components...')
  const componentTypes = await createSingleLevelComponents(prisma, websiteId)
  
  // 3. WebsiteSharedComponents (must come before pages that reference them)
  console.log('  🔗 Creating shared components...')
  const sharedComponents = await createWebsiteSharedComponents(
    prisma, 
    websiteId,
    await prisma.websiteComponentType.findMany({ where: { websiteId } })
  )
  
  // 4. WebsitePages (can now reference shared components)
  console.log('  📄 Creating website pages...')
  const contentTypesList = await prisma.contentType.findMany({ where: { websiteId } })
  const pages = await createWebsitePages(prisma, websiteId, contentTypesList, sharedComponents)
  
  // 5. WebsiteStructures (creates URL structure for pages)
  console.log('  🗂️ Creating website structures...')
  const structureCount = await createWebsiteStructures(prisma, websiteId, pages)
  
  // Note: Sample Websites moved to main seed script after Story 18.4 components
  
  const total = contentTypes + componentTypes + sharedComponents.length + 
                pages.length + structureCount
  
  console.log(`  ✅ Basic scenarios complete: ${total} test cases created`)
  
  return total
}
