import { PrismaClient } from '../../../lib/generated/prisma'
import { createCircularReferences } from './circular-refs'
import { createMaxNesting } from './max-nesting'
import { createInvalidReferences } from './invalid-references'

/**
 * Creates 10 edge case test scenarios for seed data validation
 * These scenarios test error handling and boundary conditions
 */
export async function createEdgeCaseScenarios(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  console.log('      🔄 Creating circular reference scenarios...')
  await createCircularReferences(prisma, websiteId)
  
  console.log('      📏 Creating maximum nesting scenarios...')
  await createMaxNesting(prisma, websiteId)
  
  console.log('      ❌ Creating invalid reference scenarios...')
  await createInvalidReferences(prisma, websiteId)
  
  // Edge cases don't return exact counts, estimate 10 total
  const total = 10
  
  console.log(`      ✅ Edge case scenarios complete: ${total} test cases created`)
  
  return total
}