import { createPages } from '../page-creation-stage'
import { PageBuilderService } from '../../page-builder-service'
import { TemplateValidationError } from '@/lib/studio/pages/validation/template-validation'
import { PrismaClient } from '@/lib/generated/prisma'
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog'
import { mockDeep } from 'jest-mock-extended'

jest.mock('@/lib/studio/pages/catalog', () => ({
  getPageCatalogSummary: jest.fn()
}))

const processInChunks = async <T, R>(
  data: T[],
  chunkSize: number,
  processor: (chunk: T[], chunkIndex: number) => Promise<R>,
  _operationName: string,
  options?: {
    collectResults?: boolean
    concurrency?: number
    onChunk?: (result: R, chunk: T[], chunkIndex: number) => void | Promise<void>
  }
): Promise<R[]> => {
  const results: R[] = []
  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.slice(index, index + chunkSize)
    const result = await processor(chunk, index / chunkSize)
    results.push(result)
    await options?.onChunk?.(result, chunk, index / chunkSize)
  }
  return results
}

describe('page creation stage', () => {
  const detection = {
    id: 'page-1',
    type: 'page',
    pageUrl: 'https://example.com/broken',
    pageTitle: 'Broken Page',
    bounds: { x: 0, y: 0, width: 1200, height: 800 },
    children: []
  }

  it('classifies TemplateValidationError fallback failures as validation failures with details', async () => {
    const failedPages: any[] = []
    const validationError = new TemplateValidationError({
      pageUrl: 'https://example.com/broken',
      templateKey: 'core/generic-default',
      issues: [
        {
          type: 'region',
          code: 'region.min',
          message: 'Region "main" requires at least 1 component(s); found 0.',
          severity: 'error'
        }
      ]
    })

    const pageBuilderService = {
      createPagesInBatch: jest.fn().mockRejectedValue(validationError)
    }

    const pages = await createPages({
      detectionResults: [detection as any],
      componentTypes: [],
      websiteId: 'website-1',
      contentTypeId: 'content-type-1',
      failedPages,
      pageBuilderService,
      batchSize: 10,
      processInChunks,
      onProgress: jest.fn()
    })

    expect(pages).toEqual([])
    expect(failedPages).toEqual([
      expect.objectContaining({
        pageUrl: 'https://example.com/broken',
        stage: 'validation',
        error: validationError.message,
        metadata: expect.objectContaining({
          pageTitle: 'Broken Page',
          templateKey: 'core/generic-default',
          importIssues: validationError.issues
        })
      })
    ])
  })

  it('classifies real required region coverage failures from PageBuilderService as validation failures', async () => {
    const failedPages: any[] = []
    const prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma))
    prisma.websitePage.findFirst.mockResolvedValue(null)

    ;(getPageCatalogSummary as jest.Mock).mockResolvedValue({
      total: 1,
      generatedAt: new Date().toISOString(),
      templates: [
        {
          templateKey: 'core/generic-default',
          name: 'Generic Content Page',
          category: 'core',
          isHomeEligible: false,
          description: 'Generic fallback template',
          requiredRegions: [
            {
              region: 'main',
              allowedComponents: ['text-block'],
              min: 1
            }
          ],
          optionalRegions: [
            {
              region: 'hero',
              allowedComponents: ['hero-banner']
            }
          ],
          contentSchema: {
            components: {
              type: 'component-list',
              required: true,
              allowedComponentTypes: ['hero-banner', 'text-block']
            }
          },
          propsMeta: undefined,
          aiMetadata: {
            keywords: ['generic'],
            layoutGuidelines: [],
            contentGuidelines: [],
            recommendedComponents: [],
            discouragedComponents: [],
            exampleUseCases: [],
            routeHints: ['/generic']
          }
        }
      ],
      categories: [],
      homeEligibleTemplates: []
    })

    const pageBuilderService = new PageBuilderService(prisma)
    pageBuilderService.configureContentTypes({
      defaultContentTypeId: 'content-type-1',
      templateContentTypes: new Map()
    })

    await createPages({
      detectionResults: [
        {
          ...detection,
          metadata: {
            pageTemplate: {
              templateKey: 'core/generic-default'
            }
          },
          children: [
            {
              id: 'hero-1',
              type: 'hero-banner',
              bounds: { x: 0, y: 0, width: 1200, height: 500 },
              content: JSON.stringify({ heading: 'Welcome', region: 'hero' }),
              metadata: { region: 'hero' }
            }
          ]
        } as any
      ],
      componentTypes: [
        {
          id: 'hero-type-1',
          type: 'hero-banner',
          category: 'layout',
          name: 'Hero Banner',
          description: 'Hero section',
          defaultConfig: { props: {}, styles: {}, responsive: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.95,
            modelVersion: 'test',
            detectionTimestamp: '2025-01-01T00:00:00Z',
            patternCount: 1
          },
          patterns: []
        },
        {
          id: 'text-type-1',
          type: 'text-block',
          category: 'content',
          name: 'Text Block',
          description: 'Text content',
          defaultConfig: { props: {}, styles: {}, responsive: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.95,
            modelVersion: 'test',
            detectionTimestamp: '2025-01-01T00:00:00Z',
            patternCount: 1
          },
          patterns: []
        }
      ],
      websiteId: 'website-1',
      contentTypeId: 'content-type-1',
      failedPages,
      pageBuilderService,
      batchSize: 10,
      processInChunks
    })

    expect(failedPages).toEqual([
      expect.objectContaining({
        pageUrl: 'https://example.com/broken',
        stage: 'validation',
        error: expect.stringContaining('region.min: Region "main" requires at least 1 component(s); found 0.'),
        metadata: expect.objectContaining({
          templateKey: 'core/generic-default',
          importIssues: [
            expect.objectContaining({
              code: 'region.min',
              severity: 'error',
              details: expect.objectContaining({
                region: 'main',
                currentCount: 0,
                minRequired: 1
              })
            })
          ]
        })
      })
    ])
    expect(prisma.websitePage.create).not.toHaveBeenCalled()
  })

  it('keeps generic fallback failures in page-creation and throws fatal summary', async () => {
    const failedPages: any[] = []
    const pageBuilderService = {
      createPagesInBatch: jest.fn().mockRejectedValue(new Error('database write failed'))
    }

    await expect(createPages({
      detectionResults: [detection as any],
      componentTypes: [],
      websiteId: 'website-1',
      contentTypeId: 'content-type-1',
      failedPages,
      pageBuilderService,
      batchSize: 10,
      processInChunks
    })).rejects.toThrow('Page creation failed for https://example.com/broken [Cause: database write failed]')

    expect(failedPages).toEqual([
      expect.objectContaining({
        pageUrl: 'https://example.com/broken',
        stage: 'page-creation',
        error: 'database write failed'
      })
    ])
  })
})
