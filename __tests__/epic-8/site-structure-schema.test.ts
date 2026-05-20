import { PrismaClient } from '../../lib/generated/prisma'

const prisma = new PrismaClient()

describe('SiteStructure Schema Tests', () => {
  let websiteId: string
  let parentNodeId: string

  beforeAll(async () => {
    // Create a test website
    const website = await prisma.website.create({
      data: {
        name: 'Test Website',
        category: 'Test',
        description: 'Test website for schema validation'
      }
    })
    websiteId = website.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.siteStructure.deleteMany({
      where: { websiteId }
    })
    await prisma.website.delete({
      where: { id: websiteId }
    })
    await prisma.$disconnect()
  })

  describe('Schema Constraints', () => {
    test('should enforce unique slug at sibling level', async () => {
      // Create parent node
      const parent = await prisma.siteStructure.create({
        data: {
          websiteId,
          slug: 'parent',
          fullPath: '/parent',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })
      parentNodeId = parent.id

      // Create first child
      await prisma.siteStructure.create({
        data: {
          websiteId,
          parentId: parent.id,
          slug: 'child',
          fullPath: '/parent/child',
          pathDepth: 2,
          position: 0,
          weight: 0
        }
      })

      // Try to create duplicate slug at same level - should fail
      await expect(
        prisma.siteStructure.create({
          data: {
            websiteId,
            parentId: parent.id,
            slug: 'child', // Duplicate slug
            fullPath: '/parent/child-2',
            pathDepth: 2,
            position: 1,
            weight: 10
          }
        })
      ).rejects.toThrow()
    })

    test('should allow same slug at different levels', async () => {
      // Create node with slug 'about' at root level
      const rootAbout = await prisma.siteStructure.create({
        data: {
          websiteId,
          slug: 'about',
          fullPath: '/about',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })

      // Create node with slug 'about' under parent - should succeed
      const childAbout = await prisma.siteStructure.create({
        data: {
          websiteId,
          parentId: parentNodeId,
          slug: 'about',
          fullPath: '/parent/about',
          pathDepth: 2,
          position: 0,
          weight: 0
        }
      })

      expect(childAbout).toBeDefined()
      expect(childAbout.slug).toBe('about')
      
      // Clean up
      await prisma.siteStructure.delete({ where: { id: rootAbout.id } })
      await prisma.siteStructure.delete({ where: { id: childAbout.id } })
    })

    test('should handle self-referencing check at application level', async () => {
      const node = await prisma.siteStructure.create({
        data: {
          websiteId,
          slug: 'self-ref-test',
          fullPath: '/self-ref-test',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })

      // Note: Self-referencing prevention should be handled at application level
      // Database allows it but application code should validate
      const result = await prisma.siteStructure.update({
        where: { id: node.id },
        data: { parentId: node.id }
      })

      // Verify it was allowed at database level (needs app-level validation)
      expect(result.parentId).toBe(node.id)

      // Clean up
      await prisma.siteStructure.delete({ where: { id: node.id } })
    })
  })

  describe('Cascade Deletions', () => {
    test('should cascade delete children when parent is deleted', async () => {
      // Create parent
      const parent = await prisma.siteStructure.create({
        data: {
          websiteId,
          slug: 'cascade-parent',
          fullPath: '/cascade-parent',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })

      // Create children
      const child1 = await prisma.siteStructure.create({
        data: {
          websiteId,
          parentId: parent.id,
          slug: 'child1',
          fullPath: '/cascade-parent/child1',
          pathDepth: 2,
          position: 0,
          weight: 0
        }
      })

      const child2 = await prisma.siteStructure.create({
        data: {
          websiteId,
          parentId: parent.id,
          slug: 'child2',
          fullPath: '/cascade-parent/child2',
          pathDepth: 2,
          position: 1,
          weight: 10
        }
      })

      // Create grandchild
      const grandchild = await prisma.siteStructure.create({
        data: {
          websiteId,
          parentId: child1.id,
          slug: 'grandchild',
          fullPath: '/cascade-parent/child1/grandchild',
          pathDepth: 3,
          position: 0,
          weight: 0
        }
      })

      // Delete parent
      await prisma.siteStructure.delete({
        where: { id: parent.id }
      })

      // Verify children are deleted
      const remainingChildren = await prisma.siteStructure.findMany({
        where: {
          id: { in: [child1.id, child2.id, grandchild.id] }
        }
      })

      expect(remainingChildren).toHaveLength(0)
    })

    test('should cascade delete site structures when website is deleted', async () => {
      // Create test website
      const testWebsite = await prisma.website.create({
        data: {
          name: 'Cascade Test Website',
          category: 'Test',
          description: 'Test cascade deletion'
        }
      })

      // Create site structures
      await prisma.siteStructure.create({
        data: {
          websiteId: testWebsite.id,
          slug: 'test-page',
          fullPath: '/test-page',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })

      // Delete website
      await prisma.website.delete({
        where: { id: testWebsite.id }
      })

      // Verify site structures are deleted
      const remainingStructures = await prisma.siteStructure.findMany({
        where: { websiteId: testWebsite.id }
      })

      expect(remainingStructures).toHaveLength(0)
    })

    test('should set contentItemId to null when content item is deleted', async () => {
      // Create content type
      const contentType = await prisma.contentType.create({
        data: {
          websiteId,
          key: 'test-type',
          name: 'Test Type',
          pluralName: 'Test Types',
          fields: JSON.stringify([{ name: 'title', type: 'text' }]),
          category: 'page'
        }
      })

      // Create content item
      const contentItem = await prisma.contentItem.create({
        data: {
          websiteId,
          contentTypeId: contentType.id,
          title: 'Test Item',
          slug: 'test-item',
          content: JSON.stringify({ title: 'Test' })
        }
      })

      // Create site structure with content item
      const structure = await prisma.siteStructure.create({
        data: {
          websiteId,
          contentItemId: contentItem.id,
          slug: 'content-test',
          fullPath: '/content-test',
          pathDepth: 1,
          position: 0,
          weight: 0
        }
      })

      // Delete content item
      await prisma.contentItem.delete({
        where: { id: contentItem.id }
      })

      // Verify structure still exists with null contentItemId
      const updatedStructure = await prisma.siteStructure.findUnique({
        where: { id: structure.id }
      })

      expect(updatedStructure).toBeDefined()
      expect(updatedStructure?.contentItemId).toBeNull()

      // Clean up
      await prisma.siteStructure.delete({ where: { id: structure.id } })
      await prisma.contentType.delete({ where: { id: contentType.id } })
    })
  })

  describe('Performance Benchmarks', () => {
    let performanceWebsiteId: string
    let testStructures: any[] = []

    beforeAll(async () => {
      // Create test website for performance tests
      const website = await prisma.website.create({
        data: {
          name: 'Performance Test Website',
          category: 'Test',
          description: 'Performance benchmarks'
        }
      })
      performanceWebsiteId = website.id

      // Create test data hierarchy
      const root = await prisma.siteStructure.create({
        data: {
          websiteId: performanceWebsiteId,
          slug: 'home',
          fullPath: '/',
          pathDepth: 0,
          position: 0,
          weight: 0
        }
      })
      testStructures.push(root)

      // Create 4 levels deep hierarchy
      for (let i = 0; i < 3; i++) {
        const parent = await prisma.siteStructure.create({
          data: {
            websiteId: performanceWebsiteId,
            parentId: i === 0 ? root.id : testStructures[testStructures.length - 1].id,
            slug: `level-${i + 1}`,
            fullPath: `/${Array(i + 1).fill(0).map((_, idx) => `level-${idx + 1}`).join('/')}`,
            pathDepth: i + 1,
            position: 0,
            weight: 0
          }
        })
        testStructures.push(parent)
      }
    })

    afterAll(async () => {
      await prisma.siteStructure.deleteMany({
        where: { websiteId: performanceWebsiteId }
      })
      await prisma.website.delete({
        where: { id: performanceWebsiteId }
      })
    })

    test('URL resolution by fullPath should be < 10ms', async () => {
      const testPath = '/level-1/level-2/level-3'
      
      const startTime = performance.now()
      const result = await prisma.siteStructure.findFirst({
        where: {
          websiteId: performanceWebsiteId,
          fullPath: testPath
        }
      })
      const endTime = performance.now()
      
      const duration = endTime - startTime
      
      expect(result).toBeDefined()
      expect(duration).toBeLessThan(10)
    })

    test('Children query by parentId should be < 5ms', async () => {
      const parentId = testStructures[0].id
      
      const startTime = performance.now()
      const children = await prisma.siteStructure.findMany({
        where: {
          parentId: parentId
        }
      })
      const endTime = performance.now()
      
      const duration = endTime - startTime
      
      expect(children).toBeDefined()
      expect(duration).toBeLessThan(5)
    })

    test('Tree traversal (4 levels) should be < 20ms', async () => {
      const startTime = performance.now()
      
      // Traverse the tree using recursive queries
      const traverse = async (parentId: string | null, depth: number = 0): Promise<any[]> => {
        if (depth >= 4) return []
        
        const nodes = await prisma.siteStructure.findMany({
          where: {
            websiteId: performanceWebsiteId,
            parentId: parentId
          }
        })
        
        const results = []
        for (const node of nodes) {
          const children = await traverse(node.id, depth + 1)
          results.push({ ...node, children })
        }
        
        return results
      }
      
      const tree = await traverse(null)
      const endTime = performance.now()
      
      const duration = endTime - startTime
      
      expect(tree).toBeDefined()
      expect(duration).toBeLessThan(20)
    })
  })
})