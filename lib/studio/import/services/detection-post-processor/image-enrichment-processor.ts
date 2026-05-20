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

    // Extract nearby text for context matching
    const tagIndex = match.index
    const nearbyText = extractNearbyText(html, tagIndex)

    images.push({ src, alt, nearbyText })
  }

  return images
}

/**
 * Checks if an image URL is likely a non-content image (icons, tracking pixels, etc.)
 */
function isNonContentImage(src: string): boolean {
  const lowerSrc = src.toLowerCase()

  // Tracking pixels and analytics
  if (lowerSrc.includes('pixel') || lowerSrc.includes('beacon')) return true
  if (lowerSrc.includes('analytics') || lowerSrc.includes('tracking')) return true
  if (lowerSrc.includes('.gif') && lowerSrc.includes('1x1')) return true

  // Common icon/UI element patterns
  if (lowerSrc.includes('/icons/') && lowerSrc.includes('.svg')) return true
  if (lowerSrc.includes('favicon')) return true
  if (lowerSrc.includes('spinner') || lowerSrc.includes('loading')) return true

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
      urls.add(record.src.toLowerCase())
    }
    if (typeof record.image === 'object' && record.image) {
      const img = record.image as Record<string, unknown>
      if (typeof img.src === 'string') {
        urls.add(img.src.toLowerCase())
      }
    }

    // Recurse into nested objects
    Object.values(record).forEach(scanValue)
  }

  scanValue(component.content)
  return urls
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
): void {
  const absoluteSrc = normalizeToAbsolute(image.src, pageUrl)
  const imageData = { src: absoluteSrc, alt: image.alt || '' }

  const content = component.content as Record<string, unknown> | undefined
  if (!content) {
    component.content = { images: [imageData] }
    return
  }

  // For two-column components, try to add to the matching column item
  // Two-column schema uses imageUrl/imageAlt fields, not image: { src, alt }
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
        // Add image using the proper two-column schema fields
        if (!item.imageUrl) {
          item.imageUrl = absoluteSrc
          item.imageAlt = image.alt || ''
          console.log('[ImageEnrichment] Added imageUrl to two-column item:', {
            heading: item.heading,
            imageUrl: absoluteSrc.substring(0, 60)
          })
          return
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
}

function getItemText(item: Record<string, unknown>): string {
  const texts: string[] = []
  if (typeof item.heading === 'string') texts.push(item.heading.toLowerCase())
  if (typeof item.title === 'string') texts.push(item.title.toLowerCase())
  if (typeof item.body === 'string') {
    texts.push(item.body.replace(/<[^>]+>/g, ' ').toLowerCase())
  }
  return texts.join(' ')
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

  // Collect all already-captured image URLs across all components
  const capturedUrls = new Set<string>()
  for (const component of components) {
    const urls = getExistingImageUrls(component)
    urls.forEach(url => capturedUrls.add(url))
  }

  // Find uncaptured images
  const uncapturedImages = domImages.filter(img => {
    const normalizedSrc = normalizeToAbsolute(img.src, pageUrl).toLowerCase()
    return !capturedUrls.has(normalizedSrc) && !capturedUrls.has(img.src.toLowerCase())
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
        const normalizedSrc = normalizeToAbsolute(image.src, pageUrl).toLowerCase()

        if (!existingUrls.has(normalizedSrc)) {
          enrichComponentWithImage(component, image, pageUrl)

          // Log enrichment for debugging
          console.log('[ImageEnrichment] Added image to component:', {
            componentType: component.type,
            imageSrc: image.src.substring(0, 80) + (image.src.length > 80 ? '...' : ''),
            matchedVia: 'nearbyText'
          })
        }
      }
    }
  }

  return components
}
