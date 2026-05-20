import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { getContentSource, updateContentSource, ContentSource } from '../content-source'
import { PrismaClient } from '@prisma/client'

// Mock Prisma client
const mockPrismaClient = {
  websitePage: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  websiteCustomContentData: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
}

// Mock console.log to verify performance logging
const originalConsoleLog = console.log
beforeEach(() => {
  console.log = jest.fn()
  jest.clearAllMocks()
})

afterEach(() => {
  console.log = originalConsoleLog
})

describe('Content Source Utility', () => {
  describe('getContentSource', () => {
    it('should return WebsitePage when found', async () => {
      const mockPageData = {
        id: 'page-123',
        content: { components: [], metadata: {} }
      }
      
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(mockPageData)
      mockPrismaClient.websiteCustomContentData.findUnique.mockResolvedValue(null)
      
      const result = await getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'page-123')
      
      expect(result).toEqual({
        content: mockPageData.content,
        type: 'page',
        model: 'websitePage',
        id: 'page-123'
      })
      
      expect(mockPrismaClient.websitePage.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-123' }
      })
      expect(mockPrismaClient.websiteCustomContentData.findUnique).not.toHaveBeenCalled()
      
      // Verify performance logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[PERF] Content lookup (WebsitePage)')
      )
    })

    it('should fall back to WebsiteCustomContentData when WebsitePage not found', async () => {
      const mockCustomData = {
        id: 'custom-456',
        data: { components: [], customField: 'value' }
      }
      
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(null)
      mockPrismaClient.websiteCustomContentData.findUnique.mockResolvedValue(mockCustomData)
      
      const result = await getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'custom-456')
      
      expect(result).toEqual({
        content: mockCustomData.data,
        type: 'custom',
        model: 'websiteCustomContentData',
        id: 'custom-456'
      })
      
      expect(mockPrismaClient.websitePage.findUnique).toHaveBeenCalledWith({
        where: { id: 'custom-456' }
      })
      expect(mockPrismaClient.websiteCustomContentData.findUnique).toHaveBeenCalledWith({
        where: { id: 'custom-456' }
      })
      
      // Verify performance logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[PERF] Content lookup (WebsiteCustomContentData)')
      )
    })

    it('should throw error when content not found in either model', async () => {
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(null)
      mockPrismaClient.websiteCustomContentData.findUnique.mockResolvedValue(null)
      
      await expect(
        getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'not-found')
      ).rejects.toThrow('Content item not found')
      
      expect(mockPrismaClient.websitePage.findUnique).toHaveBeenCalled()
      expect(mockPrismaClient.websiteCustomContentData.findUnique).toHaveBeenCalled()
    })

    it('should handle empty content gracefully', async () => {
      const mockPageData = {
        id: 'page-empty',
        content: {}
      }
      
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(mockPageData)
      
      const result = await getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'page-empty')
      
      expect(result).toEqual({
        content: {},
        type: 'page',
        model: 'websitePage',
        id: 'page-empty'
      })
    })

    it('should handle null content as empty object', async () => {
      const mockPageData = {
        id: 'page-null',
        content: null
      }
      
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(mockPageData)
      
      const result = await getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'page-null')
      
      expect(result.content).toEqual(null)
    })
  })

  describe('updateContentSource', () => {
    it('should update WebsitePage when source is page type', async () => {
      const source: ContentSource = {
        content: { components: [] },
        type: 'page',
        model: 'websitePage',
        id: 'page-123'
      }
      
      const updatedContent = {
        components: [{ id: 'comp-1', type: 'button' }],
        metadata: { updated: true }
      }
      
      await updateContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, source, updatedContent)
      
      expect(mockPrismaClient.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: { content: updatedContent }
      })
      
      expect(mockPrismaClient.websiteCustomContentData.update).not.toHaveBeenCalled()
      
      // Verify performance logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[PERF] Content update (websitePage)')
      )
    })

    it('should update WebsiteCustomContentData when source is custom type', async () => {
      const source: ContentSource = {
        content: { components: [] },
        type: 'custom',
        model: 'websiteCustomContentData',
        id: 'custom-456'
      }
      
      const updatedContent = {
        components: [{ id: 'comp-2', type: 'text' }],
        customField: 'updated'
      }
      
      await updateContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, source, updatedContent)
      
      expect(mockPrismaClient.websiteCustomContentData.update).toHaveBeenCalledWith({
        where: { id: 'custom-456' },
        data: { data: updatedContent }
      })
      
      expect(mockPrismaClient.websitePage.update).not.toHaveBeenCalled()
      
      // Verify performance logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[PERF] Content update (websiteCustomContentData)')
      )
    })

    it('should handle update errors gracefully', async () => {
      const source: ContentSource = {
        content: { components: [] },
        type: 'page',
        model: 'websitePage',
        id: 'page-error'
      }
      
      const updateError = new Error('Database update failed')
      mockPrismaClient.websitePage.update.mockRejectedValue(updateError)
      
      await expect(
        updateContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, source, { components: [] })
      ).rejects.toThrow('Database update failed')
      
      // Reset the mock after error test
      mockPrismaClient.websitePage.update.mockResolvedValue({})
    })

    it('should preserve existing content structure when updating', async () => {
      const source: ContentSource = {
        content: {
          components: [{ id: 'existing', type: 'div' }],
          metadata: { version: 1 }
        },
        type: 'page',
        model: 'websitePage',
        id: 'page-preserve'
      }
      
      const updatedContent = {
        ...source.content,
        components: [
          ...(source.content.components as unknown[]),
          { id: 'new', type: 'span' }
        ]
      }
      
      await updateContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, source, updatedContent)
      
      expect(mockPrismaClient.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-preserve' },
        data: { content: updatedContent }
      })
      
      // Verify the updated content has both components
      const callArgs = mockPrismaClient.websitePage.update.mock.calls[0][0]
      expect(callArgs.data.content.components).toHaveLength(2)
    })
  })

  describe('Performance Monitoring', () => {
    it('should log performance metrics for each operation', async () => {
      const mockPageData = {
        id: 'perf-test',
        content: { components: [] }
      }
      
      mockPrismaClient.websitePage.findUnique.mockResolvedValue(mockPageData)
      
      // Test read operation
      await getContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, 'perf-test')
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[PERF\] Content lookup .* \d+ms for ID: perf-test/)
      )
      
      // Test write operation
      const source: ContentSource = {
        content: mockPageData.content,
        type: 'page',
        model: 'websitePage',
        id: 'perf-test'
      }
      
      await updateContentSource(mockPrismaClient as Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">, source, { components: [] })
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[PERF\] Content update .* \d+ms for ID: perf-test/)
      )
    })
  })
})