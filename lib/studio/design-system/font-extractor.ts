/**
 * Font Extractor Module
 *
 * Detects and extracts custom fonts from CSS content including:
 * - @font-face rules
 * - TypeKit fonts (use.typekit.net)
 * - Adobe Fonts (use.fonts.adobe.com)
 * - Google Fonts (fonts.googleapis.com)
 * - System fonts
 */

export type FontSource = 'google' | 'typekit' | 'adobe' | 'custom' | 'system' | 'unknown'

export interface DetectedFont {
  fontFamily: string
  source: FontSource
  url?: string
  weights?: string[]
  styles?: string[]
  /** Original CSS value for the font-family property */
  originalValue?: string
}

export interface FontExtractionResult {
  fonts: DetectedFont[]
  /** External stylesheet URLs that load fonts */
  externalFontUrls: string[]
  /** TypeKit kit IDs found */
  typekitKitIds: string[]
  /** Adobe Fonts project IDs found */
  adobeFontsProjectIds: string[]
  /** Diagnostics for debugging */
  diagnostics: string[]
}

/**
 * Extracts font information from CSS content
 */
export function extractFontsFromCSS(cssContent: string): FontExtractionResult {
  const result: FontExtractionResult = {
    fonts: [],
    externalFontUrls: [],
    typekitKitIds: [],
    adobeFontsProjectIds: [],
    diagnostics: []
  }

  if (!cssContent || typeof cssContent !== 'string') {
    return result
  }

  // Extract @font-face declarations
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi
  let fontFaceMatch

  while ((fontFaceMatch = fontFaceRegex.exec(cssContent)) !== null) {
    const fontFaceBlock = fontFaceMatch[1]
    const font = parseFontFaceBlock(fontFaceBlock)
    if (font) {
      result.fonts.push(font)
    }
  }

  // Extract @import rules for external fonts
  const importRegex = /@import\s+(?:url\s*\(\s*)?(['"]?)([^'"\s);]+)\1(?:\s*\))?/gi
  let importMatch

  while ((importMatch = importRegex.exec(cssContent)) !== null) {
    const url = importMatch[2]
    if (url) {
      const fontSource = detectFontSourceFromUrl(url)
      if (fontSource !== 'unknown') {
        result.externalFontUrls.push(url)

        // Extract kit/project IDs
        if (fontSource === 'typekit') {
          const kitId = extractTypekitKitId(url)
          if (kitId && !result.typekitKitIds.includes(kitId)) {
            result.typekitKitIds.push(kitId)
          }
        } else if (fontSource === 'adobe') {
          const projectId = extractAdobeFontsProjectId(url)
          if (projectId && !result.adobeFontsProjectIds.includes(projectId)) {
            result.adobeFontsProjectIds.push(projectId)
          }
        }
      }
    }
  }

  return result
}

/**
 * Extracts font information from HTML content (link tags, script tags)
 */
export function extractFontsFromHTML(htmlContent: string): FontExtractionResult {
  const result: FontExtractionResult = {
    fonts: [],
    externalFontUrls: [],
    typekitKitIds: [],
    adobeFontsProjectIds: [],
    diagnostics: []
  }

  if (!htmlContent || typeof htmlContent !== 'string') {
    return result
  }

  // Extract <link> tags for stylesheets
  const linkRegex = /<link[^>]+href\s*=\s*['"]([^'"]+)['"][^>]*>/gi
  let linkMatch

  while ((linkMatch = linkRegex.exec(htmlContent)) !== null) {
    const href = linkMatch[1]
    const fontSource = detectFontSourceFromUrl(href)

    if (fontSource !== 'unknown') {
      result.externalFontUrls.push(href)

      if (fontSource === 'typekit') {
        const kitId = extractTypekitKitId(href)
        if (kitId && !result.typekitKitIds.includes(kitId)) {
          result.typekitKitIds.push(kitId)
        }
      } else if (fontSource === 'adobe') {
        const projectId = extractAdobeFontsProjectId(href)
        if (projectId && !result.adobeFontsProjectIds.includes(projectId)) {
          result.adobeFontsProjectIds.push(projectId)
        }
      }
    }
  }

  // Extract TypeKit script tags
  const typekitScriptRegex = /use\.typekit\.net\/([a-z0-9]+)\.js/gi
  let typekitMatch

  while ((typekitMatch = typekitScriptRegex.exec(htmlContent)) !== null) {
    const kitId = typekitMatch[1]
    if (kitId && !result.typekitKitIds.includes(kitId)) {
      result.typekitKitIds.push(kitId)
      result.diagnostics.push(`Found TypeKit kit ID: ${kitId}`)
    }
  }

  // Extract Adobe Fonts script/link tags
  const adobeFontsRegex = /use\.fonts\.adobe\.com\/fonts\/([a-z0-9-]+)/gi
  let adobeMatch

  while ((adobeMatch = adobeFontsRegex.exec(htmlContent)) !== null) {
    const projectId = adobeMatch[1]
    if (projectId && !result.adobeFontsProjectIds.includes(projectId)) {
      result.adobeFontsProjectIds.push(projectId)
      result.diagnostics.push(`Found Adobe Fonts project ID: ${projectId}`)
    }
  }

  return result
}

/**
 * Parses a @font-face block and extracts font information
 */
function parseFontFaceBlock(block: string): DetectedFont | null {
  // Extract font-family
  const fontFamilyMatch = block.match(/font-family\s*:\s*(['"]?)([^;'"]+)\1/i)
  if (!fontFamilyMatch) {
    return null
  }

  const fontFamily = fontFamilyMatch[2].trim().replace(/^['"]|['"]$/g, '')
  if (!fontFamily) {
    return null
  }

  // Extract src to determine source
  const srcMatch = block.match(/src\s*:\s*([^;]+)/i)
  let source: FontSource = 'custom'
  let url: string | undefined

  if (srcMatch) {
    const srcValue = srcMatch[1]

    // Check for URL in src
    const urlMatch = srcValue.match(/url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/i)
    if (urlMatch) {
      url = urlMatch[2]
      source = detectFontSourceFromUrl(url)
    }
  }

  // Extract font-weight
  const weightMatch = block.match(/font-weight\s*:\s*([^;]+)/i)
  const weights = weightMatch ? [weightMatch[1].trim()] : undefined

  // Extract font-style
  const styleMatch = block.match(/font-style\s*:\s*([^;]+)/i)
  const styles = styleMatch ? [styleMatch[1].trim()] : undefined

  return {
    fontFamily,
    source,
    url,
    weights,
    styles,
    originalValue: fontFamily
  }
}

/**
 * Detects the font source from a URL
 */
export function detectFontSourceFromUrl(url: string): FontSource {
  if (!url || typeof url !== 'string') {
    return 'unknown'
  }

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('fonts.googleapis.com') || lowerUrl.includes('fonts.gstatic.com')) {
    return 'google'
  }

  if (lowerUrl.includes('use.typekit.net') || lowerUrl.includes('typekit.com')) {
    return 'typekit'
  }

  if (lowerUrl.includes('use.fonts.adobe.com') || lowerUrl.includes('adobe.fonts.com')) {
    return 'adobe'
  }

  // Check for common CDN patterns that might host custom fonts
  if (
    lowerUrl.includes('/fonts/') ||
    lowerUrl.endsWith('.woff2') ||
    lowerUrl.endsWith('.woff') ||
    lowerUrl.endsWith('.ttf') ||
    lowerUrl.endsWith('.otf') ||
    lowerUrl.endsWith('.eot')
  ) {
    return 'custom'
  }

  return 'unknown'
}

/**
 * Extracts TypeKit kit ID from a URL
 */
function extractTypekitKitId(url: string): string | null {
  // Pattern: use.typekit.net/abc123.css or use.typekit.net/abc123.js
  const match = url.match(/use\.typekit\.net\/([a-z0-9]+)\./i)
  return match ? match[1] : null
}

/**
 * Extracts Adobe Fonts project ID from a URL
 */
function extractAdobeFontsProjectId(url: string): string | null {
  // Pattern: use.fonts.adobe.com/fonts/project-id
  const match = url.match(/use\.fonts\.adobe\.com\/fonts\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

/**
 * Known custom fonts that should be preserved (not replaced with system fonts)
 * This list includes popular studio/custom fonts that aren't in Google Fonts
 */
export const KNOWN_CUSTOM_FONTS = new Set([
  // Adobe/TypeKit popular fonts
  'museo sans',
  'museo',
  'museo slab',
  'proxima nova',
  'proxima nova soft',
  'futura pt',
  'futura',
  'avenir',
  'avenir next',
  'gotham',
  'gotham pro',
  'gotham rounded',
  'brandon grotesque',
  'brandon text',
  'din',
  'din next',
  'din pro',
  'freight sans',
  'freight text',
  'freight display',
  'acumin pro',
  'acumin variable',
  'adobe clean',
  'adobe garamond',
  'adobe caslon',
  'myriad pro',
  'minion pro',
  'century gothic',
  'trade gothic',
  'trade gothic next',
  'neue haas grotesk',
  'neue haas unica',
  'aktiv grotesk',
  'aktiv groteskek',
  'circular',
  'circular std',
  'gt america',
  'gt walsheim',
  'gt sectra',
  'graphik',
  'domaine',
  'domaine display',
  'domaine text',
  'apercu',
  'basis grotesque',
  'canela',
  'canela text',
  'canela deck',
  'sohne',
  'sohne breit',
  'sohne mono',
  'favorit',
  'favorit mono',
  'untitled sans',
  'untitled serif',
  'founders grotesk',
  'atlas grotesk',
  'atlas typewriter',
  'maison neue',
  'maison mono',
  'suisse',
  'suisse intl',
  'suisse works',
  'suisse screen',
  'replica',
  'pitch',
  'pitch sans',
  'styrene',
  'styrene a',
  'styrene b',
  // Common studio fonts
  'helvetica neue',
  'helvetica',
  'frutiger',
  'univers',
  'akzidenz grotesk',
  'gill sans',
  'gill sans mt',
  'optima',
  'palatino',
  'palatino linotype',
  'book antiqua',
  'garamond',
  'garamond premiere',
  'sabon',
  'baskerville',
  'caslon',
  'bembo',
  'bodoni',
  'didot',
  'clarendon',
  'rockwell'
])

/**
 * Checks if a font family name is a known custom font that should be preserved
 */
export function isKnownCustomFont(fontFamily: string): boolean {
  if (!fontFamily || typeof fontFamily !== 'string') {
    return false
  }

  const normalized = fontFamily.toLowerCase().trim().replace(/^['"]|['"]$/g, '')
  return KNOWN_CUSTOM_FONTS.has(normalized)
}

/**
 * Merges multiple font extraction results
 */
export function mergeFontExtractionResults(results: FontExtractionResult[]): FontExtractionResult {
  const merged: FontExtractionResult = {
    fonts: [],
    externalFontUrls: [],
    typekitKitIds: [],
    adobeFontsProjectIds: [],
    diagnostics: []
  }

  const seenFontFamilies = new Set<string>()
  const seenUrls = new Set<string>()

  for (const result of results) {
    for (const font of result.fonts) {
      const key = font.fontFamily.toLowerCase()
      if (!seenFontFamilies.has(key)) {
        seenFontFamilies.add(key)
        merged.fonts.push(font)
      }
    }

    for (const url of result.externalFontUrls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url)
        merged.externalFontUrls.push(url)
      }
    }

    for (const kitId of result.typekitKitIds) {
      if (!merged.typekitKitIds.includes(kitId)) {
        merged.typekitKitIds.push(kitId)
      }
    }

    for (const projectId of result.adobeFontsProjectIds) {
      if (!merged.adobeFontsProjectIds.includes(projectId)) {
        merged.adobeFontsProjectIds.push(projectId)
      }
    }

    merged.diagnostics.push(...result.diagnostics)
  }

  return merged
}
