/**
 * Page Creation Stage
 *
 * Handles page creation during import orchestration.
 *
 * @module page-creation-stage
 */

import type { DetectionResult } from '../interfaces/component-type-extractor.interface'
import type { ImportFailure } from '../interfaces/import-orchestrator.interface'
import { traceMemory } from '../../utils/memory-trace'
import { TemplateValidationError } from '@/lib/studio/pages/validation/template-validation'

export interface PageCreationInput {
  detectionResults: DetectionResult[]
  componentTypes: any[]
  websiteId: string
  contentTypeId: string
  failedPages: ImportFailure[]
  pageBuilderService: {
    createPagesInBatch: (inputs: any[]) => Promise<any[]>
  }
  batchSize: number
  processInChunks: <T, R>(
    data: T[],
    chunkSize: number,
    processor: (chunk: T[], chunkIndex: number) => Promise<R>,
    operationName: string,
    options?: {
      collectResults?: boolean
      concurrency?: number
      onChunk?: (result: R, chunk: T[], chunkIndex: number) => void | Promise<void>
    }
  ) => Promise<R[]>
  onProgress?: (message: string, progress: number, details?: Record<string, any>) => void
}

/**
 * Creates pages from detection results.
 */
export async function createPages(input: PageCreationInput): Promise<any[]> {
  const {
    detectionResults,
    componentTypes,
    websiteId,
    contentTypeId,
    failedPages,
    pageBuilderService,
    batchSize,
    processInChunks,
    onProgress
  } = input

  const createdPages: any[] = []

  const buildPageInput = (detection: DetectionResult) => ({
    pageData: {
      url: (detection as any).pageUrl || '/',
      title: (detection as any).pageTitle || 'Untitled',
      detectedComponents: [detection],
      pageTemplate: ((detection as any).metadata?.pageTemplate ?? undefined) as any
    },
    componentTypes,
    websiteId,
    contentTypeId
  })

  await processInChunks(
    detectionResults,
    batchSize,
    async (chunk, _chunkIndex) => {
      try {
        return await pageBuilderService.createPagesInBatch(chunk.map(buildPageInput))
      } catch (error) {
        console.warn('[PageCreationStage] Page batch failed; retrying individually', {
          error: error instanceof Error ? error.message : error,
          batchSize: chunk.length
        })
        traceMemory('page-creation:batch-retry', { batchSize: chunk.length })

        const fallbackPages: any[] = []
        for (const detection of chunk) {
          const pageUrl = (detection as any).pageUrl || 'unknown'
          try {
            const [page] = await pageBuilderService.createPagesInBatch([buildPageInput(detection)])
            if (page) {
              fallbackPages.push(page)
            }
          } catch (pageError) {
            const isTemplateValidationError = pageError instanceof TemplateValidationError
            const failure: ImportFailure = {
              pageUrl: isTemplateValidationError ? pageError.pageUrl : pageUrl,
              error: pageError instanceof Error ? pageError.message : String(pageError ?? 'Unknown error'),
              stage: isTemplateValidationError ? 'validation' : 'page-creation',
              metadata: {
                pageTitle: (detection as any).pageTitle,
                components: Array.isArray((detection as any).children) ? (detection as any).children.length : undefined,
                ...(isTemplateValidationError
                  ? {
                      templateKey: pageError.templateKey,
                      importIssues: pageError.issues
                    }
                  : {})
              }
            }
            failedPages.push(failure)
            traceMemory('page-creation:fallback-failed', { pageUrl })
            console.error('[PageCreationStage] Failed to create page after fallback', failure)
          }
        }

        return fallbackPages
      }
    },
    'page creation',
    {
      collectResults: false,
      concurrency: 1,
      onChunk: (result) => {
        if (Array.isArray(result) && result.length > 0) {
          createdPages.push(...result)
        }
      }
    }
  )

  // Check for fatal failures
  const fatalFailures = failedPages.filter(failure => failure.stage === 'page-creation')
  if (fatalFailures.length > 0) {
    const failedUrls = fatalFailures
      .map(entry => entry.pageUrl)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    const summary = failedUrls.length > 0 ? failedUrls.join(', ') : fatalFailures.length + ' pages'
    // Include first error cause for debugging visibility in workflow observability
    const firstError = fatalFailures[0]?.error
    const errorDetail = firstError ? ` [Cause: ${firstError}]` : ''
    throw new Error('Page creation failed for ' + summary + errorDetail)
  }

  // Handle validation failures
  const invalidPages = createdPages.filter(page => page && page.status === 'invalid')
  for (const page of invalidPages) {
    const rawMetadata = page?.metadata
    const metadata = rawMetadata && typeof rawMetadata === 'object' && rawMetadata !== null && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, any>)
      : {} as Record<string, any>
    const importIssues = Array.isArray(metadata.importIssues) ? metadata.importIssues : []
    const importSource = typeof metadata.importSource === 'string' ? metadata.importSource : undefined
    failedPages.push({
      pageUrl: importSource ?? page?.title ?? 'unknown',
      error: 'Template validation issues detected; manual fix required',
      stage: 'validation',
      metadata: {
        pageId: page.id,
        pageTitle: page.title,
        templateKey: page.templateKey,
        importStatus: metadata.importStatus ?? 'invalid',
        importIssues
      }
    })
  }

  // Report progress
  const nonValidationFailures = failedPages.filter(failure => failure.stage !== 'validation')
  const validationCount = failedPages.filter(failure => failure.stage === 'validation').length
  const progressDetails =
    validationCount > 0 || nonValidationFailures.length > 0
      ? {
          ...(nonValidationFailures.length > 0 ? { failedPages: nonValidationFailures.length } : {}),
          ...(validationCount > 0 ? { validationIssues: validationCount } : {})
        }
      : undefined

  const progressMessage =
    validationCount > 0
      ? `Created ${createdPages.length} pages (${validationCount} need fixes)`
      : `Created ${createdPages.length} pages`

  onProgress?.(progressMessage, 40, progressDetails)

  return Array.isArray(createdPages) ? createdPages : []
}

/**
 * Counts total components in page tree.
 */
export function countTotalComponents(pages: any[]): number {
  const countInTree = (components: any[]): number => {
    if (!components || components.length === 0) return 0
    let count = 0
    for (const comp of components) {
      count += 1
      if (comp.children && Array.isArray(comp.children)) {
        count += countInTree(comp.children)
      }
    }
    return count
  }

  let totalComponents = 0
  for (const page of pages) {
    if (page.content && typeof page.content === 'object') {
      const content = page.content as any
      if (content.components && Array.isArray(content.components)) {
        totalComponents += countInTree(content.components)
      }
    }
  }
  return totalComponents
}
