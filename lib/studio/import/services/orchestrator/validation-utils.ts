/**
 * Import Validation Utilities
 *
 * Handles import result validation and integrity checking.
 *
 * @module validation-utils
 */

import type { PrismaClient } from '@/lib/generated/prisma'
import type { ImportResult, ValidationResult } from '../interfaces/import-orchestrator.interface'

/**
 * Validates import result integrity.
 */
export function validateImportIntegrity(result: ImportResult): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const validTypeIds = new Set(result.componentTypes.map(ct => ct.id))

  let pagesValidated = 0
  let componentsValidated = 0
  let structuresValidated = 0

  for (const page of result.pages) {
    pagesValidated++

    if (page.content && typeof page.content === 'object') {
      const content = page.content as any
      if (content.components && Array.isArray(content.components)) {
        for (const component of content.components) {
          componentsValidated++
          if (component.typeId && !validTypeIds.has(component.typeId)) {
            errors.push(`Page ${page.id} references invalid component type ${component.typeId}`)
          }
        }
      }
    }
  }

  const validPageIds = new Set(result.pages.map(p => p.id))
  for (const structure of result.structures) {
    structuresValidated++
    if (structure.websitePageId && !validPageIds.has(structure.websitePageId)) {
      errors.push(`Structure ${structure.id} references invalid page ${structure.websitePageId}`)
    }
  }

  for (const shared of result.sharedComponents) {
    const typeId =
      ((shared as any).websiteComponentTypeId as string | undefined) ??
      ((shared as any).componentTypeId as string | undefined)
    if (typeId && !validTypeIds.has(typeId)) {
      errors.push(`Shared component ${shared.id} references invalid type ${typeId}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics: {
      pagesValidated,
      componentsValidated,
      structuresValidated
    }
  }
}

/**
 * Rolls back a partial import.
 */
export async function rollbackImport(
  prisma: PrismaClient,
  websiteId: string,
  importResult: Partial<ImportResult>
): Promise<void> {
  if (importResult.sharedComponents?.length) {
    await prisma.websiteSharedComponent.deleteMany({
      where: { websiteId }
    })
  }

  if (importResult.structures?.length) {
    await prisma.websiteStructure.deleteMany({
      where: { websiteId }
    })
  }

  if (importResult.pages?.length) {
    await prisma.websitePage.deleteMany({
      where: { websiteId }
    })
  }

  if (importResult.componentTypes?.length) {
    await prisma.websiteComponentType.deleteMany({
      where: { websiteId }
    })
  }
}

/**
 * Calculates import statistics.
 */
export function calculateStatistics(
  result: ImportResult,
  countComponents: (pages: any[]) => number
): ImportResult['statistics'] {
  return {
    totalPages: result.pages.length,
    totalComponents: countComponents(result.pages),
    uniqueComponentTypes: result.componentTypes.length,
    sharedComponentsDetected: result.sharedComponents.length,
    failedPages: result.failedPages.length,
    processingTimeMs: result.statistics.processingTimeMs
  }
}

/**
 * Generates import summary string.
 */
export function generateImportSummary(result: ImportResult): string {
  const { statistics } = result
  const statusLine = statistics.failedPages > 0 ? 'Completed with partial failures' : 'Completed Successfully'

  return `Import Summary for Website ${result.websiteId}:
- Pages Created: ${statistics.totalPages}
- Total Components: ${statistics.totalComponents}
- Unique Component Types: ${statistics.uniqueComponentTypes}
- Shared Components Detected: ${statistics.sharedComponentsDetected}
- Failed Pages: ${statistics.failedPages}
- Processing Time: ${statistics.processingTimeMs}ms
- Import Status: ${statusLine}`
}

/**
 * Verifies database consistency after import.
 */
export async function verifyDatabaseConsistency(
  prisma: PrismaClient,
  websiteId: string
): Promise<boolean> {
  try {
    await prisma.websitePage.findMany({
      where: { websiteId }
    })

    await prisma.websiteStructure.findMany({
      where: { websiteId },
      include: {
        websitePage: true
      }
    })

    return true
  } catch (error) {
    console.error('Database consistency check failed:', error)
    return false
  }
}
