import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import { shufflePalette } from '../palette-shuffle'

const buildPalette = (): DesignSystem['palette'] => ({
  primary: [
    { value: '#3366FF', confidence: 1, source: 'literal' },
    { value: '#254EDB', confidence: 1, source: 'literal' }
  ],
  secondary: [
    { value: '#FFB347', confidence: 1, source: 'literal' },
    { value: '#FF8C42', confidence: 1, source: 'literal' }
  ],
  accent: [{ value: '#10B981', confidence: 1, source: 'literal' }],
  neutral: [{ value: '#0F172A', confidence: 1, source: 'literal' }],
  surface: [{ value: '#F8FAFC', confidence: 1, source: 'literal' }]
})

describe('palette shuffle', () => {
  it('produces deterministic palettes when seed is provided', () => {
    const palette = buildPalette()

    const firstShuffle = shufflePalette({
      conceptId: 'concept-1',
      palette,
      seed: 'concept-1:seed'
    })

    const secondShuffle = shufflePalette({
      conceptId: 'concept-1',
      palette,
      seed: 'concept-1:seed'
    })

    expect(firstShuffle.palette).toEqual(secondShuffle.palette)
    expect(firstShuffle.seed).toBe('concept-1:seed')
  })

  it('annotates tokens with shuffle metadata', () => {
    const result = shufflePalette({
      conceptId: 'concept-2',
      palette: buildPalette(),
      seed: 'unit-test-seed'
    })

    Object.values(result.palette).forEach(tokens => {
      tokens.forEach(token => {
        expect(token.source).toBe('shuffle')
        expect(token.confidence).toBeCloseTo(0.75)
        expect(token.generatorSeed).toBe('unit-test-seed')
      })
    })
  })

  it('maintains delta E thresholds between original and shuffled values', () => {
    const basePalette = buildPalette()
    const result = shufflePalette({
      conceptId: 'concept-3',
      palette: basePalette,
      seed: 'delta-test'
    })

    Object.entries(result.deltaMap).forEach(([key, delta]) => {
      expect(delta).toBeGreaterThanOrEqual(4)
      expect(delta).toBeLessThanOrEqual(20)
    })
  })

  it('keeps palette shape identical after shuffling', () => {
    const original = buildPalette()
    const result = shufflePalette({
      conceptId: 'concept-4',
      palette: original
    })

    expect(result.palette.primary).toHaveLength(original.primary.length)
    expect(result.palette.secondary).toHaveLength(original.secondary.length)
    expect(result.palette.accent).toHaveLength(original.accent.length)
  })
})
