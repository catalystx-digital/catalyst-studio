/**
 * Color Utilities
 *
 * Shared color conversion utilities for the design system module.
 */

import { SHADCN_DEFAULTS } from '../shadcn-defaults'

/**
 * Convert hex color to HSL string format (without hsl() wrapper)
 * Returns format like "240 5.9% 10%" for use in CSS variables
 *
 * @param hex - Hex color string (e.g., "#ff0000" or "#f00")
 * @returns HSL string in format "H S% L%" (e.g., "0 100% 50%")
 */
export function hexToHslString(hex: string): string {
  const cleanHex = hex.replace('#', '')
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex

  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    return SHADCN_DEFAULTS['--primary'] // fallback
  }

  const r = parseInt(fullHex.slice(0, 2), 16) / 255
  const g = parseInt(fullHex.slice(2, 4), 16) / 255
  const b = parseInt(fullHex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  const hDeg = Math.round(h * 360)
  const sPercent = Math.round(s * 1000) / 10
  const lPercent = Math.round(l * 1000) / 10

  return `${hDeg} ${sPercent}% ${lPercent}%`
}

/**
 * Determine if a color is light (for foreground selection)
 *
 * @param hex - Hex color string
 * @returns true if the color is light (luminance > 0.5)
 */
export function isLightColor(hex: string): boolean {
  const cleanHex = hex.replace('#', '')
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex

  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    return false
  }

  const r = parseInt(fullHex.slice(0, 2), 16)
  const g = parseInt(fullHex.slice(2, 4), 16)
  const b = parseInt(fullHex.slice(4, 6), 16)

  // Relative luminance calculation
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Get foreground color for a given background (white or black in HSL)
 *
 * @param backgroundHex - Hex color of the background
 * @returns HSL string for appropriate foreground (dark text on light bg, light text on dark bg)
 */
export function getForegroundForBackground(backgroundHex: string): string {
  return isLightColor(backgroundHex) ? '240 10% 3.9%' : '0 0% 98%'
}

/**
 * Calculate a muted/subdued foreground color based on the primary foreground
 *
 * Unlike getForegroundForBackground(), this returns a DESATURATED text color
 * suitable for secondary/muted text, NOT a contrasting color for a background.
 *
 * shadcn semantics:
 * - --muted-foreground is a subdued TEXT color used on NORMAL backgrounds
 * - It is NOT the text color for the --muted background
 * - Light mode: ~46% lightness (medium gray)
 * - Dark mode: ~65% lightness (lighter gray)
 *
 * @param foregroundHsl - The main foreground color in HSL format "H S% L%"
 * @returns HSL string for muted foreground (typically 45-55% lightness in light mode)
 */
export function getMutedForeground(foregroundHsl: string): string {
  // Parse the foreground HSL
  const parts = foregroundHsl.split(' ')
  const h = parseFloat(parts[0]) || 240
  const s = parseFloat(parts[1]) || 3.8
  const l = parseFloat(parts[2]) || 3.9

  // For light mode (dark foreground): lighten to ~46% and desaturate
  // For dark mode (light foreground): darken to ~65%
  if (l < 50) {
    // Light mode - foreground is dark, muted should be medium gray
    return `${h} ${Math.max(3.8, s * 0.5).toFixed(1)}% 46.1%`
  } else {
    // Dark mode - foreground is light, muted should be lighter gray
    return `${h} ${Math.max(5, s * 0.5).toFixed(1)}% 64.9%`
  }
}

/**
 * Parse lightness value from an HSL string
 *
 * @param hslString - HSL string in format "H S% L%"
 * @returns Lightness value (0-100) or null if parsing fails
 */
export function parseLightness(hslString: string): number | null {
  const parts = hslString.split(' ')
  if (parts.length < 3) return null
  const lightness = parseFloat(parts[2])
  return isNaN(lightness) ? null : lightness
}

/**
 * Validate that a foreground color has appropriate contrast for the expected mode
 *
 * In light mode, foreground colors should be dark (<50% lightness)
 * In dark mode, foreground colors should be light (>50% lightness)
 *
 * @param foregroundHsl - The foreground color in HSL format
 * @param expectedMode - The expected color mode ('light' or 'dark')
 * @returns true if the foreground has appropriate contrast for the mode
 */
export function validateForegroundContrast(
  foregroundHsl: string,
  expectedMode: 'light' | 'dark'
): boolean {
  const lightness = parseLightness(foregroundHsl)
  if (lightness === null) return false

  if (expectedMode === 'light') {
    // Light mode: foreground should be dark (<50%)
    return lightness < 50
  } else {
    // Dark mode: foreground should be light (>50%)
    return lightness > 50
  }
}

/**
 * Convert hex color to rgba string with opacity
 * @param hex - Hex color string (e.g., '#ff5500' or 'ff5500')
 * @param opacity - Opacity value from 0 to 1
 * @returns rgba string (e.g., 'rgba(255, 85, 0, 0.5)')
 */
export function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '')
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex

  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    // Return a fallback rgba for invalid hex
    return `rgba(0, 0, 0, ${opacity})`
  }

  const r = parseInt(fullHex.substring(0, 2), 16)
  const g = parseInt(fullHex.substring(2, 4), 16)
  const b = parseInt(fullHex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Convert HSL CSS variable reference to hsl with opacity
 * @param hslVar - HSL variable (e.g., 'var(--primary)' or 'hsl(var(--primary))')
 * @param opacity - Opacity value from 0 to 1
 * @returns HSL string with opacity (e.g., 'hsl(var(--primary) / 0.5)')
 */
export function hslWithOpacity(hslVar: string, opacity: number): string {
  // Handle 'hsl(var(--x))' format
  if (hslVar.startsWith('hsl(')) {
    const inner = hslVar.slice(4, -1) // Extract 'var(--x)'
    return `hsl(${inner} / ${opacity})`
  }
  // Handle 'var(--x)' format
  if (hslVar.startsWith('var(')) {
    return `hsl(${hslVar} / ${opacity})`
  }
  // Handle raw HSL values (e.g., '240 5.9% 10%')
  return `hsl(${hslVar} / ${opacity})`
}

/**
 * Sanitize background colors that have unintended semantic meaning.
 * Detects "danger-like" colors (red, bright red) which can confuse users
 * when used as generic backgrounds, and replaces them with the design system primary.
 *
 * Use case: Imported websites may have red backgrounds that look like error states.
 *
 * @param color - Hex color string (e.g., '#ff0000' or 'ff0000')
 * @param replacement - CSS value to use instead (default: 'hsl(var(--primary))')
 * @returns Original color if safe, or replacement if it's a "danger-like" color
 */
export function sanitizeSemanticColor(
  color: string | undefined,
  replacement: string = 'hsl(var(--primary))'
): string | undefined {
  if (!color) return undefined

  const cleanHex = color.replace('#', '')
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) return color

  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  // Detect "red-like" colors: high red, low green/blue, red dominates
  const isRedLike = r > 200 && g < 150 && b < 150 && r > g * 1.5

  return isRedLike ? replacement : color
}
