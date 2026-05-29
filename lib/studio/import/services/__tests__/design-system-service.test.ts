import { buildBrandingDesignSystem } from '../design-system-service'

describe('buildBrandingDesignSystem', () => {
  it('marks synthetic defaults as low-confidence fallback provenance', () => {
    const designSystem = buildBrandingDesignSystem({})

    expect(designSystem.metadata.confidence).toBe(0.1)
    expect(designSystem.palette.primary[0]).toEqual(expect.objectContaining({
      value: '#2563eb',
      confidence: 0.1,
      source: 'fallback',
      usageCount: 0,
    }))
    expect(designSystem.palette.surface[0]).toEqual(expect.objectContaining({
      value: '#ffffff',
      confidence: 0.1,
      source: 'fallback',
      usageCount: 0,
    }))
    expect(designSystem.typography.heading[0]).toEqual(expect.objectContaining({
      fontFamily: 'Inter',
      confidence: 0.1,
      source: 'fallback',
      usageCount: 0,
    }))
    expect(designSystem.spacing).toEqual(expect.objectContaining({
      confidence: 0.1,
      source: 'inferred',
    }))
    expect(designSystem.radii).toEqual(expect.objectContaining({
      confidence: 0.1,
      source: 'inferred',
    }))
  })

  it('keeps provided branding values as modest-confidence LLM provenance', () => {
    const designSystem = buildBrandingDesignSystem({
      primaryColors: [' #123456 '],
      fonts: ['Source Sans 3'],
    })

    expect(designSystem.metadata.confidence).toBe(0.4)
    expect(designSystem.palette.primary[0]).toEqual(expect.objectContaining({
      value: '#123456',
      confidence: 0.4,
      source: 'llm',
      usageCount: 1,
    }))
    expect(designSystem.typography.heading[0]).toEqual(expect.objectContaining({
      fontFamily: 'Source Sans 3',
      confidence: 0.4,
      source: 'llm',
      usageCount: 1,
    }))
    expect(designSystem.palette.surface[0]).toEqual(expect.objectContaining({
      source: 'fallback',
      confidence: 0.1,
    }))
  })
})
