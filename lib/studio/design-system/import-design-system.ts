/**
 * Shared Design System Import Function
 *
 * This module provides a unified interface for importing design systems from URLs.
 * It orchestrates DOM probe capture, design system processing, and concept creation.
 *
 * Used by:
 * - Import pipeline (during full website import)
 * - Standalone design system import (without content import)
 *
 * @module import-design-system
 */

import { PrismaClient } from '@/lib/generated/prisma'
import {
  DomProbeService,
  type CaptureDesignSystemParams,
  type CaptureDesignSystemResult,
} from '@/lib/studio/design-system/dom-probe/service'
import {
  DesignSystemService,
  type DesignSystemProcessingResult,
} from '@/lib/studio/import/services/design-system-service'
import { DesignConceptRepository } from '@/lib/studio/design-system/design-concept.repository'
import type { ProgressCallback } from '@/lib/studio/import/types/progress.types'
import { getDomProbeBaselineKey, isDomProbeEnabledForWebsite } from '@/lib/studio/import/utils/dom-probe-flags'

/**
 * Options for importing a design system from a URL
 */
export interface ImportDesignSystemOptions {
  /** URL to probe for design system extraction */
  url: string
  /** Website ID to associate the design system with */
  websiteId: string
  /** Optional custom name for the design concept (auto-generated if not provided) */
  conceptName?: string
  /** Pre-captured DOM probe result (skips DOM probe if provided) */
  existingProbeCapture?: CaptureDesignSystemResult
  /** Progress callback for reporting extraction progress */
  onProgress?: ProgressCallback
  /** Import job ID for telemetry and linking */
  jobId?: string
  /**
   * Use the new simplified shadcn-based storage format.
   * When true, stores { variables: {...}, extraction: {...} } instead of the
   * complex legacy format with palette, typography, spacing objects.
   *
   * Default: true (new imports use new format)
   */
  useNewFormat?: boolean
}

/**
 * Result of importing a design system
 */
export interface ImportDesignSystemResult extends DesignSystemProcessingResult {
  /** ID of the created/used design concept */
  conceptId: string
  /** Name of the created/used design concept */
  conceptName: string
}

/**
 * Dependencies for the import function (for testability and reuse)
 */
export interface ImportDesignSystemDependencies {
  prisma?: PrismaClient
  domProbeService?: DomProbeService
  designSystemService?: DesignSystemService
  conceptRepository?: DesignConceptRepository
}

/**
 * Error thrown when design system import fails
 */
export class ImportDesignSystemError extends Error {
  constructor(
    message: string,
    public readonly code: ImportDesignSystemErrorCode,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'ImportDesignSystemError'
  }
}

/**
 * Error codes for import failures
 */
export type ImportDesignSystemErrorCode =
  | 'DOM_PROBE_DISABLED'
  | 'DOM_PROBE_FAILED'
  | 'DESIGN_SYSTEM_PROCESSING_FAILED'
  | 'CONCEPT_CREATION_FAILED'
  | 'INVALID_URL'
  | 'UNKNOWN'

/**
 * Import a design system from a URL
 *
 * This is the primary entry point for design system extraction. It handles:
 * 1. DOM probe capture (if not provided via existingProbeCapture)
 * 2. Design concept creation or lookup
 * 3. Design system processing and persistence
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await importDesignSystemFromUrl({
 *   url: 'https://example.com',
 *   websiteId: 'ws_123',
 * })
 *
 * // With existing probe capture (avoids duplicate DOM probe)
 * const result = await importDesignSystemFromUrl({
 *   url: 'https://example.com',
 *   websiteId: 'ws_123',
 *   existingProbeCapture: captureFromPipeline,
 *   conceptName: 'Brand V2',
 * })
 * ```
 */
export async function importDesignSystemFromUrl(
  options: ImportDesignSystemOptions,
  dependencies: ImportDesignSystemDependencies = {}
): Promise<ImportDesignSystemResult> {
  const {
    url,
    websiteId,
    conceptName,
    existingProbeCapture,
    onProgress,
    jobId,
    useNewFormat = true,
  } = options

  // Initialize dependencies
  const prisma = dependencies.prisma ?? new PrismaClient()
  const domProbeService = dependencies.domProbeService ?? new DomProbeService()
  const designSystemService =
    dependencies.designSystemService ??
    new DesignSystemService({ prisma, domProbeService })
  const conceptRepository =
    dependencies.conceptRepository ?? new DesignConceptRepository(prisma)

  // Validate URL
  if (!url || !isValidUrl(url)) {
    throw new ImportDesignSystemError(
      `Invalid URL provided: ${url}`,
      'INVALID_URL'
    )
  }

  // Check if DOM probe is enabled (unless we have an existing capture)
  if (!existingProbeCapture && !isDomProbeEnabledForWebsite(websiteId)) {
    throw new ImportDesignSystemError(
      `DOM probe is disabled for website ${websiteId}`,
      'DOM_PROBE_DISABLED'
    )
  }

  // Report start
  onProgress?.({
    message: `Starting design system import from ${url}`,
    stage: 'design_extraction',
    stageProgress: 0,
  })

  let probeCapture: CaptureDesignSystemResult

  // Step 1: Get or perform DOM probe capture
  if (existingProbeCapture) {
    probeCapture = existingProbeCapture
    onProgress?.({
      message: 'Using existing DOM probe capture',
      stageProgress: 20,
    })
  } else {
    try {
      onProgress?.({
        message: 'Running DOM probe capture...',
        stageProgress: 10,
      })

      const captureParams: CaptureDesignSystemParams = {
        websiteId,
        targetUrl: url,
        baselineKey: getDomProbeBaselineKey(),
        jobId,
        refresh: true,
        evaluation: true,
        onProgress,
      }

      probeCapture = await domProbeService.captureDesignSystem(captureParams)

      onProgress?.({
        message: 'DOM probe capture complete',
        stageProgress: 40,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new ImportDesignSystemError(
        `DOM probe capture failed: ${message}`,
        'DOM_PROBE_FAILED',
        error instanceof Error ? error : undefined
      )
    }
  }

  // Step 2: Create or find design concept
  let conceptId: string
  let resolvedConceptName: string

  try {
    onProgress?.({
      message: 'Creating design concept...',
      stageProgress: 50,
    })

    // Check for existing default concept
    const existingConcept = await conceptRepository.findDefault(websiteId)

    if (existingConcept && !conceptName) {
      // Use existing default concept
      conceptId = existingConcept.id
      resolvedConceptName = existingConcept.name
    } else {
      // Create new concept with provided or generated name
      resolvedConceptName = conceptName ?? await generateConceptName(websiteId, conceptRepository)

      const newConcept = await conceptRepository.create({
        websiteId,
        name: resolvedConceptName,
        isDefault: !existingConcept, // Make default if first concept
      })

      conceptId = newConcept.id
    }

    onProgress?.({
      message: `Using design concept: ${resolvedConceptName}`,
      stageProgress: 60,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ImportDesignSystemError(
      `Failed to create design concept: ${message}`,
      'CONCEPT_CREATION_FAILED',
      error instanceof Error ? error : undefined
    )
  }

  // Step 3: Process design system
  try {
    onProgress?.({
      message: 'Processing design system...',
      stageProgress: 70,
    })

    const processingResult = await designSystemService.processDesignSystem({
      websiteId,
      detectionResults: [], // No detection results needed for standalone import
      sourceJobId: jobId,
      importUrl: url,
      probeCapture,
      useNewFormat,
      designConceptId: conceptId, // Pass concept ID to store design system under this concept
    })

    onProgress?.({
      message: 'Design system import complete',
      stageProgress: 100,
    })

    // Build result with concept info
    const result: ImportDesignSystemResult = {
      ...processingResult,
      conceptId,
      conceptName: resolvedConceptName,
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ImportDesignSystemError(
      `Design system processing failed: ${message}`,
      'DESIGN_SYSTEM_PROCESSING_FAILED',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Generate a default concept name
 */
async function generateConceptName(
  websiteId: string,
  repository: DesignConceptRepository
): Promise<string> {
  const existingConcepts = await repository.listByWebsite(websiteId)
  return `Design Concept ${existingConcepts.length + 1}`
}
