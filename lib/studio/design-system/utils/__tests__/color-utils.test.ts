/**
 * Tests for color-utils
 */

import { describe, it, expect } from 'vitest'
import {
  hexToHslString,
  isLightColor,
  getForegroundForBackground,
  hexToRgba,
  hslWithOpacity,
  getMutedForeground,
  parseLightness,
  validateForegroundContrast,
} from '../color-utils'

describe('hexToHslString', () => {
  it('should convert pure red to HSL', () => {
    expect(hexToHslString('#ff0000')).toBe('0 100% 50%')
  })

  it('should convert pure green to HSL', () => {
    expect(hexToHslString('#00ff00')).toBe('120 100% 50%')
  })

  it('should convert pure blue to HSL', () => {
    expect(hexToHslString('#0000ff')).toBe('240 100% 50%')
  })

  it('should convert white to HSL', () => {
    expect(hexToHslString('#ffffff')).toBe('0 0% 100%')
  })

  it('should convert black to HSL', () => {
    expect(hexToHslString('#000000')).toBe('0 0% 0%')
  })

  it('should handle 3-character hex codes', () => {
    expect(hexToHslString('#f00')).toBe('0 100% 50%')
    expect(hexToHslString('#fff')).toBe('0 0% 100%')
  })

  it('should handle hex without # prefix', () => {
    expect(hexToHslString('ff0000')).toBe('0 100% 50%')
  })

  it('should return fallback for invalid hex', () => {
    const result = hexToHslString('invalid')
    expect(result).toBeDefined() // Should return SHADCN_DEFAULTS['--primary']
  })

  it('should handle gray colors', () => {
    // Gray = equal RGB values, so saturation should be 0%
    const gray = hexToHslString('#808080')
    expect(gray).toMatch(/0 0%/) // hue and saturation
    expect(gray).toMatch(/50(\.\d+)?%/) // ~50% lightness (with optional decimals)
  })
})

describe('isLightColor', () => {
  it('should return true for white', () => {
    expect(isLightColor('#ffffff')).toBe(true)
  })

  it('should return false for black', () => {
    expect(isLightColor('#000000')).toBe(false)
  })

  it('should return true for light colors', () => {
    expect(isLightColor('#ffff00')).toBe(true) // Yellow
    expect(isLightColor('#00ffff')).toBe(true) // Cyan
    expect(isLightColor('#f0f0f0')).toBe(true) // Light gray
  })

  it('should return false for dark colors', () => {
    expect(isLightColor('#000080')).toBe(false) // Navy
    expect(isLightColor('#800000')).toBe(false) // Maroon
    expect(isLightColor('#303030')).toBe(false) // Dark gray
  })

  it('should handle 3-character hex codes', () => {
    expect(isLightColor('#fff')).toBe(true)
    expect(isLightColor('#000')).toBe(false)
  })
})

describe('getForegroundForBackground', () => {
  it('should return dark foreground for light background', () => {
    const foreground = getForegroundForBackground('#ffffff')
    // Should be dark (high lightness values = dark text)
    expect(foreground).toContain('3.9%') // Dark color
  })

  it('should return light foreground for dark background', () => {
    const foreground = getForegroundForBackground('#000000')
    // Should be light (98% lightness = near white)
    expect(foreground).toContain('98%')
  })

  it('should return appropriate contrast for mid-tones', () => {
    // Light gray background -> dark text
    expect(getForegroundForBackground('#d0d0d0')).toContain('3.9%')
    // Dark gray background -> light text
    expect(getForegroundForBackground('#303030')).toContain('98%')
  })
})

describe('hexToRgba', () => {
  it('should convert hex to rgba with full opacity', () => {
    expect(hexToRgba('#ff5500', 1)).toBe('rgba(255, 85, 0, 1)')
  })

  it('should convert hex to rgba with partial opacity', () => {
    expect(hexToRgba('#ff5500', 0.5)).toBe('rgba(255, 85, 0, 0.5)')
  })

  it('should handle hex without # prefix', () => {
    expect(hexToRgba('ff5500', 0.8)).toBe('rgba(255, 85, 0, 0.8)')
  })

  it('should handle 3-character hex codes', () => {
    expect(hexToRgba('#f50', 0.5)).toBe('rgba(255, 85, 0, 0.5)')
  })

  it('should convert black correctly', () => {
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })

  it('should convert white correctly', () => {
    expect(hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
  })

  it('should return fallback for invalid hex', () => {
    expect(hexToRgba('invalid', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})

describe('hslWithOpacity', () => {
  it('should handle hsl(var(--x)) format', () => {
    expect(hslWithOpacity('hsl(var(--primary))', 0.5)).toBe('hsl(var(--primary) / 0.5)')
  })

  it('should handle var(--x) format', () => {
    expect(hslWithOpacity('var(--primary)', 0.8)).toBe('hsl(var(--primary) / 0.8)')
  })

  it('should handle raw HSL values', () => {
    expect(hslWithOpacity('240 5.9% 10%', 0.6)).toBe('hsl(240 5.9% 10% / 0.6)')
  })

  it('should handle hsl(var(--background)) format', () => {
    expect(hslWithOpacity('hsl(var(--background))', 0.7)).toBe('hsl(var(--background) / 0.7)')
  })
})

describe('getMutedForeground', () => {
  it('should return medium gray for dark foreground (light mode)', () => {
    // Dark foreground (3.9% lightness) -> should produce ~46% lightness muted
    const result = getMutedForeground('240 10% 3.9%')
    const lightness = parseFloat(result.split(' ')[2])
    expect(lightness).toBeCloseTo(46.1, 0)
  })

  it('should return lighter gray for light foreground (dark mode)', () => {
    // Light foreground (98% lightness) -> should produce ~65% lightness muted
    const result = getMutedForeground('0 0% 98%')
    const lightness = parseFloat(result.split(' ')[2])
    expect(lightness).toBeCloseTo(64.9, 0)
  })

  it('should preserve hue from foreground', () => {
    const result = getMutedForeground('240 10% 3.9%')
    const hue = parseFloat(result.split(' ')[0])
    expect(hue).toBe(240)
  })

  it('should desaturate the color', () => {
    const result = getMutedForeground('240 10% 3.9%')
    const saturation = parseFloat(result.split(' ')[1])
    // Should be desaturated (reduced saturation, min 3.8%)
    expect(saturation).toBeGreaterThanOrEqual(3.8)
    expect(saturation).toBeLessThanOrEqual(5)
  })

  it('should handle edge case of 50% lightness foreground', () => {
    // Exactly 50% should be treated as light mode (l < 50 is false)
    const result = getMutedForeground('240 5% 50%')
    const lightness = parseFloat(result.split(' ')[2])
    // Should produce dark mode muted (~65%)
    expect(lightness).toBeCloseTo(64.9, 0)
  })
})

describe('parseLightness', () => {
  it('should parse lightness from valid HSL string', () => {
    expect(parseLightness('240 3.8% 46.1%')).toBe(46.1)
    expect(parseLightness('0 0% 100%')).toBe(100)
    expect(parseLightness('0 0% 0%')).toBe(0)
  })

  it('should return null for invalid HSL strings', () => {
    expect(parseLightness('')).toBeNull()
    expect(parseLightness('240')).toBeNull()
    expect(parseLightness('240 5%')).toBeNull()
  })

  it('should handle HSL strings with different decimal formats', () => {
    expect(parseLightness('240 5.9% 10%')).toBe(10)
    expect(parseLightness('240 5.9% 10.5%')).toBe(10.5)
  })
})

describe('validateForegroundContrast', () => {
  it('should validate dark foreground for light mode', () => {
    // Dark colors (low lightness) are valid for light mode
    expect(validateForegroundContrast('240 10% 3.9%', 'light')).toBe(true)
    expect(validateForegroundContrast('240 5% 20%', 'light')).toBe(true)
    expect(validateForegroundContrast('240 5% 49%', 'light')).toBe(true)
  })

  it('should reject light foreground for light mode', () => {
    // Light colors (high lightness) are invalid for light mode
    expect(validateForegroundContrast('0 0% 98%', 'light')).toBe(false)
    expect(validateForegroundContrast('240 5% 80%', 'light')).toBe(false)
    expect(validateForegroundContrast('240 5% 51%', 'light')).toBe(false)
  })

  it('should validate light foreground for dark mode', () => {
    // Light colors are valid for dark mode
    expect(validateForegroundContrast('0 0% 98%', 'dark')).toBe(true)
    expect(validateForegroundContrast('240 5% 80%', 'dark')).toBe(true)
    expect(validateForegroundContrast('240 5% 51%', 'dark')).toBe(true)
  })

  it('should reject dark foreground for dark mode', () => {
    // Dark colors are invalid for dark mode
    expect(validateForegroundContrast('240 10% 3.9%', 'dark')).toBe(false)
    expect(validateForegroundContrast('240 5% 20%', 'dark')).toBe(false)
    expect(validateForegroundContrast('240 5% 49%', 'dark')).toBe(false)
  })

  it('should return false for invalid HSL strings', () => {
    expect(validateForegroundContrast('invalid', 'light')).toBe(false)
    expect(validateForegroundContrast('', 'dark')).toBe(false)
  })
})
