import type { DetectionComponent, NormalizedComponent } from './types'

export interface DiffResult {
  matches: Array<{
    expectedIndex: number
    actualIndex: number
    type: string
    fieldMismatches: Array<{ field: string; expected: unknown; actual: unknown }>
    score: number
    expectedFieldCount: number
  }>
  missing: NormalizedComponent[]
  unexpected: NormalizedComponent[]
}

function cloneComponent(component: NormalizedComponent): NormalizedComponent {
  return {
    type: component.type,
    confidence: component.confidence,
    content: JSON.parse(JSON.stringify(component.content || {})),
    region: component.region
  }
}

function compareFields(
  expected: Record<string, any>,
  actual: Record<string, any>
): Array<{ field: string; expected: unknown; actual: unknown }> {
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = []
  const fields = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})])
  fields.forEach(field => {
    const expectedValue = expected[field]
    const actualValue = actual[field]
    if (!deepEqual(expectedValue, actualValue)) {
      mismatches.push({ field, expected: expectedValue, actual: actualValue })
    }
  })
  return mismatches
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((value, index) => deepEqual(value, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    const keysA = Object.keys(a as any)
    const keysB = Object.keys(b as any)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => deepEqual((a as any)[key], (b as any)[key]))
  }
  return false
}

export function computeDiff(expected: NormalizedComponent[], actual: DetectionComponent[]): DiffResult {
  const matches: DiffResult['matches'] = []
  const usedActual = new Set<number>()

  expected.forEach((expectedComponent, expectedIndex) => {
    const actualIndex = actual.findIndex(
      (candidate, idx) => idx >= 0 && !usedActual.has(idx) && candidate.type === expectedComponent.type
    )
    if (actualIndex === -1) {
      return
    }

    usedActual.add(actualIndex)
    const actualComponent = actual[actualIndex]
    const mismatches = compareFields(expectedComponent.content, actualComponent.content)
    const expectedFieldCount = Object.keys(expectedComponent.content || {}).length
    const score =
      expectedFieldCount > 0 ? 1 - Math.min(mismatches.length, expectedFieldCount) / expectedFieldCount : 1
    matches.push({
      expectedIndex,
      actualIndex,
      type: expectedComponent.type,
      fieldMismatches: mismatches,
      expectedFieldCount,
      score
    })
  })

  const missing: NormalizedComponent[] = []
  expected.forEach((component, index) => {
    if (!matches.some(match => match.expectedIndex === index)) {
      missing.push(cloneComponent(component))
    }
  })

  const unexpected: NormalizedComponent[] = []
  actual.forEach((component, index) => {
    if (!matches.some(match => match.actualIndex === index)) {
      unexpected.push({
        type: component.type,
        confidence: component.confidence,
        content: JSON.parse(JSON.stringify(component.content || {})),
        region: component.region
      })
    }
  })

  return { matches, missing, unexpected }
}

export function computePrecisionRecall(
  expected: NormalizedComponent[],
  actual: DetectionComponent[],
  matches: DiffResult['matches']
): { precision: number; recall: number; f1: number; matchedCount: number } {
  const tp = matches.length
  const fp = Math.max(actual.length - tp, 0)
  const fn = Math.max(expected.length - tp, 0)

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    matchedCount: tp
  }
}

export function computeFieldAccuracy(matches: DiffResult['matches']): number {
  let compared = 0
  let matched = 0

  matches.forEach(match => {
    compared += match.expectedFieldCount
    matched += Math.max(match.expectedFieldCount - match.fieldMismatches.length, 0)
  })

  if (compared === 0) return 1
  return Number((matched / compared).toFixed(4))
}
