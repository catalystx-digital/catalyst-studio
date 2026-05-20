'use client'

import { useState, useCallback } from 'react'

interface PageInfo {
  pageId: string
  title: string
  importSource: string
  lastReimportedAt?: string
  sourceNotFoundAt?: string
}

interface ReImportResult {
  url: string
  status: string
  pageId?: string
  error?: string
  changes?: {
    componentsAdded: number
    componentsRemoved: number
    componentsUpdated: number
  }
}

interface ReImportSummary {
  updated: number
  created: number
  unchanged: number
  sourceNotFound: number
  failed: number
  skipped: number
  totalComponentsAdded: number
  totalComponentsRemoved: number
}

interface ReImportResponse {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  results: ReImportResult[]
  summary: ReImportSummary
  warnings: string[]
  processingTimeMs: number
}

interface UsePageReImportOptions {
  onSuccess?: (response: ReImportResponse) => void
  onError?: (error: Error) => void
}

interface UsePageReImportReturn {
  /** Whether re-import is in progress */
  isLoading: boolean
  /** Error from last re-import attempt */
  error: Error | null
  /** Results from last re-import */
  results: ReImportResponse | null
  /** Re-import a single page */
  reimportPage: (websiteId: string, page: PageInfo, options?: ReImportOptions) => Promise<ReImportResponse>
  /** Re-import multiple pages */
  reimportPages: (websiteId: string, pages: PageInfo[], options?: ReImportOptions) => Promise<ReImportResponse>
  /** Fetch re-importable pages for a website */
  fetchReimportablePages: (websiteId: string) => Promise<PageInfo[]>
  /** Check if a page can be re-imported */
  canReimport: (page: PageInfo) => boolean
  /** Reset state */
  reset: () => void
}

interface ReImportOptions {
  preserveCustomizations?: boolean
  skipDesignSystem?: boolean
  skipSharedComponents?: boolean
  createIfNotExists?: boolean
}

/**
 * Hook for handling page re-import functionality in the Site Builder
 */
export function usePageReImport(options: UsePageReImportOptions = {}): UsePageReImportReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [results, setResults] = useState<ReImportResponse | null>(null)

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setResults(null)
  }, [])

  const reimportPages = useCallback(async (
    websiteId: string,
    pages: PageInfo[],
    reimportOptions: ReImportOptions = {}
  ): Promise<ReImportResponse> => {
    if (pages.length === 0) {
      throw new Error('No pages to re-import')
    }

    setIsLoading(true)
    setError(null)

    try {
      const urls = pages.map(p => p.importSource).filter(Boolean)

      if (urls.length === 0) {
        throw new Error('No valid import sources found for selected pages')
      }

      const response = await fetch('/api/studio/import/reimport', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteId,
          urls,
          options: {
            preserveCustomizations: reimportOptions.preserveCustomizations ?? false,
            skipDesignSystem: reimportOptions.skipDesignSystem ?? true,
            skipSharedComponents: reimportOptions.skipSharedComponents ?? false,
            createIfNotExists: reimportOptions.createIfNotExists ?? true
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Re-import failed with status ${response.status}`)
      }

      const data: ReImportResponse = await response.json()
      setResults(data)
      options.onSuccess?.(data)
      return data

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Re-import failed')
      setError(error)
      options.onError?.(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [options])

  const reimportPage = useCallback(async (
    websiteId: string,
    page: PageInfo,
    reimportOptions?: ReImportOptions
  ): Promise<ReImportResponse> => {
    return reimportPages(websiteId, [page], reimportOptions)
  }, [reimportPages])

  const fetchReimportablePages = useCallback(async (websiteId: string): Promise<PageInfo[]> => {
    const response = await fetch(`/api/studio/import/reimport?websiteId=${websiteId}`)

    if (!response.ok) {
      throw new Error('Failed to fetch reimportable pages')
    }

    const data = await response.json()
    return data.pages.map((page: any) => ({
      pageId: page.pageId,
      title: page.title,
      importSource: page.importSource,
      lastReimportedAt: page.lastReimportedAt,
      sourceNotFoundAt: page.sourceNotFoundAt
    }))
  }, [])

  const canReimport = useCallback((page: PageInfo): boolean => {
    // Page must have an import source to be re-importable
    return !!page.importSource
  }, [])

  return {
    isLoading,
    error,
    results,
    reimportPage,
    reimportPages,
    fetchReimportablePages,
    canReimport,
    reset
  }
}

export type { PageInfo, ReImportResponse, ReImportResult, ReImportSummary, ReImportOptions }
