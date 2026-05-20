import type {
  DomComponentCue,
  DomPaletteCapture,
  DomPaletteSwatch,
  DomProbeDiagnostics,
  DomSpacingCapture,
  DomSpacingToken,
  DomTypographySample
} from '../types'

interface OklchColor {
  l: number
  c: number
  h: number
}

export interface DomAnalysisOptions {
  maxElements?: number
  minTextLength?: number
  sampleLimit?: number
  colorSampleLimit?: number
}

export interface DomAnalysisResult {
  typography: DomTypographySample[]
  palette: DomPaletteCapture
  spacing: DomSpacingCapture
  components: DomComponentCue[]
  diagnostics: DomProbeDiagnostics
}

type DocumentLike = Document & {
  fonts?: {
    check: (font: string) => boolean
  }
}

type WindowLike = Window & {
  getComputedStyle(element: Element): CSSStyleDeclaration
}

const analysisImplementation = function analysisImplementation(
  documentRef: DocumentLike,
  windowRef: WindowLike | null,
  options?: DomAnalysisOptions
): DomAnalysisResult {
  const LOW_CHROMA_THRESHOLD = 0.045

  const GENERIC_FONTS = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-sans-serif',
    'ui-serif'
  ])

  const DEFAULT_OPTIONS = {
    maxElements: 1500,
    minTextLength: 6,
    sampleLimit: 18,
    colorSampleLimit: 32
  }

  const settings = { ...DEFAULT_OPTIONS, ...(options ?? {}) }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function round(value: number, precision = 2): number {
    const factor = Math.pow(10, precision)
    return Math.round(value * factor) / factor
  }

  function parseCssPx(value: string | null): number | null {
    if (!value) return null
    if (value === 'normal') return null
    const numeric = parseFloat(value.replace('px', ''))
    if (Number.isNaN(numeric)) return null
    return round(numeric, 2)
  }

  function buildSelector(element: Element): string {
    const segments: string[] = []
    let current: Element | null = element
    let depth = 0
    while (current && depth < 4) {
      const tag = current.tagName.toLowerCase()
      const id = current.id ? `#${current.id}` : ''
      const classList = Array.from(current.classList)
      const classSuffix = classList.length > 0 ? `.${classList.slice(0, 2).join('.')}` : ''
      segments.unshift(`${tag}${id}${classSuffix}`)
      current = current.parentElement
      depth++
    }
    return segments.join(' > ')
  }

  function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (component: number) => {
      const value = clamp(Math.round(component), 0, 255)
      return value.toString(16).padStart(2, '0')
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  function calculateLuminance(r: number, g: number, b: number): number {
    const normalize = (value: number) => {
      const channel = value / 255
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
    }
    const l = 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b)
    return round(l, 4)
  }

  function calculateSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === min) return 0
    const l = (max + min) / 2
    const d = max - min
    const s = l > 127.5 ? d / (510 - max - min) : d / (max + min)
    return round(s, 3)
  }

  function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue = h % 360
    const saturation = clamp(s / 100, 0, 1)
    const lightness = clamp(l / 100, 0, 1)
    if (saturation === 0) {
      const grey = Math.round(lightness * 255)
      return { r: grey, g: grey, b: grey }
    }
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
    const p = 2 * lightness - q
    const hueToRgb = (pValue: number, qValue: number, tValue: number) => {
      let t = tValue
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return pValue + (qValue - pValue) * 6 * t
      if (t < 1 / 2) return qValue
      if (t < 2 / 3) return pValue + (qValue - pValue) * (2 / 3 - t) * 6
      return pValue
    }
    const r = Math.round(hueToRgb(p, q, hue / 360 + 1 / 3) * 255)
    const g = Math.round(hueToRgb(p, q, hue / 360) * 255)
    const b = Math.round(hueToRgb(p, q, hue / 360 - 1 / 3) * 255)
    return { r, g, b }
  }

  function parseCssColor(color: string | null): { hex: string; rgb: string; alpha: number; luminance: number; saturation: number } | null {
    if (!color) return null
    const value = color.trim().toLowerCase()
    if (value === 'transparent' || value === 'inherit') return null
    if (value.startsWith('#')) {
      let normalized = value
      if (value.length === 4) {
        normalized = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      }
      if (normalized.length === 7) {
        const r = parseInt(normalized.slice(1, 3), 16)
        const g = parseInt(normalized.slice(3, 5), 16)
        const b = parseInt(normalized.slice(5, 7), 16)
        const luminance = calculateLuminance(r, g, b)
        const saturation = calculateSaturation(r, g, b)
        return {
          hex: normalized,
          rgb: `rgb(${r}, ${g}, ${b})`,
          alpha: 1,
          luminance,
          saturation
        }
      }
      return null
    }
    const rgbMatch = value.match(/rgba?\(([^)]+)\)/)
    if (rgbMatch) {
      const [r, g, b, a] = rgbMatch[1].split(',').map(part => parseFloat(part.trim()))
      if ([r, g, b].some(component => Number.isNaN(component))) return null
      const alpha = Number.isNaN(a) ? 1 : clamp(a, 0, 1)
      if (alpha === 0) return null
      const hex = rgbToHex(r, g, b)
      const luminance = calculateLuminance(r, g, b)
      const saturation = calculateSaturation(r, g, b)
      return {
        hex,
        rgb: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
        alpha,
        luminance,
        saturation
      }
    }
    const hslMatch = value.match(/hsla?\(([^)]+)\)/)
    if (hslMatch) {
      const [hValue, sValue, lValue, aValue] = hslMatch[1].split(',').map(part => part.trim())
      const h = parseFloat(hValue)
      const s = parseFloat(sValue)
      const l = parseFloat(lValue)
      if ([h, s, l].some(component => Number.isNaN(component))) return null
      const alpha = aValue ? clamp(parseFloat(aValue), 0, 1) : 1
      if (alpha === 0) return null
      const { r, g, b } = hslToRgb(h, s, l)
      const hex = rgbToHex(r, g, b)
      const luminance = calculateLuminance(r, g, b)
      const saturation = calculateSaturation(r, g, b)
      return {
        hex,
        rgb: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
        alpha,
        luminance,
        saturation
      }
    }
    return null
  }

  function detectScript(text: string): { script: string; confidence: number } {
    const trimmed = text.trim()
    if (!trimmed) return { script: 'unknown', confidence: 0 }
    const codePoints = Array.from(trimmed)
    const sample = codePoints.slice(0, 12)
    const scriptCount: Record<string, number> = {}
    sample.forEach(char => {
      const code = char.codePointAt(0) ?? 0
      const script = classifyCodePoint(code)
      if (!scriptCount[script]) scriptCount[script] = 0
      scriptCount[script] += 1
    })
    const best = Object.entries(scriptCount)
      .sort((a, b) => b[1] - a[1])
      .shift()
    if (!best) {
      return { script: 'unknown', confidence: 0 }
    }
    const confidence = best[1] / sample.length
    return { script: best[0], confidence: round(confidence, 2) }
  }

  function classifyCodePoint(code: number): string {
    if (code >= 0x0600 && code <= 0x06ff) return 'arabic'
    if (code >= 0x0400 && code <= 0x04ff) return 'cyrillic'
    if (code >= 0x3040 && code <= 0x30ff) return 'japanese'
    if (code >= 0xac00 && code <= 0xd7af) return 'korean'
    if (code >= 0x0900 && code <= 0x097f) return 'devanagari'
    if (code >= 0x4e00 && code <= 0x9fff) return 'cjk'
    if (code >= 0x370 && code <= 0x3ff) return 'greek'
    if (code >= 0x1f300 && code <= 0x1f64f) return 'emoji'
    return 'latin'
  }

  function computeRole(element: Element, fontSizePx: number, weight: string, text: string): DomTypographySample['role'] {
    const tag = element.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) return 'heading'
    if (tag === 'button' || (tag === 'a' && element.getAttribute('role') === 'button')) return 'cta'
    const numericWeight = parseInt(weight, 10)
    if (!Number.isNaN(numericWeight) && numericWeight >= 600 && fontSizePx >= 18) return 'heading'
    if (fontSizePx >= 24) return 'heading'
    if (tag === 'label' || tag === 'small') return 'label'
    if (text.length <= 18 && tag === 'a') return 'label'
    return 'body'
  }

  function toTypographySampleId(sample: Omit<DomTypographySample, 'id'>): string {
    const base = `${sample.fontFamily}-${sample.fontSizePx}-${sample.fontWeight}-${sample.lineHeightPx}-${sample.letterSpacingPx}-${sample.role}`
    return base.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  function normalizeFontStack(value: string): { fontFamily: string; fontStack: string } {
    if (!value) return { fontFamily: 'Unknown', fontStack: 'Unknown' }
    const parts = value
      .split(',')
      .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    return {
      fontFamily: parts[0] ?? 'Unknown',
      fontStack: parts.join(', ')
    }
  }

  interface ColorAccumulator {
    hex: string
    rgb: string
    occurrences: number
    cssProperties: Set<string>
    sampleSelectors: Set<string>
    luminance: number
    saturation: number
  }

  interface SpacingAccumulator {
    valuePx: number
    occurrences: number
    sources: Set<string>
  }

  const diagnostics: DomProbeDiagnostics = {
    errors: [],
    warnings: [],
    infos: [],
    missingFonts: [],
    consoleErrors: [],
    notes: []
  }

  const typographyMap = new Map<string, DomTypographySample>()
  const colorMap = new Map<string, ColorAccumulator>()
  const spacingMap = new Map<number, SpacingAccumulator>()
  const componentMap = new Map<string, DomComponentCue>()

  const root = documentRef.body || documentRef.documentElement
  if (!root) {
    diagnostics.errors.push('Document has no analyzable root element')
    return {
      typography: [],
      palette: { colors: [] },
      spacing: { baseUnitPx: null, scale: [] },
      components: [],
      diagnostics
    }
  }

  const defaultView = windowRef ?? (documentRef.defaultView as WindowLike | null)
  const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let current: Node | null = walker.currentNode
  let processed = 0
  while (current && processed < settings.maxElements) {
    processed++
    const element = current as Element
    current = walker.nextNode()
    if (!defaultView) continue
    const style = defaultView.getComputedStyle(element)
    if (!style) continue
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue

    const textContent = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (textContent.length >= settings.minTextLength) {
      const fontSizePx = parseCssPx(style.fontSize)
      if (fontSizePx && fontSizePx > 0) {
        const { fontFamily, fontStack } = normalizeFontStack(style.fontFamily)
        const lineHeightPx = parseCssPx(style.lineHeight)
        const letterSpacingPx = parseCssPx(style.letterSpacing)
        const role = computeRole(element, fontSizePx, style.fontWeight, textContent)
        const scriptDetection = detectScript(textContent)
        const selector = buildSelector(element)
        const key = [
          fontFamily,
          style.fontWeight,
          fontSizePx,
          lineHeightPx ?? 'auto',
          letterSpacingPx ?? 'auto',
          style.textTransform ?? 'none',
          role
        ].join('|')
        const sample: DomTypographySample = typographyMap.get(key) ?? {
          id: '',
          selector,
          fontFamily,
          fontStack,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          fontSizePx,
          lineHeightPx,
          letterSpacingPx,
          textTransform: style.textTransform || null,
          textDecoration: style.textDecorationLine || null,
          textAlign: style.textAlign || null,
          textSample: textContent.slice(0, 140),
          usageCount: 0,
          role,
          script: scriptDetection.script,
          scriptConfidence: scriptDetection.confidence
        }
        sample.usageCount += 1
        if (sample.textSample.length < textContent.length) {
          sample.textSample = textContent.slice(0, 140)
        }
        sample.selector = sample.selector.length <= selector.length ? sample.selector : selector
        sample.id = sample.id || toTypographySampleId(sample)
        typographyMap.set(key, sample)
      }
    }

    collectColor(element, style, colorMap)
    collectSpacing(element, style, spacingMap)
    collectComponentCue(element, componentMap)
  }

  if (typographyMap.size === 0) {
    diagnostics.warnings.push('No typography samples detected in DOM traversal')
  }

  const typographySamples = Array.from(typographyMap.values())
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, settings.sampleLimit)

  const palette = buildPalette(colorMap, settings.colorSampleLimit)
  if (palette.colors.length === 0) {
    diagnostics.warnings.push('No palette colors identified; DOM may lack inline styles or computed styles unavailable')
  }

  const spacing = buildSpacing(spacingMap)
  if (!spacing.baseUnitPx) {
    diagnostics.notes?.push('Failed to infer dominant spacing unit; distribution may be noisy')
  }

  const missingFonts = detectMissingFonts(documentRef, typographySamples)
  diagnostics.missingFonts = missingFonts
  if (missingFonts.length > 0) {
    diagnostics.warnings.push(`Detected ${missingFonts.length} fonts still loading or unavailable`)
  }

  const componentCues = Array.from(componentMap.values()).slice(0, settings.sampleLimit ?? 18)

  return {
    typography: typographySamples,
    palette,
    spacing,
    components: componentCues,
    diagnostics
  }

  function collectColor(element: Element, style: CSSStyleDeclaration, map: Map<string, ColorAccumulator>): void {
    const selector = buildSelector(element)
    const colorProperties: Array<[string, string | null]> = [
      ['color', style.color],
      ['background-color', style.backgroundColor],
      ['border-top-color', style.borderTopColor],
      ['border-right-color', style.borderRightColor],
      ['border-bottom-color', style.borderBottomColor],
      ['border-left-color', style.borderLeftColor],
      ['outline-color', style.outlineColor]
    ]
    for (const [property, rawColor] of colorProperties) {
      const parsed = parseCssColor(rawColor)
      if (!parsed) continue
      const existing = map.get(parsed.hex) ?? {
        hex: parsed.hex,
        rgb: parsed.rgb,
        occurrences: 0,
        cssProperties: new Set<string>(),
        sampleSelectors: new Set<string>(),
        luminance: parsed.luminance,
        saturation: parsed.saturation
      }
      existing.occurrences += 1
      existing.cssProperties.add(property)
      if (existing.sampleSelectors.size < 6) {
        existing.sampleSelectors.add(selector)
      }
      map.set(parsed.hex, existing)
    }
  }

  function collectSpacing(element: Element, style: CSSStyleDeclaration, map: Map<number, SpacingAccumulator>): void {
    const selector = buildSelector(element)
    const spacingProperties: Array<[string, string | null]> = [
      ['margin-top', style.marginTop],
      ['margin-bottom', style.marginBottom],
      ['margin-left', style.marginLeft],
      ['margin-right', style.marginRight],
      ['padding-top', style.paddingTop],
      ['padding-bottom', style.paddingBottom],
      ['padding-left', style.paddingLeft],
      ['padding-right', style.paddingRight],
      ['gap', (style as any).gap],
      ['row-gap', (style as any).rowGap],
      ['column-gap', (style as any).columnGap]
    ]
    for (const [property, raw] of spacingProperties) {
      const value = parseCssPx(raw)
      if (!value || value <= 0.5) continue
      const rounded = round(value, 1)
      const accumulator = map.get(rounded) ?? {
        valuePx: rounded,
        occurrences: 0,
        sources: new Set<string>()
      }
      accumulator.occurrences += 1
      if (accumulator.sources.size < 5) {
        accumulator.sources.add(`${selector} -> ${property}`)
      }
      map.set(rounded, accumulator)
    }
  }

  function buildPalette(map: Map<string, ColorAccumulator>, limit: number): DomPaletteCapture {
    const entries = Array.from(map.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit)

    const swatches = entries.map(entry => {
      const oklch = rgbHexToOklch(entry.hex)
      return {
        hex: entry.hex,
        rgb: entry.rgb,
        occurrences: entry.occurrences,
        cssProperties: Array.from(entry.cssProperties.values()),
        sampleSelectors: Array.from(entry.sampleSelectors.values()),
        contrastWarnings: [],
        role: undefined,
        oklch
      }
    })

    const sorted = harmonicSortSwatches(swatches)

    const neutrals = sorted.filter(swatch => swatch.oklch.c < LOW_CHROMA_THRESHOLD)
    const chromatic = sorted.filter(swatch => swatch.oklch.c >= LOW_CHROMA_THRESHOLD)

    sorted.forEach(swatch => {
      if (swatch.role === 'primary' || swatch.role === 'secondary') {
        swatch.role = undefined
      }
    })

    let primary: DomPaletteSwatch | null = null
    let secondary: DomPaletteSwatch | null = null

    if (chromatic.length > 0) {
      const chromaticByUsage = [...chromatic].sort((a, b) =>
        scoreChromatic(b) - scoreChromatic(a) || b.occurrences - a.occurrences
      )
      primary = chromaticByUsage[0]
      primary.role = 'primary'
      if (chromatic.length > 1) {
        secondary = chromaticByUsage.find(swatch => swatch !== primary) ?? chromaticByUsage[1]
        secondary.role = 'secondary'
      }
    } else if (neutrals.length > 0) {
      primary = neutrals[0]
      primary.role = 'primary'
      if (neutrals.length > 1) {
        secondary = neutrals[1]
        secondary.role = 'secondary'
      }
    }

    return {
      colors: sorted,
      primary,
      secondary,
      neutrals
    }
  }

  type SwatchWithOklch = DomPaletteSwatch & { oklch: OklchColor }

  function scoreChromatic(swatch: SwatchWithOklch): number {
    // Balanced scoring: frequency matters more than pure chroma
    // This prevents high-chroma utility colors (focus rings, outlines) from
    // beating actual brand colors that appear more frequently
    const chromaScore = swatch.oklch.c * 50  // Reduced from 100
    const frequencyScore = Math.log(1 + swatch.occurrences) * 15  // Increased weight

    // Penalty for colors primarily used in outline/focus/ring properties
    // These are often Tailwind utility colors, not brand colors
    const outlineProperties = ['outline-color', 'ring-color', 'box-shadow']
    const isOutlineColor = swatch.cssProperties?.some(prop =>
      outlineProperties.some(op => prop.includes(op) || prop === 'outline-color')
    )
    const outlinePenalty = isOutlineColor ? 15 : 0

    // Bonus for colors used in background-color (more likely to be intentional brand use)
    const isBackgroundColor = swatch.cssProperties?.includes('background-color')
    const backgroundBonus = isBackgroundColor ? 5 : 0

    return chromaScore + frequencyScore - outlinePenalty + backgroundBonus
  }

  function harmonicSortSwatches(swatches: SwatchWithOklch[]): SwatchWithOklch[] {
    const withOklch = swatches.map(swatch => ({
      swatch,
      _okl_l: swatch.oklch.l,
      _okl_c: swatch.oklch.c,
      _okl_h: (swatch.oklch.h % 360 + 360) % 360
    }))

    const SAMPLE_SIZE = 20
    const LIGHTNESS_WEIGHT = 3
    const HUE_WEIGHT = 1.6
    const CHROMA_WEIGHT = 0.5
    const HUE_WRAP_PENALTY = 5
    const WRAP_SCORE = 1000

    const decomposeHueDistance = (a: number, b: number) => {
      const diff = Math.abs(a - b) % 360
      return diff > 180 ? 360 - diff : diff
    }

    const popAtIndex = <T,>(collection: T[], index: number): T => collection.splice(index, 1)[0]

    const lowChroma: typeof withOklch = []
    const highChroma: typeof withOklch = []

    withOklch.forEach(color => {
      if (color._okl_c < LOW_CHROMA_THRESHOLD) {
        lowChroma.push(color)
      } else {
        highChroma.push(color)
      }
    })

    lowChroma.sort((a, b) => b._okl_l - a._okl_l)
    highChroma.sort((a, b) => b._okl_l - a._okl_l)

    const sequence: typeof withOklch = []

    if (highChroma.length) {
      const sample = highChroma.slice(0, SAMPLE_SIZE)
      let bestIndex = 0
      let bestDistance = Number.POSITIVE_INFINITY
      sample.forEach((color, index) => {
        const distance = decomposeHueDistance(color._okl_h, 0)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })
      sequence.push(popAtIndex(highChroma, bestIndex))
    }

    while (highChroma.length) {
      const previous = sequence[sequence.length - 1]
      const sample = highChroma.slice(0, Math.min(SAMPLE_SIZE, highChroma.length))
      let candidateIndex = 0
      let candidateScore = Number.POSITIVE_INFINITY

      sample.forEach((color, index) => {
        let score =
          LIGHTNESS_WEIGHT * Math.abs(previous._okl_l - color._okl_l) +
          HUE_WEIGHT * decomposeHueDistance(previous._okl_h, color._okl_h) +
          CHROMA_WEIGHT * Math.abs(previous._okl_c - color._okl_c)
        if (color._okl_h + HUE_WRAP_PENALTY < previous._okl_h) {
          score += WRAP_SCORE
        }
        if (score < candidateScore) {
          candidateScore = score
          candidateIndex = index
        }
      })

      sequence.push(popAtIndex(highChroma, candidateIndex))
    }

    return [...lowChroma, ...sequence].map(entry => entry.swatch)
  }

  function rgbHexToOklch(hex: string): OklchColor {
    const { r, g, b } = hexToRgb(hex)
    return rgbToOklch(r, g, b)
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex
    const expanded = normalized.length === 3 ? normalized.split('').map(value => value + value).join('') : normalized
    const r = parseInt(expanded.slice(0, 2), 16)
    const g = parseInt(expanded.slice(2, 4), 16)
    const b = parseInt(expanded.slice(4, 6), 16)
    return {
      r: Number.isNaN(r) ? 0 : r,
      g: Number.isNaN(g) ? 0 : g,
      b: Number.isNaN(b) ? 0 : b
    }
  }

  function rgbToOklch(r: number, g: number, b: number): OklchColor {
    const rl = srgbChannelToLinear(r)
    const gl = srgbChannelToLinear(g)
    const bl = srgbChannelToLinear(b)

    const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
    const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
    const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

    const lRoot = Math.cbrt(l)
    const mRoot = Math.cbrt(m)
    const sRoot = Math.cbrt(s)

    const okl = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot
    const oka = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot
    const okb = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot

    const c = Math.sqrt(oka * oka + okb * okb)
    let h = 0
    if (c > 1e-4) {
      h = Math.atan2(okb, oka) * (180 / Math.PI)
      if (h < 0) h += 360
    }
    return { l: okl, c, h }
  }

  function srgbChannelToLinear(channel: number): number {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }

  function buildSpacing(map: Map<number, SpacingAccumulator>): DomSpacingCapture {
    const tokens: DomSpacingToken[] = Array.from(map.values())
      .sort((a, b) => {
        if (b.occurrences === a.occurrences) return a.valuePx - b.valuePx
        return b.occurrences - a.occurrences
      })
      .map(entry => ({
        valuePx: entry.valuePx,
        occurrences: entry.occurrences,
        sources: Array.from(entry.sources.values())
      }))

    let baseUnitPx: number | null = null
    if (tokens.length > 0) {
      const candidateTokens = tokens
        .filter(token => token.valuePx <= 32)
        .sort((a, b) => {
          if (b.occurrences === a.occurrences) return a.valuePx - b.valuePx
          return b.occurrences - a.occurrences
        })

      const primary = candidateTokens[0]
      const secondary = candidateTokens[1]
      if (primary) {
        baseUnitPx = primary.valuePx
        if (secondary) {
          const occurrenceGap = primary.occurrences - secondary.occurrences
          const relativeGap = primary.occurrences > 0 ? occurrenceGap / primary.occurrences : 1
          const secondaryIsSmaller = secondary.valuePx < primary.valuePx
          const secondaryDividesPrimary =
            primary.valuePx % secondary.valuePx === 0 || secondary.valuePx % primary.valuePx === 0
          if (secondaryIsSmaller && (relativeGap <= 0.1 || secondaryDividesPrimary)) {
            baseUnitPx = secondary.valuePx
          }
        }
      } else {
        baseUnitPx = tokens[0].valuePx
      }
    }

    const gapTokens = tokens.filter(token => token.sources.some(source => source.includes('gap')))
    return {
      baseUnitPx,
      scale: tokens.slice(0, 12),
      gapTokens
    }
  }

  function detectMissingFonts(documentTarget: DocumentLike, samples: DomTypographySample[]): string[] {
    const fontStatus = new Set<string>()
    const fonts = new Set<string>()
    samples.forEach(sample => {
      sample.fontStack
        .split(',')
        .map(font => font.trim().replace(/^['"]|['"]$/g, ''))
        .forEach(font => {
          if (!font) return
          if (font.toLowerCase() === 'unknown') return
          if (GENERIC_FONTS.has(font.toLowerCase())) return
          fonts.add(font)
        })
    })
    const checker = documentTarget.fonts
    if (!checker || typeof checker.check !== 'function') {
      return Array.from(fonts)
    }
    fonts.forEach(font => {
      try {
        const isLoaded = checker.check(`12px "${font}"`)
        if (!isLoaded) {
          fontStatus.add(font)
        }
      } catch {
        fontStatus.add(font)
      }
    })
    return Array.from(fontStatus)
  }

  function collectComponentCue(element: Element, map: Map<string, DomComponentCue>): void {
    if (map.size >= 40) return
    const tag = element.tagName.toLowerCase()
    const classList = Array.from(element.classList)
    const roleAttr = element.getAttribute('role') ?? undefined
    const ariaRole = element.getAttribute('aria-role') ?? undefined
    const dataComponent = element.getAttribute('data-component') ?? undefined
    let inferredRole: DomComponentCue['role']
    let description: string | undefined

    const classMatches = (patterns: RegExp[]) => patterns.some(pattern => classList.some(cls => pattern.test(cls)))

    if (tag === 'button' || roleAttr === 'button' || classMatches([/btn/i, /button/i, /cta/i])) {
      inferredRole = 'cta'
      description = 'Call-to-action or button element'
    } else if (
      tag === 'a' &&
      (roleAttr === 'button' || classMatches([/btn/i, /cta/i, /primary/i])) &&
      element.hasAttribute('href')
    ) {
      inferredRole = 'cta'
      description = 'Link styled as actionable button'
    } else if (['input', 'textarea', 'select'].includes(tag)) {
      const inputType = tag === 'input' ? ((element as HTMLInputElement).type || '').toLowerCase() : undefined
      if (tag === 'input' && (inputType === 'submit' || inputType === 'button' || inputType === 'reset')) {
        inferredRole = 'cta'
        description = inputType === 'submit' ? 'Form submission control' : 'Button-style input control'
      } else {
        inferredRole = 'form-control'
        description = inputType ? `Form control (${inputType})` : `Form control element`
      }
    } else if (tag === 'nav' || roleAttr === 'navigation' || classMatches([/nav/i, /menu/i, /tabs?/i])) {
      inferredRole = 'navigation'
      description = 'Navigation container'
    } else if (tag === 'form' || classMatches([/form/i])) {
      inferredRole = 'form'
      description = 'Form wrapper'
    } else if (classMatches([/card/i, /tile/i, /panel/i, /module/i])) {
      inferredRole = 'container'
      description = 'Card or panel container'
    } else if (dataComponent) {
      inferredRole = 'custom'
      description = `Custom component (${dataComponent})`
    }

    if (!inferredRole) return
    const selector = buildSelector(element)
    const key = `${inferredRole}|${selector}`
    if (map.has(key)) return
    map.set(key, {
      selector,
      tagName: tag,
      classes: classList.slice(0, 6),
      role: inferredRole,
      description: description ?? ariaRole ?? roleAttr ?? undefined
    })
  }
}

export type AnalysisImplementation = typeof analysisImplementation

export function analyzeDomDocument(documentRef: DocumentLike, options?: DomAnalysisOptions): DomAnalysisResult {
  const windowRef = (documentRef.defaultView as WindowLike | null) ?? null
  return analysisImplementation(documentRef, windowRef, options)
}

export function analyzeDom(options?: DomAnalysisOptions): DomAnalysisResult {
  return analysisImplementation(document as DocumentLike, window as WindowLike, options)
}

export { analysisImplementation as __INTERNAL_ANALYSIS_IMPLEMENTATION }
