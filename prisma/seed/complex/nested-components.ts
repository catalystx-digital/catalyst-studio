import { PrismaClient } from '../../../lib/generated/prisma'
import { ComponentGenerator } from '../utils/component-generator'

/**
 * Creates multi-level nested component structures
 * Tests deep component hierarchies and recursive structures
 */
export async function createNestedComponents(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const generator = new ComponentGenerator(prisma)
  let createdCount = 0
  
  // Test Case 1: 3-level nested structure
  console.log('    Creating 3-level nested structure...')
  const level3 = generator.generateNestedComponent(3)
  await generator.saveToDatabase(level3, websiteId)
  createdCount++
  
  // Test Case 2: 5-level nested structure
  console.log('    Creating 5-level nested structure...')
  const level5 = generator.generateNestedComponent(5)
  await generator.saveToDatabase(level5, websiteId)
  createdCount++
  
  // Test Case 3: 8-level nested structure
  console.log('    Creating 8-level nested structure...')
  const level8 = generator.generateNestedComponent(8)
  await generator.saveToDatabase(level8, websiteId)
  createdCount++
  
  // Test Case 4: 10-level nested structure (reduced from 20)
  console.log('    Creating 10-level nested structure...')
  const level10 = generator.generateNestedComponent(10)
  await generator.saveToDatabase(level10, websiteId)
  createdCount++
  
  // Test Case 5: Maximum 12-level nested structure (reduced from 25 for MVP)
  console.log('    Creating 12-level nested structure (max for MVP)...')
  const level12 = generator.generateNestedComponent(12)
  await generator.saveToDatabase(level12, websiteId)
  createdCount++
  
  // Test Case 6: Recursive component structure
  const recursive = generator.generateRecursiveComponent(5)
  await generator.saveToDatabase(recursive, websiteId)
  createdCount++
  
  // Test Case 7: Cross-referenced component network
  const network = generator.generateCrossReferencedNetwork(10)
  await generator.saveToDatabase(network, websiteId)
  createdCount += network.length
  
  return createdCount
}