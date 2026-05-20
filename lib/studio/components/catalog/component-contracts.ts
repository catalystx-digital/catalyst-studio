import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { ComponentType, type AIComponentMetadata, type ComponentRegistryEntry } from '@/lib/studio/components/cms/_core/types'
import type { PropertyMeta } from '@/lib/studio/components/cms/_core/propsmeta'
import {
  canonicalizeComponentType,
  ensureCanonicalComponentsRegistered,
  listCanonicalComponents,
  type CanonicalComponentDefinition,
  type CanonicalSynthesizer
} from '@/lib/studio/import/detection/canonical'

export interface ComponentContractSources {
  canonical: string
  hasComponentRegistry: boolean
  hasSynthesizer: boolean
}

export interface ComponentContract {
  canonicalType: string
  componentType?: ComponentType
  summary: string
  description?: string
  fragments: string[]
  cues: string[]
  sampleContent?: Record<string, any>
  synthesizer?: CanonicalSynthesizer
  propsMeta?: Record<string, PropertyMeta>
  aiMetadata?: AIComponentMetadata
  defaultRegion?: string
  sources: ComponentContractSources
}

type ContractBuildResult = {
  byCanonical: Map<string, ComponentContract>
  byComponent: Map<ComponentType, ComponentContract>
}

let cachedContracts: ContractBuildResult | null = null

function cloneIfDefined<T>(value: T | undefined): T | undefined {
  if (value === undefined || value === null) {
    return value
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('[ComponentContracts] Failed to deep clone value; using shallow copy', { error })
    }
    if (Array.isArray(value)) {
      return [...value] as T
    }
    if (typeof value === 'object') {
      return { ...(value as Record<string, any>) } as T
    }
    return value
  }
}

function deriveDefaultRegion(sample: Record<string, any> | undefined): string | undefined {
  if (!sample || typeof sample !== 'object') {
    return undefined
  }
  const region = sample.region
  if (typeof region === 'string' && region.trim().length > 0) {
    return region
  }
  return undefined
}

function findComponentTypeForCanonical(canonicalType: string): ComponentType | undefined {
  const entries = Object.values(ComponentType) as string[]
  for (const value of entries) {
    const normalized = canonicalizeComponentType(value)
    if (normalized === canonicalType) {
      return value as ComponentType
    }
  }
  return undefined
}

function shouldSkipContract(registryEntry: ComponentRegistryEntry | undefined): boolean {
  return Boolean(registryEntry?.subOnly)
}

function buildContractMaps(): ContractBuildResult {
  ensureCanonicalComponentsRegistered()

  const canonicalDefinitions = listCanonicalComponents()
  const registry = cmsComponentFactory.getRegistry()
  const byCanonical = new Map<string, ComponentContract>()
  const byComponent = new Map<ComponentType, ComponentContract>()

  for (const definition of canonicalDefinitions) {
    const canonicalType = canonicalizeComponentType(definition.canonicalType)
    if (!canonicalType) {
      continue
    }
    if (byCanonical.has(canonicalType)) {
      continue
    }

    const componentType = (definition.componentType as ComponentType | undefined) ?? findComponentTypeForCanonical(canonicalType)
    const registryEntry = componentType ? registry.get(componentType) as ComponentRegistryEntry | undefined : undefined

    if (shouldSkipContract(registryEntry)) {
      continue
    }

    // Derive propsMeta from Zod schema
    let propsMeta: Record<string, PropertyMeta> | undefined
    if (registryEntry?.schema) {
      const { zodSchemaToTypeString } = require('@/lib/studio/components/cms/_core/component-definition')
      const { z } = require('zod')
      const meta: Record<string, PropertyMeta> = {}

      for (const [fieldName, zodType] of Object.entries(registryEntry.schema.shape)) {
        const field = zodType as any
        const typeString = zodSchemaToTypeString(field)
        const isRequired = !(field.isOptional() || field instanceof z.ZodOptional)
        const description = field._def?.description || undefined
        const allowedTypes = field._def?.allowedTypes as string[] | undefined

        meta[fieldName] = {
          type: typeString,
          required: isRequired,
          description,
          ...(allowedTypes ? { allowedTypes } : {})
        }
      }

      propsMeta = meta
    }

    const aiMetadata = registryEntry?.metadata
      ? (cloneIfDefined(registryEntry.metadata) as AIComponentMetadata)
      : undefined

    const sampleContent = cloneIfDefined(definition.sampleContent)
    const defaultRegion = deriveDefaultRegion(sampleContent)

    const contract: ComponentContract = {
      canonicalType,
      componentType,
      summary: definition.summary,
      description: registryEntry?.description ?? definition.summary,
      fragments: [...definition.fragments],
      cues: [...definition.cues],
      sampleContent,
      synthesizer: definition.synthesizer,
      propsMeta,
      aiMetadata,
      defaultRegion,
      sources: {
        canonical: 'registry',
        hasComponentRegistry: Boolean(registryEntry),
        hasSynthesizer: Boolean(definition.synthesizer)
      }
    }

    byCanonical.set(canonicalType, contract)
    if (componentType && !byComponent.has(componentType)) {
      byComponent.set(componentType, contract)
    }
  }

  return { byCanonical, byComponent }
}

function ensureContracts(): void {
  if (!cachedContracts) {
    cachedContracts = buildContractMaps()
  }
}

export function refreshComponentContracts(): void {
  cachedContracts = null
}

export function listComponentContracts(): ComponentContract[] {
  ensureContracts()
  return Array.from(cachedContracts!.byCanonical.values())
}

export function getComponentContractByCanonicalType(canonicalType: string): ComponentContract | undefined {
  ensureContracts()
  const normalized = canonicalizeComponentType(canonicalType) ?? canonicalType
  return cachedContracts!.byCanonical.get(normalized)
}

export function getComponentContractByComponentType(componentType: ComponentType): ComponentContract | undefined {
  ensureContracts()
  return cachedContracts!.byComponent.get(componentType)
}
