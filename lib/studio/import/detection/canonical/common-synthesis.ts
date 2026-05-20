import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { canonicalizeComponentType } from './registry'
import type { CanonicalSynthesizeParams, CanonicalSynthesisResult } from './types'
import type { DetectedComponent } from '../types'

const SYNTH_CONFIDENCE = 0.9

export function synthesizeNavBar(params: CanonicalSynthesizeParams): CanonicalSynthesisResult | null {
  const { components, pattern, region, templateKey, pageUrl, pageMetadata: _pageMetadata } = params
  const resolvedRegion = region || 'header'
  const menuItems = buildMenuItems(components)

  if (menuItems.length === 0) {
    menuItems.push({ label: 'Home', href: '/' })
  }

  const content: Record<string, any> = {
    menuItems,
    region: resolvedRegion,
    sticky: true
  }

  const logo = buildLogo(components, pageUrl)
  if (logo) {
    content.logo = logo
  }

  const cta = findCallToAction(components)
  if (cta) {
    content.cta = cta
  }

  content.metadata = {
    region: resolvedRegion,
    source: 'canonical-synthesis',
    fragments: ['navigation']
  }

  const componentType = canonicalizeComponentType(pattern.type) as DetectedComponent['type']
  const synthesized: DetectedComponent = {
    component: componentType,
    type: componentType,
    confidence: SYNTH_CONFIDENCE,
    content,
    location: inferLocationFromRegion(resolvedRegion),
    metadata: {
      confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
      ...(pattern.metadata as Record<string, any> | undefined),
      source: 'canonical-synthesis',
      templateKey,
      fragments: ['navigation']
    }
  }

  return {
    component: synthesized,
    insertIndex: resolvedRegion.toLowerCase().includes('header') ? 0 : 0
  }
}

export function synthesizeFooter(params: CanonicalSynthesizeParams): CanonicalSynthesisResult | null {
  const { components, pattern, region, templateKey, pageUrl, pageMetadata: _pageMetadata } = params
  const resolvedRegion = region || 'footer'
  const content: Record<string, any> = {
    columns: buildFooterColumns(components),
    socialLinks: buildSocialLinks(pageUrl),
    legalLinks: buildLegalLinks(),
    copyright: buildCopyright(),
    region: resolvedRegion
  }

  content.metadata = {
    confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
    region: resolvedRegion,
    source: 'canonical-synthesis',
    fragments: ['footer']
  }

  const componentType = canonicalizeComponentType(pattern.type) as DetectedComponent['type']
  const synthesized: DetectedComponent = {
    component: componentType,
    type: componentType,
    confidence: SYNTH_CONFIDENCE,
    content,
    location: inferLocationFromRegion(resolvedRegion),
    metadata: {
      confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
      ...(pattern.metadata as Record<string, any> | undefined),
      source: 'canonical-synthesis',
      templateKey,
      fragments: ['footer']
    }
  }

  return {
    component: synthesized,
    insertIndex: components.length
  }
}

type SynthesizedMenuItem = {
  label: string
  href: string
  external?: boolean
  children?: SynthesizedMenuItem[]
}

function buildMenuItems(components: DetectedComponent[]): SynthesizedMenuItem[] {
  for (const component of components) {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    if (!canonical) {
      continue
    }

    if (canonical === ComponentType.NavBar) {
      const structured = extractStructuredMenuItems(component.content)
      if (structured.length > 0) {
        return structured
      }
    }
  }

  const labels = new Set<string>()

  for (const component of components) {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    if (!canonical) {
      continue
    }

    if (canonical === ComponentType.NavBar) {
      for (const item of extractMenuLabels(component.content)) {
        labels.add(item)
      }
      continue
    }

    const label = extractLabel(component.content)
    if (label) {
      labels.add(label)
    }
  }

  if (labels.size === 0) {
    return buildFallbackMenu()
  }

  return Array.from(labels)
    .slice(0, 6)
    .map(label => ({ label, href: buildHrefFromLabel(label) }))
}

function extractStructuredMenuItems(content: any): SynthesizedMenuItem[] {
  if (!Array.isArray(content?.menuItems)) {
    return []
  }

  const normalize = (item: any): SynthesizedMenuItem | null => {
    const label = selectFirstString([item?.label, item?.text])
    if (!label) {
      return null
    }
    const href = selectFirstString([item?.href, item?.url]) ?? buildHrefFromLabel(label)
    const children = Array.isArray(item?.children)
      ? item.children
          .map((child: any) => normalize(child))
          .filter((child: unknown): child is SynthesizedMenuItem => Boolean(child))
      : undefined

    const normalized: SynthesizedMenuItem = {
      label,
      href,
      ...(typeof item?.external === 'boolean' ? { external: item.external } : {}),
      ...(children && children.length > 0 ? { children } : {})
    }

    return normalized
  }

  return content.menuItems
    .map(normalize)
    .filter((item: unknown): item is SynthesizedMenuItem => Boolean(item))
}

function extractMenuLabels(content: any): string[] {
  if (!Array.isArray(content?.menuItems)) {
    return []
  }
  const items: string[] = []
  for (const item of content.menuItems) {
    const label = selectFirstString([item?.label, item?.text])
    if (label) {
      items.push(label)
    }
  }
  return items
}

function extractLabel(content: any): string | undefined {
  if (!content || typeof content !== 'object') {
    return undefined
  }
  return selectFirstString([
    content.title,
    content.heading,
    content.label,
    content.name,
    content.sectionTitle
  ])
}

function buildFallbackMenu(): SynthesizedMenuItem[] {
  const defaults = ['Home', 'Solutions', 'Pricing', 'Resources', 'Contact']
  return defaults.map(label => ({ label, href: buildHrefFromLabel(label) }))
}

function buildHrefFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  if (!slug || slug === 'home') {
    return '/'
  }
  return '/' + slug
}

function buildLogo(components: DetectedComponent[], pageUrl?: string): Record<string, any> | undefined {
  for (const component of components) {
    const logo = component.content?.logo
    if (logo && (logo.src || logo.text)) {
      return {
        src: typeof logo.src === 'string' ? logo.src : undefined,
        alt: selectFirstString([logo.alt, logo.text]) ?? buildSiteLabel(pageUrl),
        href: typeof logo.href === 'string' ? logo.href : '/'
      }
    }
  }

  return {
    text: buildSiteLabel(pageUrl),
    href: '/'
  }
}

function findCallToAction(components: DetectedComponent[]): Record<string, any> | undefined {
  for (const component of components) {
    const content = component.content ?? {}
    const candidates = [content.primaryCta, content.cta, content.ctaButtons?.[0]]
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue
      }
      const text = selectFirstString([candidate.label, candidate.text])
      const href = selectFirstString([candidate.href, candidate.url])
      if (text) {
        return {
          text,
          href: href ?? '#contact',
          variant: candidate.variant ?? 'default'
        }
      }
    }
  }
  return undefined
}

function buildFooterColumns(components: DetectedComponent[]): Array<Record<string, any>> {
  const sections: Array<Record<string, any>> = []

  for (const component of components) {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    if (!canonical) {
      continue
    }
    const heading = extractLabel(component.content)
    const link = selectFirstString([
      component.content?.link,
      component.content?.href,
      component.content?.url,
      component.content?.cta?.href,
      component.content?.cta?.url,
      component.content?.primaryCta?.href,
      component.content?.primaryCta?.url
    ])
    if (heading && link) {
      sections.push({
        title: heading,
        links: [{ label: heading, href: link }]
      })
      if (sections.length >= 3) {
        break
      }
    }
  }

  if (sections.length > 0) {
    return sections
  }

  return [
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/company' },
        { label: 'Careers', href: '/careers' },
        { label: 'Press', href: '/press' }
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'Blog', href: '/resources/blog' },
        { label: 'Docs', href: '/docs' },
        { label: 'Support', href: '/support' }
      ]
    }
  ]
}

function buildSocialLinks(pageUrl?: string): Array<Record<string, any>> {
  const base = normalizeHost(pageUrl)
  return [
    { platform: 'linkedin', url: 'https://www.linkedin.com/company/' + base },
    { platform: 'twitter', url: 'https://twitter.com/' + base }
  ]
}

function buildLegalLinks(): Array<{ label: string; href: string }> {
  return [
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' }
  ]
}

function buildCopyright(): string {
  const year = new Date().getFullYear()
  return 'Copyright ' + year + ' Your Company. All rights reserved.'
}

function buildSiteLabel(pageUrl?: string): string {
  const host = normalizeHost(pageUrl)
  if (!host) {
    return 'Site'
  }
  return host
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeHost(pageUrl?: string): string {
  if (!pageUrl) {
    return 'site'
  }
  try {
    const { hostname } = new URL(pageUrl)
    return hostname
      .replace(/^www\./, '')
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase() || 'site'
  } catch {
    return 'site'
  }
}

function selectFirstString(values: any[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function inferLocationFromRegion(region: string): DetectedComponent['location'] {
  const normalized = region.toLowerCase()
  if (normalized.includes('header')) {
    return 'header'
  }
  if (normalized.includes('hero')) {
    return 'hero'
  }
  if (normalized.includes('footer')) {
    return 'footer'
  }
  return 'main'
}


