/**
 * shadcn Variable Transformer
 *
 * Transforms extracted design system data into shadcn CSS variables.
 *
 * DESIGN PHILOSOPHY: Brand Identity + shadcn Polish
 *
 * We extract BRAND colors from the source website (primary, secondary) to preserve
 * the client's brand identity. Everything else uses shadcn's refined defaults
 * for consistent, polished UI.
 *
 * Why? Old business websites often have inconsistent grays, weird border colors,
 * and dated UI patterns. But their brand colors (the orange, the blue, etc.) are
 * their identity. We keep the identity, apply shadcn's design excellence.
 *
 * Result: Fast, polished exports that still feel like the client's brand.
 */

import { SHADCN_DEFAULTS, SHADCN_DEFAULTS_DARK, getShadcnVariablesWithDefaults } from './shadcn-defaults'
import { hexToHslString, getForegroundForBackground } from './utils/color-utils'

/**
 * Minimal palette swatch interface for transformer use
 * (Avoids importing full dom-probe/types which has playwright dependency)
 */
interface PaletteSwatch {
  hex: string
  role?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background' | 'text'
}

/**
 * Minimal palette capture interface for transformer use
 */
interface PaletteCapture {
  colors: PaletteSwatch[]
  primary?: PaletteSwatch | null
  secondary?: PaletteSwatch | null
}

/**
 * Minimal typography sample interface for transformer use
 */
interface TypographySample {
  fontFamily: string
  fontStack?: string
  fontWeight: string
  fontSizePx: number
  lineHeightPx?: number | null
  letterSpacingPx?: number | null
  role?: 'heading' | 'body' | 'label' | 'cta' | 'unknown'
  textSample?: string
}

/**
 * Minimal spacing capture interface for transformer use
 */
interface SpacingCapture {
  baseUnitPx: number | null
  scale: Array<{ valuePx: number; occurrences?: number }>
}

/**
 * Minimal design system capture interface for transformer use
 * (Full type available in dom-probe/types for import pipeline)
 */
export interface DomDesignSystemCapture {
  palette: PaletteCapture
  typography?: TypographySample[]
  spacing?: SpacingCapture
}

/**
 * Variables that represent BRAND IDENTITY - extracted from source website
 *
 * These are the colors users consciously associate with the brand:
 * - Primary buttons, CTAs, highlights
 * - Secondary actions, tags
 * - Focus rings (matches brand)
 */
const BRAND_VARIABLES = [
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--ring',
] as const

/**
 * Variables that represent UI POLISH - use shadcn defaults
 *
 * These are structural/functional colors users don't consciously notice:
 * - Background colors (just "white" or "dark")
 * - Text colors (just "readable")
 * - Borders, inputs, muted states
 * - Hover/accent states
 *
 * shadcn has perfected these through design iteration. Old websites often
 * have inconsistent or dated values for these.
 */
const UI_POLISH_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--destructive',
  '--destructive-foreground',
  '--radius',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const

// Export for testing purposes
export { BRAND_VARIABLES, UI_POLISH_VARIABLES }

/**
 * Typography token stored in design system
 */
export interface TypographyToken {
  fontFamily: string
  fontStack?: string
  fontSize: string
  fontWeight: string | number
  lineHeight?: string
  letterSpacing?: string
  name?: string
  role: 'heading' | 'body' | 'ui'
}

/**
 * Spacing token stored in design system
 */
export interface SpacingToken {
  value: number
  unit: string
  name?: string
}

/**
 * New simplified design system storage format
 */
export interface ShadcnDesignSystemTokens {
  variables: Record<string, string>
  darkVariables?: Record<string, string>

  /** Typography styles captured from the source website */
  typography?: {
    heading: TypographyToken[]
    body: TypographyToken[]
    ui: TypographyToken[]
  }

  /** Spacing scale captured from the source website */
  spacing?: {
    baseUnitPx: number | null
    scale: SpacingToken[]
  }

  extraction: {
    timestamp: string
    confidence: number
    source: 'detected' | 'default' | 'mixed'
    detectedCount: number
    defaultCount: number
  }
}

/**
 * Convert a typography sample to a stored token
 */
function normalizeTypographySample(sample: TypographySample, role: 'heading' | 'body' | 'ui'): TypographyToken {
  return {
    fontFamily: sample.fontFamily,
    fontStack: sample.fontStack,
    fontSize: `${sample.fontSizePx}px`,
    fontWeight: sample.fontWeight,
    lineHeight: sample.lineHeightPx ? `${sample.lineHeightPx}px` : undefined,
    letterSpacing: sample.letterSpacingPx ? `${sample.letterSpacingPx}px` : undefined,
    role,
  }
}

/**
 * Infer a human-readable name for a spacing value
 */
function inferSpacingName(valuePx: number): string {
  if (valuePx <= 2) return 'xs'
  if (valuePx <= 4) return 'sm'
  if (valuePx <= 8) return 'md'
  if (valuePx <= 16) return 'lg'
  if (valuePx <= 24) return 'xl'
  if (valuePx <= 32) return '2xl'
  if (valuePx <= 48) return '3xl'
  return '4xl'
}

/**
 * Extract typography from DOM probe capture
 */
function extractTypography(
  samples?: TypographySample[]
): ShadcnDesignSystemTokens['typography'] {
  if (!samples || samples.length === 0) {
    return undefined
  }

  const heading: TypographyToken[] = []
  const body: TypographyToken[] = []
  const ui: TypographyToken[] = []

  for (const sample of samples) {
    const role = sample.role
    if (role === 'heading') {
      heading.push(normalizeTypographySample(sample, 'heading'))
    } else if (role === 'body') {
      body.push(normalizeTypographySample(sample, 'body'))
    } else if (role === 'label' || role === 'cta') {
      ui.push(normalizeTypographySample(sample, 'ui'))
    }
    // Ignore 'unknown' role samples
  }

  // Sort by font size (largest first for headings, smallest first for body/ui)
  heading.sort((a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize))
  body.sort((a, b) => parseFloat(a.fontSize) - parseFloat(b.fontSize))
  ui.sort((a, b) => parseFloat(a.fontSize) - parseFloat(b.fontSize))

  // Only return if we have at least some typography
  if (heading.length === 0 && body.length === 0 && ui.length === 0) {
    return undefined
  }

  return { heading, body, ui }
}

/**
 * Extract spacing from DOM probe capture
 */
function extractSpacing(
  spacingCapture?: SpacingCapture
): ShadcnDesignSystemTokens['spacing'] {
  if (!spacingCapture || !spacingCapture.scale || spacingCapture.scale.length === 0) {
    return undefined
  }

  // Sort scale by value
  const sortedScale = [...spacingCapture.scale].sort((a, b) => a.valuePx - b.valuePx)

  // Convert to stored format with names
  const scale: SpacingToken[] = sortedScale.map((s) => ({
    value: s.valuePx,
    unit: 'px',
    name: inferSpacingName(s.valuePx),
  }))

  return {
    baseUnitPx: spacingCapture.baseUnitPx,
    scale,
  }
}

/**
 * Transform DOM probe capture to shadcn CSS variables
 *
 * BRAND + POLISH APPROACH:
 * - Extract ONLY brand identity colors (primary, secondary, ring)
 * - Let shadcn defaults handle all UI polish (muted, border, accent, etc.)
 *
 * This produces modern, polished exports that preserve the client's brand.
 */
export function toShadcnVariables(capture: DomDesignSystemCapture): ShadcnDesignSystemTokens {
  const palette = capture.palette
  const extracted: Record<string, string> = {}
  let detectedCount = 0

  // ============================================================
  // BRAND IDENTITY EXTRACTION
  // These colors ARE the client's brand - we preserve them
  // ============================================================

  // --- Primary Brand Color ---
  const primarySwatch = palette.primary ?? palette.colors.find(c => c.role === 'primary')
  if (primarySwatch) {
    extracted['--primary'] = hexToHslString(primarySwatch.hex)
    extracted['--primary-foreground'] = getForegroundForBackground(primarySwatch.hex)
    extracted['--ring'] = extracted['--primary'] // Focus ring matches brand
    detectedCount += 3
  }

  // --- Secondary Brand Color ---
  const secondarySwatch = palette.secondary ?? palette.colors.find(c => c.role === 'secondary')
  if (secondarySwatch) {
    extracted['--secondary'] = hexToHslString(secondarySwatch.hex)
    extracted['--secondary-foreground'] = getForegroundForBackground(secondarySwatch.hex)
    detectedCount += 2
  }

  // ============================================================
  // UI POLISH: Use shadcn defaults for everything else
  // ============================================================
  // We intentionally DO NOT extract:
  // - background/foreground (shadcn's clean white/dark text)
  // - muted/muted-foreground (shadcn's refined grays)
  // - accent/accent-foreground (shadcn's hover states)
  // - border/input (shadcn's consistent neutral borders)
  // - destructive (always standard red)
  // - card/popover (clean surface colors)

  // Fill in shadcn defaults for all UI polish variables
  const variables = getShadcnVariablesWithDefaults(extracted, 'light')

  // Dark mode: Brand colors adapt, UI polish uses shadcn dark defaults
  const darkExtracted: Record<string, string> = {}

  if (primarySwatch) {
    darkExtracted['--primary'] = hexToHslString(primarySwatch.hex)
    darkExtracted['--primary-foreground'] = getForegroundForBackground(primarySwatch.hex)
    darkExtracted['--ring'] = darkExtracted['--primary']
  }
  if (secondarySwatch) {
    darkExtracted['--secondary'] = hexToHslString(secondarySwatch.hex)
    darkExtracted['--secondary-foreground'] = getForegroundForBackground(secondarySwatch.hex)
  }

  const darkVariables = getShadcnVariablesWithDefaults(darkExtracted, 'dark')

  // ============================================================
  // TYPOGRAPHY EXTRACTION
  // Preserve captured font styles from the source website
  // ============================================================
  const typography = extractTypography(capture.typography)

  // ============================================================
  // SPACING EXTRACTION
  // Preserve captured spacing scale from the source website
  // ============================================================
  const spacing = extractSpacing(capture.spacing)

  const totalVariables = Object.keys(SHADCN_DEFAULTS).length
  const defaultCount = totalVariables - detectedCount

  return {
    variables,
    darkVariables,
    typography,
    spacing,
    extraction: {
      timestamp: new Date().toISOString(),
      confidence: detectedCount / totalVariables,
      source: detectedCount === 0 ? 'default' : detectedCount === totalVariables ? 'detected' : 'mixed',
      detectedCount,
      defaultCount,
    },
  }
}

/**
 * Generate complete CSS output for export
 */
export function generateExportCss(tokens: ShadcnDesignSystemTokens): string {
  const lightVars = Object.entries(tokens.variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  const darkVars = tokens.darkVariables
    ? Object.entries(tokens.darkVariables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n')
    : Object.entries(SHADCN_DEFAULTS_DARK)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n')

  return `:root {
${lightVars}
}

.dark {
${darkVars}
}`
}
