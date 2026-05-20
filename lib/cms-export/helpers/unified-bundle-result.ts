import type { UnifiedBundleSyncResult } from '@/lib/services/export/types'
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator'
import type { UniversalContentItem } from '@/lib/cms-export/types'

type FailureEntry = {
  item?: {
    id?: unknown
    contentTypeId?: unknown
    [key: string]: unknown
  } | UnifiedContent | null
  error: string
}

type BatchResult = {
  successful: UniversalContentItem[]
  failed: FailureEntry[]
}

const toIdentifier = (input: unknown): string => {
  if (input === null || input === undefined) {
    return 'unknown'
  }
  const value = typeof input === 'object' ? (input as { id?: unknown; contentGuid?: unknown; contentTypeId?: unknown }) : { id: input }
  const id = value.id ?? value.contentGuid ?? value.contentTypeId
  return String(id ?? 'unknown')
}

export const formatUnifiedBundleSyncResult = (
  providerId: string,
  result: BatchResult
): UnifiedBundleSyncResult => {
  const successDetails = result.successful.map(item => ({
    scope: 'content' as const,
    id: toIdentifier(item),
    action: 'created' as const,
    message: item.title ? `Synced ${item.title}` : undefined,
    providerId,
    payload: item
  }))

  const failureDetails = result.failed.map(entry => ({
    scope: 'content' as const,
    id: toIdentifier(entry.item ?? undefined),
    action: 'error' as const,
    message: entry.error,
    providerId,
    payload: entry.item ?? undefined
  }))

  return {
    successCount: result.successful.length,
    failureCount: result.failed.length,
    details: [...successDetails, ...failureDetails]
  }
}
