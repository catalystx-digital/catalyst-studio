import type { DetectionComponent } from './schema'
import type { DiffResult } from './stats'
import type { EvaluationViolation, NormalizedComponent } from './types'

const MAX_COMPONENT_COUNT = 40
const MAX_SUMMARY_LENGTH = 200
const ALLOWED_REGIONS = new Set(['header', 'hero', 'main', 'footer', 'sidebar', 'global', 'unknown'])

export interface StructuralValidationResult {
  violations: EvaluationViolation[]
  warnings: EvaluationViolation[]
}

export function validateStructure(
  expected: NormalizedComponent[],
  actual: DetectionComponent[],
  diff: DiffResult
): StructuralValidationResult {
  const violations: EvaluationViolation[] = []
  const warnings: EvaluationViolation[] = []

  if (actual.length > MAX_COMPONENT_COUNT) {
    violations.push({
      code: 'structure.component_count',
      message: `Detected ${actual.length} components; maximum allowed is ${MAX_COMPONENT_COUNT}.`,
      severity: 'error',
      details: { detected: actual.length, limit: MAX_COMPONENT_COUNT }
    })
  }

  actual.forEach((component, index) => {
    const path = `components[${index}]`
    if (!component.type || typeof component.type !== 'string' || component.type.trim().length === 0) {
      violations.push({
        code: 'structure.missing_type',
        message: 'Component is missing a type.',
        severity: 'error',
        path
      })
    }

    const region = typeof component.region === 'string' ? component.region.trim().toLowerCase() : ''
    if (!region) {
      warnings.push({
        code: 'structure.region_missing',
        message: 'Component region is missing; importer will assign the canonical region.',
        severity: 'warning',
        path,
        details: { componentType: component.type }
      })
    } else if (!ALLOWED_REGIONS.has(region)) {
      violations.push({
        code: 'structure.invalid_region',
        message: `Component region "${component.region}" is not allowed.`,
        severity: 'error',
        path,
        details: { componentType: component.type, region: component.region }
      })
    }

    const summary = component.content?.summary
    if (typeof summary === 'string') {
      const length = summary.trim().length
      if (length > MAX_SUMMARY_LENGTH) {
        violations.push({
          code: 'structure.summary_length',
          message: `Component summary exceeds ${MAX_SUMMARY_LENGTH} characters.`,
          severity: 'error',
          path: `${path}.content.summary`,
          details: { length, limit: MAX_SUMMARY_LENGTH }
        })
      }
    }
  })

  // Ordering check: ensure actual indices respecting expected ordering.
  const orderedMatches = [...diff.matches].sort((a, b) => a.expectedIndex - b.expectedIndex)
  for (let i = 1; i < orderedMatches.length; i++) {
    if (orderedMatches[i].actualIndex < orderedMatches[i - 1].actualIndex) {
      const offender = orderedMatches[i]
      violations.push({
        code: 'structure.ordering',
        message: `Component "${offender.type}" appears out of order relative to expected sequence.`,
        severity: 'error',
        path: `components[${offender.actualIndex}]`,
        details: {
          expectedIndex: offender.expectedIndex,
          actualIndex: offender.actualIndex,
          previousActualIndex: orderedMatches[i - 1].actualIndex
        }
      })
      break
    }
  }

  return { violations, warnings }
}

export const structureValidationConstants = {
  MAX_COMPONENT_COUNT,
  MAX_SUMMARY_LENGTH,
  ALLOWED_REGIONS
}
