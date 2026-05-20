import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock the prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn()
  }
}))

// Get prisma from the mock for TypeScript
import { prisma } from '@/lib/prisma'

describe('/api/studio/site-builder/components/reorder', () => {
  const mockTransaction = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTransaction))
  })

  describe('POST - Reorder Components', () => {
    it('should successfully reorder component within same parent', async () => {
      const mockComponents = [
        { id: 'comp1', parentId: null, position: 0, type: 'hero' },
        { id: 'comp2', parentId: null, position: 1, type: 'section' },
        { id: 'comp3', parentId: null, position: 2, type: 'footer' }
      ]

      const mockWebsitePage = {
        id: 'page-123',
        content: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage),
        update: jest.fn().mockResolvedValue({ ...mockWebsitePage })
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp1',
          newParentId: null,
          newPosition: 2,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.updatedStructure).toBeDefined()
      
      // Verify the update was called with repositioned components
      expect(mockTransaction.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: {
          content: expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ id: 'comp1', position: 2 }),
              expect.objectContaining({ id: 'comp2', position: 0 }),
              expect.objectContaining({ id: 'comp3', position: 1 })
            ])
          })
        }
      })
    })

    it('should successfully reorder component to different parent', async () => {
      const mockComponents = [
        { id: 'parent1', parentId: null, position: 0, type: 'section' },
        { id: 'parent2', parentId: null, position: 1, type: 'section' },
        { id: 'child1', parentId: 'parent1', position: 0, type: 'text' }
      ]

      const mockWebsitePage = {
        id: 'page-123',
        content: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage),
        update: jest.fn().mockResolvedValue({ ...mockWebsitePage })
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'child1',
          newParentId: 'parent2',
          newPosition: 0,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Verify the child was moved to the new parent
      expect(mockTransaction.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: {
          content: expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ id: 'child1', parentId: 'parent2', position: 0 })
            ])
          })
        }
      })
    })

    it('should prevent circular dependencies', async () => {
      const mockComponents = [
        { id: 'parent', parentId: null, position: 0, type: 'section' },
        { id: 'child', parentId: 'parent', position: 0, type: 'section' },
        { id: 'grandchild', parentId: 'child', position: 0, type: 'text' }
      ]

      const mockWebsitePage = {
        id: 'page-123',
        content: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage),
        update: jest.fn()
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'parent',
          newParentId: 'grandchild', // Trying to make parent a child of its descendant
          newPosition: 0,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Cannot move component into its own descendant')
      expect(mockTransaction.websitePage.update).not.toHaveBeenCalled()
    })

    it('should enforce maximum nesting depth of 5', async () => {
      // Create a structure with 4 levels already
      const mockComponents = [
        { id: 'level1', parentId: null, position: 0, type: 'section' },
        { id: 'level2', parentId: 'level1', position: 0, type: 'section' },
        { id: 'level3', parentId: 'level2', position: 0, type: 'section' },
        { id: 'level4', parentId: 'level3', position: 0, type: 'section' },
        { id: 'level5', parentId: 'level4', position: 0, type: 'section' },
        { id: 'moveMe', parentId: null, position: 1, type: 'section' },
        { id: 'moveChild', parentId: 'moveMe', position: 0, type: 'text' } // Has a child
      ]

      const mockWebsitePage = {
        id: 'page-123',
        content: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage),
        update: jest.fn()
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'moveMe',
          newParentId: 'level5', // Would exceed max depth with its child
          newPosition: 0,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Maximum nesting depth of 5 would be exceeded')
      expect(mockTransaction.websitePage.update).not.toHaveBeenCalled()
    })

    it('should handle WebsiteCustomContentData fallback', async () => {
      const mockComponents = [
        { id: 'comp1', parentId: null, position: 0, type: 'widget' },
        { id: 'comp2', parentId: null, position: 1, type: 'widget' }
      ]

      const mockCustomData = {
        id: 'custom-123',
        data: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(null)
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(mockCustomData),
        update: jest.fn().mockResolvedValue({ ...mockCustomData })
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp1',
          newParentId: null,
          newPosition: 1,
          contentItemId: 'custom-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Verify WebsiteCustomContentData was updated
      expect(mockTransaction.websiteCustomContentData.update).toHaveBeenCalledWith({
        where: { id: 'custom-123' },
        data: {
          data: expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ id: 'comp1', position: 1 }),
              expect.objectContaining({ id: 'comp2', position: 0 })
            ])
          })
        }
      })
    })

    it('should return 404 when content item not found', async () => {
      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(null)
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp1',
          newParentId: null,
          newPosition: 0,
          contentItemId: 'non-existent'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should return 404 when component not found', async () => {
      const mockWebsitePage = {
        id: 'page-123',
        content: { 
          components: [
            { id: 'comp1', parentId: null, position: 0, type: 'section' }
          ] 
        }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage)
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'non-existent',
          newParentId: null,
          newPosition: 0,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('Component not found')
    })

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          componentId: 'comp1'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid request data')
      expect(data.details).toBeDefined()
    })

    it('should handle complex reordering scenarios', async () => {
      const mockComponents = [
        { id: 'parent', parentId: null, position: 0, type: 'section' },
        { id: 'child1', parentId: 'parent', position: 0, type: 'text' },
        { id: 'child2', parentId: 'parent', position: 1, type: 'text' },
        { id: 'child3', parentId: 'parent', position: 2, type: 'text' },
        { id: 'child4', parentId: 'parent', position: 3, type: 'text' }
      ]

      const mockWebsitePage = {
        id: 'page-123',
        content: { components: mockComponents }
      }

      mockTransaction.websitePage = {
        findUnique: jest.fn().mockResolvedValue(mockWebsitePage),
        update: jest.fn().mockResolvedValue({ ...mockWebsitePage })
      }
      mockTransaction.websiteCustomContentData = {
        findUnique: jest.fn().mockResolvedValue(null)
      }

      // Move child4 to position 1 (between child1 and child2)
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/reorder', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'child4',
          newParentId: 'parent',
          newPosition: 1,
          contentItemId: 'page-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Verify positions were correctly adjusted
      const updateCall = (mockTransaction.websitePage.update as jest.Mock).mock.calls[0][0]
      const updatedComponents = updateCall.data.content.components
      
      const getPosition = (id: string) => 
        updatedComponents.find((c: Record<string, unknown>) => c.id === id)?.position

      expect(getPosition('child1')).toBe(0)
      expect(getPosition('child4')).toBe(1)
      expect(getPosition('child2')).toBe(2)
      expect(getPosition('child3')).toBe(3)
    })
  })
})