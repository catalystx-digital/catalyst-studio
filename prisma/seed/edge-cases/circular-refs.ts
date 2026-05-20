import { PrismaClient } from '../../../lib/generated/prisma'
import { createComponentTypeData } from '../utils/component-type-helper'

/**
 * Creates circular reference scenarios for testing
 * These test cases ensure the export system can handle circular dependencies
 */
export async function createCircularReferences(
  prisma: PrismaClient,
  websiteId: string
): Promise<void> {
  console.log('🔄 Creating circular reference test cases...')
  
  // Case 1: Simple A → B → A circular reference
  const componentA = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'circular-component-a',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'simple-circular',
        referenceType: 'direct'
      },
      placeholderData: {
        title: 'Circular Component A',
        description: 'This component references B which references back to A',
        // We'll update this after creating B
        referencedComponentId: null
      },
      aiMetadata: {
        detectionPatterns: ['circular', 'edge-case'],
        testScenario: 'circular-reference',
        confidence: 0.95
      },
      confidence: 0.95,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  const componentB = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'circular-component-b',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'simple-circular',
        referenceType: 'direct'
      },
      placeholderData: {
        title: 'Circular Component B',
        description: 'This component references A creating a circular dependency',
        referencedComponentId: componentA.id // Reference back to A
      },
      aiMetadata: {
        detectionPatterns: ['circular', 'edge-case'],
        testScenario: 'circular-reference',
        confidence: 0.95
      },
      confidence: 0.95,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  // Update A to reference B
  await prisma.websiteComponentType.update({
    where: { id: componentA.id },
    data: {
      placeholderData: {
        title: 'Circular Component A',
        description: 'This component references B which references back to A',
        referencedComponentId: componentB.id
      }
    }
  })
  
  console.log('  ✅ Created simple A → B → A circular reference')
  
  // Case 2: Complex circular chain A → B → C → A
  const componentC = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'circular-component-c',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'chain-circular',
        chainLength: 3
      },
      placeholderData: {
        title: 'Circular Component C',
        description: 'Part of A → B → C → A chain'
      },
      aiMetadata: {
        detectionPatterns: ['circular-chain', 'edge-case'],
        confidence: 0.9
      },
      confidence: 0.9,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  const componentD = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'circular-component-d',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'chain-circular',
        chainLength: 3
      },
      placeholderData: {
        title: 'Circular Component D',
        description: 'Part of circular chain',
        next: componentC.id
      },
      aiMetadata: {
        detectionPatterns: ['circular-chain', 'edge-case'],
        confidence: 0.9
      },
      confidence: 0.9,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  const componentE = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'circular-component-e',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'chain-circular',
        chainLength: 3
      },
      placeholderData: {
        title: 'Circular Component E',
        description: 'Part of circular chain',
        next: componentD.id
      },
      aiMetadata: {
        detectionPatterns: ['circular-chain', 'edge-case'],
        confidence: 0.9
      },
      confidence: 0.9,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  // Complete the circle
  await prisma.websiteComponentType.update({
    where: { id: componentC.id },
    data: {
      placeholderData: {
        title: 'Circular Component C',
        description: 'Part of A → B → C → A chain',
        next: componentE.id // Completes the circle
      }
    }
  })
  
  console.log('  ✅ Created complex C → D → E → C circular chain')
  
  // Case 3: Self-referencing component
  const selfRef = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'self-referencing-component',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'self-reference',
        recursive: true
      },
      placeholderData: {
        title: 'Self-Referencing Component',
        description: 'This component references itself',
        children: [] // Will be updated
      },
      aiMetadata: {
        detectionPatterns: ['self-reference', 'recursive'],
        confidence: 0.85
      },
      confidence: 0.85,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  // Update to reference itself
  await prisma.websiteComponentType.update({
    where: { id: selfRef.id },
    data: {
      placeholderData: {
        title: 'Self-Referencing Component',
        description: 'This component references itself',
        selfReference: selfRef.id,
        children: [
          { type: 'reference', id: selfRef.id }
        ]
      }
    }
  })
  
  console.log('  ✅ Created self-referencing component')
  
  // Case 4: Content item with circular component references
  const circularContentType = await prisma.contentType.create({
    data: {
      key: 'circular_content_type',
      name: 'Circular Content Type',
      pluralName: 'Circular Content Types',
      category: 'page',
      displayField: 'title',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'primaryComponent', type: 'component', required: false },
        { name: 'secondaryComponent', type: 'component', required: false }
      ],
      websiteId
    }
  })
  
  const circularContent = await prisma.websitePage.create({
    data: {
      contentTypeId: circularContentType.id,
      websiteId,
      type: "page",
      title: 'Content with Circular Components',
      status: 'published',
      content: {
        title: 'Circular Component Test',
        primaryComponent: {
          id: componentA.id,
          type: 'reference'
        },
        secondaryComponent: {
          id: componentB.id,
          type: 'reference'
        },
        description: 'This content references components that reference each other'
      },
      metadata: {
        testCase: 'circular-content-components',
        edgeCase: true
      }
    }
  })
  
  console.log('  ✅ Created content item with circular component references')
  
  // Case 5: Nested circular references
  const nestedCircular1 = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'nested-circular-1',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'nested-circular',
        depth: 'parent'
      },
      placeholderData: {
        title: 'Nested Circular Parent',
        children: [] // Will be updated
      },
      aiMetadata: {
        detectionPatterns: ['nested-circular'],
        confidence: 0.8
      },
      confidence: 0.8,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  const nestedCircular2 = await prisma.websiteComponentType.create({
    data: createComponentTypeData({
      type: 'nested-circular-2',
      category: 'edge-case-circular',
      version: '1.0.0',
      props: {
        testCase: 'nested-circular',
        depth: 'child'
      },
      placeholderData: {
        title: 'Nested Circular Child',
        parent: nestedCircular1.id,
        children: [
          {
            type: 'component',
            data: {
              title: 'Deeply Nested',
              reference: nestedCircular1.id // Circular reference in nested structure
            }
          }
        ]
      },
      aiMetadata: {
        detectionPatterns: ['nested-circular'],
        confidence: 0.8
      },
      confidence: 0.8,
      websiteId,
      createdBy: 'edge-case-generator'
    })
  })
  
  // Update parent to include child
  await prisma.websiteComponentType.update({
    where: { id: nestedCircular1.id },
    data: {
      placeholderData: {
        title: 'Nested Circular Parent',
        children: [
          {
            type: 'component',
            id: nestedCircular2.id,
            data: {
              reference: 'child-component'
            }
          }
        ]
      }
    }
  })
  
  console.log('  ✅ Created nested circular references')
  
  // Case 6: Multi-level circular dependency web
  const webComponents = []
  for (let i = 0; i < 5; i++) {
    const component = await prisma.websiteComponentType.create({
      data: createComponentTypeData({
        type: `web-component-${i}`,
        category: 'edge-case-circular',
        version: '1.0.0',
        props: {
          testCase: 'dependency-web',
          nodeIndex: i
        },
        placeholderData: {
          title: `Web Component ${i}`,
          connections: [] // Will be updated
        },
        aiMetadata: {
          detectionPatterns: ['dependency-web'],
          confidence: 0.75
        },
        confidence: 0.75,
        websiteId,
        createdBy: 'edge-case-generator'
      })
    })
    webComponents.push(component)
  }
  
  // Create complex web of references
  for (let i = 0; i < webComponents.length; i++) {
    const connections = []
    // Each component references 2-3 others, including some circular paths
    connections.push(webComponents[(i + 1) % webComponents.length].id)
    connections.push(webComponents[(i + 2) % webComponents.length].id)
    if (i % 2 === 0) {
      connections.push(webComponents[(i + 3) % webComponents.length].id)
    }
    
    await prisma.websiteComponentType.update({
      where: { id: webComponents[i].id },
      data: {
        placeholderData: {
          title: `Web Component ${i}`,
          connections,
          description: `Connected to ${connections.length} other components`
        }
      }
    })
  }
  
  console.log('  ✅ Created dependency web with multiple circular paths')
  
  console.log('\n✨ All circular reference test cases created successfully')
}