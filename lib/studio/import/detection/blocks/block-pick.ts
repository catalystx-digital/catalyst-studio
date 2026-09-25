import { askPanel, getQuestion, type DecisionSource } from '@/lib/studio/decisions'
import { expandCandidatesFromSectionEvidence } from '@/lib/studio/import/web-detection'
import { filterPageContentCandidateTypes } from '../candidate-types'
import { roleForSection, candidatesForRole } from '../section-plan'
import { classifySectionIntent } from '../section-taxonomy'
import type { BlockInput } from './block-input'
import type { BlockCatalogueOverride } from './block-catalogue'

const COMPONENT_QUESTION = 'import.block.component'
const MULTIPLE_QUESTION = 'import.block.multiple'
const EVIDENCE_CHARACTERS = 14_000
const NODE_TEXT_CHARACTERS = 180
const DEPTH_LIMIT = 6

export function selectBlockCandidates(input: BlockInput, url: string, catalogueOverride?: Pick<BlockCatalogueOverride, 'types'>) {
  const index = input.block.order - 1
  const sectionKey = input.block.region + '-block-' + input.block.order + '-' + input.block.id
  const role = roleForSection(sectionKey, index)
  const task = {
    sectionKey,
    sectionOrder: index,
    role,
    required: role === 'header' || role === 'footer',
    candidateTypes: candidatesForRole(role, url)
  }
  const taxonomy = classifySectionIntent({
    componentType: task.role,
    content: { section: input.nodes },
    pageUrl: url
  })
  const types = new Set(task.candidateTypes)
  taxonomy.allowedTypes.forEach(type => types.add(type))
  expandCandidatesFromSectionEvidence(types, input.nodes)
  if (task.role === 'header' || task.role === 'footer') {
    types.clear()
    types.add(task.role === 'header' ? 'navbar' : 'footer')
  }
  return { allowedTypes: catalogueOverride ? Object.keys(catalogueOverride.types) : filterPageContentCandidateTypes(types), task, taxonomy }
}

// Exported for the lab to record production evidence in dry runs.
export function renderPickEvidence(input: BlockInput) {
  const lines: string[] = []
  const issues = new Set(input.issues)
  const headings: string[] = []
  let images = 0
  let links = 0
  let buttons = 0
  let backgrounds = 0
  const walk = (node: any, depth: number) => {
    if (!node.tagName) {
      return
    }
    const tag = node.tagName
    const attrs = Object.fromEntries((node.attrs || []).map((attribute: any) => [attribute.name, attribute.value]))
    const text = (node.childNodes || []).filter((child: any) => child.nodeName === '#text')
      .map((child: any) => child.value).join('').replace(/\s+/g, ' ').trim()
    if (String(attrs.alt || '').length > NODE_TEXT_CHARACTERS) {
      issues.add('Decision image alt shortened: ' + String(attrs.alt).length + ' -> ' + NODE_TEXT_CHARACTERS + ' characters')
    }
    if (text.length > NODE_TEXT_CHARACTERS) {
      issues.add('Decision node text shortened: ' + tag + ' ' + text.length + ' -> ' + NODE_TEXT_CHARACTERS + ' characters')
    }
    if (depth > DEPTH_LIMIT) {
      issues.add('Decision outline indentation capped at depth ' + DEPTH_LIMIT)
    }
    if (/^h[1-6]$/.test(tag)) {
      headings.push(tag + ': ' + text.slice(0, NODE_TEXT_CHARACTERS))
    }
    if (attrs.src || attrs.srcset) images++
    if (attrs.href) links++
    if (tag === 'button' || attrs.role === 'button') buttons++
    if (node.bgImage || /background.*url/i.test(attrs.style || '')) backgrounds++
    lines.push('  '.repeat(Math.min(depth, DEPTH_LIMIT)) + tag +
      (attrs.src || attrs.srcset ? ' IMAGE' : '') +
      (attrs.href ? ' LINK' : '') +
      (tag === 'button' || attrs.role === 'button' ? ' BUTTON' : '') +
      (attrs.alt ? ' alt=' + JSON.stringify(String(attrs.alt).slice(0, NODE_TEXT_CHARACTERS)) : '') +
      (text ? ' ' + JSON.stringify(text.slice(0, NODE_TEXT_CHARACTERS)) : ''))
    const children = (node.childNodes || []).filter((child: any) => child.tagName)
    for (const child of children) walk(child, depth + 1)
  }
  input.trees.forEach(tree => walk(tree, 0))
  const rendered = [
    'Block ' + input.block.order + '; region ' + input.block.region,
    'Counts: ' + images + ' images, ' + backgrounds + ' inline backgrounds, ' + links + ' links, ' + buttons + ' buttons, ' + headings.length + ' headings.',
    'Repeated child groups: ' + JSON.stringify(input.block.repeatedChildren || []),
    'Headings in order:\n' + headings.join('\n'),
    'DOM outline:\n' + lines.join('\n')
  ].join('\n')
  if (rendered.length > EVIDENCE_CHARACTERS) {
    issues.add('Decision evidence truncated: ' + rendered.length + ' -> ' + EVIDENCE_CHARACTERS + ' characters')
  }
  return {
    state: rendered.length > EVIDENCE_CHARACTERS ? rendered.slice(0, EVIDENCE_CHARACTERS) + '\n[truncated]' : rendered,
    issues: [...issues]
  }
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export async function pickBlockTypes(
  blockInput: BlockInput & { url: string; websiteId?: string },
  selection = selectBlockCandidates(blockInput, blockInput.url),
  catalogueOverride?: Pick<BlockCatalogueOverride, 'types'>
) {
  const evidence = renderPickEvidence(blockInput)
  const answer = await askPanel(
    [COMPONENT_QUESTION, MULTIPLE_QUESTION],
    { url: blockInput.url, nodes: [], rendered: evidence.state },
    { websiteId: blockInput.websiteId },
    catalogueOverride ? { [COMPONENT_QUESTION]: {
      criteria: catalogueOverride.types,
      instructions: current => current.replace('catalogue page-level component type', 'component family')
    } } : undefined
  )
  const component = answer[COMPONENT_QUESTION]
  const multiple = answer[MULTIPLE_QUESTION]
  const fallback = (source: DecisionSource, reason?: string) => ({
    allowedTypes: selection.allowedTypes,
    topChoices: { component: null, multiple: null },
    answer,
    source,
    issues: [...evidence.issues, 'Production candidate selection used: ' + (reason || component.error || multiple.error || source)]
  })
  if (component.source !== 'model' || multiple.source !== 'model') {
    return fallback(component.source !== 'model' ? component.source : multiple.source)
  }
  const question = catalogueOverride ? { ...getQuestion(COMPONENT_QUESTION), criteria: catalogueOverride.types } : getQuestion(COMPONENT_QUESTION)
  if (question.shape !== 'choice') {
    throw new Error('Block component question must be a choice')
  }
  const criteria = typeof question.criteria === 'function' ? await question.criteria() : question.criteria
  const types = Object.keys(criteria)
  const distribution = component.distribution
  const multipleProbability = multiple.value === true ? multiple.probability : 1 - (multiple.probability ?? NaN)
  if (!distribution || types.length < 3 || Object.keys(distribution).length !== types.length ||
    types.some(type => !isProbability(distribution[type])) || !isProbability(multipleProbability)) {
    return fallback('fallback', 'Decision response lacks a complete valid probability distribution')
  }
  const sum = Object.values(distribution).reduce((total, probability) => total + probability, 0)
  if (Math.abs(sum - 1) > 0.02) {
    return fallback('fallback', 'Decision probabilities do not sum to one (tolerance 0.02): ' + sum)
  }
  const ranked = types.sort((a, b) => distribution[b] - distribution[a] || a.localeCompare(b))
  if (distribution[String(component.value)] !== distribution[ranked[0]]) {
    return fallback('fallback', 'Decision chosen option contradicts distribution')
  }
  if (distribution[ranked[0]] === distribution[ranked[1]]) {
    evidence.issues.push('Top probability tie; catalogue type lexical order breaks ties')
  }
  const allowedTypes = multipleProbability >= 0.5
    ? ranked.slice(0, 3)
    : distribution[ranked[0]] >= 2 * distribution[ranked[1]]
      ? ranked.slice(0, 1)
      : ranked.slice(0, 3)
  return {
    allowedTypes,
    answer,
    source: 'model' as const,
    topChoices: { component: String(component.value), multiple: multiple.value === true },
    issues: evidence.issues
  }
}
