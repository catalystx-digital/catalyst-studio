import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types'
import { canonicalizeComponentType as canonicalizeTemplateComponent } from './page-builder/component-helpers'
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated'
import {
  getCanonicalComponent,
  canonicalizeComponentType as canonicalizeDetectionType
} from '@/lib/studio/import/detection/canonical'

type Primitive = string | number | boolean | null

export interface CanonicalContractMetadata {
  canonicalType: string
  category: ComponentCategory
  sampleContent?: Record<string, unknown>
  aiMetadata?: Record<string, unknown>
  summary?: string
}

const COMPONENT_CATEGORY_MAP: Map<ComponentType, ComponentCategory> = new Map(
  COMPONENT_REGISTRY.map(entry => [entry.name, entry.category])
)

function safeClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

export function canonicalizeImportType(value: string | undefined | null): string | undefined {
  const canonical = canonicalizeTemplateComponent(value)
  if (canonical) {
    return canonical
  }
  const normalized = canonicalizeDetectionType(value)
  return normalized ?? undefined
}

export function resolveCategoryForComponentType(type: ComponentType | undefined): ComponentCategory | undefined {
  if (!type) {
    return undefined
  }
  return COMPONENT_CATEGORY_MAP.get(type)
}

export function resolveCategoryForCanonicalType(canonicalType: string): ComponentCategory {
  const fromEnum = resolveCategoryForComponentType(canonicalType as ComponentType)
  if (fromEnum) {
    return fromEnum
  }
  const normalizedEnum = resolveCategoryForComponentType(
    canonicalizeDetectionType(canonicalType) as ComponentType | undefined
  )
  if (normalizedEnum) {
    return normalizedEnum
  }
  return ComponentCategory.Content
}

export function getCanonicalContractMetadata(canonicalType: string): CanonicalContractMetadata | undefined {
  const canonical = canonicalizeImportType(canonicalType)
  if (!canonical) {
    return undefined
  }

  const contract = getComponentContractByCanonicalType(canonical)
  if (!contract) {
    return undefined
  }

  const category =
    resolveCategoryForComponentType(contract.componentType as ComponentType | undefined) ??
    resolveCategoryForCanonicalType(canonical)

  const metadata: CanonicalContractMetadata = {
    canonicalType: canonical,
    category,
    summary: contract.summary
  }

  if (contract.sampleContent && typeof contract.sampleContent === 'object') {
    metadata.sampleContent = safeClone(contract.sampleContent)
  }

  if (contract.aiMetadata && typeof contract.aiMetadata === 'object') {
    metadata.aiMetadata = safeClone(contract.aiMetadata) as unknown as Record<string, unknown>
  }

  return metadata
}

export function hasCanonicalDefinition(canonicalType: string): boolean {
  const canonical = canonicalizeImportType(canonicalType)
  if (!canonical) {
    return false
  }
  return Boolean(getCanonicalComponent(canonical))
}

export function buildSeedAiMetadata(options: {
  canonicalType: string
  source: 'template-required' | 'detected-canonical'
  createdAt: string
  detectionConfidence?: number
  detectionOccurrences?: number
  summary?: string
  contractAiMetadata?: Record<string, unknown>
}): Record<string, Primitive | Record<string, unknown> | Primitive[]> {
  const {
    canonicalType,
    source,
    createdAt,
    detectionConfidence,
    detectionOccurrences,
    summary,
    contractAiMetadata
  } = options

  const aiMetadata: Record<string, Primitive | Record<string, unknown> | Primitive[]> = {
    source,
    canonicalType,
    createdAt
  }

  if (typeof detectionConfidence === 'number') {
    aiMetadata.detectionConfidence = detectionConfidence
  }
  if (typeof detectionOccurrences === 'number') {
    aiMetadata.detectedOccurrences = detectionOccurrences
  }
  if (summary) {
    aiMetadata.summary = summary
  }
  if (contractAiMetadata && Object.keys(contractAiMetadata).length > 0) {
    aiMetadata.registry = safeClone(contractAiMetadata) as Record<string, unknown>
  }

  return aiMetadata
}

export { safeClone }
