/**
 * Design System Reader
 *
 * Handles reading design systems from storage.
 *
 * Runtime readers should use the strict helpers in this file. The legacy
 * conversion helpers remain for import/migration paths that explicitly opt in.
 */

import { SHADCN_DEFAULTS, getShadcnVariablesWithDefaults } from './shadcn-defaults'
import { generateExportCss, type ShadcnDesignSystemTokens } from './shadcn-transformer'
import { hexToHslString } from './utils/color-utils'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'

type ShadcnTypography = NonNullable<ShadcnDesignSystemTokens['typography']>
type ShadcnSpacing = NonNullable<ShadcnDesignSystemTokens['spacing']>

export type DesignSystemReaderErrorCode =
  | 'DESIGN_SYSTEM_MISSING'
  | 'DESIGN_CONCEPT_NOT_FOUND'
  | 'DESIGN_SYSTEM_LEGACY_PAYLOAD'
  | 'DESIGN_SYSTEM_INVALID_PAYLOAD'

export class DesignSystemReaderError extends Error {
  constructor(
    public readonly code: DesignSystemReaderErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DesignSystemReaderError'
  }
}

export function isDesignSystemReaderError(error: unknown): error is DesignSystemReaderError {
  if (!isRecord(error) || typeof error.message !== 'string') {
    return false
  }

  const code = error.code
  return (
    (error.name === 'DesignSystemReaderError' || typeof code === 'string') &&
    (
      code === 'DESIGN_SYSTEM_MISSING' ||
      code === 'DESIGN_CONCEPT_NOT_FOUND' ||
      code === 'DESIGN_SYSTEM_LEGACY_PAYLOAD' ||
      code === 'DESIGN_SYSTEM_INVALID_PAYLOAD'
    ) &&
    (
      error.context === undefined ||
      error.context === null ||
      isRecord(error.context)
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(entry => typeof entry === 'string')
}

function cloneTokens(tokens: ShadcnDesignSystemTokens): ShadcnDesignSystemTokens {
  return JSON.parse(JSON.stringify(tokens)) as ShadcnDesignSystemTokens
}

/**
 * Check if a string produces a valid Date when parsed
 */
function isValidDateString(str: unknown): str is string {
  if (typeof str !== 'string' || str.trim() === '') return false
  const date = new Date(str)
  return !isNaN(date.getTime())
}

/**
 * Check if a value is a valid finite number
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value)
}

/**
 * Check if tokens are in the new simplified format
 */
export function isNewFormat(tokens: unknown): tokens is ShadcnDesignSystemTokens {
  return (
    tokens !== null &&
    typeof tokens === 'object' &&
    'variables' in tokens &&
    typeof (tokens as any).variables === 'object' &&
    'extraction' in tokens
  )
}

/**
 * Strict current-format guard for runtime callers.
 *
 * This accepts only the shadcn token payload shape written by the current
 * design-system pipeline. It does not accept legacy palette payloads and does
 * not fill missing fields from defaults.
 */
export function isShadcnDesignSystemTokens(tokens: unknown): tokens is ShadcnDesignSystemTokens {
  return validateShadcnDesignSystemTokens(tokens) === null
}

function validateShadcnDesignSystemTokens(tokens: unknown): string | null {
  if (!isRecord(tokens)) {
    return '$'
  }

  if (!isStringRecord(tokens.variables)) {
    return 'variables'
  }

  if (!isRecord(tokens.extraction)) {
    return 'extraction'
  }

  const extraction = tokens.extraction
  const source = extraction.source
  if (tokens.darkVariables !== undefined && !isStringRecord(tokens.darkVariables)) {
    return 'darkVariables'
  }

  if (tokens.typography !== undefined) {
    if (!isRecord(tokens.typography)) {
      return 'typography'
    }

    for (const group of ['heading', 'body', 'ui'] as const) {
      const entries = tokens.typography[group]
      if (!Array.isArray(entries)) {
        return `typography.${group}`
      }

      for (const [index, entry] of entries.entries()) {
        if (!isRecord(entry)) {
          return `typography.${group}.${index}`
        }
        if (typeof entry.fontFamily !== 'string') {
          return `typography.${group}.${index}.fontFamily`
        }
        if (typeof entry.fontSize !== 'string') {
          return `typography.${group}.${index}.fontSize`
        }
        if (typeof entry.fontWeight !== 'string' && typeof entry.fontWeight !== 'number') {
          return `typography.${group}.${index}.fontWeight`
        }
        if (entry.role !== 'heading' && entry.role !== 'body' && entry.role !== 'ui') {
          return `typography.${group}.${index}.role`
        }
        if (entry.fontStack !== undefined && typeof entry.fontStack !== 'string') {
          return `typography.${group}.${index}.fontStack`
        }
        if (entry.lineHeight !== undefined && typeof entry.lineHeight !== 'string') {
          return `typography.${group}.${index}.lineHeight`
        }
        if (entry.letterSpacing !== undefined && typeof entry.letterSpacing !== 'string') {
          return `typography.${group}.${index}.letterSpacing`
        }
        if (entry.name !== undefined && typeof entry.name !== 'string') {
          return `typography.${group}.${index}.name`
        }
      }
    }
  }

  if (tokens.spacing !== undefined) {
    if (!isRecord(tokens.spacing)) {
      return 'spacing'
    }
    if (tokens.spacing.baseUnitPx !== null && !isValidNumber(tokens.spacing.baseUnitPx)) {
      return 'spacing.baseUnitPx'
    }
    if (!Array.isArray(tokens.spacing.scale)) {
      return 'spacing.scale'
    }
    for (const [index, entry] of tokens.spacing.scale.entries()) {
      if (!isRecord(entry)) {
        return `spacing.scale.${index}`
      }
      if (!isValidNumber(entry.value)) {
        return `spacing.scale.${index}.value`
      }
      if (typeof entry.unit !== 'string') {
        return `spacing.scale.${index}.unit`
      }
      if (entry.name !== undefined && typeof entry.name !== 'string') {
        return `spacing.scale.${index}.name`
      }
    }
  }

  if (!isValidDateString(extraction.timestamp)) {
    return 'extraction.timestamp'
  }

  if (!isValidNumber(extraction.confidence)) {
    return 'extraction.confidence'
  }

  if (source !== 'detected' && source !== 'default' && source !== 'mixed') {
    return 'extraction.source'
  }

  if (!isValidNumber(extraction.detectedCount)) {
    return 'extraction.detectedCount'
  }

  if (!isValidNumber(extraction.defaultCount)) {
    return 'extraction.defaultCount'
  }

  return null
}

/**
 * Strict nullable runtime reader.
 *
 * Missing records are an allowed state and return null. Legacy palette payloads
 * and malformed current-format payloads are invalid runtime data and throw.
 */
export function readNullableShadcnDesignSystemTokens(
  tokens: unknown,
  context?: Record<string, unknown>
): ShadcnDesignSystemTokens | null {
  if (tokens === null || tokens === undefined) {
    return null
  }

  if (isLegacyFormat(tokens)) {
    throw new DesignSystemReaderError(
      'DESIGN_SYSTEM_LEGACY_PAYLOAD',
      'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
      context
    )
  }

  const invalidPath = validateShadcnDesignSystemTokens(tokens)
  if (invalidPath) {
    throw new DesignSystemReaderError(
      'DESIGN_SYSTEM_INVALID_PAYLOAD',
      'Design-system payload is not valid current shadcn token data.',
      { ...context, invalidPath }
    )
  }

  return cloneTokens(tokens as ShadcnDesignSystemTokens)
}

export function readShadcnDesignSystemTokens(
  tokens: unknown,
  context?: Record<string, unknown>
): ShadcnDesignSystemTokens {
  const parsed = readNullableShadcnDesignSystemTokens(tokens, context)
  if (!parsed) {
    throw new DesignSystemReaderError(
      'DESIGN_SYSTEM_MISSING',
      'Design-system tokens are missing.',
      context
    )
  }
  return parsed
}

export function generateStrictDesignSystemCss(
  tokens: unknown,
  context?: Record<string, unknown>
): string | null {
  const parsed = readNullableShadcnDesignSystemTokens(tokens, context)
  if (!parsed) {
    return null
  }

  const lightVars = Object.entries(parsed.variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  const darkVars = parsed.darkVariables
    ? Object.entries(parsed.darkVariables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n')
    : null

  return darkVars
    ? `:root {
${lightVars}
}

.dark {
${darkVars}
}`
    : `:root {
${lightVars}
}`
}

/**
 * Check if tokens are in the old legacy format
 */
export function isLegacyFormat(tokens: unknown): tokens is DesignSystem {
  return (
    tokens !== null &&
    typeof tokens === 'object' &&
    'palette' in tokens &&
    typeof (tokens as any).palette === 'object'
  )
}

/**
 * Convert legacy DesignSystem format to shadcn variables
 *
 * TODO: Remove once all test data is re-imported with new format
 */
export function legacyToShadcnVariables(designSystem: DesignSystem): Record<string, string> {
  const variables: Record<string, string> = {}

  // If aliases already exist, use them (they're already computed)
  if (designSystem.aliases?.cssVariables) {
    const aliases = designSystem.aliases.cssVariables

    // Map existing aliases to shadcn format
    if (aliases['--background']) variables['--background'] = aliases['--background']
    if (aliases['--foreground']) variables['--foreground'] = aliases['--foreground']
    if (aliases['--primary']) variables['--primary'] = aliases['--primary']
    if (aliases['--primary-foreground']) variables['--primary-foreground'] = aliases['--primary-foreground']
    if (aliases['--secondary']) variables['--secondary'] = aliases['--secondary']
    if (aliases['--secondary-foreground']) variables['--secondary-foreground'] = aliases['--secondary-foreground']
    if (aliases['--muted']) variables['--muted'] = aliases['--muted']
    if (aliases['--muted-foreground']) variables['--muted-foreground'] = aliases['--muted-foreground']
    if (aliases['--accent']) variables['--accent'] = aliases['--accent']
    if (aliases['--accent-foreground']) variables['--accent-foreground'] = aliases['--accent-foreground']
    if (aliases['--destructive']) variables['--destructive'] = aliases['--destructive']
    if (aliases['--destructive-foreground']) variables['--destructive-foreground'] = aliases['--destructive-foreground']
    if (aliases['--border']) variables['--border'] = aliases['--border']
    if (aliases['--input']) variables['--input'] = aliases['--input']
    if (aliases['--ring']) variables['--ring'] = aliases['--ring']
    if (aliases['--radius']) variables['--radius'] = aliases['--radius']
    if (aliases['--card']) variables['--card'] = aliases['--card']
    if (aliases['--card-foreground']) variables['--card-foreground'] = aliases['--card-foreground']
    if (aliases['--popover']) variables['--popover'] = aliases['--popover']
    if (aliases['--popover-foreground']) variables['--popover-foreground'] = aliases['--popover-foreground']

    // Fill in defaults for any missing
    return getShadcnVariablesWithDefaults(variables, 'light')
  }

  // Otherwise, extract from palette
  const palette = designSystem.palette

  // Background from surface
  if (palette.surface?.[0]?.hex) {
    variables['--background'] = hexToHslString(palette.surface[0].hex)
  } else if (palette.surface?.[0]?.value) {
    variables['--background'] = hexToHslString(palette.surface[0].value)
  }

  // Primary
  if (palette.primary?.[0]?.hex) {
    variables['--primary'] = hexToHslString(palette.primary[0].hex)
  } else if (palette.primary?.[0]?.value) {
    variables['--primary'] = hexToHslString(palette.primary[0].value)
  }

  // Secondary
  if (palette.secondary?.[0]?.hex) {
    variables['--secondary'] = hexToHslString(palette.secondary[0].hex)
  } else if (palette.secondary?.[0]?.value) {
    variables['--secondary'] = hexToHslString(palette.secondary[0].value)
  }

  // Accent
  if (palette.accent?.[0]?.hex) {
    variables['--accent'] = hexToHslString(palette.accent[0].hex)
  } else if (palette.accent?.[0]?.value) {
    variables['--accent'] = hexToHslString(palette.accent[0].value)
  }

  // Neutral for muted/border
  if (palette.neutral?.[0]?.hex) {
    variables['--muted'] = hexToHslString(palette.neutral[0].hex)
    variables['--border'] = hexToHslString(palette.neutral[0].hex)
    variables['--input'] = hexToHslString(palette.neutral[0].hex)
  }

  // Radius from radii
  if (designSystem.radii?.base) {
    const unit = designSystem.radii.unit || 'px'
    variables['--radius'] = `${designSystem.radii.base}${unit}`
  }

  return getShadcnVariablesWithDefaults(variables, 'light')
}

/**
 * Get shadcn CSS variables from any format of stored tokens
 *
 * This is the main reading function that handles both formats.
 */
export function getDesignSystemVariables(tokens: unknown): Record<string, string> {
  // New format - return variables directly
  if (isNewFormat(tokens)) {
    return tokens.variables
  }

  // Old format - convert to shadcn variables
  if (isLegacyFormat(tokens)) {
    return legacyToShadcnVariables(tokens)
  }

  // Unknown or null - return defaults
  return { ...SHADCN_DEFAULTS }
}

/**
 * Get design system tokens in the new normalized format
 *
 * Converts any stored format to the new ShadcnDesignSystemTokens format.
 * Preserves typography and spacing data when available.
 */
export function getNormalizedDesignSystem(tokens: unknown): ShadcnDesignSystemTokens {
  // Already in new format - return with all fields including typography/spacing
  if (isNewFormat(tokens)) {
    return {
      variables: tokens.variables,
      darkVariables: tokens.darkVariables,
      typography: tokens.typography,
      spacing: tokens.spacing,
      extraction: {
        ...tokens.extraction,
        timestamp: isValidDateString(tokens.extraction.timestamp)
          ? tokens.extraction.timestamp
          : new Date().toISOString(),
        confidence: isValidNumber(tokens.extraction.confidence)
          ? tokens.extraction.confidence
          : 0.5,
      },
    }
  }

  // Convert from legacy
  if (isLegacyFormat(tokens)) {
    const variables = legacyToShadcnVariables(tokens)

    // Convert legacy typography if present
    const typography = convertLegacyTypography(tokens.typography)

    // Convert legacy spacing if present
    const spacing = convertLegacySpacing(tokens.spacing)

    // Validate metadata values before using them
    const capturedAt = tokens.metadata?.capturedAt
    const confidence = tokens.metadata?.confidence

    return {
      variables,
      typography,
      spacing,
      extraction: {
        timestamp: isValidDateString(capturedAt) ? capturedAt : new Date().toISOString(),
        confidence: isValidNumber(confidence) ? confidence : 0.5,
        source: 'detected',
        detectedCount: Object.keys(variables).length,
        defaultCount: 0,
      },
    }
  }

  // Return defaults
  return {
    variables: { ...SHADCN_DEFAULTS },
    extraction: {
      timestamp: new Date().toISOString(),
      confidence: 0,
      source: 'default',
      detectedCount: 0,
      defaultCount: Object.keys(SHADCN_DEFAULTS).length,
    },
  }
}

/**
 * Convert legacy typography format to new format
 */
function convertLegacyTypography(
  legacyTypography: DesignSystem['typography'] | undefined
): ShadcnDesignSystemTokens['typography'] | undefined {
  if (!legacyTypography) return undefined

  const heading: ShadcnTypography['heading'] = []
  const body: ShadcnTypography['body'] = []
  const ui: ShadcnTypography['ui'] = []

  // Convert headings
  if (legacyTypography.heading) {
    for (const h of legacyTypography.heading) {
      heading.push({
        fontFamily: h.fontFamily || 'system-ui',
        fontSize: h.fontSize || '16px',
        fontWeight: h.fontWeight || '600',
        lineHeight: h.lineHeight,
        letterSpacing: h.letterSpacing,
        role: 'heading',
      })
    }
  }

  // Convert body text
  if (legacyTypography.body) {
    for (const b of legacyTypography.body) {
      body.push({
        fontFamily: b.fontFamily || 'system-ui',
        fontSize: b.fontSize || '16px',
        fontWeight: b.fontWeight || '400',
        lineHeight: b.lineHeight,
        letterSpacing: b.letterSpacing,
        role: 'body',
      })
    }
  }

  if (legacyTypography.ui) {
    for (const u of legacyTypography.ui) {
      ui.push({
        fontFamily: u.fontFamily || 'system-ui',
        fontSize: u.fontSize || '16px',
        fontWeight: u.fontWeight || '400',
        lineHeight: u.lineHeight,
        letterSpacing: u.letterSpacing,
        role: 'ui',
      })
    }
  }

  if (heading.length === 0 && body.length === 0 && ui.length === 0) {
    return undefined
  }

  return { heading, body, ui }
}

/**
 * Convert legacy spacing format to new format
 */
function convertLegacySpacing(
  legacySpacing: DesignSystem['spacing'] | undefined
): ShadcnDesignSystemTokens['spacing'] | undefined {
  if (!legacySpacing) return undefined

  const scale: ShadcnSpacing['scale'] = []

  if (Array.isArray(legacySpacing.values)) {
    for (const s of legacySpacing.values) {
      scale.push({
        value: s.value,
        unit: legacySpacing.unit || 'px',
        name: s.name,
      })
    }
  }

  if (scale.length === 0) {
    return undefined
  }

  return {
    baseUnitPx: legacySpacing.base ?? null,
    scale,
  }
}

/**
 * Generate CSS for export from any format of stored tokens
 */
export function generateDesignSystemCss(tokens: unknown): string {
  const normalized = getNormalizedDesignSystem(tokens)
  return generateExportCss(normalized)
}

/**
 * Export type for external use
 */
export type { ShadcnDesignSystemTokens }
