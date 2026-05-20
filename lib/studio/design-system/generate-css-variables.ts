import { DesignSystem, type TokenTypography } from '@/lib/studio/import/types/design-system.types'
import { GENERIC_FONT_FAMILIES } from './font-registry'
import { isKnownCustomFont } from './font-extractor'
import { normalizeTypographyScale, ensureCompleteTypographySystem } from './typography-normalizer'

export const DESIGN_SYSTEM_THEME_FALLBACKS = {
  root: `  --background: 210 33% 98%;
  --foreground: 222 47% 11%;
  --muted: 210 20% 93%;
  --muted-foreground: 215 16% 47%;
  --popover: 210 33% 98%;
  --popover-foreground: 222 47% 11%;
  --card: 210 33% 98%;
  --card-foreground: 222 47% 11%;
  --border: 214 32% 85%;
  --input: 214 32% 85%;
  --primary: 221 83% 53%;
  --primary-foreground: 0 0% 100%;
  --secondary: 44 96% 58%;
  --secondary-foreground: 25 96% 12%;
  --accent: 205 82% 44%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --ring: 221 83% 53%;
  --radius: 0.625rem;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-surface: rgba(248, 250, 252, 0.92);
  --color-bg-surface-dark: rgba(15, 23, 42, 0.08);
  --color-bg-overlay: rgba(15, 23, 42, 0.45);
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #4a5568;
  --color-text-muted: #718096;
  --color-text-disabled: #a0aec0;
  --color-text-on-accent: #ffffff;
  --color-border-default: rgba(15, 23, 42, 0.1);
  --color-border-hover: rgba(15, 23, 42, 0.18);
  --color-border-active: #3b82f6;
  --component-border-radius: var(--radius, 0.625rem);
  --component-padding: var(--ds-spacing-lg, 24px);
  --ds-spacing-xxs: 4px;
  --ds-spacing-xs: 8px;
  --ds-spacing-sm: 12px;
  --ds-spacing-md: 16px;
  --ds-spacing-lg: 24px;
  --ds-spacing-xl: 32px;
  --ds-spacing-2xl: 48px;
  --ds-spacing-3xl: 64px;
  --ds-radius-sm: 0.25rem;
  --ds-radius-md: 0.375rem;
  --ds-radius-lg: 0.5rem;
  --ds-radius-xl: 0.75rem;
  --ds-radius-full: 9999px;
  --ds-heading-font: var(--font-heading, var(--font-sans));
  --ds-body-font: var(--font-body, var(--font-sans));
  --ds-ui-font: var(--font-ui, var(--font-sans));
  --ds-heading-heading-1-size: 3.5rem;
  --ds-heading-heading-1-line-height: 1.1;
  --ds-heading-heading-1-weight: 700;
  --ds-heading-heading-1-letter-spacing: -0.03em;
  --ds-heading-heading-2-size: 2.75rem;
  --ds-heading-heading-2-line-height: 1.15;
  --ds-heading-heading-2-weight: 700;
  --ds-heading-heading-2-letter-spacing: -0.025em;
  --ds-heading-heading-3-size: 2rem;
  --ds-heading-heading-3-line-height: 1.2;
  --ds-heading-heading-3-weight: 600;
  --ds-heading-heading-3-letter-spacing: -0.02em;
  --ds-heading-heading-4-size: 1.625rem;
  --ds-heading-heading-4-line-height: 1.25;
  --ds-heading-heading-4-weight: 600;
  --ds-heading-heading-4-letter-spacing: -0.015em;
  --ds-heading-heading-5-size: 1.375rem;
  --ds-heading-heading-5-line-height: 1.3;
  --ds-heading-heading-5-weight: 600;
  --ds-heading-heading-5-letter-spacing: -0.01em;
  --ds-heading-heading-6-size: 1.125rem;
  --ds-heading-heading-6-line-height: 1.4;
  --ds-heading-heading-6-weight: 600;
  --ds-heading-heading-6-letter-spacing: 0;
  --ds-body-body-1-size: 0.875rem;
  --ds-body-body-1-line-height: 1.65;
  --ds-body-body-1-weight: 400;
  --ds-body-body-1-letter-spacing: 0.01em;
  --ds-body-body-2-size: 1rem;
  --ds-body-body-2-line-height: 1.7;
  --ds-body-body-2-weight: 400;
  --ds-body-body-2-letter-spacing: 0.005em;
  --ds-body-body-3-size: 1.125rem;
  --ds-body-body-3-line-height: 1.7;
  --ds-body-body-3-weight: 400;
  --ds-body-body-3-letter-spacing: 0;
  --ds-body-body-4-size: 1.25rem;
  --ds-body-body-4-line-height: 1.6;
  --ds-body-body-4-weight: 400;
  --ds-body-body-4-letter-spacing: -0.005em;`,
  dark: `  color-scheme: dark;
  --background: 222 47% 9%;
  --foreground: 210 40% 96%;
  --muted: 217 33% 14%;
  --muted-foreground: 215 20% 65%;
  --popover: 222 47% 9%;
  --popover-foreground: 210 40% 96%;
  --card: 222 47% 11%;
  --card-foreground: 210 40% 96%;
  --border: 217 33% 22%;
  --input: 217 33% 22%;
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 44 96% 58%;
  --secondary-foreground: 25 96% 12%;
  --accent: 199 89% 48%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --ring: 217 91% 60%;
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-surface: rgba(30, 41, 59, 0.92);
  --color-bg-surface-dark: rgba(148, 163, 184, 0.08);
  --color-bg-overlay: rgba(0, 0, 0, 0.55);
  --color-text-primary: #f8fafc;
  --color-text-secondary: #e2e8f0;
  --color-text-muted: #94a3b8;
  --color-text-disabled: #64748b;
  --color-text-on-accent: #ffffff;
  --color-border-default: rgba(148, 163, 184, 0.15);
  --color-border-hover: rgba(148, 163, 184, 0.25);
  --color-border-active: #60a5fa;
  --component-border-radius: var(--radius, 0.625rem);
  --component-padding: var(--ds-spacing-lg, 24px);`,
  themeLight: `  color-scheme: light;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-surface: rgba(248, 250, 252, 0.92);
  --color-bg-surface-dark: rgba(15, 23, 42, 0.08);
  --color-bg-overlay: rgba(15, 23, 42, 0.45);
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #4a5568;
  --color-text-muted: #718096;
  --color-text-disabled: #a0aec0;
  --color-text-on-accent: #ffffff;
  --color-border-default: rgba(15, 23, 42, 0.1);
  --color-border-hover: rgba(15, 23, 42, 0.18);
  --color-border-active: #3b82f6;
  --component-border-radius: var(--radius, 0.625rem);
  --component-padding: var(--ds-spacing-lg, 24px);`,
  themeDark: `  color-scheme: dark;
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-surface: rgba(30, 41, 59, 0.92);
  --color-bg-surface-dark: rgba(148, 163, 184, 0.08);
  --color-bg-overlay: rgba(0, 0, 0, 0.55);
  --color-text-primary: #f8fafc;
  --color-text-secondary: #e2e8f0;
  --color-text-muted: #94a3b8;
  --color-text-disabled: #64748b;
  --color-text-on-accent: #ffffff;
  --color-border-default: rgba(148, 163, 184, 0.15);
  --color-border-hover: rgba(148, 163, 184, 0.25);
  --color-border-active: #60a5fa;
  --component-border-radius: var(--radius, 0.625rem);
  --component-padding: var(--ds-spacing-lg, 24px);`,
  themeInverted: `  color-scheme: dark;
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-surface: rgba(30, 41, 59, 0.92);
  --color-bg-surface-dark: rgba(148, 163, 184, 0.08);
  --color-bg-overlay: rgba(0, 0, 0, 0.55);
  --color-text-primary: #f8fafc;
  --color-text-secondary: #e0f2fe;
  --color-text-muted: #bfdbfe;
  --color-text-disabled: #7dd3fc;
  --color-text-on-accent: #ffffff;
  --color-border-default: rgba(148, 163, 184, 0.2);
  --color-border-hover: rgba(148, 163, 184, 0.3);
  --color-border-active: #60a5fa;
  --component-border-radius: var(--radius, 0.625rem);
  --component-padding: var(--ds-spacing-lg, 24px);`
} as const

type ThemeFallbackKey = keyof typeof DESIGN_SYSTEM_THEME_FALLBACKS

interface ParsedSection {
  headerLines: string[]
  keysInOrder: string[]
  variableMap: Map<string, string>
}

const DARK_PRESERVE_KEYS = new Set([
  '--background',
  '--foreground',
  '--muted',
  '--muted-foreground',
  '--popover',
  '--popover-foreground',
  '--card',
  '--card-foreground',
  '--border',
  '--input',
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-surface',
  '--color-bg-surface-dark',
  '--color-bg-overlay',
  '--color-border-default',
  '--color-border-hover',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-text-disabled'
])

const THEME_DARK_PRESERVE_KEYS = new Set([
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-surface',
  '--color-bg-surface-dark',
  '--color-bg-overlay',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-text-disabled',
  '--color-border-default',
  '--color-border-hover'
])

/**
 * Modern default font stack that avoids the generic "AI slop" aesthetic.
 * Uses Inter as primary with quality fallbacks for professional appearance.
 */
const DEFAULT_FONT_STACK = '"Inter var", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'

/**
 * Heading typography fallbacks with increased contrast for visual impact.
 * H1: 48-64px for hero impact (bold 700-800)
 * H2: 36-48px for section headers (bold 700)
 * H3-H6: Progressively smaller with appropriate weights (semibold 600)
 */
const HEADING_TYPOGRAPHY_FALLBACKS: Array<{
  size: string
  lineHeight: string
  weight: string
  letterSpacing: string
}> = [
  { size: '3.5rem', lineHeight: '1.1', weight: '700', letterSpacing: '-0.03em' },  // H1: 56px, bold
  { size: '2.75rem', lineHeight: '1.15', weight: '700', letterSpacing: '-0.025em' }, // H2: 44px, bold
  { size: '2rem', lineHeight: '1.2', weight: '600', letterSpacing: '-0.02em' },    // H3: 32px, semibold
  { size: '1.625rem', lineHeight: '1.25', weight: '600', letterSpacing: '-0.015em' }, // H4: 26px, semibold
  { size: '1.375rem', lineHeight: '1.3', weight: '600', letterSpacing: '-0.01em' }, // H5: 22px, semibold
  { size: '1.125rem', lineHeight: '1.4', weight: '600', letterSpacing: '0' }        // H6: 18px, semibold
]

/**
 * Body typography fallbacks with improved readability.
 * Base body: 16-18px for comfortable reading
 * Caption: 12-14px for secondary information
 */
const BODY_TYPOGRAPHY_FALLBACKS: Array<{
  size: string
  lineHeight: string
  weight: string
  letterSpacing: string
}> = [
  { size: '0.875rem', lineHeight: '1.65', weight: '400', letterSpacing: '0.01em' }, // Small/Caption: 14px
  { size: '1rem', lineHeight: '1.7', weight: '400', letterSpacing: '0.005em' },      // Base: 16px
  { size: '1.125rem', lineHeight: '1.7', weight: '400', letterSpacing: '0' },        // Medium: 18px
  { size: '1.25rem', lineHeight: '1.6', weight: '400', letterSpacing: '-0.005em' }   // Large: 20px
]

function normalizeTypographyName(raw: string | undefined | null, fallback: string): string {
  if (!raw || typeof raw !== 'string') {
    return fallback
  }

  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned.length > 0 ? cleaned : fallback
}

/**
 * Convert various color formats to HSL string format for CSS hsl() function
 * Handles hex, rgb, rgba, hsl, hsla, and CSS variables
 */
export function toHSL(color: string): string {
  if (!color || typeof color !== 'string') {
    return '0 0% 50%' // fallback
  }

  // Trim whitespace
  color = color.trim()

  // If it's already HSL format, extract the values
  if (color.startsWith('hsl(') || color.startsWith('hsla(')) {
    const match = color.match(/hsl[a]?\(([^)]+)\)/)
    if (match) {
      const values = match[1].split(',').map(v => v.trim())
      const h = values[0]
      const s = values[1].endsWith('%') ? values[1] : `${values[1]}%`
      const l = values[2].endsWith('%') ? values[2] : `${values[2]}%`
      return `${h} ${s} ${l}`
    }
  }

  // If it's CSS variable, return as-is (can't convert without context)
  if (color.startsWith('var(')) {
    return '210 40% 50%' // fallback blue for variables
  }

  // If it's hex format, convert to HSL
  if (color.startsWith('#')) {
    const cleanHex = color.slice(1)
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map(c => c + c).join('')
      : cleanHex

    // Validate hex format
    if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
      return '210 40% 50%' // fallback for invalid hex
    }

    // Parse hex to RGB
    const r = parseInt(fullHex.slice(0, 2), 16) / 255
    const g = parseInt(fullHex.slice(2, 4), 16) / 255
    const b = parseInt(fullHex.slice(4, 6), 16) / 255

    // Convert RGB to HSL
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
    const sPercent = Math.round(s * 100)
    const lPercent = Math.round(l * 100)

    return `${hDeg} ${sPercent}% ${lPercent}%`
  }

  // If it's RGB/RGBA format, convert to HSL
  if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
    const match = color.match(/rgb[a]?\(([^)]+)\)/)
    if (match) {
      const content = match[1]

      // Handle both comma-separated and space-delimited RGB formats
      // Traditional: rgb(255, 0, 0) or rgb(255, 0, 0, 0.5)
      // Modern: rgb(255 0 0) or rgb(255 0 0 / 0.5)
      const values = content.includes(',')
        ? content.split(',').map(component => {
            const trimmed = component.trim()
            return trimmed.endsWith('%') ? parseFloat(trimmed) / 100 : parseInt(trimmed) / 255
          })
        : (() => {
            const parts = content.trim().split(/\s+/)
            if (parts.includes('/')) {
              const slashIndex = parts.indexOf('/')
              return parts.slice(0, slashIndex).map(component => {
                const trimmed = component.trim()
                return trimmed.endsWith('%') ? parseFloat(trimmed) / 100 : parseInt(trimmed) / 255
              })
            }

            return parts.map(component => {
              const trimmed = component.trim()
              return trimmed.endsWith('%') ? parseFloat(trimmed) / 100 : parseInt(trimmed) / 255
            })
          })()

      // Validate we got valid RGB values
      if (values.length < 3 || values.some(v => isNaN(v))) {
        return '210 40% 50%' // fallback for invalid RGB
      }

      const [r, g, b] = values

      // Convert RGB to HSL
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
      const sPercent = Math.round(s * 100)
      const lPercent = Math.round(l * 100)

      return `${hDeg} ${sPercent}% ${lPercent}%`
    }
  }

  // If it's a named color, handle common ones
  const namedColors: Record<string, string> = {
    'transparent': '0 0% 100%',
    'black': '0 0% 0%',
    'white': '0 0% 100%',
    'red': '0 100% 50%',
    'green': '120 100% 50%',
    'blue': '240 100% 50%',
    'yellow': '60 100% 50%',
    'cyan': '180 100% 50%',
    'magenta': '300 100% 50%',
    'gray': '0 0% 50%',
    'grey': '0 0% 50%',
    'orange': '30 100% 50%',
    'purple': '270 100% 50%'
  }

  const lowerColor = color.toLowerCase()
  if (namedColors[lowerColor]) {
    return namedColors[lowerColor]
  }

  // Default fallback for unknown formats
  return '210 40% 50%'
}

/**
 * Normalizes a font family value for safe CSS output.
 *
 * IMPORTANT: This function now PRESERVES custom font names (like Museo Sans, Proxima Nova)
 * instead of replacing them with system-ui fallbacks. Custom fonts are quoted properly
 * for CSS safety but their names are kept intact.
 *
 * @param fontFamily - The font family string to normalize
 * @param options - Optional configuration
 * @returns Normalized font family string safe for CSS
 */
export function normalizeFontFamilyValue(
  fontFamily?: string | null,
  options?: { preserveCustomFonts?: boolean }
): string {
  const { preserveCustomFonts = true } = options ?? {}

  if (!fontFamily || typeof fontFamily !== 'string') {
    return DEFAULT_FONT_STACK
  }

  const trimmedWhole = fontFamily.replace(/[\0\r\n\t]+/g, ' ').trim()
  if (!trimmedWhole) {
    return DEFAULT_FONT_STACK
  }

  // Block CSS injection attempts
  if (/[{};@]/.test(trimmedWhole)) {
    return 'sans-serif'
  }

  // Preserve CSS variables as-is
  if (trimmedWhole.toLowerCase().startsWith('var(')) {
    return trimmedWhole
  }

  // Check for unbalanced quotes (potential injection)
  const doubleQuotes = (trimmedWhole.match(/"/g) || []).length
  if (doubleQuotes % 2 !== 0) {
    return 'sans-serif'
  }

  const singleQuotes = (trimmedWhole.match(/'/g) || []).length
  if (singleQuotes % 2 !== 0) {
    return 'sans-serif'
  }

  const segments = trimmedWhole
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  const formatted = segments
    .map((segment) => {
      const lower = segment.toLowerCase()
      if (lower.startsWith('var(')) {
        return segment
      }

      const hasMatchingDouble = segment.startsWith('"') && segment.endsWith('"')
      const hasMatchingSingle = segment.startsWith("'") && segment.endsWith("'")

      if ((segment.startsWith('"') && !hasMatchingDouble) || (segment.startsWith("'") && !hasMatchingSingle)) {
        return ''
      }

      let core = segment
      if (hasMatchingDouble || hasMatchingSingle) {
        core = segment.slice(1, -1)
      }

      core = core.trim()
      if (!core || /[{}@]/.test(core)) {
        return ''
      }

      const generic = core.toLowerCase()

      // Generic font families don't need quotes
      if (GENERIC_FONT_FAMILIES.has(generic)) {
        return generic
      }

      // Check if this is a known custom font that should be preserved
      if (preserveCustomFonts && isKnownCustomFont(core)) {
        // Custom fonts with spaces need quotes
        if (core.includes(' ')) {
          const escaped = core.replace(/(["\\])/g, '\\$1')
          return `"${escaped}"`
        }
        return core
      }

      // Simple alphanumeric font names (like Inter, Roboto) don't need quotes
      if (/^[\w.-]+$/i.test(core)) {
        return core
      }

      // Font names with spaces or special chars need quotes
      // IMPORTANT: Preserve the original font name, just add proper quoting
      const escaped = core.replace(/(["\\])/g, '\\$1')
      return `"${escaped}"`
    })
    .filter(Boolean)

  return formatted.length > 0 ? formatted.join(', ') : DEFAULT_FONT_STACK
}

function sanitizeCssLiteral(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') {
    return null
  }

  let value = raw.replace(/[\0\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!value) {
    return null
  }

  const lower = value.toLowerCase()
  for (const marker of ['@media', '@supports', '@keyframes', '@font-face']) {
    const idx = lower.indexOf(marker)
    if (idx !== -1) {
      value = value.slice(0, idx).trim()
      break
    }
  }

  const commentIdx = value.indexOf('/*')
  if (commentIdx !== -1) {
    value = value.slice(0, commentIdx).trim()
  }

  value = value.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!value) {
    return null
  }

  return value.replace(/;+\s*$/g, '').trim() || null
}

/**
 * Generate CSS variable declarations for a design system using the canonical `--ds-*` naming.
 */
export interface GeneratedCSSVariables {
  canonical: string
  aliases: string
  combined: string
  sections: {
    root: string
    dark: string
    themeLight: string
    themeDark: string
    themeInverted: string
  }
}

export function generateDesignSystemCSSVariables(
  designSystem: DesignSystem,
  aliasOverride?: Record<string, string> | null
): GeneratedCSSVariables {
  const canonicalVariables: string[] = []

  // Normalize typography scale to ensure proper H1 > H2 > H3 > H4 > H5 > H6 hierarchy
  // This fixes the issue where H4 was larger than H1 in some imported sites
  const defaultTypography = { heading: [], body: [], ui: [] }
  const normalizedDesignSystem: DesignSystem = {
    ...designSystem,
    typography: designSystem.typography
      ? ensureCompleteTypographySystem(normalizeTypographyScale(designSystem.typography))
      : defaultTypography
  }

  // Palette variables
  if (normalizedDesignSystem.palette) {
    Object.entries(normalizedDesignSystem.palette).forEach(([category, colors]) => {
      colors.forEach((color, index) => {
        const name = color.name || `${category}-${index + 1}`
        const sanitizedValue = sanitizeCssLiteral(color.value)
        if (sanitizedValue) {
          canonicalVariables.push(`  --ds-${category}-${name}: ${sanitizedValue};`)
        }
      })
    })

    // Add Tailwind-compatible alias variables in HSL format
    // Map primary palette to --ds-primary
    if (normalizedDesignSystem.palette.primary && normalizedDesignSystem.palette.primary.length > 0) {
      const primaryColor = normalizedDesignSystem.palette.primary[0]
      const sanitized = sanitizeCssLiteral(primaryColor.value) ?? primaryColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-primary: ${hslValue};`)
    }

    // Map secondary palette to --ds-secondary
    if (normalizedDesignSystem.palette.secondary && normalizedDesignSystem.palette.secondary.length > 0) {
      const secondaryColor = normalizedDesignSystem.palette.secondary[0]
      const sanitized = sanitizeCssLiteral(secondaryColor.value) ?? secondaryColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-secondary: ${hslValue};`)
    }

    // Map accent palette to --ds-accent
    if (normalizedDesignSystem.palette.accent && normalizedDesignSystem.palette.accent.length > 0) {
      const accentColor = normalizedDesignSystem.palette.accent[0]
      const sanitized = sanitizeCssLiteral(accentColor.value) ?? accentColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-accent: ${hslValue};`)
    }

    // Map neutral palette to --ds-neutral
    if (normalizedDesignSystem.palette.neutral && normalizedDesignSystem.palette.neutral.length > 0) {
      const neutralColor = normalizedDesignSystem.palette.neutral[0]
      const sanitized = sanitizeCssLiteral(neutralColor.value) ?? neutralColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-neutral: ${hslValue};`)
    }

    // Map surface palette to --ds-surface (fallback to neutral if no surface)
    if (normalizedDesignSystem.palette.surface && normalizedDesignSystem.palette.surface.length > 0) {
      const surfaceColor = normalizedDesignSystem.palette.surface[0]
      const sanitized = sanitizeCssLiteral(surfaceColor.value) ?? surfaceColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-surface: ${hslValue};`)
    } else if (normalizedDesignSystem.palette.neutral && normalizedDesignSystem.palette.neutral.length > 1) {
      const surfaceColor = normalizedDesignSystem.palette.neutral[1]
      const sanitized = sanitizeCssLiteral(surfaceColor.value) ?? surfaceColor.value
      const hslValue = toHSL(sanitized)
      canonicalVariables.push(`  --ds-surface: ${hslValue};`)
    }
  }

  // Typography variables (using normalized typography with proper scale)
  if (normalizedDesignSystem.typography) {
    const typographySets = normalizedDesignSystem.typography
    const emittedTypography = new Set<string>()
    const pushTypography = (line: string | null | undefined) => {
      if (!line || emittedTypography.has(line)) {
        return
      }
      emittedTypography.add(line)
      canonicalVariables.push(line)
    }

    const toTypographyMetric = (
      value: string | number | undefined | null,
      fallback?: string | number | null
    ): string | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toString() : null
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        const sanitized = sanitizeCssLiteral(value)
        return sanitized ?? value.trim()
      }

      if (typeof fallback === 'number') {
        return Number.isFinite(fallback) ? fallback.toString() : null
      }

      if (typeof fallback === 'string' && fallback.trim().length > 0) {
        const sanitizedFallback = sanitizeCssLiteral(fallback)
        return sanitizedFallback ?? fallback.trim()
      }

      return null
    }

    type TypographyOptions = {
      canonicalPrefix?: string
      fallbacks?: Array<{
        size: string
        lineHeight: string
        weight: string
        letterSpacing: string
      }>
    }

    const emitTypographyCategory = (
      category: 'heading' | 'body' | 'ui',
      fonts: TokenTypography[] | undefined,
      options: TypographyOptions = {}
    ) => {
      const resolvedFonts = Array.isArray(fonts) ? fonts : []
      const fallbacks = options.fallbacks ?? []
      const total = options.canonicalPrefix
        ? Math.max(resolvedFonts.length, fallbacks.length)
        : resolvedFonts.length

      for (let index = 0; index < total; index += 1) {
        const font = resolvedFonts[index]
        const fallback = fallbacks[index]
        const defaultName = `${category}-${index + 1}`
        const normalizedName = normalizeTypographyName(font?.name, defaultName)
        const variableNames = new Set<string>([`--ds-${category}-${normalizedName}`])

        if (options.canonicalPrefix) {
          variableNames.add(`--ds-${category}-${options.canonicalPrefix}-${index + 1}`)
        }

        const fontFamilyValue =
          font?.fontFamily && font.fontFamily.trim().length > 0
            ? normalizeFontFamilyValue(font.fontFamily)
            : null

        if (fontFamilyValue) {
          variableNames.forEach((variable) => {
            pushTypography(`  ${variable}: ${fontFamilyValue};`)
          })
        }

        const sizeValue = toTypographyMetric(font?.fontSize, fallback?.size)
        if (sizeValue) {
          variableNames.forEach((variable) => {
            pushTypography(`  ${variable}-size: ${sizeValue};`)
          })
        }

        const lineHeightValue = toTypographyMetric(font?.lineHeight, fallback?.lineHeight)
        if (lineHeightValue) {
          variableNames.forEach((variable) => {
            pushTypography(`  ${variable}-line-height: ${lineHeightValue};`)
          })
        }

        const weightValue = toTypographyMetric(font?.fontWeight, fallback?.weight)
        if (weightValue) {
          variableNames.forEach((variable) => {
            pushTypography(`  ${variable}-weight: ${weightValue};`)
          })
        }

        const letterSpacingFallback =
          fallback?.letterSpacing ?? (category === 'body' ? '0' : undefined)
        const letterSpacingValue = toTypographyMetric(font?.letterSpacing, letterSpacingFallback)
        if (letterSpacingValue) {
          variableNames.forEach((variable) => {
            pushTypography(`  ${variable}-letter-spacing: ${letterSpacingValue};`)
          })
        }
      }
    }

    emitTypographyCategory('heading', typographySets.heading, {
      canonicalPrefix: 'heading',
      fallbacks: HEADING_TYPOGRAPHY_FALLBACKS
    })

    emitTypographyCategory('body', typographySets.body, {
      canonicalPrefix: 'body',
      fallbacks: BODY_TYPOGRAPHY_FALLBACKS
    })

    emitTypographyCategory('ui', typographySets.ui)

    // Add Tailwind-compatible typography alias variables
    // Map heading typography to --ds-heading-font
    if (normalizedDesignSystem.typography.heading && normalizedDesignSystem.typography.heading.length > 0) {
      const headingFont = normalizedDesignSystem.typography.heading[0]
      pushTypography(`  --ds-heading-font: ${normalizeFontFamilyValue(headingFont.fontFamily)};`)
    }

    // Map body typography to --ds-body-font
    if (normalizedDesignSystem.typography.body && normalizedDesignSystem.typography.body.length > 0) {
      const bodyFont = normalizedDesignSystem.typography.body[0]
      pushTypography(`  --ds-body-font: ${normalizeFontFamilyValue(bodyFont.fontFamily)};`)
    }

    // Map UI/interactive typography to --ds-ui-font (fallback to body if no UI category)
    if (normalizedDesignSystem.typography.ui && normalizedDesignSystem.typography.ui.length > 0) {
      const uiFont = normalizedDesignSystem.typography.ui[0]
      pushTypography(`  --ds-ui-font: ${normalizeFontFamilyValue(uiFont.fontFamily)};`)
    } else if (normalizedDesignSystem.typography.body && normalizedDesignSystem.typography.body.length > 0) {
      const bodyFont = normalizedDesignSystem.typography.body[0]
      pushTypography(`  --ds-ui-font: ${normalizeFontFamilyValue(bodyFont.fontFamily)};`)
    }
  }

  // Spacing variables
  if (normalizedDesignSystem.spacing?.values) {
    const unit = normalizedDesignSystem.spacing.unit ?? ''
    normalizedDesignSystem.spacing.values.forEach((value, index) => {
      const name = value.name || `${index + 1}`
      canonicalVariables.push(`  --ds-spacing-${name}: ${value.value}${unit};`)
    })
  }

  // Border radius variables
  if (normalizedDesignSystem.radii?.values) {
    const unit = normalizedDesignSystem.radii.unit ?? ''
    normalizedDesignSystem.radii.values.forEach((value, index) => {
      const name = value.name || `${index + 1}`
      canonicalVariables.push(`  --ds-radius-${name}: ${value.value}${unit};`)
    })
  }

  // Shadow variables
  if (normalizedDesignSystem.shadows) {
    normalizedDesignSystem.shadows.forEach((shadow, index) => {
      const name = shadow.name || `${index + 1}`
      const sanitized = sanitizeCssLiteral(shadow.value)
      if (sanitized) {
        canonicalVariables.push(`  --ds-shadow-${name}: ${sanitized};`)
      }
    })
  }

  const canonical = canonicalVariables.join('\n')
  const resolvedAliasMap = aliasOverride ?? normalizedDesignSystem.aliases?.cssVariables ?? undefined
  const normalizeAliasValue = (key: string, value: string): string => {
    if (!value || typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('font')) {
      return normalizeFontFamilyValue(trimmed)
    }

    const sanitized = sanitizeCssLiteral(trimmed)
    return sanitized ?? trimmed
  }
  const aliasEntries: Array<[string, string]> = []
  const aliasVariables = resolvedAliasMap
    ? Object.entries(resolvedAliasMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const normalizedValue = normalizeAliasValue(key, value)
          aliasEntries.push([key, normalizedValue])
          return `  ${key}: ${normalizedValue};`
        })
    : []

  const aliases = aliasVariables.join('\n')
  const combinedSections = []
  if (canonical) combinedSections.push(canonical)
  if (aliases) combinedSections.push(aliases)
  const combined = combinedSections.join('\n')

  const sections =
    canonical.trim().length === 0 && aliasEntries.length === 0
      ? {
          root: DESIGN_SYSTEM_THEME_FALLBACKS.root,
          dark: DESIGN_SYSTEM_THEME_FALLBACKS.dark,
          themeLight: DESIGN_SYSTEM_THEME_FALLBACKS.themeLight,
          themeDark: DESIGN_SYSTEM_THEME_FALLBACKS.themeDark,
          themeInverted: DESIGN_SYSTEM_THEME_FALLBACKS.themeInverted
        }
      : buildGeneratedThemeSections(combined || DESIGN_SYSTEM_THEME_FALLBACKS.root, aliasEntries)

  return {
    canonical,
    aliases,
    combined,
    sections
  }
}

function buildGeneratedThemeSections(
  rootCombined: string,
  aliasEntries: Array<[string, string]>
): GeneratedCSSVariables['sections'] {
  const trimmedRoot = rootCombined.trim().length > 0 ? rootCombined : DESIGN_SYSTEM_THEME_FALLBACKS.root
  if (aliasEntries.length === 0) {
    return {
      root: trimmedRoot,
      dark: DESIGN_SYSTEM_THEME_FALLBACKS.dark,
      themeLight: DESIGN_SYSTEM_THEME_FALLBACKS.themeLight,
      themeDark: DESIGN_SYSTEM_THEME_FALLBACKS.themeDark,
      themeInverted: DESIGN_SYSTEM_THEME_FALLBACKS.themeInverted
    }
  }

  const aliasMap = new Map(aliasEntries)

  return {
    root: trimmedRoot,
    dark: buildDarkThemeBlock(aliasMap),
    themeLight: buildThemeLightBlock(aliasMap),
    themeDark: buildThemeDarkBlock(aliasMap),
    themeInverted: buildThemeInvertedBlock(aliasMap)
  }
}

const PARSED_FALLBACK_SECTIONS = new Map<ThemeFallbackKey, ParsedSection>()

function getParsedFallbackSection(key: ThemeFallbackKey): ParsedSection {
  const cached = PARSED_FALLBACK_SECTIONS.get(key)
  if (cached) {
    return cached
  }
  const parsed = parseFallbackSection(DESIGN_SYSTEM_THEME_FALLBACKS[key])
  PARSED_FALLBACK_SECTIONS.set(key, parsed)
  return parsed
}

function parseFallbackSection(section: string): ParsedSection {
  const headerLines: string[] = []
  const keysInOrder: string[] = []
  const variableMap = new Map<string, string>()

  section
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .forEach(line => {
      if (!line.startsWith('--')) {
        const header = line.endsWith(';') ? line : `${line};`
        headerLines.push(header)
        return
      }

      const idx = line.indexOf(':')
      if (idx === -1) {
        return
      }

      const key = line.slice(0, idx).trim()
      const rawValue = line.slice(idx + 1).trim()
      const value = rawValue.endsWith(';') ? rawValue.slice(0, -1).trim() : rawValue
      variableMap.set(key, value)
      keysInOrder.push(key)
    })

  return {
    headerLines,
    keysInOrder,
    variableMap
  }
}

function serializeSection(
  parsed: ParsedSection,
  overrides: Map<string, string>,
  preserveKeys: Set<string>
): string {
  const lines: string[] = []
  parsed.headerLines.forEach(header => {
    lines.push(`  ${header}`)
  })

  const emittedKeys = new Set<string>()
  parsed.keysInOrder.forEach(key => {
    const fallbackValue = parsed.variableMap.get(key)
    const overrideValue = overrides.get(key)
    const value = overrideValue !== undefined ? overrideValue : fallbackValue
    if (value !== undefined) {
      lines.push(`  ${key}: ${value};`)
      emittedKeys.add(key)
    }
  })

  const additionalKeys = Array.from(overrides.keys())
    .filter(key => !emittedKeys.has(key) && !preserveKeys.has(key))
    .sort((a, b) => a.localeCompare(b))

  additionalKeys.forEach(key => {
    const value = overrides.get(key)
    if (value !== undefined) {
      lines.push(`  ${key}: ${value};`)
    }
  })

  return lines.join('\n')
}

/**
 * Inverts the lightness of an HSL color value for dark mode generation
 *
 * @param hslValue - HSL value string like "210 40% 98%" or "0 0% 100%"
 * @returns Inverted HSL value with lightness flipped (L -> 100 - L)
 */
function invertLightness(hslValue: string): string {
  if (!hslValue || typeof hslValue !== 'string') {
    return hslValue
  }

  // Match HSL format: "H S% L%" where H can be any number, S and L are percentages
  const match = hslValue.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!match) {
    return hslValue // Can't parse, return as-is
  }

  const h = match[1]
  const s = match[2]
  const l = parseFloat(match[3])

  // Invert lightness: 100% -> 10%, 98% -> 12%, 0% -> 95%, etc.
  // Use a slight adjustment to avoid pure black/white
  const invertedL = Math.max(5, Math.min(95, 100 - l))

  return `${h} ${s}% ${Math.round(invertedL)}%`
}

/**
 * Checks if the aliasMap contains explicit dark mode values
 * (values that differ from typical light mode patterns)
 */
function hasExplicitDarkModeValues(aliasMap: Map<string, string>): boolean {
  // Check if --background or --color-bg-primary has dark-looking values
  const background = aliasMap.get('--background')
  const bgPrimary = aliasMap.get('--color-bg-primary')

  // Light mode typically has high lightness (80%+), dark mode has low lightness (20%-)
  const checkDarkBackground = (value: string | undefined): boolean => {
    if (!value) return false

    // For HSL format
    const hslMatch = value.match(/(\d+(?:\.\d+)?)%$/)
    if (hslMatch) {
      const lightness = parseFloat(hslMatch[1])
      return lightness < 30 // Dark if lightness < 30%
    }

    // For hex format
    if (value.startsWith('#')) {
      const hex = value.slice(1)
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance < 0.3
      }
    }

    return false
  }

  return checkDarkBackground(background) || checkDarkBackground(bgPrimary)
}

/**
 * Builds the dark theme block with proper dark mode values
 *
 * If the source site doesn't have explicit dark mode CSS detected,
 * this generates computed dark values by inverting lightness of colors.
 */
function buildDarkThemeBlock(aliasMap: Map<string, string>): string {
  const parsed = getParsedFallbackSection('dark')
  const overrides = new Map<string, string>()

  // Check if we have explicit dark mode values from the source
  const hasDarkMode = hasExplicitDarkModeValues(aliasMap)

  if (hasDarkMode) {
    // Use detected dark values directly
    aliasMap.forEach((value, key) => {
      if (parsed.variableMap.has(key) || !DARK_PRESERVE_KEYS.has(key)) {
        overrides.set(key, value)
      }
    })
  } else {
    // Generate dark values from light values by inverting colors
    // IMPORTANT: For semantic color variables that define background/foreground,
    // we use the fallback dark theme values instead of inverting
    // This ensures proper dark theme aesthetics

    aliasMap.forEach((value, key) => {
      // Skip keys that should use fallback dark values
      if (DARK_PRESERVE_KEYS.has(key)) {
        // Use fallback from parsed (the default dark theme)
        return
      }

      // For non-color variables (typography, spacing, etc.), use as-is
      if (!key.includes('color') && !key.includes('bg') && !key.includes('foreground') && !key.includes('border')) {
        overrides.set(key, value)
        return
      }

      // For color-related HSL variables, invert the lightness
      if (/^\d+\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(value.trim())) {
        overrides.set(key, invertLightness(value))
        return
      }

      // For other values, use as-is (non-color properties)
      if (!parsed.variableMap.has(key)) {
        overrides.set(key, value)
      }
    })
  }

  return serializeSection(parsed, overrides, DARK_PRESERVE_KEYS)
}

function buildThemeLightBlock(aliasMap: Map<string, string>): string {
  const colorEntries = Array.from(aliasMap.entries()).filter(([key]) => key.startsWith('--color-'))
  if (colorEntries.length === 0) {
    return DESIGN_SYSTEM_THEME_FALLBACKS.themeLight
  }

  // Parse the fallback to get all required variables
  const parsed = getParsedFallbackSection('themeLight')
  const merged = new Map<string, string>()

  // Start with fallback values to ensure essential variables are present
  parsed.variableMap.forEach((value, key) => {
    merged.set(key, value)
  })

  // Override with custom values from the aliasMap
  colorEntries.forEach(([key, value]) => {
    merged.set(key, value)
  })

  const lines = ['  color-scheme: light;']
  Array.from(merged.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      lines.push(`  ${key}: ${value};`)
    })

  return lines.join('\n')
}

/**
 * Builds the .theme-dark block with proper dark mode values
 *
 * IMPORTANT: This uses the dark fallback values for all semantic color variables
 * to ensure proper dark theme aesthetics. Only non-color variables from the
 * source are passed through.
 */
function buildThemeDarkBlock(aliasMap: Map<string, string>): string {
  const parsed = getParsedFallbackSection('themeDark')
  const overrides = new Map<string, string>()

  // Check if we have explicit dark mode values from the source
  const hasDarkMode = hasExplicitDarkModeValues(aliasMap)

  if (hasDarkMode) {
    // Use detected dark values directly
    aliasMap.forEach((value, key) => {
      if (!THEME_DARK_PRESERVE_KEYS.has(key)) {
        overrides.set(key, value)
      }
    })
  } else {
    // For .theme-dark, use FALLBACK dark values for semantic color variables
    // Only pass through non-color variables (typography, spacing, etc.)
    aliasMap.forEach((value, key) => {
      // Skip semantic color keys - they should use fallback dark values
      if (THEME_DARK_PRESERVE_KEYS.has(key)) {
        return
      }

      // Skip any color-related variables - use fallbacks instead
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('color') ||
        lowerKey.includes('-bg-') ||
        lowerKey.includes('foreground') ||
        lowerKey.includes('border') ||
        lowerKey.includes('background') ||
        lowerKey.includes('card') ||
        lowerKey.includes('muted') ||
        lowerKey.includes('popover') ||
        lowerKey.includes('input') ||
        lowerKey.includes('ring') ||
        lowerKey.includes('destructive') ||
        lowerKey.includes('chart')
      ) {
        // For HSL color values, we could invert them
        if (/^\d+\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(value.trim())) {
          overrides.set(key, invertLightness(value))
        }
        // Otherwise skip - use fallback
        return
      }

      // Non-color variables (typography, spacing, etc.) pass through
      overrides.set(key, value)
    })
  }

  return serializeSection(parsed, overrides, THEME_DARK_PRESERVE_KEYS)
}

/**
 * Builds the .theme-inverted block with proper inverted/dark mode values
 *
 * IMPORTANT: This uses the inverted fallback values for all semantic color variables
 * to ensure proper dark theme aesthetics. Only non-color variables from the
 * source are passed through.
 */
function buildThemeInvertedBlock(aliasMap: Map<string, string>): string {
  const parsed = getParsedFallbackSection('themeInverted')
  const overrides = new Map<string, string>()

  // Check if we have explicit dark mode values from the source
  const hasDarkMode = hasExplicitDarkModeValues(aliasMap)

  if (hasDarkMode) {
    // Use detected dark values directly
    aliasMap.forEach((value, key) => {
      if (!THEME_DARK_PRESERVE_KEYS.has(key)) {
        overrides.set(key, value)
      }
    })
  } else {
    // For .theme-inverted, use FALLBACK inverted values for semantic color variables
    // Only pass through non-color variables (typography, spacing, etc.)
    aliasMap.forEach((value, key) => {
      // Skip semantic color keys - they should use fallback inverted values
      if (THEME_DARK_PRESERVE_KEYS.has(key)) {
        return
      }

      // Skip any color-related variables - use fallbacks instead
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('color') ||
        lowerKey.includes('-bg-') ||
        lowerKey.includes('foreground') ||
        lowerKey.includes('border') ||
        lowerKey.includes('background') ||
        lowerKey.includes('card') ||
        lowerKey.includes('muted') ||
        lowerKey.includes('popover') ||
        lowerKey.includes('input') ||
        lowerKey.includes('ring') ||
        lowerKey.includes('destructive') ||
        lowerKey.includes('chart')
      ) {
        // For HSL color values, we could invert them
        if (/^\d+\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(value.trim())) {
          overrides.set(key, invertLightness(value))
        }
        // Otherwise skip - use fallback
        return
      }

      // Non-color variables (typography, spacing, etc.) pass through
      overrides.set(key, value)
    })
  }

  return serializeSection(parsed, overrides, THEME_DARK_PRESERVE_KEYS)
}
