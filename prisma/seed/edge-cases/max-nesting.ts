import { PrismaClient } from '../../../lib/generated/prisma'
import { createComponentTypeData } from '../utils/component-type-helper'

/**
 * Creates maximum nesting depth scenarios
 * Tests system limits and stack overflow prevention
 */
export async function createMaxNesting(
  prisma: PrismaClient,
  websiteId: string
): Promise<void> {
  console.log('        📊 Creating maximum nesting test cases...')
  
  // Test Case 1: Maximum array nesting
  const maxArrayNesting = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'max-array-nesting',
      category: 'edge-case-nesting',
      version: '1.0.0',
      props: {
        testCase: 'max-array-depth',
        maxSize: true
      },
      content: {
        title: 'Maximum Array Nesting',
        // Create deeply nested array structure
        data: createDeepArray(10)
      },
      aiMetadata: {
        detectionPatterns: ['max-nesting', 'array'],
        confidence: 0.7
      },
      confidence: 0.7,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created maximum array nesting')
  
  // Test Case 2: Maximum object nesting
  const maxObjectNesting = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'max-object-nesting',
      category: 'edge-case-nesting',
      version: '1.0.0',
      props: {
        testCase: 'max-object-depth'
      },
      content: {
        title: 'Maximum Object Nesting',
        nested: createDeepObject(25)
      },
      aiMetadata: {
        detectionPatterns: ['max-nesting', 'object'],
        confidence: 0.7
      },
      confidence: 0.7,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created maximum object nesting')
  
  // Test Case 3: Maximum string length
  const maxString = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'max-string-length',
      category: 'edge-case-size',
      version: '1.0.0',
      props: {
        testCase: 'max-string',
        stringLength: 65535
      },
      content: {
        title: 'Maximum String Length',
        longString: 'x'.repeat(65535), // Maximum text field size
        description: 'Testing maximum string length limits'
      },
      aiMetadata: {
        detectionPatterns: ['max-size', 'string'],
        confidence: 0.6
      },
      confidence: 0.6,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created maximum string length')
  
  // Test Case 4: Maximum array size
  const maxArraySize = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'max-array-size',
      category: 'edge-case-size',
      version: '1.0.0',
      props: {
        testCase: 'max-array-items',
        arraySize: 1000
      },
      content: {
        title: 'Maximum Array Size',
        items: new Array(1000).fill(null).map((_, i) => ({
          id: i,
          value: `Item ${i}`,
          data: Math.random()
        }))
      },
      aiMetadata: {
        detectionPatterns: ['max-size', 'array'],
        confidence: 0.6
      },
      confidence: 0.6,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created maximum array size')
}

// Helper function to create deeply nested array
function createDeepArray(depth: number): any {
  if (depth === 0) {
    return ['leaf-value']
  }
  return [createDeepArray(depth - 1)]
}

// Helper function to create deeply nested object
function createDeepObject(depth: number): any {
  if (depth === 0) {
    return { value: 'leaf', depth: 0 }
  }
  return {
    level: depth,
    nested: createDeepObject(depth - 1),
    metadata: {
      depth,
      timestamp: Date.now()
    }
  }
}