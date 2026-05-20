/**
 * Tests for Import Planner Service
 */

import {
  ImportPlannerService,
  resetImportPlannerService,
} from '../service'
import type { ImportPlannerInput } from '../../../types/import-planner.types'

// Mock the llm-client module
jest.mock('../../llm-client', () => ({
  createLLMClient: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
  validateLLMApiKey: jest.fn((key: string) => key || 'test-key'),
}))

describe('ImportPlannerService', () => {
  let service: ImportPlannerService

  beforeEach(() => {
    resetImportPlannerService()
    service = new ImportPlannerService('test-api-key')
  })

  describe('Deterministic Planning', () => {
    it('should use sitemap strategy for root URL without request', async () => {
      const input: ImportPlannerInput = {
        url: 'https://example.com/',
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('sitemap')
      expect(plan.urls).toEqual(['https://example.com/'])
      expect(plan.followLinks).toBe(false)
      expect(plan.linkScope).toBe('none')
      expect(plan.reasoning).toContain('Root URL')
    })

    it('should use crawl_from_root for subsection URL', async () => {
      const input: ImportPlannerInput = {
        url: 'https://example.com/courses',
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('crawl_from_root')
      expect(plan.urls).toEqual(['https://example.com/courses'])
      expect(plan.followLinks).toBe(true)
      expect(plan.linkScope).toBe('same_path')
      expect(plan.reasoning).toContain('Subsection URL')
    })

    it('should use specific_urls for multiple URLs', async () => {
      const input: ImportPlannerInput = {
        urls: [
          'https://example.com/page1',
          'https://example.com/page2',
          'https://example.com/page3',
        ],
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('specific_urls')
      expect(plan.urls).toEqual([
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ])
      expect(plan.followLinks).toBe(true) // Default followSubpages is true
      expect(plan.reasoning).toContain('Multiple specific URLs')
    })

    it('should respect followSubpages=false', async () => {
      const input: ImportPlannerInput = {
        urls: [
          'https://example.com/page1',
          'https://example.com/page2',
        ],
        followSubpages: false,
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('specific_urls')
      expect(plan.followLinks).toBe(false)
      expect(plan.linkScope).toBe('none')
    })

    it('should handle root URL with trailing slash', async () => {
      const input: ImportPlannerInput = {
        url: 'https://example.com',
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('sitemap')
    })

    it('should handle single URL in urls array', async () => {
      const input: ImportPlannerInput = {
        urls: ['https://example.com/blog'],
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('crawl_from_root')
      expect(plan.urls).toEqual(['https://example.com/blog'])
    })

    it('should handle root URL in urls array', async () => {
      const input: ImportPlannerInput = {
        urls: ['https://example.com/'],
      }

      const plan = await service.planImport(input)

      expect(plan.strategy).toBe('sitemap')
    })
  })

  describe('Plan Properties', () => {
    it('should always include maxPages from config', async () => {
      const input: ImportPlannerInput = {
        url: 'https://example.com',
      }

      const plan = await service.planImport(input)

      expect(plan.maxPages).toBeGreaterThan(0)
    })

    it('should always include reasoning', async () => {
      const input: ImportPlannerInput = {
        url: 'https://example.com/courses',
      }

      const plan = await service.planImport(input)

      expect(plan.reasoning).toBeTruthy()
      expect(typeof plan.reasoning).toBe('string')
    })
  })
})
