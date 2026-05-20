import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { canonicalizeComponentType as unifiedCanonicalize } from '@/lib/studio/components/cms/_core/canonicalization'
import type { CanonicalSynthesizer } from './types'

export interface CanonicalComponentDefinition {
  canonicalType: string
  componentType?: ComponentType
  summary: string
  fragments: string[]
  cues: string[]
  sampleContent: Record<string, any>
  synthesizer?: CanonicalSynthesizer
}

const registry = new Map<string, CanonicalComponentDefinition>()

/**
 * @deprecated Use the unified canonicalization module instead.
 * Import from '@/lib/studio/components/cms/_core/canonicalization'
 *
 * This function delegates to the unified implementation for backward compatibility.
 */
export function canonicalizeComponentType(value: string | undefined | null): string | undefined {
  const result = unifiedCanonicalize(value)
  // Convert null to undefined for backward compatibility
  return result !== null ? result : undefined
}

export function registerCanonicalComponent(definition: CanonicalComponentDefinition): void {
  const canonicalType = canonicalizeComponentType(definition.canonicalType)
  if (!canonicalType) {
    throw new Error('[CanonicalRegistry] canonicalType is required')
  }
  if (registry.has(canonicalType)) {
    return
  }

  const normalized: CanonicalComponentDefinition = {
    ...definition,
    canonicalType,
    fragments: [...definition.fragments],
    cues: [...definition.cues],
    sampleContent: { ...definition.sampleContent },
    synthesizer: definition.synthesizer
  }

  registry.set(canonicalType, Object.freeze(normalized))
}

export function getCanonicalComponentDefinition(
  canonicalType: string | undefined | null
): CanonicalComponentDefinition | undefined {
  const key = canonicalizeComponentType(canonicalType)
  if (!key) {
    return undefined
  }
  return registry.get(key)
}

export function listCanonicalComponentDefinitions(): CanonicalComponentDefinition[] {
  return Array.from(registry.values())
}

export function clearCanonicalComponentDefinitions(): void {
  registry.clear()
}
