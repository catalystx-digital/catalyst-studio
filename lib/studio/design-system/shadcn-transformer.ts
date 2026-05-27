/**
 * shadcn Variable Transformer
 *
 * Transforms extracted design system data into shadcn CSS variables.
 *
 * DESIGN PHILOSOPHY: Brand Identity + Source Page Base + shadcn Polish
 *
 * We extract brand colors from the source website (primary, secondary) and
 * semantic base colors (page background and body text) to preserve the client's
 * visible identity. Unresolved structural UI colors use shadcn's refined
 * defaults for consistent, polished UI.
 *
 * Why? Old business websites often have inconsistent grays, weird border colors,
 * and dated UI patterns. But their brand colors (the orange, the blue, etc.) are
 * their identity. We keep the identity, apply shadcn's design excellence.
 *
 * Result: Fast, polished exports that still feel like the client's site.
 */

import { SHADCN_DEFAULTS, SHADCN_DEFAULTS_DARK, getShadcnVariablesWithDefaults } from './shadcn-defaults'
import {
  hexToHslString,
  getForegroundForBackground,
  validateForegroundContrast,
} from './utils/color-utils'

/**
 * Minimal palette swatch interface for transformer use
 * (Avoids importing full dom-probe/types which has playwright dependency)
 */
interface PaletteSwatch {
  hex: string
  role?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background' | 'text'
  occurrences?: number
  cssProperties?: string[]
  sampleSelectors?: string[]
}

/**
 * Minimal palette capture interface for transformer use
 */
interface PaletteCapture {
  colors: PaletteSwatch[]
  primary?: PaletteSwatch | null
  secondary?: PaletteSwatch | null
  neutrals?: PaletteSwatch[]
  surface?: PaletteSwatch[]
  accent?: PaletteSwatch[]
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

function byOccurrencesDesc(a: PaletteSwatch, b: PaletteSwatch): number {
  return (b.occurrences ?? 0) - (a.occurrences ?? 0)
}

function isTextOnlySwatch(swatch: PaletteSwatch): boolean {
  const properties = swatch.cssProperties ?? []
  return (
    properties.includes('color') &&
    !properties.some(property =>
      property.includes('background') ||
      property.includes('border') ||
      property.includes('outline')
    )
  )
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return 0
  }

  const toLinear = (value: number): number => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  }

  return (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b))
}

function hasBackgroundProperty(swatch: PaletteSwatch): boolean {
  return swatch.cssProperties?.some(property => property.includes('background')) ?? false
}

function hasRootSurfaceSelector(swatch: PaletteSwatch): boolean {
  return swatch.sampleSelectors?.some(selector =>
    selector.includes('> body') ||
    selector.includes('body.') ||
    selector.includes('form#') ||
    selector.includes('div.container')
  ) ?? false
}

function selectSurfaceSwatch(palette: PaletteCapture): PaletteSwatch | undefined {
  const backgroundCandidates = [
    ...(palette.surface ?? []),
    ...palette.colors.filter(c =>
      c.role === 'background' ||
      hasBackgroundProperty(c)
    ),
  ]

  const explicitBackground = backgroundCandidates.filter(c => c.role === 'background')
  if (explicitBackground.length > 0) {
    return explicitBackground.sort(byOccurrencesDesc)[0]
  }

  const lightPageSurfaces = backgroundCandidates.filter(c =>
    hasBackgroundProperty(c) &&
    getRelativeLuminance(c.hex) >= 0.85
  )

  if (lightPageSurfaces.length > 0) {
    return lightPageSurfaces.sort((a, b) => {
      const rootScore = Number(hasRootSurfaceSelector(b)) - Number(hasRootSurfaceSelector(a))
      if (rootScore !== 0) return rootScore
      return byOccurrencesDesc(a, b)
    })[0]
  }

  return backgroundCandidates.sort(byOccurrencesDesc)[0]
}

function selectTextSwatch(palette: PaletteCapture): PaletteSwatch | undefined {
  return [
    ...palette.colors.filter(c => c.role === 'text' || isTextOnlySwatch(c)),
    ...(palette.neutrals ?? []).filter(c => c.role === 'text' || isTextOnlySwatch(c)),
    ...(palette.neutrals ?? []).filter(c => validateForegroundContrast(hexToHslString(c.hex), 'light')),
    ...palette.colors.filter(c => c.role === 'neutral' && validateForegroundContrast(hexToHslString(c.hex), 'light')),
  ].sort(byOccurrencesDesc)[0]
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
 * BRAND + SEMANTIC BASE APPROACH:
 * - Extract brand identity colors (primary, secondary, ring)
 * - Extract semantic page base colors when the probe captured them explicitly
 *   (background/surface and body text)
 * - Let shadcn defaults handle unresolved UI polish (border, destructive, charts)
 *
 * This preserves the client's visible page feel without importing every legacy
 * visual quirk from the source site.
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
  const secondaryCandidate = palette.secondary ?? palette.colors.find(c => c.role === 'secondary')
  const secondarySwatch = secondaryCandidate && !isTextOnlySwatch(secondaryCandidate)
    ? secondaryCandidate
    : undefined
  if (secondarySwatch) {
    extracted['--secondary'] = hexToHslString(secondarySwatch.hex)
    extracted['--secondary-foreground'] = getForegroundForBackground(secondarySwatch.hex)
    detectedCount += 2
  }

  // ============================================================
  // SEMANTIC PAGE BASE EXTRACTION
  // These are visible on nearly every imported page and must match the source.
  // ============================================================
  const backgroundSwatch = selectSurfaceSwatch(palette)

  if (backgroundSwatch) {
    const background = hexToHslString(backgroundSwatch.hex)
    extracted['--background'] = background
    extracted['--card'] = background
    extracted['--popover'] = background
    detectedCount += 3
  }

  const textSwatch = selectTextSwatch(palette)

  if (textSwatch) {
    const foreground = hexToHslString(textSwatch.hex)
    extracted['--foreground'] = foreground
    extracted['--card-foreground'] = foreground
    extracted['--popover-foreground'] = foreground
    extracted['--muted-foreground'] = foreground
    detectedCount += 4
  }

  // ============================================================
  // UI POLISH: Use shadcn defaults for unresolved structural colors
  // ============================================================
  // We intentionally still do not extract:
  // - border/input (shadcn's consistent neutral borders)
  // - destructive (always standard red)

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
