import * as parse5 from 'parse5'
import type { DetectedComponent } from '../types'

type HtmlNode = { nodeName?: string; tagName?: string; value?: string; attrs?: Array<{name: string; value: string}>; aria?: Record<string, string>; childNodes?: HtmlNode[]; content?: HtmlNode }
const blockTags = new Set(['p','div','section','article','header','footer','main','nav','li','ul','ol','h1','h2','h3','h4','h5','h6','blockquote','td','th','tr','figcaption','figure','address','form','br'])
const excludedTags = new Set(['script','style','template','noscript'])
const normalizePlainText = (value: string) => value.normalize('NFKC').replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').replace(/\s+/gu, ' ').trim().replace(/[\p{P}]+$/gu, '').toLocaleLowerCase('en')
const textWords = (value: string) => normalizeText(value).split(/\s+/).map(word => word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')).filter(word => /[\p{L}\p{N}]/u.test(word))
const joinChildren = (node: HtmlNode, flatten: (child: HtmlNode) => string) => (node.childNodes || []).map((child, index, children) => (index && child.tagName && children[index - 1].tagName ? ' ' : '') + flatten(child)).join('')
export function normalizeText(value: string): string {
  const tree = parse5.parseFragment(value) as HtmlNode
  const flatten = (node: HtmlNode): string => excludedTags.has(node.tagName || '') ? '' : node.nodeName === '#text' ? node.value || '' : (blockTags.has(node.tagName || '') ? ' ' : '') + joinChildren(node, flatten) + (blockTags.has(node.tagName || '') ? ' ' : '')
  return normalizePlainText(flatten(tree))
}
export function wordShingles(value: string): string[] {
  const words = normalizeText(value).split(/\s+/).filter(Boolean)
  return words.length < 5 ? (words.length ? [words.join(' ')] : []) : words.slice(0, -4).map((_, index) => words.slice(index, index + 5).join(' '))
}
export const containsPhrase = (text: string, phrase: string) => {
  const needle = normalizeText(phrase), haystack = normalizeText(text)
  if (!needle) return false
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    const before = haystack[index - 1], after = haystack[index + needle.length]
    if ((index === 0 || /\s/u.test(before)) && (after === undefined || /[\s\p{P}]/u.test(after))) return true
    index = haystack.indexOf(needle, index + 1)
  }
  return false
}
export const TEXT_COVERAGE_THRESHOLD = 0.9
export function isHumanText(field: {value: string; path: string}, minimumLength = 12): boolean {
  const text = normalizeText(field.value), key = field.path.split('.').pop()!.replace(/\[\d+\]/g, '')
  if (text.length < minimumLength) return false
  if (/^(?:id|.*Id|slug|type|component|componentType|variant|layout|size|align|alignment|position|region|location|class|className|classes|color|.*Color|style|theme|icon|font|fontFamily|weight|target|rel|mediaType|url|href|src|srcset|path|originalUrl|canonicalUrl)$/i.test(key)) return false
  if (/^(?:https?:|mailto:|tel:|data:|\/|#|rgb\(|rgba\(|hsl\(|var\(|[a-z]+:\/\/)/i.test(text)) return false
  if (/^[a-f0-9-]{12,}$/i.test(text) || /^\S+@\S+\.\S+$/.test(text)) return false
  if (/^(?:eyebrow|intro|subtitle|title|heading|subheading|description|text|body|bodyHtml|html|content|label|alt|caption|quote|name|placeholder|value|summary|copyright)$/i.test(key)) return true
  return /\s/u.test(text) && !text.split(/\s+/).every(word => /[_:]/.test(word) || /^[a-z]+-/.test(word)) && /\p{L}/u.test(text)
}
export function fieldsNotFound<T extends {value: string}>(fields: T[], corpus: string): T[] {
  return fields.filter(field => {
    const shingles = wordShingles(field.value)
    return shingles.length > 0 && shingles.filter(shingle => containsPhrase(corpus, shingle)).length / shingles.length < TEXT_COVERAGE_THRESHOLD
  })
}

function inventedTextMissing(corpus: string): (value: string) => boolean {
  const normalizedCorpus = normalizeText(corpus)
  const words = textWords(corpus)
  const positions = new Map<string, number[]>()
  words.forEach((word, index) => {
    const seen = positions.get(word)
    if (seen) seen.push(index)
    else positions.set(word, [index])
  })
  const found = (shingle: string) => {
    const parts = shingle.split(' ')
    if (parts.length < 3) return words.some((word, index) => word === parts[0] && (parts.length === 1 || words[index + 1] === parts[1]))
    // Small ordered gaps preserve text whose linked words were omitted by extraction.
    return (positions.get(parts[0]) || []).some(start => {
      for (let middle = start + 1; middle <= start + 4 && middle < words.length; middle++) {
        if (words[middle] !== parts[1]) continue
        for (let end = middle + 1; end <= middle + 4 && end < words.length; end++) {
          if (words[end] === parts[2]) return true
        }
      }
      return false
    })
  }
  return value => {
    const phrase = normalizeText(value)
    let offset = normalizedCorpus.indexOf(phrase)
    while (offset !== -1) {
      const before = normalizedCorpus[offset - 1], after = normalizedCorpus[offset + phrase.length]
      if ((offset === 0 || /\s/u.test(before)) && (after === undefined || /[\s\p{P}]/u.test(after))) return false
      offset = normalizedCorpus.indexOf(phrase, offset + 1)
    }
    const fieldWords = textWords(value)
    const shingles = fieldWords.length < 3 ? (fieldWords.length ? [fieldWords.join(' ')] : []) : fieldWords.slice(0, -2).map((_, index) => fieldWords.slice(index, index + 3).join(' '))
    return shingles.length > 0 && shingles.filter(found).length / shingles.length < TEXT_COVERAGE_THRESHOLD
  }
}

export function pageTextCorpus(html: string): string {
  const attrs: string[] = []
  const flatten = (node: HtmlNode): string => {
    if (excludedTags.has(node.tagName || '') || node.tagName === 'head') return ''
    for (const name of ['alt', 'title', 'value', 'placeholder', 'aria-label']) {
      const value = node.attrs?.find(attr => attr.name === name)?.value || node.aria?.[name]
      if (value) attrs.push(value)
    }
    if (node.nodeName === '#text') return node.value || ''
    const inside = joinChildren(node, flatten) + (node.content ? flatten(node.content) : '')
    return blockTags.has(node.tagName || '') ? ' ' + inside + ' ' : inside
  }
  return normalizePlainText(flatten(parse5.parse(html) as HtmlNode) + ' ' + attrs.join(' '))
}

type InventedTextFinding = {componentIndex: number; type: 'field'; path: string; value: string}
const skippedKeys = new Set(['metadata','settings','type','component','id','location','region','confidence'])

export function findInventedText(components: DetectedComponent[], corpus: string): InventedTextFinding[] {
  const missing = inventedTextMissing(corpus)
  const findings: InventedTextFinding[] = []
  components.forEach((component, componentIndex) => {
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          const item = value[index], itemPath = `${path}[${index}]`
          if (typeof item === 'string' && !/^[\p{N}\s\p{P}\p{S}]+$/u.test(normalizeText(item)) && isHumanText({value: item, path: itemPath}, 1) && missing(item)) {
            findings.push({type: 'field', path: itemPath, value: item, componentIndex})
          } else walk(item, itemPath)
        }
      } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (skippedKeys.has(key) || (key === 'name' && /(?:^|\.)(?:fields|formFields)\[\d+\]$/i.test(path))) continue
          const itemPath = path ? `${path}.${key}` : key
          if (typeof item === 'string' && key.toLowerCase() !== 'alt' && !/^[\p{N}\s\p{P}\p{S}]+$/u.test(normalizeText(item)) && isHumanText({value: item, path: itemPath}, 1) && missing(item)) {
            findings.push({type: 'field', path: itemPath, value: item, componentIndex})
          } else walk(item, itemPath)
        }
      }
    }
    walk(component.content, 'content')
    if ('props' in component) walk((component as DetectedComponent & {props?: unknown}).props, 'props')
  })
  return findings
}
