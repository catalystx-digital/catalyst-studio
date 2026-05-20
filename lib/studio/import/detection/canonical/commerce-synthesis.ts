import { canonicalizeComponentType } from './registry'
import type { CanonicalSynthesizeParams, CanonicalSynthesisResult } from './types'
import type { DetectedComponent } from '../types'
import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { ConfidenceConfig } from '../../config'

// Use centralized synthetic confidence
const DEFAULT_CONFIDENCE = ConfidenceConfig.synthetic.commerce
const STORE_PATH_MATCHER = /(\/stores\/|\/retail-stores\/|\/eat\/|\/dine\/|\/shop\b)/i

interface FeatureItem {
  icon?: string
  title: string
  description: string
}

export function synthesizeStoreFeatureList(
  params: CanonicalSynthesizeParams
): CanonicalSynthesisResult | null {
  if (!isStoreLikePage(params.pageUrl, params.pageMetadata?.pageType)) {
    return null
  }

  const resolvedRegion = params.region || 'main'
  const items = buildFeatureItems(params.components, params.pageMetadata)

  if (items.length === 0) {
    const fallbackDescription = buildFallbackDescription(params.pageMetadata, params.pageUrl)
    items.push({
      icon: 'map-pin',
      title: 'Visit us in centre',
      description: fallbackDescription
    })
  }

  const canonicalType = canonicalizeComponentType(params.pattern.type) ?? params.pattern.type
  const storeName = deriveStoreName(params.pageMetadata?.title, items, params.pageUrl)

  const content: Record<string, any> = {
    region: resolvedRegion,
    layout: 'vertical',
    heading: storeName ? `${storeName} store details` : 'Store information',
    items: items.map(item => ({
      type: 'feature-item',
      icon: item.icon,
      title: item.title,
      description: item.description
    })),
    metadata: {
      confidence: DEFAULT_CONFIDENCE,
      region: resolvedRegion,
      source: 'canonical-synthesis',
      templateKey: params.templateKey,
      variant: 'commerce-store'
    }
  }

  const synthesized: DetectedComponent = {
    component: canonicalType,
    type: canonicalType as ComponentType,
    confidence: DEFAULT_CONFIDENCE,
    content,
    location: 'main',
    metadata: {
      confidence: params.pattern.confidence ?? DEFAULT_CONFIDENCE,
      ...(params.pattern.metadata as Record<string, unknown> | undefined),
      region: resolvedRegion,
      source: 'canonical-synthesis',
      templateKey: params.templateKey,
      variant: 'commerce-store'
    }
  }

  return {
    component: synthesized,
    insertIndex: determineInsertIndex(params.components)
  }
}

function isStoreLikePage(pageUrl?: string, pageType?: string | null): boolean {
  if (pageType && pageType.toLowerCase().includes('store')) {
    return true
  }

  if (!pageUrl) {
    return false
  }

  return STORE_PATH_MATCHER.test(pageUrl)
}

function buildFeatureItems(components: DetectedComponent[], pageMetadata: any): FeatureItem[] {
  const items: FeatureItem[] = []
  const location = findComponent(components, 'location-map')
  const contact = findComponent(components, 'contact-info')

  const hours = extractHours(contact, pageMetadata)
  const phone = extractPhone(contact, pageMetadata)
  const address = extractAddress(contact, location, pageMetadata)

  if (address) {
    items.push({ icon: 'map-pin', title: 'Location', description: address })
  }

  if (hours) {
    items.push({ icon: 'clock', title: 'Opening hours', description: hours })
  }

  if (phone) {
    items.push({ icon: 'phone', title: 'Contact', description: phone })
  }

  const about = normalizeString(pageMetadata?.description)
  if (about && !items.some(item => item.description === about)) {
    items.push({ icon: 'info', title: 'About', description: about })
  }

  return items
}

function findComponent(
  components: DetectedComponent[],
  canonicalType: string
): DetectedComponent | undefined {
  return components.find(component => {
    const candidate =
      canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    return candidate === canonicalType
  })
}

function extractAddress(
  contact?: DetectedComponent,
  location?: DetectedComponent,
  pageMetadata?: any
): string | null {
  const contactAddress = normalizeAddress(contact?.content?.address)
  if (contactAddress) {
    return contactAddress
  }

  const mapAddress = normalizeAddress(location?.content?.address)
  if (mapAddress) {
    return mapAddress
  }

  const infoWindow = normalizeString(location?.content?.infoWindow?.description)
  if (infoWindow) {
    return infoWindow
  }

  const metadataAddress = normalizeAddress(pageMetadata?.contactInfo?.address)
  if (metadataAddress) {
    return metadataAddress
  }

  return null
}

function extractHours(contact?: DetectedComponent, pageMetadata?: any): string | null {
  const metadataHours = normalizeHours(pageMetadata?.contactInfo?.hours)
  if (metadataHours) {
    return metadataHours
  }

  const contactHours = normalizeHours(contact?.content?.hours || contact?.content?.openingHours)
  if (contactHours) {
    return contactHours
  }

  return null
}

function extractPhone(contact?: DetectedComponent, pageMetadata?: any): string | null {
  const contactPhone = normalizeString(contact?.content?.phone)
  if (contactPhone) {
    return contactPhone
  }

  const metadataPhone = normalizeString(pageMetadata?.contactInfo?.phone)
  if (metadataPhone) {
    return metadataPhone
  }

  const metadataEmail = normalizeString(pageMetadata?.contactInfo?.email)
  if (metadataEmail) {
    return metadataEmail
  }

  return null
}

function normalizeAddress(address: any): string | null {
  if (!address) {
    return null
  }

  if (typeof address === 'string') {
    const normalized = normalizeString(address)
    return normalized || null
  }

  if (typeof address === 'object') {
    const parts = [
      address.street || address.address1,
      address.street2 || address.address2,
      address.city,
      address.state,
      address.postcode || address.zipCode,
      address.country
    ]
      .map(value => normalizeString(value))
      .filter((value): value is string => Boolean(value))

    if (parts.length > 0) {
      return parts.join(', ')
    }
  }

  return null
}

function normalizeHours(value: any): string | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    const normalized = normalizeString(value)
    return normalized || null
  }

  if (Array.isArray(value)) {
    const rows = value
      .map(item => normalizeString(item))
      .filter((item): item is string => Boolean(item))
    if (rows.length > 0) {
      return rows.join(' \u2022 ')
    }
  }

  if (typeof value === 'object') {
    const rows = Object.entries(value)
      .map(([key, val]) => {
        const normalizedValue = normalizeString(val)
        if (!normalizedValue) {
          return null
        }
        const normalizedKey = normalizeString(key)
        return normalizedKey ? `${normalizedKey}: ${normalizedValue}` : normalizedValue
      })
      .filter((item): item is string => Boolean(item))

    if (rows.length > 0) {
      return rows.join(' \u2022 ')
    }
  }

  return null
}

function normalizeString(value: any): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function determineInsertIndex(components: DetectedComponent[]): number {
  if (components.length === 0) {
    return 0
  }

  let lastHeroIndex = -1
  for (let i = 0; i < components.length; i += 1) {
    const region = normalizeString(components[i].metadata?.region)
    if (region === 'hero' || region === 'header') {
      lastHeroIndex = i
    }
  }

  return lastHeroIndex >= 0 ? lastHeroIndex + 1 : components.length
}

function buildFallbackDescription(pageMetadata: any, pageUrl?: string): string {
  const summary = normalizeString(pageMetadata?.description) || normalizeString(pageMetadata?.pageSummary)
  if (summary) {
    return summary
  }

  if (pageUrl) {
    try {
      const parsed = new URL(pageUrl)
      return `Located at ${parsed.hostname}. See map for details.`
    } catch {
      /* ignore */
    }
  }

  return 'Located inside the shopping centre. See the map for directions.'
}

function deriveStoreName(
  title: string | undefined,
  items: FeatureItem[],
  pageUrl?: string
): string | undefined {
  const normalizedTitle = normalizeString(title)
  if (normalizedTitle) {
    return normalizedTitle
  }

  const locationFeature = items.find(item => item.title.toLowerCase().includes('location'))
  if (locationFeature) {
    const descriptor = locationFeature.description.split(',')[0]?.trim()
    if (descriptor && descriptor.length <= 60) {
      return descriptor
    }
  }

  if (pageUrl) {
    try {
      const { pathname } = new URL(pageUrl)
      const segments = pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        const last = segments[segments.length - 1]
        const words = last
          .replace(/[-_]+/g, ' ')
          .replace(/%20/g, ' ')
          .split(' ')
          .filter(Boolean)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        if (words.length > 0) {
          return words.join(' ')
        }
      }
    } catch {
      /* ignore */
    }
  }

  return undefined
}

