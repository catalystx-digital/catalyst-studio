import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { sanitizeOptiKey } from '@/lib/cms-export/optimizely/utils/sanitize'
import { zodSchemaToTypeString } from '@/lib/studio/components/cms/_core/component-definition'
import { z } from 'zod'

type FieldGuidance = { name: string; allowedTypes?: string[] }

const canonicalize = (value: unknown): string => {
  const sanitized = sanitizeOptiKey(value);
  if (sanitized !== undefined) return sanitized;
  return value === undefined || value === null ? '' : String(value);
};

const getArrayType = (field: z.ZodTypeAny): z.ZodArray<z.ZodTypeAny> | null => {
  if (field instanceof z.ZodArray) return field
  if (field instanceof z.ZodOptional && field._def.innerType instanceof z.ZodArray) {
    return field._def.innerType as z.ZodArray<z.ZodTypeAny>
  }
  return null
}

export async function getRegisteredComponentTypeKeys(): Promise<string[]> {
  await initializeCMSComponents()
  const seen = new Set<string>()
  for (const type of cmsComponentFactory.getRegisteredTypes()) {
    const canonical = canonicalize(type)
    if (canonical) seen.add(canonical)
  }
  return Array.from(seen)
}

export async function getContentAreaGuidanceFor(componentTypeKey: string): Promise<FieldGuidance[]> {
  await initializeCMSComponents()
  const catalog = cmsComponentFactory.getComponentCatalog()
  const target = canonicalize(componentTypeKey)
  let entry: ReturnType<typeof catalog.get> | undefined
  for (const [rawKey, candidate] of catalog.entries()) {
    if (canonicalize(rawKey) === target) {
      entry = candidate
      break
    }
  }
  if (!entry?.schema) return []

  // Use Zod introspection directly on schema.shape
  const out: FieldGuidance[] = []
  for (const [name, zodType] of Object.entries(entry.schema.shape)) {
    const field = zodType as z.ZodTypeAny
    const arrayType = getArrayType(field)

    // Check if this is an array of content/components
    if (arrayType) {
      const typeString = zodSchemaToTypeString(arrayType)

      // content[] arrays should be tracked
      if (typeString.toLowerCase().includes('content') || typeString.toLowerCase().includes('array<content>')) {
        // Try to extract allowedTypes from schema metadata if available
        const allowed = (field as any)._def?.allowedTypes as string[] | undefined
        const canonicalAllowed = Array.isArray(allowed)
          ? allowed.map(canonicalize).filter(Boolean)
          : undefined
        out.push({ name, ...(canonicalAllowed && canonicalAllowed.length > 0 ? { allowedTypes: canonicalAllowed } : {}) })
      }
    }
  }
  return out
}

export async function getAllContentAreaGuidance(): Promise<Record<string, FieldGuidance[]>> {
  await initializeCMSComponents()
  const map: Record<string, FieldGuidance[]> = {}
  const catalog = cmsComponentFactory.getComponentCatalog()
  for (const [key, entry] of catalog.entries()) {
    const canonicalKey = canonicalize(key)
    if (!canonicalKey || !entry.schema) continue

    // Use Zod introspection directly on schema.shape
    const fields: FieldGuidance[] = []
    for (const [name, zodType] of Object.entries(entry.schema.shape)) {
      const field = zodType as z.ZodTypeAny
      const arrayType = getArrayType(field)

      // Check if this is an array of content/components
      if (arrayType) {
        const typeString = zodSchemaToTypeString(arrayType)

        // content[] arrays should be tracked
        if (typeString.toLowerCase().includes('content') || typeString.toLowerCase().includes('array<content>')) {
          // Try to extract allowedTypes from schema metadata if available
          const allowed = (field as any)._def?.allowedTypes as string[] | undefined
          const canonicalAllowed = Array.isArray(allowed)
            ? allowed.map(canonicalize).filter(Boolean)
            : undefined
          fields.push({ name, ...(canonicalAllowed && canonicalAllowed.length > 0 ? { allowedTypes: canonicalAllowed } : {}) })
        }
      }
    }
    if (fields.length > 0) map[canonicalKey] = fields
  }
  return map
}

// Infer sub-component types from any allowedTypes usage across all components
export async function getSubComponentTypes(): Promise<Set<string>> {
  const guidance = await getAllContentAreaGuidance()
  const subs = new Set<string>()
  for (const [, fields] of Object.entries(guidance)) {
    for (const f of fields) {
      for (const t of (f.allowedTypes || [])) subs.add(canonicalize(t))
    }
  }
  return subs
}

export async function getTopLevelComponentTypes(): Promise<string[]> {
  const all = new Set((await getRegisteredComponentTypeKeys()).map(canonicalize))
  const subs = await getSubComponentTypes()
  return Array.from(all).filter(t => t && !subs.has(t))
}
