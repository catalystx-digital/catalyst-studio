import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { extractSourceSections, type SourceSection } from './source-section-extractor'

export interface SourceNarrativeRecoveryOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
    : ''
}

function collectComponentText(value: unknown, parts: string[] = []): string[] {
  if (typeof value === 'string') {
    parts.push(value)
    return parts
  }
  if (Array.isArray(value)) {
    value.forEach(entry => collectComponentText(entry, parts))
    return parts
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(entry => collectComponentText(entry, parts))
  }
  return parts
}

function hasExistingOverlap(section: SourceSection, components: DetectedComponent[]): boolean {
  const existingText = normalizeText(collectComponentText(components.map(component => component.content)).join(' '))
  if (!existingText) {
    return false
  }

  const body = normalizeText(section.body)
  if (body && body.length >= 80 && existingText.includes(body.slice(0, 80))) {
    return true
  }

  return false
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphsToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractListHtml(sectionHtml: string): string {
  return Array.from(sectionHtml.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi))
    .map(match => {
      const tag = match[1].toLowerCase() === 'ol' ? 'ol' : 'ul'
      const items = Array.from((match[2] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
        .map(item => stripTags(item[1] ?? ''))
        .filter(Boolean)
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join('')
      return items ? `<${tag}>${items}</${tag}>` : ''
    })
    .filter(Boolean)
    .join('')
}

function bodyHtmlFromSection(section: SourceSection): string {
  return `${paragraphsToHtml(section.body ?? '')}${extractListHtml(section.html)}`
}

function recoveredComponent(section: SourceSection): DetectedComponent | undefined {
  if (!section.heading || !section.body) {
    return undefined
  }

  const paragraphCount = section.body.split(/\n{2,}/).filter(Boolean).length
  const hasStructuredBody = /<(ul|ol)\b/i.test(section.html)
  const useHtmlBlock = paragraphCount > 1 || hasStructuredBody
  const metadata = {
    source: 'source-narrative-recovery',
    sourceEvidence: {
      narrativeRecovery: {
        sectionIndex: section.index,
        heading: section.heading,
        kind: section.kind
      }
    }
  }

  return {
    component: useHtmlBlock ? ComponentType.HtmlBlock : ComponentType.TextBlock,
    type: useHtmlBlock ? ComponentType.HtmlBlock : ComponentType.TextBlock,
    confidence: 0.68,
    location: 'main',
    metadata,
    content: useHtmlBlock
      ? {
          title: section.heading,
          bodyHtml: bodyHtmlFromSection(section)
        }
      : {
          heading: section.heading,
          body: section.body,
          alignment: 'left',
          headingLevel: 2
        }
  }
}

export function recoverSourceNarrativeSections(
  components: DetectedComponent[],
  options: SourceNarrativeRecoveryOptions = {}
): DetectedComponent[] {
  if (!options.domSnapshot) {
    return components
  }

  const seenRecovered = new Set<string>()
  const recovered = extractSourceSections(options.domSnapshot, options.pageUrl)
    .filter(section => section.kind === 'narrative')
    .filter(section => !hasExistingOverlap(section, components))
    .filter(section => {
      const key = `${normalizeText(section.heading)}::${normalizeText(section.body).slice(0, 160)}`
      if (seenRecovered.has(key)) {
        return false
      }
      seenRecovered.add(key)
      return true
    })
    .map(recoveredComponent)
    .filter((component): component is DetectedComponent => Boolean(component))

  if (recovered.length === 0) {
    return components
  }

  const insertIndex = components.findIndex(component => component.location === 'footer' || component.type === ComponentType.Footer)
  if (insertIndex === -1) {
    return [...components, ...recovered]
  }

  return [
    ...components.slice(0, insertIndex),
    ...recovered,
    ...components.slice(insertIndex)
  ]
}
