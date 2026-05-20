/**
 * Typography Normalizer Module
 *
 * Ensures typography scales are properly ordered and normalized:
 * - H1 should be largest, H6 should be smallest
 * - Body text should have consistent hierarchy
 * - Font sizes are validated and normalized
 */

import type { DesignSystem, TokenTypography } from '@/lib/studio/import/types/design-system.types'

/**
 * Modern, distinctive default font stack that avoids the generic "AI slop" aesthetic.
 * Uses Inter as primary (widely available, professional) with quality fallbacks.
 */
export const DEFAULT_HEADING_FONT_STACK = '"Inter var", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
export const DEFAULT_BODY_FONT_STACK = '"Inter var", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'

/**
 * Standard fallback sizes for heading typography (in rem)
 * Ensures a proper visual hierarchy: H1 > H2 > H3 > H4 > H5 > H6
 * H1/H2 use bold (700) for visual impact, H3-H6 use semibold (600)
 */
export const STANDARD_HEADING_SIZES = {
  'heading-1': { size: '3.5rem', lineHeight: '1.1', weight: '700', letterSpacing: '-0.03em' },
  'heading-2': { size: '2.5rem', lineHeight: '1.15', weight: '700', letterSpacing: '-0.025em' },
  'heading-3': { size: '2rem', lineHeight: '1.2', weight: '600', letterSpacing: '-0.02em' },
  'heading-4': { size: '1.5rem', lineHeight: '1.25', weight: '600', letterSpacing: '-0.015em' },
  'heading-5': { size: '1.25rem', lineHeight: '1.3', weight: '600', letterSpacing: '-0.01em' },
  'heading-6': { size: '1rem', lineHeight: '1.4', weight: '600', letterSpacing: '0' }
} as const

/**
 * Minimum heading sizes in pixels to ensure readable hierarchy
 * H1: 40px, H2: 32px, H3: 26px, H4: 22px, H5: 18px, H6: 16px
 */
export const MIN_HEADING_SIZES_PX: Record<number, number> = {
  1: 40,
  2: 32,
  3: 26,
  4: 22,
  5: 18,
  6: 16
}

/**
 * Minimum body text size in pixels for readability
 */
export const MIN_BODY_SIZE_PX = 14

/**
 * Standard fallback sizes for body typography (in rem)
 */
export const STANDARD_BODY_SIZES = {
  'body-1': { size: '0.875rem', lineHeight: '1.6', weight: '400', letterSpacing: '0' },
  'body-2': { size: '1rem', lineHeight: '1.6', weight: '400', letterSpacing: '0' },
  'body-3': { size: '1.125rem', lineHeight: '1.6', weight: '400', letterSpacing: '0' },
  'body-4': { size: '1.25rem', lineHeight: '1.6', weight: '500', letterSpacing: '0' }
} as const

/**
 * Parses a font size string to pixels for comparison
 * Handles px, rem, em, and unitless values
 */
export function parseFontSizeToPixels(fontSize: string | undefined | null): number {
  if (!fontSize || typeof fontSize !== 'string') {
    return 0
  }

  const trimmed = fontSize.trim().toLowerCase()

  // Handle px values
  if (trimmed.endsWith('px')) {
    return parseFloat(trimmed) || 0
  }

  // Handle rem values (assume 16px base)
  if (trimmed.endsWith('rem')) {
    return (parseFloat(trimmed) || 0) * 16
  }

  // Handle em values (assume 16px base for comparison purposes)
  if (trimmed.endsWith('em')) {
    return (parseFloat(trimmed) || 0) * 16
  }

  // Handle unitless values (assume pixels)
  const numericValue = parseFloat(trimmed)
  return Number.isFinite(numericValue) ? numericValue : 0
}

/**
 * Converts a pixel value to rem
 */
export function pixelsToRem(pixels: number, base: number = 16): string {
  if (!Number.isFinite(pixels) || pixels <= 0) {
    return '1rem'
  }
  const remValue = pixels / base
  // Round to 3 decimal places
  return `${Math.round(remValue * 1000) / 1000}rem`
}

/**
 * Determines if the heading typography scale is properly ordered
 * (H1 should be largest, descending to H6)
 */
export function isTypographyScaleOrdered(headings: TokenTypography[]): boolean {
  if (headings.length <= 1) {
    return true
  }

  let previousSize = Infinity

  for (const heading of headings) {
    const currentSize = parseFontSizeToPixels(heading.fontSize)
    if (currentSize > previousSize) {
      return false
    }
    previousSize = currentSize
  }

  return true
}

/**
 * Detects if the typography scale appears to be inverted
 * (smaller headings have larger sizes)
 */
export function detectInvertedScale(headings: TokenTypography[]): {
  isInverted: boolean
  evidence: string[]
} {
  const evidence: string[] = []

  if (headings.length < 2) {
    return { isInverted: false, evidence }
  }

  // Get sizes for first and last headings
  const firstSize = parseFontSizeToPixels(headings[0]?.fontSize)
  const lastSize = parseFontSizeToPixels(headings[headings.length - 1]?.fontSize)

  // If the last heading is significantly larger than the first, scale may be inverted
  if (lastSize > firstSize * 1.2) {
    evidence.push(
      `First heading size (${headings[0]?.fontSize}) is smaller than last heading size (${headings[headings.length - 1]?.fontSize})`
    )
    return { isInverted: true, evidence }
  }

  // Check for any H4+ being larger than H1-H3
  const h1ToH3Sizes = headings.slice(0, 3).map(h => parseFontSizeToPixels(h.fontSize))
  const h4ToH6Sizes = headings.slice(3).map(h => parseFontSizeToPixels(h.fontSize))

  const maxH1ToH3 = Math.max(...h1ToH3Sizes.filter(s => s > 0), 0)
  const maxH4ToH6 = Math.max(...h4ToH6Sizes.filter(s => s > 0), 0)

  if (maxH4ToH6 > maxH1ToH3) {
    evidence.push(
      `Lower-level headings (H4-H6) have larger max size (${maxH4ToH6}px) than upper headings (H1-H3: ${maxH1ToH3}px)`
    )
    return { isInverted: true, evidence }
  }

  return { isInverted: false, evidence }
}

/**
 * Normalizes the typography scale to ensure proper heading hierarchy
 */
export function normalizeTypographyScale(
  typography: DesignSystem['typography']
): DesignSystem['typography'] {
  if (!typography) {
    return {
      heading: [],
      body: [],
      ui: []
    }
  }

  const normalizedHeadings = normalizeHeadingScale(typography.heading || [])
  const normalizedBody = normalizeBodyScale(typography.body || [])

  return {
    heading: normalizedHeadings,
    body: normalizedBody,
    ui: typography.ui || []
  }
}

/**
 * Normalizes heading typography to ensure proper size hierarchy
 * and enforces minimum sizes for readability
 */
function normalizeHeadingScale(headings: TokenTypography[]): TokenTypography[] {
  if (headings.length === 0) {
    // Return standard heading scale as fallback with distinctive font stack
    return Object.entries(STANDARD_HEADING_SIZES).map(([name, values], index) => ({
      fontFamily: DEFAULT_HEADING_FONT_STACK,
      fontSize: values.size,
      fontWeight: parseInt(values.weight) || values.weight,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing,
      name,
      confidence: 0.5,
      source: 'fallback' as const,
      usageCount: 0,
      fallbacks: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
    }))
  }

  // Check if scale needs normalization
  const { isInverted } = detectInvertedScale(headings)

  // Extract sizes and sort them (largest first for proper hierarchy)
  const sizesWithIndices = headings.map((heading, index) => ({
    originalIndex: index,
    size: parseFontSizeToPixels(heading.fontSize),
    heading
  }))

  // Sort by size descending (largest first = H1)
  const sortedBySize = [...sizesWithIndices].sort((a, b) => b.size - a.size)

  // If scale is inverted or not properly ordered, reassign based on sorted sizes
  if (isInverted || !isTypographyScaleOrdered(headings)) {
    const standardSizes = Object.values(STANDARD_HEADING_SIZES)

    return sortedBySize.map((item, index) => {
      const standardFallback = standardSizes[index]
      const heading = item.heading
      const headingLevel = index + 1

      // Get minimum size for this heading level
      const minSizePx = MIN_HEADING_SIZES_PX[headingLevel] ?? 16

      // Use detected size if valid and meets minimum, otherwise use standard
      const detectedSizePx = item.size
      const useDetectedSize = detectedSizePx >= minSizePx && detectedSizePx <= 120

      // Enforce minimum size
      const finalSize = useDetectedSize
        ? heading.fontSize
        : detectedSizePx > 0 && detectedSizePx < minSizePx
          ? pixelsToRem(minSizePx) // Detected but too small, use minimum
          : standardFallback?.size || `${3 - index * 0.5}rem`

      return {
        ...heading,
        fontSize: finalSize,
        lineHeight: heading.lineHeight || standardFallback?.lineHeight || '1.2',
        letterSpacing: heading.letterSpacing || standardFallback?.letterSpacing || '0',
        name: `heading-${headingLevel}`,
        confidence: useDetectedSize ? (heading.confidence ?? 0.8) : 0.5
      }
    })
  }

  // Scale is already ordered, but still enforce minimum sizes
  return headings.map((heading, index) => {
    const headingLevel = index + 1
    const minSizePx = MIN_HEADING_SIZES_PX[headingLevel] ?? 16
    const detectedSizePx = parseFontSizeToPixels(heading.fontSize)
    const standardFallback = Object.values(STANDARD_HEADING_SIZES)[index]

    // Enforce minimum size even for already-ordered scales
    const finalSize = detectedSizePx >= minSizePx
      ? heading.fontSize
      : detectedSizePx > 0
        ? pixelsToRem(minSizePx)
        : standardFallback?.size || heading.fontSize

    return {
      ...heading,
      fontSize: finalSize,
      name: `heading-${headingLevel}`
    }
  })
}

/**
 * Normalizes body typography to ensure proper hierarchy
 * and enforces minimum size for readability.
 *
 * When source body sizes are too uniform (< 4px range), applies standard scale
 * to ensure proper typographic differentiation.
 */
function normalizeBodyScale(bodyStyles: TokenTypography[]): TokenTypography[] {
  if (bodyStyles.length === 0) {
    // Return standard body scale as fallback with distinctive font stack
    return Object.entries(STANDARD_BODY_SIZES).map(([name, values], index) => ({
      fontFamily: DEFAULT_BODY_FONT_STACK,
      fontSize: values.size,
      fontWeight: parseInt(values.weight) || values.weight,
      lineHeight: values.lineHeight,
      letterSpacing: values.letterSpacing,
      name,
      confidence: 0.5,
      source: 'fallback' as const,
      usageCount: 0,
      fallbacks: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
    }))
  }

  // Sort body styles by size (smallest first for body-1, body-2, etc.)
  const sizesWithIndices = bodyStyles.map((style, index) => ({
    originalIndex: index,
    size: parseFontSizeToPixels(style.fontSize),
    style
  }))

  const sortedBySize = [...sizesWithIndices].sort((a, b) => a.size - b.size)

  // Check if source sizes are too uniform (less than 4px range)
  // This indicates the source site had poor typography differentiation
  const validSizes = sortedBySize.filter(item => item.size > 0)
  const minSize = validSizes.length > 0 ? validSizes[0].size : 0
  const maxSize = validSizes.length > 0 ? validSizes[validSizes.length - 1].size : 0
  const sizeRange = maxSize - minSize

  const isUniformSource = sizeRange < 4 // Less than 4px difference = uniform

  if (isUniformSource) {
    // Source has poor differentiation - apply standard scale while preserving font family
    const standardSizes = Object.values(STANDARD_BODY_SIZES)
    const baseFontFamily = sortedBySize[0]?.style?.fontFamily || 'sans-serif'

    return standardSizes.map((standard, index) => {
      const sourceStyle = sortedBySize[index]?.style
      return {
        fontFamily: sourceStyle?.fontFamily || baseFontFamily,
        fontSize: standard.size,
        fontWeight: parseInt(standard.weight) || 400,
        lineHeight: sourceStyle?.lineHeight || standard.lineHeight,
        letterSpacing: sourceStyle?.letterSpacing || standard.letterSpacing,
        name: `body-${index + 1}`,
        confidence: 0.6,
        source: 'normalized' as const,
        usageCount: sourceStyle?.usageCount || 0,
        fallbacks: sourceStyle?.fallbacks || ['sans-serif']
      }
    })
  }

  // Source has good differentiation - enforce minimums but preserve detected scale
  return sortedBySize.map((item, index) => {
    const detectedSizePx = item.size
    const standardFallback = Object.values(STANDARD_BODY_SIZES)[index]

    // Enforce minimum body size for readability
    const finalSize = detectedSizePx >= MIN_BODY_SIZE_PX
      ? item.style.fontSize
      : detectedSizePx > 0
        ? pixelsToRem(MIN_BODY_SIZE_PX)
        : standardFallback?.size || item.style.fontSize

    return {
      ...item.style,
      fontSize: finalSize,
      name: `body-${index + 1}`
    }
  })
}

/**
 * Validates and fixes typography values
 */
export function validateTypographyValues(typography: TokenTypography): TokenTypography {
  const validated = { ...typography }

  // Validate font size
  const sizeInPx = parseFontSizeToPixels(validated.fontSize)
  if (sizeInPx <= 0 || sizeInPx > 200) {
    validated.fontSize = '1rem'
    validated.confidence = Math.min(validated.confidence ?? 1, 0.5)
  }

  // Validate line height
  if (validated.lineHeight) {
    const lineHeightValue = parseFloat(String(validated.lineHeight))
    if (!Number.isFinite(lineHeightValue) || lineHeightValue < 0.8 || lineHeightValue > 3) {
      validated.lineHeight = '1.5'
    }
  }

  // Validate font weight
  if (validated.fontWeight !== undefined) {
    const weight =
      typeof validated.fontWeight === 'number'
        ? validated.fontWeight
        : parseInt(String(validated.fontWeight), 10)

    if (!Number.isFinite(weight) || weight < 100 || weight > 900) {
      // Try to normalize named weights
      const namedWeights: Record<string, number> = {
        thin: 100,
        extralight: 200,
        light: 300,
        normal: 400,
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900
      }
      const normalized = String(validated.fontWeight).toLowerCase().replace(/[\s-]/g, '')
      validated.fontWeight = namedWeights[normalized] ?? 400
    }
  }

  return validated
}

/**
 * Creates a complete typography system with proper fallbacks
 */
export function ensureCompleteTypographySystem(
  typography: DesignSystem['typography']
): DesignSystem['typography'] {
  const normalized = normalizeTypographyScale(typography)

  // Ensure we have at least 6 heading styles
  while (normalized.heading.length < 6) {
    const index = normalized.heading.length
    const standardSize = Object.values(STANDARD_HEADING_SIZES)[index]
    const previousHeading = normalized.heading[index - 1]

    normalized.heading.push({
      fontFamily: previousHeading?.fontFamily || DEFAULT_HEADING_FONT_STACK,
      fontSize: standardSize?.size || `${1.5 - index * 0.1}rem`,
      fontWeight: parseInt(standardSize?.weight || '600') || 600,
      lineHeight: standardSize?.lineHeight || '1.3',
      letterSpacing: standardSize?.letterSpacing || '0',
      name: `heading-${index + 1}`,
      confidence: 0.4,
      source: 'fallback' as const,
      usageCount: 0,
      fallbacks: previousHeading?.fallbacks || ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
    })
  }

  // Ensure we have at least 2 body styles
  while (normalized.body.length < 2) {
    const index = normalized.body.length
    const standardSize = Object.values(STANDARD_BODY_SIZES)[index]
    const previousBody = normalized.body[index - 1]

    normalized.body.push({
      fontFamily: previousBody?.fontFamily || DEFAULT_BODY_FONT_STACK,
      fontSize: standardSize?.size || '1rem',
      fontWeight: parseInt(standardSize?.weight || '400') || 400,
      lineHeight: standardSize?.lineHeight || '1.6',
      letterSpacing: standardSize?.letterSpacing || '0',
      name: `body-${index + 1}`,
      confidence: 0.4,
      source: 'fallback' as const,
      usageCount: 0,
      fallbacks: previousBody?.fallbacks || ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
    })
  }

  // Validate all typography values
  normalized.heading = normalized.heading.map(validateTypographyValues)
  normalized.body = normalized.body.map(validateTypographyValues)
  normalized.ui = (normalized.ui || []).map(validateTypographyValues)

  return normalized
}
