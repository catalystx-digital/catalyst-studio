/**
 * Image Enrichment Processor
 *
 * Scans the DOM snapshot for images that weren't captured by LLM detection
 * and enriches components with missing image references.
 *
 * This post-processor addresses the common issue where LLMs detect components
 * but miss extracting `<img>` tags from the HTML. By scanning the DOM snapshot
 * (captured by headless browser), we can find and attach images that are
 * visually present on the page.
 *
 * @module detection-post-processor/image-enrichment-processor
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'

/**
 * Extracted image from DOM
 */
interface ExtractedImage {
  src: string
  alt?: string
  /** Text context near the image (for matching to components) */
  nearbyText?: string
  /** Nearest source section around the image, used to prevent cross-section matches. */
  sectionHtml?: string
  sectionText?: string
  sectionKind?: 'logo' | 'content' | 'navigation'
}

/**
 * Options for image enrichment
 */
export interface ImageEnrichmentOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

/**
 * Extracts all images from DOM snapshot HTML
 */
function extractImagesFromDom(html: string): ExtractedImage[] {
  if (!html || typeof html !== 'string') return []
  if (!html.includes('<img')) return []

  const images: ExtractedImage[] = []

  // Match <img> tags with src attribute
  // Handles various attribute orders and formats
  const imgTagRegex = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  const altRegex = /alt\s*=\s*["']([^"']*)["']/i

  let match
  while ((match = imgTagRegex.exec(html)) !== null) {
    const src = match[1]?.trim()

    // Skip data URLs and empty sources
    if (!src || src.startsWith('data:') || src.length < 5) continue

    // Skip common non-content images
    if (isNonContentImage(src)) continue

    const fullTag = match[0]
    const altMatch = altRegex.exec(fullTag)
    const alt = altMatch?.[1] || undefined

    const sectionHtml = extractNearestSectionHtml(html, match.index)
    const sectionKind = classifySection(sectionHtml)
    if (sectionKind === 'navigation') continue

    const tagIndex = match.index
    const nearbyText = extractSectionText(sectionHtml) || extractNearbyText(html, tagIndex)

    images.push({
      src,
      alt,
      nearbyText,
      sectionHtml,
      sectionText: nearbyText,
      sectionKind
    })
  }

  return images
}

function extractNearestSectionHtml(html: string, tagIndex: number): string {
  const semanticSection = extractNearestOpenElement(html, tagIndex, ['section', 'article', 'header', 'footer', 'nav'])
  if (semanticSection) return semanticSection

  const divSection = extractNearestOpenElement(html, tagIndex, ['div'])
  if (divSection) return divSection

  const mainSection = extractNearestOpenElement(html, tagIndex, ['main'])
  if (mainSection) return mainSection

  const start = Math.max(0, tagIndex - 500)
  const end = Math.min(html.length, tagIndex + 500)
  return html.slice(start, end)
}

function extractNearestOpenElement(html: string, tagIndex: number, tags: string[]): string | null {
  const before = html.slice(0, tagIndex)
  const tagPattern = tags.map(tag => tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
  const openMatches = Array.from(before.matchAll(new RegExp(`<(${tagPattern})\\b[^>]*>`, 'gi')))
  const opening = openMatches.reverse().find(match => {
    const tag = match[1]?.toLowerCase()
    if (!tag) return false
    const afterOpen = before.slice((match.index || 0) + match[0].length)
    const closeCount = (afterOpen.match(new RegExp(`</${tag}>`, 'gi')) || []).length
    const openCount = (afterOpen.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []).length
    return closeCount <= openCount
  })

  if (!opening) {
    return null
  }

  const tag = opening[1].toLowerCase()
  const start = opening.index || 0
  const closingRegex = new RegExp(`</${tag}>`, 'gi')
  closingRegex.lastIndex = tagIndex
  const closing = closingRegex.exec(html)
  const end = closing ? closing.index + closing[0].length : Math.min(html.length, tagIndex + 500)
  return html.slice(start, end)
}

function classifySection(sectionHtml: string): ExtractedImage['sectionKind'] {
  const tagMatch = sectionHtml.match(/^<([a-z0-9-]+)\b/i)
  const openingTag = sectionHtml.slice(0, Math.min(sectionHtml.indexOf('>') + 1 || 200, 300)).toLowerCase()
  if (
    tagMatch?.[1]?.toLowerCase() === 'nav' ||
    tagMatch?.[1]?.toLowerCase() === 'header' ||
    /\b(role|aria-label)\s*=\s*["'][^"']*(navigation|menu)[^"']*["']/i.test(openingTag) ||
    /\b(class|id)\s*=\s*["'][^"']*(mega|menu|nav|navbar|dropdown|header)[^"']*["']/i.test(openingTag)
  ) {
    return 'navigation'
  }

  const text = extractSectionText(sectionHtml).toLowerCase()
  if (
    /\b(class|id)\s*=\s*["'][^"']*(awards?|logo|logos|client|clients)[^"']*["']/i.test(openingTag) ||
    /\b(trusted by|client logos?|partner logos?|awards? and recognition)\b/.test(text)
  ) {
    return 'logo'
  }

  return 'content'
}

function extractSectionText(sectionHtml: string): string {
  return sectionHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

/**
 * Checks if an image URL is likely a non-content image (icons, tracking pixels, etc.)
 */
function isNonContentImage(src: string): boolean {
  const lowerSrc = src.toLowerCase()
  const pathname = (() => {
    try {
      return new URL(src, 'https://example.invalid').pathname.toLowerCase()
    } catch {
      return lowerSrc.split(/[?#]/, 1)[0] || lowerSrc
    }
  })()
  const filename = pathname.split('/').filter(Boolean).pop() || pathname

  // Tracking pixels and analytics
  if (lowerSrc.includes('facebook.com/tr?')) return true
  if (lowerSrc.includes('/tr?id=')) return true
  if (lowerSrc.includes('pixel') || lowerSrc.includes('beacon')) return true
  if (lowerSrc.includes('analytics') || lowerSrc.includes('tracking')) return true
  if (lowerSrc.includes('.gif') && lowerSrc.includes('1x1')) return true

  // Common icon/UI element patterns
  if (lowerSrc.includes('/icons/') && lowerSrc.includes('.svg')) return true
  if (lowerSrc.includes('favicon')) return true
  if (lowerSrc.includes('spinner') || lowerSrc.includes('loading')) return true
  if (pathname.includes('/flags/') || /^flag[-_.]/.test(filename)) return true
  if (
    (pathname.includes('/templateassets/') || pathname.includes('/icons/')) &&
    (filename.includes('auslan') || filename.includes('interpreter'))
  ) return true
  if (/^(auslan|interpreter)[-_.].*\.svg$/i.test(filename)) return true

  // Site-wide brand assets should not be attached as content images.
  if (
    filename.includes('rch-master') ||
    (
      pathname.includes('/templateassets/') &&
      (filename.includes('logo') || filename.includes('brandmark'))
    )
  ) return true

  // Social media share buttons
  if (lowerSrc.includes('facebook') && lowerSrc.includes('share')) return true
  if (lowerSrc.includes('twitter') && lowerSrc.includes('share')) return true

  return false
}

/**
 * Extracts text near an image tag for context matching
 */
function extractNearbyText(html: string, tagIndex: number): string {
  const windowSize = 500
  const start = Math.max(0, tagIndex - windowSize)
  const end = Math.min(html.length, tagIndex + windowSize)

  const window = html.slice(start, end)

  // Strip HTML tags to get just text
  const textOnly = window
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return textOnly.slice(0, 200)
}

/**
 * Normalizes URL to absolute form
 */
function normalizeToAbsolute(src: string, pageUrl?: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }

  if (!pageUrl) return src

  try {
    const base = new URL(pageUrl)
    return new URL(src, base.origin).href
  } catch {
    return src
  }
}

function normalizeImageUrl(src: string, pageUrl?: string): string {
  return normalizeToAbsolute(src, pageUrl).toLowerCase().replace(/&amp;/g, '&')
}

/**
 * Gets all image URLs already present in a component
 */
function getExistingImageUrls(component: DetectedComponent): Set<string> {
  const urls = new Set<string>()

  const scanValue = (value: unknown): void => {
    if (!value || typeof value !== 'object') return

    if (Array.isArray(value)) {
      value.forEach(scanValue)
      return
    }

    const record = value as Record<string, unknown>

    // Check for image-like fields
    if (typeof record.src === 'string') {
      urls.add(record.src.toLowerCase().replace(/&amp;/g, '&'))
    }
    if (typeof record.url === 'string') {
      urls.add(record.url.toLowerCase().replace(/&amp;/g, '&'))
    }
    if (typeof record.originalUrl === 'string') {
      urls.add(record.originalUrl.toLowerCase().replace(/&amp;/g, '&'))
    }
    if (typeof record.image === 'object' && record.image) {
      const img = record.image as Record<string, unknown>
      if (typeof img.src === 'string') {
        urls.add(img.src.toLowerCase().replace(/&amp;/g, '&'))
      }
    }

    // Recurse into nested objects
    Object.values(record).forEach(scanValue)
  }

  scanValue(component.content)
  return urls
}

function getImageUrl(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return null
  if (typeof value.url === 'string') return value.url
  if (typeof value.src === 'string') return value.src
  if (isRecord(value.src) && typeof value.src.url === 'string') return value.src.url
  if (typeof value.originalUrl === 'string') return value.originalUrl
  return null
}

/**
 * Extracts text content from component for matching
 */
function getComponentText(component: DetectedComponent): string {
  const texts: string[] = []

  const extractText = (value: unknown): void => {
    if (typeof value === 'string') {
      // Strip HTML if present
      const text = value.replace(/<[^>]+>/g, ' ').trim()
      if (text.length > 2) texts.push(text.toLowerCase())
      return
    }

    if (!value || typeof value !== 'object') return

    if (Array.isArray(value)) {
      value.forEach(extractText)
      return
    }

    const record = value as Record<string, unknown>

    // Extract from common text fields
    for (const key of ['heading', 'title', 'body', 'text', 'description', 'label']) {
      if (typeof record[key] === 'string') {
        const text = (record[key] as string).replace(/<[^>]+>/g, ' ').trim()
        if (text.length > 2) texts.push(text.toLowerCase())
      }
    }

    Object.values(record).forEach(extractText)
  }

  extractText(component.content)
  return texts.join(' ')
}

/**
 * Checks if an image likely belongs to a component based on nearby text
 */
function imageMatchesComponent(image: ExtractedImage, componentText: string): boolean {
  if (!image.nearbyText || !componentText) return false

  const nearbyLower = image.nearbyText.toLowerCase()

  // Extract significant words from component text (3+ chars)
  const words = componentText
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .slice(0, 10) // Take first 10 significant words

  // Check if multiple significant words appear near the image
  let matchCount = 0
  for (const word of words) {
    if (nearbyLower.includes(word)) {
      matchCount++
    }
  }

  // Require at least 2 matching words for confidence
  return matchCount >= 2
}

/**
 * Enriches a component's content with an image
 */
function enrichComponentWithImage(
  component: DetectedComponent,
  image: ExtractedImage,
  pageUrl?: string
): boolean {
  const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
  const mediaRef = {
    mediaId: `detected:${stableImageId(absoluteSrc)}`,
    mediaType: 'image' as const,
    url: absoluteSrc
  }
  const imageData = { src: mediaRef, alt: image.alt || '', originalUrl: absoluteSrc }

  const content = component.content as Record<string, unknown> | undefined
  if (!content) {
    if (component.type === 'image-gallery') {
      component.content = { images: [imageData] }
      return true
    }
    return false
  }

  if (component.type === 'hero-with-image' && !content.image) {
    content.image = imageData
    return true
  }

  if (component.type === 'image-gallery') {
    const images = Array.isArray(content.images) ? content.images as unknown[] : []
    content.images = [...images, imageData]
    return true
  }

  if (component.type === 'card-grid') {
    return enrichCardCollection(content.cards, image, imageData)
  }

  if (component.type === 'content-feed') {
    return enrichCardCollection(content.pinned, image, imageData)
  }

  if (component.type === 'cta-banner') {
    // CTA media is reconciled by source section before the generic enrichment loop.
    // Per-image CTA matching is too broad on pages with footer badges and global logos.
    return false
  }

  if (component.type === 'logo-cloud') {
    if (image.sectionKind !== 'logo') {
      return false
    }
    const logos = Array.isArray(content.logos) ? content.logos as unknown[] : []
    const existingUrls = getExistingImageUrls(component)
    if (existingUrls.has(normalizeImageUrl(absoluteSrc, pageUrl))) {
      return false
    }
    content.logos = [
      ...logos,
      {
        id: stableImageId(absoluteSrc),
        ...imageData
      }
    ]
    return true
  }

  // For two-column components, try to add to the matching child component.
  if (component.type === 'two-column') {
    const leftColumn = content.leftColumn as Array<Record<string, unknown>> | undefined
    const rightColumn = content.rightColumn as Array<Record<string, unknown>> | undefined

    const columns = [...(leftColumn || []), ...(rightColumn || [])]

    // Find matching column item by text
    for (const item of columns) {
      const itemText = getItemText(item)

      // Debug: Log matching attempts for ED-wait image
      if (image.src.includes('ED-wait')) {
        console.log('[ImageEnrichment] Trying to match ED-wait image:', {
          itemHeading: item.heading,
          itemText: itemText.substring(0, 100),
          nearbyText: image.nearbyText?.substring(0, 100),
          matches: image.nearbyText && itemText ? imageMatchesItem(image.nearbyText, itemText) : false
        })
      }

      if (image.nearbyText && itemText && imageMatchesItem(image.nearbyText, itemText)) {
        if (!hasImage(item)) {
          if (isRecord(item.content)) {
            ;(item.content as Record<string, unknown>).image = imageData
          } else {
            item.image = imageData
          }
          console.log('[ImageEnrichment] Added image to two-column item:', {
            heading: item.heading,
            imageUrl: absoluteSrc.substring(0, 60)
          })
          return true
        }
      }
    }
  }

  // For other components, only add images if the component type supports it
  // Many components don't have an 'images' field in their schema
  // Skip adding images array to avoid normalization warnings
  // The image enrichment for these components should happen through
  // component-specific fields (like slides[].image for carousel)
  // For now, we only enrich two-column components with matched images
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stableImageId(src: string): string {
  const withoutQuery = src.split(/[?#]/, 1)[0] || src
  const file = withoutQuery.split('/').filter(Boolean).pop() || 'image'
  const base = file.replace(/\.[a-z0-9]+$/i, '')
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'image'
}

function imageUrlSame(a: unknown, b: unknown, pageUrl?: string): boolean {
  const aUrl = getImageUrl(a)
  const bUrl = getImageUrl(b)
  if (!aUrl || !bUrl) return false
  return normalizeImageUrl(aUrl, pageUrl) === normalizeImageUrl(bUrl, pageUrl)
}

function sectionContainsImageUrl(sectionHtml: string, src: unknown, pageUrl?: string): boolean {
  const srcUrl = getImageUrl(src)
  if (!sectionHtml || !srcUrl) return false
  const normalizedSection = sectionHtml.toLowerCase().replace(/&amp;/g, '&')
  const normalizedSrc = normalizeImageUrl(srcUrl, pageUrl)
  const rawSrc = srcUrl.toLowerCase().replace(/&amp;/g, '&')
  try {
    const pathname = new URL(srcUrl, pageUrl).pathname.toLowerCase()
    return normalizedSection.includes(normalizedSrc) || normalizedSection.includes(rawSrc) || normalizedSection.includes(pathname)
  } catch {
    return normalizedSection.includes(normalizedSrc) || normalizedSection.includes(rawSrc)
  }
}

function hasImage(record: Record<string, unknown>): boolean {
  if (record.image) return true
  if (record.imageUrl) return true
  if (isRecord(record.content)) {
    const content = record.content as Record<string, unknown>
    return Boolean(content.image || content.imageUrl)
  }
  return false
}

function enrichCardCollection(
  value: unknown,
  image: ExtractedImage,
  imageData: Record<string, unknown>
): boolean {
  if (!Array.isArray(value)) {
    return false
  }

  for (const item of value) {
    if (!isRecord(item) || hasImage(item)) {
      continue
    }
    const itemText = getItemText(item)
    if (image.nearbyText && itemText && imageMatchesItem(image.nearbyText, itemText)) {
      item.image = imageData
      return true
    }
  }

  return false
}

function getItemText(item: Record<string, unknown>): string {
  const texts: string[] = []

  const collectText = (value: unknown): void => {
    if (typeof value === 'string') {
      const text = value.replace(/<[^>]+>/g, ' ').trim().toLowerCase()
      if (text.length > 2) texts.push(text)
      return
    }

    if (!isRecord(value)) {
      return
    }

    for (const key of ['heading', 'title', 'body', 'text', 'description', 'summary', 'excerpt', 'label', 'name', 'caption', 'alt']) {
      collectText(value[key])
    }
  }

  collectText(item)

  if (isRecord(item.content)) {
    collectText(item.content)
  }

  return Array.from(new Set(texts)).join(' ')
}

function imageMatchesItem(nearbyText: string, itemText: string): boolean {
  const nearbyLower = nearbyText.toLowerCase()
  const words = itemText.split(/\s+/).filter(w => w.length >= 4).slice(0, 5)

  let matchCount = 0
  for (const word of words) {
    if (nearbyLower.includes(word)) matchCount++
  }

  return matchCount >= 2
}

/**
 * Main function: Enriches components with images from DOM snapshot
 *
 * @param components - Array of detected components
 * @param options - Options including DOM snapshot and page URL
 * @returns Components enriched with additional images
 */
export function enrichComponentImages(
  components: DetectedComponent[],
  options: ImageEnrichmentOptions = {}
): DetectedComponent[] {
  const { domSnapshot, pageUrl } = options

  console.log('[ImageEnrichment] Called with:', {
    componentCount: components.length,
    hasDomSnapshot: !!domSnapshot,
    domSnapshotLength: domSnapshot?.length || 0,
    pageUrl
  })

  if (!domSnapshot) {
    console.log('[ImageEnrichment] No DOM snapshot, skipping enrichment')
    return components
  }

  // Extract all images from DOM
  const domImages = extractImagesFromDom(domSnapshot)

  console.log('[ImageEnrichment] Extracted images from DOM:', {
    count: domImages.length,
    samples: domImages.slice(0, 5).map(img => img.src.substring(0, 60))
  })

  if (domImages.length === 0) return components

  reconcileLogoCloudsFromSourceSections(components, domSnapshot, pageUrl)
  reconcileLogoCloudsWithSourceSections(components, domImages, pageUrl)
  reconcileCtaImagesWithSourceSections(components, domSnapshot, domImages, pageUrl)
  removeUnsupportedCardGridImages(components, domSnapshot)

  // Collect all already-captured image URLs across all components
  const capturedUrls = new Set<string>()
  for (const component of components) {
    const urls = getExistingImageUrls(component)
    urls.forEach(url => capturedUrls.add(url))
  }

  // Find uncaptured images
  const uncapturedImages = domImages.filter(img => {
    const normalizedSrc = normalizeImageUrl(img.src, pageUrl)
    return !capturedUrls.has(normalizedSrc) && !capturedUrls.has(img.src.toLowerCase().replace(/&amp;/g, '&'))
  })

  console.log('[ImageEnrichment] Uncaptured images:', {
    count: uncapturedImages.length,
    captured: capturedUrls.size,
    samples: uncapturedImages.slice(0, 5).map(img => img.src.substring(0, 60))
  })

  if (uncapturedImages.length === 0) return components

  // Try to match uncaptured images to components
  for (const component of components) {
    // Skip components that typically don't have content images
    if (['navbar', 'footer', 'breadcrumb'].includes(component.type || '')) continue

    const componentText = getComponentText(component)

    for (const image of uncapturedImages) {
      if (imageMatchesComponent(image, componentText)) {
        // Check if we haven't already added this image
        const existingUrls = getExistingImageUrls(component)
        const normalizedSrc = normalizeImageUrl(image.src, pageUrl)

        if (!existingUrls.has(normalizedSrc)) {
          const mutated = enrichComponentWithImage(component, image, pageUrl)

          if (mutated) {
            console.log('[ImageEnrichment] Added image to component:', {
              componentType: component.type,
              imageSrc: image.src.substring(0, 80) + (image.src.length > 80 ? '...' : ''),
              matchedVia: 'nearbyText'
            })
          } else {
            console.log('[ImageEnrichment] Skipped image candidate:', {
              componentType: component.type,
              imageSrc: image.src.substring(0, 80) + (image.src.length > 80 ? '...' : ''),
              reason: 'schema_unsupported_or_no_item_match'
            })
          }
        }
      }
    }
  }

  reconcileLogoCloudsFromSourceSections(components, domSnapshot, pageUrl)
  removeUnsupportedCardGridImages(components, domSnapshot)
  return components
}

function reconcileLogoCloudsFromSourceSections(
  components: DetectedComponent[],
  domSnapshot: string,
  pageUrl?: string
): void {
  const logoSections = extractContentSections(domSnapshot)
    .filter(section => classifySection(section.html) === 'logo')
    .map(section => ({
      ...section,
      images: extractSectionImages(section.html)
    }))
    .filter(section => section.images.length > 0)

  if (logoSections.length === 0) return

  for (const component of components) {
    if (component.type !== 'logo-cloud' || !isRecord(component.content)) continue

    const existingUrls = getExistingImageUrls(component)
    const existingLogoText = JSON.stringify(component.content).toLowerCase()
    const existingLooksLikeAwards = /\baward/.test(existingLogoText)
    const best = logoSections
      .map(section => {
        const sourceUrls = new Set(section.images.map(image => normalizeImageUrl(image.src, pageUrl)))
        const overlap = Array.from(existingUrls).filter(url => sourceUrls.has(normalizeImageUrl(url, pageUrl))).length
        const awardBoost = existingLooksLikeAwards && section.html.toLowerCase().includes('award') ? 1 : 0
        return { section, overlap, score: overlap + awardBoost }
      })
      .sort((a, b) => b.score - a.score)[0]

    const bestLooksLikeAwards = Boolean(best?.section.html.toLowerCase().includes('award'))
    if (!best || (best.overlap < 2 && !(existingLooksLikeAwards && bestLooksLikeAwards))) continue

    const unique = new Map<string, Pick<ExtractedImage, 'src' | 'alt'>>()
    for (const image of best.section.images) {
      const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
      unique.set(normalizeImageUrl(absoluteSrc, pageUrl), { ...image, src: absoluteSrc })
    }

    const content = component.content as Record<string, unknown>
    content.logos = Array.from(unique.values()).map(image => {
      const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
      return {
        id: stableImageId(absoluteSrc),
        src: {
          mediaId: `detected:${stableImageId(absoluteSrc)}`,
          mediaType: 'image' as const,
          url: absoluteSrc
        },
        alt: image.alt || '',
        originalUrl: absoluteSrc
      }
    })
  }
}

function extractSectionImages(sectionHtml: string): Array<Pick<ExtractedImage, 'src' | 'alt'>> {
  const images: Array<Pick<ExtractedImage, 'src' | 'alt'>> = []
  const imgTagRegex = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  const altRegex = /alt\s*=\s*["']([^"']*)["']/i
  let match
  while ((match = imgTagRegex.exec(sectionHtml)) !== null) {
    const src = match[1]?.trim()
    if (!src || src.startsWith('data:') || isNonContentImage(src)) continue
    images.push({ src, alt: altRegex.exec(match[0])?.[1] || undefined })
  }
  return images
}

function reconcileCtaImagesWithSourceSections(
  components: DetectedComponent[],
  domSnapshot: string,
  domImages: ExtractedImage[],
  pageUrl?: string
): void {
  const sections = extractContentSections(domSnapshot)

  for (const component of components) {
    if (component.type !== 'cta-banner' || !isRecord(component.content)) continue

    const content = component.content as Record<string, unknown>
    const heading = typeof content.heading === 'string' ? content.heading : ''
    const subheading = typeof content.subheading === 'string' ? content.subheading : ''
    if (!heading && !subheading) continue

    const matched = sections.find(section => {
      const sectionText = section.text.toLowerCase()
      return textMatchesCta(sectionText, heading, subheading)
    })
    const fallbackImage = matched ? undefined : domImages.find(image => {
      const sectionText = (image.sectionText || image.nearbyText || '').toLowerCase()
      return textMatchesCta(sectionText, heading, subheading)
    })
    if (!matched && !fallbackImage) continue

    const image = matched ? extractFirstContentImage(matched.html) : fallbackImage
    if (!image) continue

    const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
    if (imageUrlSame(content.backgroundImage, absoluteSrc, pageUrl)) continue
    const sourceHtml = matched ? matched.html : fallbackImage?.sectionHtml || ''
    if (content.backgroundImage && sectionContainsImageUrl(sourceHtml, content.backgroundImage, pageUrl)) continue

    content.backgroundImage = isRecord(content.backgroundImage)
      ? {
        mediaId: `detected:${stableImageId(absoluteSrc)}`,
        mediaType: 'image',
        url: absoluteSrc
      }
      : absoluteSrc
    component.metadata = {
      ...(component.metadata || {}),
      sourceEvidence: {
        ...(component.metadata?.sourceEvidence || {}),
        ctaImageCorrection: {
          reason: 'matched-source-section-image',
          replacement: absoluteSrc
        }
      }
    }
  }
}

function textMatchesCta(sectionText: string, heading: string, subheading: string): boolean {
  const hasHeading = heading.length > 2 && sectionText.includes(heading.toLowerCase())
  const hasSubheading = subheading.length > 8 && sectionText.includes(subheading.toLowerCase())
  if (heading.length > 2 && subheading.length > 8) {
    return hasHeading && hasSubheading
  }
  return hasHeading || hasSubheading
}

function extractFirstContentImage(sectionHtml: string): Pick<ExtractedImage, 'src' | 'alt'> | null {
  const imgTagRegex = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  const altRegex = /alt\s*=\s*["']([^"']*)["']/i
  let match
  while ((match = imgTagRegex.exec(sectionHtml)) !== null) {
    const src = match[1]?.trim()
    if (!src || src.startsWith('data:') || isNonContentImage(src)) continue
    const alt = altRegex.exec(match[0])?.[1] || undefined
    return { src, alt }
  }
  return null
}

function reconcileLogoCloudsWithSourceSections(
  components: DetectedComponent[],
  images: ExtractedImage[],
  pageUrl?: string
): void {
  const logoSections = new Map<string, ExtractedImage[]>()
  for (const image of images) {
    if (image.sectionKind !== 'logo' || !image.sectionHtml) continue
    const current = logoSections.get(image.sectionHtml) || []
    current.push(image)
    logoSections.set(image.sectionHtml, current)
  }

  if (logoSections.size === 0) return

  for (const component of components) {
    if (component.type !== 'logo-cloud' || !isRecord(component.content)) continue

    const componentText = getComponentText(component)
    const existingUrls = getExistingImageUrls(component)
    const match = Array.from(logoSections.entries())
      .map(([sectionHtml, sectionImages]) => {
        const sectionUrls = new Set(sectionImages.map(image => normalizeImageUrl(image.src, pageUrl)))
        const overlap = Array.from(existingUrls).filter(url => sectionUrls.has(normalizeImageUrl(url, pageUrl))).length
        const textMatched = sectionImages.some(image => imageMatchesComponent(image, componentText))
        return { sectionHtml, sectionImages, score: overlap + (textMatched ? 2 : 0) }
      })
      .sort((a, b) => b.score - a.score)[0]
    if (!match || match.score <= 0) continue

    const { sectionImages } = match
    const unique = new Map<string, ExtractedImage>()
    for (const image of sectionImages) {
      const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
      unique.set(normalizeImageUrl(absoluteSrc, pageUrl), { ...image, src: absoluteSrc })
    }

    const content = component.content as Record<string, unknown>
    content.logos = Array.from(unique.values()).map(image => {
      const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
      const mediaRef = {
        mediaId: `detected:${stableImageId(absoluteSrc)}`,
        mediaType: 'image' as const,
        url: absoluteSrc
      }
      return {
        id: stableImageId(absoluteSrc),
        src: mediaRef,
        alt: image.alt || '',
        originalUrl: absoluteSrc
      }
    })
  }
}

function removeUnsupportedCardGridImages(
  components: DetectedComponent[],
  domSnapshot: string
): void {
  const sourceSections = extractContentSections(domSnapshot)

  for (const component of components) {
    if (component.type !== 'card-grid' || !isRecord(component.content)) continue

    const content = component.content as Record<string, unknown>
    if (typeof content.heading !== 'string' || !Array.isArray(content.cards)) continue

    const heading = content.heading.toLowerCase()
    const matchedSection = sourceSections.find(section => section.text.toLowerCase().includes(heading))
    if (!matchedSection) continue

    const sectionText = matchedSection.text.toLowerCase()

    for (const card of content.cards) {
      if (!isRecord(card) || !card.image || card.href) continue
      const title = typeof card.title === 'string' ? card.title.toLowerCase() : ''
      if (!title || !sectionText.includes(title)) continue
      const titleBlock = extractLocalTextBlock(matchedSection.html, title)
      if (titleBlock && /(<img\b|srcset\s*=|background-image\s*:|data-bg|data-background|data-image)/i.test(titleBlock)) continue
      const cardImageUrl = getImageUrl(card.image)
      if (!cardImageUrl) continue

      delete card.image
      component.metadata = {
        ...(component.metadata || {}),
        sourceEvidence: {
          ...(component.metadata?.sourceEvidence || {}),
          cardGridImageRemoval: {
            reason: 'matched-source-section-has-no-image-elements',
            heading: content.heading
          }
        }
      }
    }
  }
}

function extractLocalTextBlock(html: string, normalizedNeedle: string): string | null {
  const normalizedHtml = html.toLowerCase()
  const index = normalizedHtml.indexOf(normalizedNeedle)
  if (index < 0) return null
  return html.slice(Math.max(0, index - 350), Math.min(html.length, index + 700))
}

function extractContentSections(html: string): Array<{ html: string, text: string, imageCount: number }> {
  const sections: Array<{ html: string, text: string, imageCount: number }> = []
  const regex = /<(section|article)\b[^>]*>[\s\S]*?<\/\1>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const sectionHtml = match[0]
    if (classifySection(sectionHtml) === 'navigation') continue
    sections.push({
      html: sectionHtml,
      text: extractSectionText(sectionHtml),
      imageCount: (sectionHtml.match(/<img\b/gi) || []).length
    })
  }
  return sections
}
