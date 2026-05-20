import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates basic content items with no components
 * Tests simple content item creation and field population
 */
export async function createBasicContentItems(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const contentItems = []
  
  // First, get or create a simple content type for testing
  const contentType = await prisma.contentType.upsert({
    where: { 
      id: `${websiteId}-basic-content-type`
    },
    update: {},
    create: {
      id: `${websiteId}-basic-content-type`,
      key: 'basic_content',
      name: 'Basic Content',
      pluralName: 'Basic Contents',
      category: 'page',
      displayField: 'title',
      websiteId,
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'body', type: 'richtext', required: false, label: 'Body' },
        { name: 'tags', type: 'array', required: false, label: 'Tags' }
      ]
    }
  })
  
  // Test Case 1: Minimal content item
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Minimal Content Item',
      status: 'draft',
      content: {
        title: 'Minimal Content Item'
      }
    }
  }))
  
  // Test Case 2: Published content item
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Published Content',
      status: 'published',
      content: {
        title: 'Published Content',
        body: '<p>This is published content with rich text.</p>',
        tags: ['published', 'basic']
      },
      publishedAt: new Date(),
      metadata: {
        author: 'Test Author',
        version: 1
      }
    }
  }))
  
  // Test Case 3: Draft content item
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Draft Content',
      status: 'draft',
      content: {
        title: 'Draft Content',
        body: '<p>This content is still in draft.</p>',
        tags: ['draft', 'wip']
      }
    }
  }))
  
  // Test Case 4: Archived content item
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Archived Content',
      status: 'archived',
      content: {
        title: 'Archived Content',
        body: '<p>This content has been archived.</p>',
        tags: ['archived', 'old']
      },
      metadata: {
        archivedAt: new Date().toISOString(),
        reason: 'Outdated content'
      }
    }
  }))
  
  // Test Case 5: Content with empty fields
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Empty Fields Content',
      status: 'published',
      content: {
        title: 'Empty Fields Content',
        body: null,
        tags: []
      }
    }
  }))
  
  // Test Case 6: Content with special characters
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Special Characters: <>&"\'',
      status: 'published',
      content: {
        title: 'Special Characters: <>&"\'',
        body: '<p>Testing &lt;html&gt; entities &amp; "quotes" and \'apostrophes\'</p>',
        tags: ['special', 'characters', '&test']
      }
    }
  }))
  
  // Test Case 7: Content with Unicode
  contentItems.push(await prisma.websitePage.create({
    data: {
      contentTypeId: contentType.id,
      websiteId,
      type: 'page',
      title: 'Unicode Content 你好 مرحبا 🌍',
      status: 'published',
      content: {
        title: 'Unicode Content 你好 مرحبا 🌍',
        body: '<p>Testing Unicode: 日本語 한글 العربية emoji: 😀🎉🚀</p>',
        tags: ['unicode', 'international', '多语言']
      }
    }
  }))
  
  // Create site structure for some content items
  await createBasicSiteStructure(prisma, websiteId, contentItems)
  
  return contentItems.length
}

/**
 * Create basic site structure hierarchy
 */
async function createBasicSiteStructure(
  prisma: PrismaClient,
  websiteId: string,
  contentItems: any[]
) {
  // Create root-level structure
  const rootStructure = await prisma.websiteStructure.create({
    data: {
      websiteId,
      slug: 'home',
      fullPath: '/home',
      pathDepth: 0,
      position: 0,
      websitePageId: contentItems[0]?.id || null
    }
  })
  
  // Create nested folder structure
  const level1 = await prisma.websiteStructure.create({
    data: {
      websiteId,
      slug: 'products',
      parentId: rootStructure.id,
      fullPath: '/home/products',
      pathDepth: 1,
      position: 0,
      websitePageId: contentItems[1]?.id || null
    }
  })
  
  // Create deeper nested structure
  await prisma.websiteStructure.create({
    data: {
      websiteId,
      slug: 'featured',
      parentId: level1.id,
      fullPath: '/home/products/featured',
      pathDepth: 2,
      position: 0,
      websitePageId: contentItems[2]?.id || null
    }
  })
  
  // Create another branch
  await prisma.websiteStructure.create({
    data: {
      websiteId,
      slug: 'about',
      parentId: rootStructure.id,
      fullPath: '/home/about',
      pathDepth: 1,
      position: 1
    }
  })
}