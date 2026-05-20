import { PrismaClient } from '../../../lib/generated/prisma'
import { createComponentTypeData } from '../utils/component-type-helper'

/**
 * Creates invalid reference scenarios for validation testing
 * Tests error handling for malformed and missing references
 */
export async function createInvalidReferences(
  prisma: PrismaClient,
  websiteId: string
): Promise<void> {
  console.log('        ⚠️  Creating invalid reference test cases...')
  
  // Test Case 1: Orphaned components (not referenced by any content)
  const orphanedComponent = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'orphaned-component',
      category: 'edge-case-orphan',
      version: '1.0.0',
      props: {
        testCase: 'orphaned',
        isOrphan: true
      },
      content: {
        title: 'Orphaned Component',
        description: 'This component is not referenced by any content item',
        data: 'This should not appear in exports unless explicitly included'
      },
      aiMetadata: {
        detectionPatterns: ['orphan', 'unused'],
        confidence: 0.5
      },
      confidence: 0.5,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created orphaned component')
  
  // Test Case 2: Component with invalid references
  const invalidRefComponent = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'invalid-reference-component',
      category: 'edge-case-invalid',
      version: '1.0.0',
      props: {
        testCase: 'invalid-refs',
        hasInvalidRefs: true
      },
      content: {
        title: 'Component with Invalid References',
        invalidComponentRef: 'non-existent-component-id-12345',
        invalidContentRef: 'non-existent-content-id-67890',
        nullRef: null,
        undefinedRef: undefined,
        emptyRef: '',
        references: [
          { id: 'valid-ref-placeholder', type: 'component' },
          { id: 'invalid-ref-abc123', type: 'missing' },
          { id: null, type: 'null-ref' }
        ]
      },
      aiMetadata: {
        detectionPatterns: ['invalid', 'broken-ref'],
        confidence: 0.4
      },
      confidence: 0.4,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created component with invalid references')
  
  // Test Case 3: Content with malformed component data
  const contentType = await prisma.contentType.create({
    data: {
      key: 'malformed_content_type',
      name: 'Malformed Content Type',
      pluralName: 'Malformed Content Types',
      category: 'page',
      websiteId,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'component', type: 'component', required: false }
      ]
    }
  })
  
  const malformedContent = await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: "page",
      title: 'Content with Malformed Components',
      status: 'draft',
      content: {
        title: 'Malformed Component Data',
        component: {
          // Missing required fields for component
          type: null,
          props: 'invalid-props-should-be-object',
          content: undefined,
          // Extra unexpected fields
          unexpectedField: 'should-not-be-here',
          '': 'empty-key',
          'special-chars!@#': 'invalid-key-chars'
        }
      }
    }
  })
  
  console.log('        ✅ Created content with malformed component data')
  
  // Test Case 4: Empty and null scenarios
  const emptyComponent = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'empty-component',
      category: 'edge-case-empty',
      version: '1.0.0',
      props: {},
      content: {},
      aiMetadata: {},
      confidence: 0,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created empty component')
  
  // Test Case 5: Special characters and Unicode in references
  const specialCharComponent = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'special-char-component',
      category: 'edge-case-special',
      version: '1.0.0',
      props: {
        'key with spaces': 'value',
        'key-with-dashes': 'value',
        'key.with.dots': 'value',
        'key/with/slashes': 'value',
        'key\\with\\backslashes': 'value',
        '日本語キー': '値',
        '🔥emoji-key': '🎉value'
      },
      content: {
        title: 'Special Characters: <>&"\' \\ / \n \r \t',
        html: '<script>alert("xss")</script>',
        unicode: '你好世界 مرحبا بالعالم שלום עולם',
        emoji: '😀🎉🚀💻🔥',
        controlChars: 'Control chars test (safe)', // Removed null byte \u0000 - not supported by PostgreSQL
        references: [
          'ref-with-<brackets>',
          'ref-with-"quotes"',
          'ref-with-\'apostrophes\'',
          'ref-with-&ampersand'
        ]
      },
      aiMetadata: {
        detectionPatterns: ['special-chars', 'unicode'],
        confidence: 0.3
      },
      confidence: 0.3,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  console.log('        ✅ Created special character component')
}