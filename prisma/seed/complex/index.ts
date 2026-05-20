import { PrismaClient } from '../../../lib/generated/prisma'
import { createNestedComponents } from './nested-components'
import { createMultiComponentItems } from './multi-component-items'
import { createLargeCollections } from './large-collections'

/**
 * Creates 15 complex test scenarios for seed data validation
 * These scenarios test sophisticated functionality and relationships
 */
export async function createComplexScenarios(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  console.log('    🔄 Creating nested component structures...')
  const nestedCount = await createNestedComponents(prisma, websiteId)
  
  console.log('    🎨 Creating multi-component content items...')
  const multiCount = await createMultiComponentItems(prisma, websiteId)
  
  console.log('    📚 Creating large collections...')
  const largeCount = await createLargeCollections(prisma, websiteId)
  
  const total = nestedCount + multiCount + largeCount
  
  console.log(`    ✅ Complex scenarios complete: ${total} test cases created`)
  
  return total
}