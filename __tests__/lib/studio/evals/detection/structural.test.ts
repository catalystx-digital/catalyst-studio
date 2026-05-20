import { validateStructure, structureValidationConstants } from '@/lib/studio/evals/detection/structural'
import type { DetectionComponent } from '@/lib/studio/evals/detection/schema'
import type { DiffResult } from '@/lib/studio/evals/detection/stats'
import type { NormalizedComponent } from '@/lib/studio/evals/detection/types'

function createNormalized(type: string, region = 'main', summary = 'ok'): NormalizedComponent {
  return {
    type,
    confidence: 0.9,
    content: {
      summary
    },
    region
  }
}

function createDetected(type: string, region = 'main', summary = 'ok'): DetectionComponent {
  return {
    type,
    confidence: 0.9,
    content: {
      summary
    },
    region,
    metadata: {}
  }
}

describe('validateStructure', () => {
  it('flags component ordering violations', () => {
    const expected = [createNormalized('hero', 'hero'), createNormalized('cta-simple', 'main')]
    const actual = [createDetected('cta-simple', 'main'), createDetected('hero', 'hero')]

    const diff: DiffResult = {
      matches: [
        { expectedIndex: 0, actualIndex: 1, type: 'hero', fieldMismatches: [], expectedFieldCount: 0, score: 1 },
        { expectedIndex: 1, actualIndex: 0, type: 'cta-simple', fieldMismatches: [], expectedFieldCount: 0, score: 1 }
      ],
      missing: [],
      unexpected: []
    }

    const result = validateStructure(expected, actual, diff)
    expect(result.violations.some(v => v.code === 'structure.ordering')).toBe(true)
  })

  it('enforces summary length limit', () => {
    const longSummary = 'x'.repeat(structureValidationConstants.MAX_SUMMARY_LENGTH + 1)
    const expected = [createNormalized('feature-grid', 'main', longSummary)]
    const actual = [createDetected('feature-grid', 'main', longSummary)]

    const diff: DiffResult = {
      matches: [
        {
          expectedIndex: 0,
          actualIndex: 0,
          type: 'feature-grid',
          fieldMismatches: [],
          expectedFieldCount: 0,
          score: 1
        }
      ],
      missing: [],
      unexpected: []
    }

    const result = validateStructure(expected, actual, diff)
    expect(result.violations.some(v => v.code === 'structure.summary_length')).toBe(true)
  })

  it('flags excessive component counts', () => {
    const count = structureValidationConstants.MAX_COMPONENT_COUNT + 1
    const expected = Array.from({ length: count }, (_, idx) => createNormalized(`component-${idx}`, 'main'))
    const actual = Array.from({ length: count }, (_, idx) => createDetected(`component-${idx}`, 'main'))

    const diff: DiffResult = {
      matches: expected.map((_, idx) => ({
        expectedIndex: idx,
        actualIndex: idx,
        type: `component-${idx}`,
        fieldMismatches: [],
        expectedFieldCount: 0,
        score: 1
      })),
      missing: [],
      unexpected: []
    }

    const result = validateStructure(expected, actual, diff)
    expect(result.violations.some(v => v.code === 'structure.component_count')).toBe(true)
  })
})

