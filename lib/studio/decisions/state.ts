/**
 * Building the state a question is asked against.
 *
 * This decides more than the wording does. In the benchmark the same model
 * answering the same questions read every hero as a feature list, until the
 * renderer stopped discarding image and heading signals. Nothing about the
 * prompt changed.
 *
 * Each facet's rendering lives here and is tested once; which facets a question
 * gets is declared on the question. A universal builder is one-size-fits-nothing
 * and free-form per-question renderers drift, so this is the middle.
 *
 * @module decisions/state
 */
import type { Facet } from './types'

export interface EvidenceNode {
  tag?: string
  text?: string
  href?: string
  src?: string
  alt?: string
  bgImage?: string
  children?: EvidenceNode[]
}

export interface EvidenceSource {
  url?: string
  nodes: EvidenceNode[]
  /** Pre-rendered evidence for questions with a domain-specific outline. */
  rendered?: string
}

export const DEFAULT_MAX_CHARS = 14_000
/** Choice tops out at 255 options; the field slots need headroom. */
export const MAX_ENUMERATED_NODES = 200

const HEADING_TAG = /^h[1-6]$/i

interface Walked {
  headings: Array<{ tag: string; text: string }>
  paragraphs: string[]
  links: Array<{ label: string; href: string }>
  media: Array<{ src: string; alt: string }>
  backgrounds: number
  outline: string[]
  nodes: Array<{ id: string; tag: string; text: string; href?: string; src?: string; alt?: string }>
}

function walk(source: EvidenceSource): Walked {
  const out: Walked = {
    headings: [], paragraphs: [], links: [], media: [],
    backgrounds: 0, outline: [], nodes: []
  }
  let counter = 0

  const visit = (nodes: EvidenceNode[], depth: number): void => {
    for (const node of nodes) {
      const tag = String(node.tag ?? '')
      const text = node.text ? String(node.text).replace(/\s+/g, ' ').trim() : ''

      if (node.src) out.media.push({ src: node.src, alt: node.alt ?? '' })
      if (node.bgImage) out.backgrounds++
      if (HEADING_TAG.test(tag) && text) out.headings.push({ tag: tag.toLowerCase(), text })
      else if (node.href && text) out.links.push({ label: text, href: node.href })
      // Any remaining text is body copy. Not length-filtered: a short line is
      // still the evidence when the source is a user's prompt rather than a page.
      else if (text) out.paragraphs.push(text)

      if (text || node.src) {
        counter++
        if (out.nodes.length < MAX_ENUMERATED_NODES) {
          out.nodes.push({
            id: `n${counter}`,
            tag: tag || '?',
            text: text.slice(0, 220),
            href: node.href,
            src: node.src,
            alt: node.alt
          })
        }
      }

      if (tag || text) {
        const marks: string[] = []
        if (node.src) marks.push('IMAGE')
        if (node.bgImage) marks.push('BACKGROUND-IMAGE')
        if (node.href) marks.push('LINK')
        out.outline.push(
          `${'  '.repeat(Math.min(depth, 6))}${tag || '?'}` +
          `${marks.length ? ` ${marks.join(' ')}` : ''}` +
          `${text ? ` "${text.slice(0, 180)}"` : ''}`
        )
      }

      if (Array.isArray(node.children)) visit(node.children, depth + 1)
    }
  }

  visit(source.nodes, 0)
  return out
}

function renderFacet(facet: Facet, source: EvidenceSource, walked: Walked): string | null {
  switch (facet) {
    case 'url':
      return source.url ? `URL: ${source.url}` : null

    case 'counts':
      // Deliberately first in the output: cheapest signal, survives truncation.
      return `Counts: ${walked.media.length} images, ${walked.backgrounds} background images, ` +
        `${walked.links.length} links, ${walked.headings.length} headings.`

    case 'headings':
      if (walked.headings.length === 0) return 'Headings: none'
      return `Headings in order:\n${walked.headings.map(h => `${h.tag}: ${h.text.slice(0, 120)}`).join('\n')}`

    case 'text':
      if (walked.paragraphs.length === 0) return null
      return `Text:\n${walked.paragraphs.map(p => p.slice(0, 400)).join('\n')}`

    case 'links':
      if (walked.links.length === 0) return null
      return `Links:\n${walked.links.map(l => `${l.label.slice(0, 60)} -> ${l.href.slice(0, 90)}`).join('\n')}`

    case 'media':
      if (walked.media.length === 0 && walked.backgrounds === 0) return null
      return `Media:\n${walked.media.map(m => `image alt="${m.alt.slice(0, 70)}"`).join('\n')}` +
        (walked.backgrounds > 0 ? `\n${walked.backgrounds} background image(s)` : '')

    case 'structure':
      if (walked.outline.length === 0) return null
      return `Outline:\n${walked.outline.join('\n')}`

    case 'nodes':
      if (walked.nodes.length === 0) return null
      return 'Selectable source nodes:\n' + walked.nodes.map(n =>
        `${n.id}: ${n.tag}${n.src ? ' [image]' : ''}` +
        `${n.href ? ` [href ${n.href.slice(0, 60)}]` : ''}` +
        `${n.text ? ` "${n.text}"` : ''}`
      ).join('\n')

    default:
      return null
  }
}

/**
 * Deterministic: the same source and facets always produce a byte-identical
 * string. State is hashed for the shadow log, so a renderer that varied run to
 * run would make the log ungroupable.
 */
export function buildState(
  source: EvidenceSource,
  facets: Facet[],
  maxChars: number = DEFAULT_MAX_CHARS
): string {
  if (source.rendered !== undefined) {
    return source.rendered.length <= maxChars
      ? source.rendered
      : `${source.rendered.slice(0, maxChars)}\n…[truncated at ${maxChars} characters]`
  }
  const walked = walk(source)
  // Counts leads regardless of the order a question declared its facets.
  const ordered = [...facets].sort((a, b) => (a === 'counts' ? -1 : b === 'counts' ? 1 : 0))

  const blocks: string[] = []
  for (const facet of ordered) {
    const rendered = renderFacet(facet, source, walked)
    if (rendered) blocks.push(rendered)
  }

  const joined = blocks.join('\n\n')
  if (joined.length <= maxChars) return joined
  // Truncation is visible. Silent truncation produces confident answers about
  // a page the model only half saw.
  return `${joined.slice(0, maxChars)}\n…[truncated at ${maxChars} characters]`
}

/** The enumerated nodes a 'nodes' state offered, so an answer can be resolved. */
export function enumerateNodes(source: EvidenceSource): Walked['nodes'] {
  return walk(source).nodes
}
