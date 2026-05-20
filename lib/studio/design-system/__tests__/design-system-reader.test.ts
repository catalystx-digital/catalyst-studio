/**
 * Tests for design-system-reader
 */

import { describe, it, expect } from 'vitest'
import {
  isNewFormat,
  isLegacyFormat,
  getDesignSystemVariables,
  getNormalizedDesignSystem,
} from '../design-system-reader'
import { SHADCN_DEFAULTS } from '../shadcn-defaults'
import type { ShadcnDesignSystemTokens } from '../shadcn-transformer'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'

describe('isNewFormat', () => {
  it('should return true for valid new format', () => {
    const newFormat: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%' },
      extraction: { timestamp: '', confidence: 1, source: 'detected', detectedCount: 1, defaultCount: 0 },
    }
    expect(isNewFormat(newFormat)).toBe(true)
  })

  it('should return false for legacy format', () => {
    const legacyFormat = {
      palette: { primary: [], secondary: [], accent: [], neutral: [], surface: [] },
      typography: { heading: [], body: [], ui: [] },
      version: '1.0.0',
    }
    expect(isNewFormat(legacyFormat)).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isNewFormat(null)).toBe(false)
    expect(isNewFormat(undefined)).toBe(false)
  })

  it('should return false for objects without extraction', () => {
    const partial = { variables: { '--primary': '240 5.9% 10%' } }
    expect(isNewFormat(partial)).toBe(false)
  })
})

describe('isLegacyFormat', () => {
  it('should return true for valid legacy format', () => {
    const legacyFormat = {
      palette: { primary: [], secondary: [], accent: [], neutral: [], surface: [] },
      typography: { heading: [], body: [], ui: [] },
      version: '1.0.0',
    }
    expect(isLegacyFormat(legacyFormat)).toBe(true)
  })

  it('should return false for new format', () => {
    const newFormat: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%' },
      extraction: { timestamp: '', confidence: 1, source: 'detected', detectedCount: 1, defaultCount: 0 },
    }
    expect(isLegacyFormat(newFormat)).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isLegacyFormat(null)).toBe(false)
    expect(isLegacyFormat(undefined)).toBe(false)
  })
})

describe('getDesignSystemVariables', () => {
  it('should return variables directly for new format', () => {
    const newFormat: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%', '--background': '0 0% 100%' },
      extraction: { timestamp: '', confidence: 1, source: 'detected', detectedCount: 2, defaultCount: 0 },
    }
    const result = getDesignSystemVariables(newFormat)

    expect(result['--primary']).toBe('240 5.9% 10%')
    expect(result['--background']).toBe('0 0% 100%')
  })

  it('should convert legacy format to shadcn variables', () => {
    const legacyFormat: Partial<DesignSystem> = {
      palette: {
        primary: [{ value: '#ff0000', confidence: 1, source: 'css-var' }],
        secondary: [],
        accent: [],
        neutral: [],
        surface: [{ value: '#ffffff', confidence: 1, source: 'css-var' }],
      },
    }
    const result = getDesignSystemVariables(legacyFormat)

    // Should have converted colors to HSL
    expect(result['--primary']).toBeDefined()
    expect(result['--background']).toBeDefined()
  })

  it('should return defaults for null/undefined/unknown', () => {
    const result = getDesignSystemVariables(null)
    expect(result).toEqual(SHADCN_DEFAULTS)
  })

  it('should use pre-computed aliases from legacy format when available', () => {
    const legacyWithAliases = {
      palette: { primary: [], secondary: [], accent: [], neutral: [], surface: [] },
      aliases: {
        cssVariables: {
          '--primary': '100 50% 50%',
          '--background': '0 0% 100%',
        },
      },
    }
    const result = getDesignSystemVariables(legacyWithAliases)

    expect(result['--primary']).toBe('100 50% 50%')
    expect(result['--background']).toBe('0 0% 100%')
  })
})

describe('getNormalizedDesignSystem', () => {
  it('should return new format as-is', () => {
    const newFormat: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%' },
      extraction: { timestamp: '2024-01-01', confidence: 0.9, source: 'detected', detectedCount: 1, defaultCount: 0 },
    }
    const result = getNormalizedDesignSystem(newFormat)

    expect(result).toEqual(newFormat)
  })

  it('should convert legacy format to new format', () => {
    const legacyFormat = {
      palette: { primary: [], secondary: [], accent: [], neutral: [], surface: [] },
      metadata: { capturedAt: '2024-01-01', confidence: 0.8 },
    }
    const result = getNormalizedDesignSystem(legacyFormat)

    expect(result).toHaveProperty('variables')
    expect(result).toHaveProperty('extraction')
    expect(result.extraction.source).toBe('detected')
  })

  it('should return defaults for unknown format', () => {
    const result = getNormalizedDesignSystem(null)

    expect(result.variables).toEqual(SHADCN_DEFAULTS)
    expect(result.extraction.source).toBe('default')
    expect(result.extraction.confidence).toBe(0)
  })
})
