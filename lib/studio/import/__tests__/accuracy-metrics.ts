/**
 * Accuracy Metrics for Import Quality
 *
 * These metrics help measure how well the import process works
 * across different website types. Used in conjunction with golden-sites.ts
 * for regression testing and baseline tracking.
 *
 * @see golden-sites.ts for test site definitions
 * @see detection-telemetry.ts for performance telemetry integration
 */

import type { DetectionPhaseRecord } from '../telemetry/detection-telemetry'

// =============================================================================
// Component Accuracy Metrics
// =============================================================================

/**
 * Measures how accurately component types are detected and assigned.
 */
export interface ComponentAccuracyMetrics {
  /** Total number of components detected in the import */
  totalComponents: number
  /** Components with correctly assigned types (matches expected) */
  correctTypes: number
  /** Components with wrong type assigned */
  incorrectTypes: number
  /** Expected components that were not detected */
  missingComponents: number
  /** Components detected that were not expected (false positives) */
  extraComponents: number
  /** Accuracy rate: correctTypes / totalComponents (0-1) */
  typeAccuracyRate: number
}

// =============================================================================
// Navigation Accuracy Metrics
// =============================================================================

/**
 * Measures fidelity of navigation structure extraction.
 */
export interface NavigationAccuracyMetrics {
  /** Total menu items expected in navigation */
  totalMenuItems: number
  /** Menu items with correct label AND href */
  correctMenuItems: number
  /** Expected menu items that were not detected */
  missingMenuItems: number
  /** Extra menu items detected (not in source) */
  extraMenuItems: number
  /** Whether parent-child relationships are correctly preserved */
  hierarchyCorrect: boolean
  /** Overall navigation fidelity: correctMenuItems / totalMenuItems (0-1) */
  navigationFidelityRate: number
}

// =============================================================================
// Region Accuracy Metrics
// =============================================================================

/**
 * Measures correctness of page region assignments.
 */
export interface RegionAccuracyMetrics {
  /** Header region correctly identified */
  headerCorrect: boolean
  /** Hero section correctly identified */
  heroCorrect: boolean
  /** Main content area correctly identified */
  mainCorrect: boolean
  /** Footer region correctly identified */
  footerCorrect: boolean
  /** Sidebar correctly identified (if present) */
  sidebarCorrect?: boolean
  /** Overall region accuracy (correct regions / total regions) */
  regionAccuracyRate: number
}

// =============================================================================
// Content Preservation Metrics
// =============================================================================

/**
 * Measures how well content is preserved during import.
 */
export interface ContentPreservationMetrics {
  /** Total text blocks in source */
  totalTextBlocks: number
  /** Text blocks successfully preserved */
  textPreserved: number
  /** Total images found in source */
  imagesFound: number
  /** Images successfully preserved/referenced */
  imagesPreserved: number
  /** Total links found in source */
  linksFound: number
  /** Links successfully preserved */
  linksPreserved: number
  /** Overall preservation rate (weighted average) */
  preservationRate: number
}

// =============================================================================
// Full Import Accuracy Report
// =============================================================================

/**
 * Complete accuracy report for an import operation.
 * Combines all metric categories with metadata.
 */
export interface ImportAccuracyReport {
  /** Source URL that was imported */
  siteUrl: string
  /** Human-readable site name */
  siteName: string
  /** Site category (healthcare, saas, ecommerce, etc.) */
  category: string
  /** When the report was generated */
  timestamp: Date
  /** Component detection metrics */
  components: ComponentAccuracyMetrics
  /** Navigation extraction metrics */
  navigation: NavigationAccuracyMetrics
  /** Page region assignment metrics */
  regions: RegionAccuracyMetrics
  /** Content preservation metrics */
  content: ContentPreservationMetrics
  /** Weighted overall score (0-1) */
  overallScore: number
  /** Performance telemetry from detection phases */
  processorTelemetry?: DetectionPhaseRecord[]
  /** Additional notes or observations */
  notes?: string
}

// =============================================================================
// Target Thresholds
// =============================================================================

/**
 * Target accuracy thresholds based on expert recommendations.
 * These define the quality bar for import operations.
 */
export const ACCURACY_TARGETS = {
  /** Component type detection should be >85% accurate */
  componentTypeAccuracy: 0.85,
  /** Navigation extraction should be >90% accurate */
  navigationFidelity: 0.9,
  /** Region assignment should be >90% accurate */
  regionAssignment: 0.9,
  /** Content preservation should be >95% */
  contentPreservation: 0.95,
  /** False positive rate should be <10% */
  falsePositiveRate: 0.1,
} as const

/**
 * Weight factors for calculating overall score.
 * Totals to 1.0 for weighted average calculation.
 */
export const SCORE_WEIGHTS = {
  components: 0.35,
  navigation: 0.25,
  regions: 0.2,
  content: 0.2,
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate the overall import quality score from a report.
 * Uses weighted average of individual metric categories.
 *
 * @param report - The accuracy report to score
 * @returns Overall score between 0 and 1
 */
export function calculateOverallScore(report: ImportAccuracyReport): number {
  return (
    report.components.typeAccuracyRate * SCORE_WEIGHTS.components +
    report.navigation.navigationFidelityRate * SCORE_WEIGHTS.navigation +
    report.regions.regionAccuracyRate * SCORE_WEIGHTS.regions +
    report.content.preservationRate * SCORE_WEIGHTS.content
  )
}

/**
 * Result of checking if metrics meet quality targets.
 */
export interface TargetCheckResult {
  /** Whether all targets are met */
  meets: boolean
  /** List of failed targets with details */
  failures: string[]
  /** Individual target results */
  details: {
    componentAccuracy: { value: number; target: number; passed: boolean }
    navigationFidelity: { value: number; target: number; passed: boolean }
    regionAssignment: { value: number; target: number; passed: boolean }
    contentPreservation: { value: number; target: number; passed: boolean }
    falsePositiveRate: { value: number; target: number; passed: boolean }
  }
}

/**
 * Calculate false positive rate from component metrics.
 * False positives = extra components that shouldn't have been detected.
 */
function calculateFalsePositiveRate(
  metrics: ComponentAccuracyMetrics
): number {
  const totalDetected = metrics.totalComponents
  if (totalDetected === 0) return 0
  return metrics.extraComponents / totalDetected
}

/**
 * Check if an accuracy report meets all quality targets.
 *
 * @param report - The accuracy report to evaluate
 * @returns Object with pass/fail status and failure details
 */
export function meetsTargets(report: ImportAccuracyReport): TargetCheckResult {
  const failures: string[] = []

  const componentAccuracy = report.components.typeAccuracyRate
  const navigationFidelity = report.navigation.navigationFidelityRate
  const regionAssignment = report.regions.regionAccuracyRate
  const contentPreservation = report.content.preservationRate
  const falsePositiveRate = calculateFalsePositiveRate(report.components)

  const componentPassed =
    componentAccuracy >= ACCURACY_TARGETS.componentTypeAccuracy
  const navigationPassed =
    navigationFidelity >= ACCURACY_TARGETS.navigationFidelity
  const regionPassed = regionAssignment >= ACCURACY_TARGETS.regionAssignment
  const contentPassed =
    contentPreservation >= ACCURACY_TARGETS.contentPreservation
  const fpPassed = falsePositiveRate <= ACCURACY_TARGETS.falsePositiveRate

  if (!componentPassed) {
    failures.push(
      `Component accuracy ${(componentAccuracy * 100).toFixed(1)}% < ${ACCURACY_TARGETS.componentTypeAccuracy * 100}% target`
    )
  }

  if (!navigationPassed) {
    failures.push(
      `Navigation fidelity ${(navigationFidelity * 100).toFixed(1)}% < ${ACCURACY_TARGETS.navigationFidelity * 100}% target`
    )
  }

  if (!regionPassed) {
    failures.push(
      `Region assignment ${(regionAssignment * 100).toFixed(1)}% < ${ACCURACY_TARGETS.regionAssignment * 100}% target`
    )
  }

  if (!contentPassed) {
    failures.push(
      `Content preservation ${(contentPreservation * 100).toFixed(1)}% < ${ACCURACY_TARGETS.contentPreservation * 100}% target`
    )
  }

  if (!fpPassed) {
    failures.push(
      `False positive rate ${(falsePositiveRate * 100).toFixed(1)}% > ${ACCURACY_TARGETS.falsePositiveRate * 100}% target`
    )
  }

  return {
    meets: failures.length === 0,
    failures,
    details: {
      componentAccuracy: {
        value: componentAccuracy,
        target: ACCURACY_TARGETS.componentTypeAccuracy,
        passed: componentPassed,
      },
      navigationFidelity: {
        value: navigationFidelity,
        target: ACCURACY_TARGETS.navigationFidelity,
        passed: navigationPassed,
      },
      regionAssignment: {
        value: regionAssignment,
        target: ACCURACY_TARGETS.regionAssignment,
        passed: regionPassed,
      },
      contentPreservation: {
        value: contentPreservation,
        target: ACCURACY_TARGETS.contentPreservation,
        passed: contentPassed,
      },
      falsePositiveRate: {
        value: falsePositiveRate,
        target: ACCURACY_TARGETS.falsePositiveRate,
        passed: fpPassed,
      },
    },
  }
}

/**
 * Create an empty/default accuracy metrics object.
 * Useful for initializing before measurements.
 */
export function createEmptyComponentMetrics(): ComponentAccuracyMetrics {
  return {
    totalComponents: 0,
    correctTypes: 0,
    incorrectTypes: 0,
    missingComponents: 0,
    extraComponents: 0,
    typeAccuracyRate: 0,
  }
}

export function createEmptyNavigationMetrics(): NavigationAccuracyMetrics {
  return {
    totalMenuItems: 0,
    correctMenuItems: 0,
    missingMenuItems: 0,
    extraMenuItems: 0,
    hierarchyCorrect: false,
    navigationFidelityRate: 0,
  }
}

export function createEmptyRegionMetrics(): RegionAccuracyMetrics {
  return {
    headerCorrect: false,
    heroCorrect: false,
    mainCorrect: false,
    footerCorrect: false,
    regionAccuracyRate: 0,
  }
}

export function createEmptyContentMetrics(): ContentPreservationMetrics {
  return {
    totalTextBlocks: 0,
    textPreserved: 0,
    imagesFound: 0,
    imagesPreserved: 0,
    linksFound: 0,
    linksPreserved: 0,
    preservationRate: 0,
  }
}

/**
 * Format an accuracy report as a human-readable summary.
 */
export function formatReportSummary(report: ImportAccuracyReport): string {
  const targetCheck = meetsTargets(report)
  const status = targetCheck.meets ? 'PASS' : 'FAIL'

  const lines = [
    `=== Import Accuracy Report: ${report.siteName} ===`,
    `URL: ${report.siteUrl}`,
    `Category: ${report.category}`,
    `Date: ${report.timestamp.toISOString()}`,
    '',
    `Overall Score: ${(report.overallScore * 100).toFixed(1)}% [${status}]`,
    '',
    'Component Accuracy:',
    `  - Type accuracy: ${(report.components.typeAccuracyRate * 100).toFixed(1)}% (target: ${ACCURACY_TARGETS.componentTypeAccuracy * 100}%)`,
    `  - Components: ${report.components.correctTypes}/${report.components.totalComponents} correct`,
    `  - Missing: ${report.components.missingComponents}, Extra: ${report.components.extraComponents}`,
    '',
    'Navigation Fidelity:',
    `  - Fidelity: ${(report.navigation.navigationFidelityRate * 100).toFixed(1)}% (target: ${ACCURACY_TARGETS.navigationFidelity * 100}%)`,
    `  - Menu items: ${report.navigation.correctMenuItems}/${report.navigation.totalMenuItems} correct`,
    `  - Hierarchy: ${report.navigation.hierarchyCorrect ? 'preserved' : 'NOT preserved'}`,
    '',
    'Region Assignment:',
    `  - Accuracy: ${(report.regions.regionAccuracyRate * 100).toFixed(1)}% (target: ${ACCURACY_TARGETS.regionAssignment * 100}%)`,
    `  - Header: ${report.regions.headerCorrect ? 'Y' : 'N'}, Hero: ${report.regions.heroCorrect ? 'Y' : 'N'}, Main: ${report.regions.mainCorrect ? 'Y' : 'N'}, Footer: ${report.regions.footerCorrect ? 'Y' : 'N'}`,
    '',
    'Content Preservation:',
    `  - Rate: ${(report.content.preservationRate * 100).toFixed(1)}% (target: ${ACCURACY_TARGETS.contentPreservation * 100}%)`,
    `  - Text: ${report.content.textPreserved}/${report.content.totalTextBlocks}, Images: ${report.content.imagesPreserved}/${report.content.imagesFound}, Links: ${report.content.linksPreserved}/${report.content.linksFound}`,
  ]

  if (!targetCheck.meets) {
    lines.push('', 'Failed Targets:')
    for (const failure of targetCheck.failures) {
      lines.push(`  - ${failure}`)
    }
  }

  if (report.notes) {
    lines.push('', `Notes: ${report.notes}`)
  }

  return lines.join('\n')
}
