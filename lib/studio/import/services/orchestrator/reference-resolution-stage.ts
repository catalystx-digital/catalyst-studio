/**
 * Reference Resolution Stage
 *
 * Post-processing stage that resolves URL references to content references
 * and syncs them to the ContentReference junction table.
 *
 * @module reference-resolution-stage
 */

import { resolveImportedReferences } from '../reference-resolver'
import { contentReferenceSyncService } from '@/lib/services/content-reference/sync-service'

export interface ReferenceResolutionInput {
  websiteId: string
  onProgress?: (message: string, progress: number, details?: Record<string, any>) => void
}

/**
 * Resolves all references and syncs to ContentReference table
 */
export async function resolveReferencesStage(input: ReferenceResolutionInput): Promise<{
  mediaReferencesResolved: number
  pageReferencesResolved: number
  externalLinksPreserved: number
  contentReferencesSynced: number
}> {
  const { websiteId, onProgress } = input

  onProgress?.('Resolving media and page references', 0)

  // Step 1: Resolve URL references to content references
  const resolutionResult = await resolveImportedReferences(websiteId)

  onProgress?.(
    `Resolved ${resolutionResult.mediaReferencesResolved} media refs, ${resolutionResult.pageReferencesResolved} page refs`,
    50,
    { resolutionResult }
  )

  // Step 2: Sync all references to ContentReference junction table
  const syncResult = await contentReferenceSyncService.syncAllPagesInWebsite(websiteId)

  onProgress?.(
    `Synced ${syncResult.referencesCreated} content references across ${syncResult.pagesProcessed} pages`,
    100,
    { syncResult }
  )

  return {
    ...resolutionResult,
    contentReferencesSynced: syncResult.referencesCreated
  }
}
