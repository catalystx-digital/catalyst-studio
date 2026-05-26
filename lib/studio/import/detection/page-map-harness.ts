import crypto from 'crypto'

import type { ComponentPattern, DetectedComponent, PageMetadata } from './types'
import type { DetectionSectionTask } from './section-plan'
import type { SectionExtractionArtifact } from './section-aggregation'
import type { GetSectionResult } from '../services/web-tools'
import { parseSectionDetectionResponse } from './response-parser'

export const PAGE_MAP_VERSION = 'page-map-v1'
export const PLAN_SCHEMA_VERSION = 'component-plan-v1'
export const FILL_SCHEMA_VERSION = 'component-fill-v1'

export type EmptySectionReason = 'duplicate' | 'decorative' | 'unsupported' | 'no_visible_content'

export interface SourcePacket {
  id: string
  pathId?: string
  tag?: string
  role?: string
  text?: string
  attrs?: Record<string, unknown>
  children?: SourcePacket[]
}

export interface PageMapSection {
  sectionKey: string
  sectionOrder: number
  role: DetectionSectionTask['role']
  required: boolean
  candidateTypes: string[]
  stats: { nodeCount: number; approxBytes: number; truncated?: boolean }
  sourceHash: string
  packets: SourcePacket[]
}

export interface PageMap {
  version: string
  url: string
  finalUrl?: string
  generatedAt: string
  sections: PageMapSection[]
  originalBytes: number
  packetBytes: number
  sourceHash: string
}

export interface PlannedComponent {
  plannedComponentId: string
  component: string
  confidence: number
  evidenceRefs: string[]
}

export interface PlannedSection {
  sectionKey: string
  plannedComponents: PlannedComponent[]
  emptyReason?: EmptySectionReason
}

export interface ComponentPlan {
  schemaVersion: string
  sections: PlannedSection[]
  pageMetadata?: PageMetadata
}

export interface FillBatch {
  groupKey: string
  sectionKeys: string[]
  plannedComponents: PlannedComponent[]
  sourcePackets: SourcePacket[]
  candidateTypes: string[]
  promptTokensEstimate: number
}

export interface FillBatchResult {
  groupKey: string
  artifacts: SectionExtractionArtifact[]
  pageMetadata?: PageMetadata
}

const EMPTY_REASONS = new Set<EmptySectionReason>(['duplicate', 'decorative', 'unsupported', 'no_visible_content'])
const PRESERVED_ATTRS = new Set([
  'href',
  'src',
  'srcset',
  'alt',
  'title',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'role',
  'type',
  'name',
  'value',
  'placeholder',
  'datetime',
  'data-src',
  'data-href'
])

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function byteLength(value: unknown): number {
  return JSON.stringify(value).length
}

function toPacket(value: unknown, packetIdPrefix: string, indexPath: string): SourcePacket | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const node = value as Record<string, unknown>
  const packet: SourcePacket = {
    id: `${packetIdPrefix}#${indexPath}`
  }

  for (const key of ['pathId', 'tag', 'role'] as const) {
    if (typeof node[key] === 'string' && node[key]) {
      packet[key] = node[key]
    }
  }

  const textParts = ['text', 'label', 'name', 'value', 'alt', 'title']
    .map(key => typeof node[key] === 'string' ? compactWhitespace(node[key] as string) : '')
    .filter(Boolean)
  if (textParts.length > 0) {
    packet.text = Array.from(new Set(textParts)).join(' ')
  }

  const attrs = node.attrs
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    const kept: Record<string, unknown> = {}
    for (const [key, rawValue] of Object.entries(attrs as Record<string, unknown>)) {
      if (!PRESERVED_ATTRS.has(key) && !key.startsWith('aria-')) continue
      kept[key] = typeof rawValue === 'string' ? compactWhitespace(rawValue) : rawValue
    }
    if (Object.keys(kept).length > 0) {
      packet.attrs = kept
    }
  }

  const children = node.children
  if (Array.isArray(children)) {
    const childPackets = children
      .map((child, index) => toPacket(child, packetIdPrefix, `${indexPath}.${index}`))
      .filter((packet): packet is SourcePacket => Boolean(packet))
    if (childPackets.length > 0) {
      packet.children = childPackets
    }
  }

  if (!packet.pathId && !packet.tag && !packet.role && !packet.text && !packet.attrs && !packet.children) {
    return null
  }
  return packet
}

export async function buildPageMap(input: {
  url: string
  finalUrl?: string
  tasks: DetectionSectionTask[]
  getSection: (task: DetectionSectionTask) => Promise<GetSectionResult>
}): Promise<PageMap> {
  const sections: PageMapSection[] = []
  let originalBytes = 0
  let packetBytes = 0

  for (const task of input.tasks) {
    const section = await input.getSection(task)
    const packetIdPrefix = `s${task.sectionOrder}`
    const packets = section.slice
      .map((node, index) => toPacket(node, packetIdPrefix, String(index)))
      .filter((packet): packet is SourcePacket => Boolean(packet))
    const sectionOriginalBytes = byteLength(section.slice)
    const sectionPacketBytes = byteLength(packets)
    originalBytes += sectionOriginalBytes
    packetBytes += sectionPacketBytes
    sections.push({
      sectionKey: task.sectionKey,
      sectionOrder: task.sectionOrder,
      role: task.role,
      required: task.required,
      candidateTypes: [...task.candidateTypes],
      stats: section.stats,
      sourceHash: stableHash(section.slice),
      packets
    })
  }

  return {
    version: PAGE_MAP_VERSION,
    url: input.url,
    finalUrl: input.finalUrl,
    generatedAt: new Date().toISOString(),
    sections,
    originalBytes,
    packetBytes,
    sourceHash: stableHash(sections.map(section => ({ sectionKey: section.sectionKey, sourceHash: section.sourceHash })))
  }
}

function collectEvidenceRefs(section: PageMapSection): Set<string> {
  const refs = new Set<string>()
  const visit = (packet: SourcePacket): void => {
    refs.add(packet.id)
    if (packet.pathId) refs.add(packet.pathId)
    packet.children?.forEach(visit)
  }
  section.packets.forEach(visit)
  return refs
}

export function parseComponentPlanResponse(input: {
  rawResponse: string
  pageMap: PageMap
  plannedSectionKeys: string[]
  availableComponents: ComponentPattern[]
}): ComponentPlan {
  const raw = JSON.parse(input.rawResponse)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('ComponentPlan response must be a JSON object')
  }
  const response = raw as Record<string, unknown>
  if (!Array.isArray(response.sections)) {
    throw new Error('ComponentPlan response sections must be an array')
  }

  const expectedKeys = new Set(input.plannedSectionKeys)
  const seenKeys = new Set<string>()
  const seenIds = new Set<string>()
  const availableTypes = new Set(input.availableComponents.map(component => component.type))
  const sectionsByKey = new Map(input.pageMap.sections.map(section => [section.sectionKey, section]))
  const plannedSections: PlannedSection[] = []

  for (const [index, rawSection] of (response.sections as unknown[]).entries()) {
    if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
      throw new Error(`ComponentPlan sections[${index}] must be an object`)
    }
    const section = rawSection as Record<string, unknown>
    if (typeof section.sectionKey !== 'string' || !expectedKeys.has(section.sectionKey)) {
      throw new Error(`ComponentPlan sections[${index}].sectionKey is not expected`)
    }
    if (seenKeys.has(section.sectionKey)) {
      throw new Error(`ComponentPlan sectionKey "${section.sectionKey}" is duplicated`)
    }
    seenKeys.add(section.sectionKey)
    const pageMapSection = sectionsByKey.get(section.sectionKey)
    if (!pageMapSection) {
      throw new Error(`ComponentPlan sectionKey "${section.sectionKey}" is missing from PageMap`)
    }
    const sectionAllowedTypes = new Set(pageMapSection.candidateTypes)
    const validEvidenceRefs = collectEvidenceRefs(pageMapSection)
    const rawComponents = section.plannedComponents
    if (!Array.isArray(rawComponents)) {
      throw new Error(`ComponentPlan section "${section.sectionKey}" plannedComponents must be an array`)
    }
    const plannedComponents: PlannedComponent[] = []
    for (const [componentIndex, rawComponent] of rawComponents.entries()) {
      if (!rawComponent || typeof rawComponent !== 'object' || Array.isArray(rawComponent)) {
        throw new Error(`ComponentPlan ${section.sectionKey}.plannedComponents[${componentIndex}] must be an object`)
      }
      const component = rawComponent as Record<string, unknown>
      if (typeof component.plannedComponentId !== 'string' || component.plannedComponentId.trim().length === 0) {
        throw new Error(`ComponentPlan ${section.sectionKey}.plannedComponents[${componentIndex}].plannedComponentId must be a non-empty string`)
      }
      if (seenIds.has(component.plannedComponentId)) {
        throw new Error(`ComponentPlan plannedComponentId "${component.plannedComponentId}" is duplicated`)
      }
      seenIds.add(component.plannedComponentId)
      if (typeof component.component !== 'string' || !availableTypes.has(component.component) || !sectionAllowedTypes.has(component.component)) {
        throw new Error(`ComponentPlan plannedComponentId "${component.plannedComponentId}" has unsupported component "${String(component.component)}"`)
      }
      if (typeof component.confidence !== 'number' || !Number.isFinite(component.confidence)) {
        throw new Error(`ComponentPlan plannedComponentId "${component.plannedComponentId}" confidence must be a finite number`)
      }
      if (!Array.isArray(component.evidenceRefs) || component.evidenceRefs.length === 0) {
        throw new Error(`ComponentPlan plannedComponentId "${component.plannedComponentId}" evidenceRefs must be a non-empty array`)
      }
      const evidenceRefs = component.evidenceRefs.map(ref => {
        if (typeof ref !== 'string' || !validEvidenceRefs.has(ref)) {
          throw new Error(`ComponentPlan plannedComponentId "${component.plannedComponentId}" has unsupported evidence ref "${String(ref)}"`)
        }
        return ref
      })
      plannedComponents.push({
        plannedComponentId: component.plannedComponentId,
        component: component.component,
        confidence: component.confidence,
        evidenceRefs
      })
    }

    const emptyReason = typeof section.emptyReason === 'string' ? section.emptyReason : undefined
    if (plannedComponents.length === 0) {
      if (!emptyReason || !EMPTY_REASONS.has(emptyReason as EmptySectionReason)) {
        throw new Error(`ComponentPlan section "${section.sectionKey}" without planned components must include a valid emptyReason`)
      }
    }
    if (plannedComponents.length > 0 && emptyReason) {
      throw new Error(`ComponentPlan section "${section.sectionKey}" cannot include emptyReason with planned components`)
    }

    plannedSections.push({
      sectionKey: section.sectionKey,
      plannedComponents,
      ...(emptyReason ? { emptyReason: emptyReason as EmptySectionReason } : {})
    })
  }

  for (const expectedKey of expectedKeys) {
    if (!seenKeys.has(expectedKey)) {
      throw new Error(`ComponentPlan missing section "${expectedKey}"`)
    }
  }

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    sections: plannedSections,
    pageMetadata: response.pageMetadata && typeof response.pageMetadata === 'object' && !Array.isArray(response.pageMetadata)
      ? response.pageMetadata as PageMetadata
      : undefined
  }
}

export function buildFillBatches(input: {
  pageMap: PageMap
  plan: ComponentPlan
  maxPromptTokens: number
  maxSections: number
  estimateTokens: (value: unknown) => number
}): FillBatch[] {
  const sectionsByKey = new Map(input.pageMap.sections.map(section => [section.sectionKey, section]))
  const batches: FillBatch[] = []
  let currentSections: string[] = []
  let currentPlanned: PlannedComponent[] = []
  let currentPackets: SourcePacket[] = []

  const flush = () => {
    if (currentSections.length === 0) return
    const candidateTypes = Array.from(new Set(currentPlanned.map(component => component.component))).sort()
    batches.push({
      groupKey: `fill:${batches.length}`,
      sectionKeys: currentSections,
      plannedComponents: currentPlanned,
      sourcePackets: currentPackets,
      candidateTypes,
      promptTokensEstimate: input.estimateTokens({ sections: currentSections, plannedComponents: currentPlanned, sourcePackets: currentPackets })
    })
    currentSections = []
    currentPlanned = []
    currentPackets = []
  }

  for (const plannedSection of input.plan.sections) {
    const section = sectionsByKey.get(plannedSection.sectionKey)
    if (!section || section.role === 'header' || section.role === 'footer' || plannedSection.plannedComponents.length === 0) {
      continue
    }
    const nextPackets = section.packets
    const projectedSections = [...currentSections, section.sectionKey]
    const projectedPlanned = [...currentPlanned, ...plannedSection.plannedComponents]
    const projectedPackets = [...currentPackets, ...nextPackets]
    const projectedTokens = input.estimateTokens({ sections: projectedSections, plannedComponents: projectedPlanned, sourcePackets: projectedPackets })
    if (
      currentSections.length > 0 &&
      (projectedSections.length > Math.max(1, input.maxSections) || projectedTokens > input.maxPromptTokens)
    ) {
      flush()
    }
    currentSections.push(section.sectionKey)
    currentPlanned.push(...plannedSection.plannedComponents)
    currentPackets.push(...nextPackets)
  }
  flush()
  return batches
}

export function parseFillBatchResponse(input: {
  rawResponse: string
  batch: FillBatch
  plan: ComponentPlan
  pageMap: PageMap
  availableComponents: ComponentPattern[]
  url: string
  confidenceThreshold: number
}): FillBatchResult {
  const raw = JSON.parse(input.rawResponse)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('FillBatch response must be a JSON object')
  }
  const response = raw as Record<string, unknown>
  if (!Array.isArray(response.sections)) {
    throw new Error('FillBatch response sections must be an array')
  }

  const expectedSectionKeys = new Set(input.batch.sectionKeys)
  const plannedById = new Map(input.batch.plannedComponents.map(component => [component.plannedComponentId, component]))
  const plannedSectionById = new Map<string, string>()
  for (const plannedSection of input.plan.sections) {
    for (const plannedComponent of plannedSection.plannedComponents) {
      plannedSectionById.set(plannedComponent.plannedComponentId, plannedSection.sectionKey)
    }
  }
  const seenIds = new Set<string>()
  const componentsBySection = new Map<string, Array<{ component: unknown; confidence: unknown; content: unknown }>>()
  const pageMapSectionByKey = new Map(input.pageMap.sections.map(section => [section.sectionKey, section]))

  for (const [sectionIndex, rawSection] of (response.sections as unknown[]).entries()) {
    if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
      throw new Error(`FillBatch sections[${sectionIndex}] must be an object`)
    }
    const section = rawSection as Record<string, unknown>
    if (typeof section.sectionKey !== 'string') {
      throw new Error(`FillBatch sections[${sectionIndex}].sectionKey is not expected`)
    }
    if (!expectedSectionKeys.has(section.sectionKey)) {
      throw new Error(`FillBatch section "${section.sectionKey}" is not planned for this batch`)
    }
    if (!Array.isArray(section.components)) {
      throw new Error(`FillBatch section "${section.sectionKey}" components must be an array`)
    }
    for (const [componentIndex, rawComponent] of (section.components as unknown[]).entries()) {
      if (!rawComponent || typeof rawComponent !== 'object' || Array.isArray(rawComponent)) {
        throw new Error(`FillBatch ${section.sectionKey}.components[${componentIndex}] must be an object`)
      }
      const component = rawComponent as Record<string, unknown>
      if (typeof component.plannedComponentId !== 'string' || !plannedById.has(component.plannedComponentId)) {
        throw new Error(`FillBatch ${section.sectionKey}.components[${componentIndex}].plannedComponentId is not planned`)
      }
      if (seenIds.has(component.plannedComponentId)) {
        throw new Error(`FillBatch plannedComponentId "${component.plannedComponentId}" is duplicated`)
      }
      seenIds.add(component.plannedComponentId)
      const planned = plannedById.get(component.plannedComponentId)!
      if (component.component !== planned.component) {
        throw new Error(`FillBatch plannedComponentId "${component.plannedComponentId}" changed component type`)
      }
      const plannedSectionKey = plannedSectionById.get(component.plannedComponentId)
      if (!plannedSectionKey || !expectedSectionKeys.has(plannedSectionKey)) {
        throw new Error(`FillBatch plannedComponentId "${component.plannedComponentId}" section is not planned for this batch`)
      }
      if (section.sectionKey !== plannedSectionKey) {
        throw new Error(`FillBatch section "${section.sectionKey}" does not match plannedComponentId "${component.plannedComponentId}" section "${plannedSectionKey}"`)
      }
      const rawComponents = componentsBySection.get(plannedSectionKey) ?? []
      rawComponents.push({
        component: component.component,
        confidence: component.confidence,
        content: component.content
      })
      componentsBySection.set(plannedSectionKey, rawComponents)
    }
  }

  const artifacts: SectionExtractionArtifact[] = []
  for (const sectionKey of input.batch.sectionKeys) {
    const rawComponents = componentsBySection.get(sectionKey) ?? []
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({ sectionKey, components: rawComponents }),
      sectionKey,
      availableComponents: input.availableComponents,
      url: input.url,
      confidenceThreshold: input.confidenceThreshold,
      allowMissingSectionKey: false,
      isolateInvalidComponents: true
    })
    const invalidComponents = parsed.invalidComponents ?? []
    if (invalidComponents.length > 0) {
      throw new Error(`FillBatch section "${sectionKey}" produced ${invalidComponents.length} invalid planned component${invalidComponents.length === 1 ? '' : 's'}`)
    }
    const pageMapSection = pageMapSectionByKey.get(sectionKey)
    artifacts.push({
      sectionKey,
      sectionOrder: pageMapSection?.sectionOrder ?? 0,
      components: parsed.components,
      invalidComponents: parsed.invalidComponents,
      pageMetadata: parsed.pageMetadata
    })
  }

  for (const plannedId of plannedById.keys()) {
    if (!seenIds.has(plannedId)) {
      throw new Error(`FillBatch missing plannedComponentId "${plannedId}"`)
    }
  }

  return {
    groupKey: input.batch.groupKey,
    artifacts,
    pageMetadata: response.pageMetadata && typeof response.pageMetadata === 'object' && !Array.isArray(response.pageMetadata)
      ? response.pageMetadata as PageMetadata
      : undefined
  }
}
