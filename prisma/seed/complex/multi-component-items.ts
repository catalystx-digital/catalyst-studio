import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates content items with multiple component references
 * Tests complex content structures with mixed embedded and referenced components
 */
export async function createMultiComponentItems(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const items = []
  
  // Create a content type that supports multiple components
  const contentType = await prisma.contentType.upsert({
    where: {
      id: `${websiteId}-multi-component-type`
    },
    update: {},
    create: {
      id: `${websiteId}-multi-component-type`,
      key: 'multi_component_page',
      name: 'Multi Component Page',
      pluralName: 'Multi Component Pages',
      category: 'page',
      displayField: 'title',
      websiteId,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'hero', type: 'component', required: false },
        { name: 'sections', type: 'array', itemType: 'component', required: false },
        { name: 'sidebar', type: 'component', required: false },
        { name: 'relatedComponents', type: 'array', itemType: 'reference', required: false }
      ]
    }
  })
  
  // Create some components to reference
  const sharedComponents = []
  for (let i = 0; i < 5; i++) {
    sharedComponents.push(await prisma.websiteComponentType.create({
      data: {
        type: `shared-component-${i}`,
        category: 'content',
        version: '1.0.0',
        defaultConfig: { shared: true, index: i },  // Updated field name
        placeholderData: {  // Updated field name
          title: `Shared Component ${i}`,
          data: `Shared data ${i}`
        },
        aiMetadata: {
          detectionPatterns: ['shared'],
          confidence: 0.85
        },
        confidence: 0.85,
        websiteId,
        createdBy: 'multi-component-seed'
      }
    }))
  }
  
  // Test Case 1: Page with 10+ component references
  items.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',  // Add required type field
      title: 'Page with Many Components',
      status: 'published',
      content: {
        title: 'Page with Many Components',
        hero: {
          type: 'embedded',
          data: {
            type: 'hero',
            content: {
              title: 'Hero Section',
              subtitle: 'With embedded component'
            }
          }
        },
        sections: [
          {
            type: 'embedded',
            data: {
              type: 'section',
              content: { title: 'Section 1' }
            }
          },
          {
            type: 'reference',
            id: sharedComponents[0].id
          },
          {
            type: 'embedded',
            data: {
              type: 'section',
              content: { title: 'Section 3' }
            }
          },
          {
            type: 'reference',
            id: sharedComponents[1].id
          },
          {
            type: 'embedded',
            data: {
              type: 'gallery',
              content: {
                images: ['/img1.jpg', '/img2.jpg', '/img3.jpg']
              }
            }
          }
        ],
        sidebar: {
          type: 'reference',
          id: sharedComponents[2].id
        },
        relatedComponents: sharedComponents.map(c => c.id)
      }
    }
  }))
  
  // Test Case 2: Content with nested component structures
  items.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',  // Add required type field
      title: 'Nested Component Content',
      status: 'published',
      content: {
        title: 'Nested Component Content',
        hero: {
          type: 'embedded',
          data: {
            type: 'hero-with-cards',
            content: {
              title: 'Main Hero',
              cards: [
                {
                  type: 'card',
                  content: {
                    title: 'Card 1',
                    button: {
                      type: 'button',
                      content: { label: 'Click' }
                    }
                  }
                },
                {
                  type: 'card',
                  content: {
                    title: 'Card 2',
                    list: {
                      type: 'list',
                      content: {
                        items: ['Item 1', 'Item 2', 'Item 3']
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  }))
  
  // Test Case 3: Content with mixed global and local components
  items.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',  // Add required type field
      title: 'Mixed Component Types',
      status: 'published',
      content: {
        title: 'Mixed Component Types',
        hero: {
          type: 'global-reference',
          globalId: 'global-hero-component'
        },
        sections: [
          {
            type: 'local',
            data: {
              type: 'local-section',
              props: { isGlobal: false },
              content: { title: 'Local Section' }
            }
          },
          {
            type: 'global',
            data: {
              type: 'global-section',
              props: { isGlobal: true },
              content: { title: 'Global Section' }
            }
          }
        ]
      }
    }
  }))
  
  // Test Case 4: Content with component arrays
  const componentArray = []
  for (let i = 0; i < 20; i++) {
    componentArray.push({
      type: 'array-item',
      index: i,
      content: {
        title: `Array Item ${i}`,
        value: Math.random()
      }
    })
  }
  
  items.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',  // Add required type field
      title: 'Component Array Content',
      status: 'published',
      content: {
        title: 'Component Array Content',
        sections: componentArray
      }
    }
  }))
  
  return items.length
}