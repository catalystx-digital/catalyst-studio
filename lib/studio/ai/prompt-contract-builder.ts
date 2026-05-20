import {
  buildUnifiedSchemaBundle,
  clearUnifiedSchemaCache,
  type UnifiedSchemaBundle
} from '@/lib/studio/schema/unified-schema-registry'
import {
  ComponentCategory,
  type AIComponentMetadata
} from '@/lib/studio/components/cms/_core/types'

type FieldSource = 'propsMeta' | 'aiMetadata'

export interface PromptContractField {
  name: string
  type: string
  required: boolean
  description?: string
  allowedTypes?: string[]
  source: FieldSource
}

export interface PromptContractComponent {
  type: string
  category: ComponentCategory
  description?: string
  summary: string
  keywords: string[]
  patterns: string[]
  confidence: number
  metadata?: AIComponentMetadata
  /** LLM extraction/generation directives from component definition */
  directives?: string[]
  fields: PromptContractField[]
  subOnly?: boolean
}

export type PromptContractWarningCode = 'MISSING_PROPS_META' | 'MISSING_AI_METADATA' | 'MISSING_DESCRIPTION'

export interface PromptContractWarning {
  code: PromptContractWarningCode
  componentType: string
  message: string
  severity: 'warning' | 'error'
  details?: Record<string, unknown>
}

export interface PromptContractUsage {
  component: string
  fields: string[]
}

export interface PromptContractBundle {
  version: number
  generatedAt: string
  hash: string
  registrySize: number
  components: PromptContractComponent[]
  subcomponents: PromptContractComponent[]
  warnings: PromptContractWarning[]
  subcomponentUsage: Record<string, PromptContractUsage[]>
}

export interface BuildPromptContractBundleOptions {
  forceRefresh?: boolean
}

/**
 * DEPRECATED: This module now delegates to the unified schema registry.
 * Use @/lib/studio/schema/unified-schema-registry for new code.
 *
 * This backward-compatible wrapper is maintained for existing consumers.
 */

export async function buildPromptContractBundle(
  options: BuildPromptContractBundleOptions = {}
): Promise<PromptContractBundle> {
  const unified = await buildUnifiedSchemaBundle(options.forceRefresh)
  return convertToPromptContractBundle(unified)
}

export function clearPromptContractBundleCache(): void {
  clearUnifiedSchemaCache()
}

function convertToPromptContractBundle(unified: UnifiedSchemaBundle): PromptContractBundle {
  const warnings: PromptContractWarning[] = unified.warnings.map(msg => {
    let code: PromptContractWarningCode = 'MISSING_PROPS_META'
    if (msg.includes('AI metadata')) code = 'MISSING_AI_METADATA'
    else if (msg.includes('description')) code = 'MISSING_DESCRIPTION'

    return {
      code,
      componentType: extractComponentType(msg),
      message: msg,
      severity: 'warning' as const
    }
  })

  const components = unified.components.map(convertToPromptComponent)
  const subcomponents = unified.subcomponents.map(convertToPromptComponent)

  return {
    version: unified.version,
    generatedAt: unified.generatedAt,
    hash: unified.integrity.hash,
    registrySize: unified.registrySize,
    components,
    subcomponents,
    warnings,
    subcomponentUsage: unified.subcomponentUsage
  }
}

function convertToPromptComponent(schema: UnifiedSchemaBundle['components'][0]): PromptContractComponent {
  return {
    type: schema.type,
    category: schema.category,
    description: schema.description,
    summary: schema.summary,
    keywords: schema.keywords,
    patterns: schema.patterns,
    confidence: schema.confidence,
    metadata: schema.metadata,
    directives: schema.directives,
    fields: schema.fields.map(f => ({
      name: f.name,
      type: f.type,
      required: f.required,
      description: f.description,
      allowedTypes: f.allowedTypes,
      source: f.source as 'propsMeta' | 'aiMetadata'
    })),
    ...(schema.subOnly ? { subOnly: true } : {})
  }
}

function extractComponentType(message: string): string {
  const match = message.match(/for ["']?([^"'\s]+)["']?/)
  return match ? match[1] : 'unknown'
}

// All implementation logic moved to unified-schema-registry.ts
// This file now only contains type definitions and delegation functions
