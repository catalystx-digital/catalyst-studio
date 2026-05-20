import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated'

const ACRONYM_SEGMENTS = new Set(['cta', 'api', 'ai', 'seo', 'ui'])

export function toPascalCase(value: string): string {
  if (!value) return ''
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(segment => {
      const lower = segment.toLowerCase()
      if (ACRONYM_SEGMENTS.has(lower)) {
        return lower.toUpperCase()
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

const COMPONENT_ADAPTER_EXPORTS = new Map<ComponentType, string>()

COMPONENT_REGISTRY.forEach(entry => {
  if (!entry.hasAdapter) {
    return
  }
  const segments = entry.path.split('/')
  const lastSegment = segments[segments.length - 1] ?? entry.path
  const adapterExport = `${toPascalCase(lastSegment)}Adapter`
  COMPONENT_ADAPTER_EXPORTS.set(entry.name, adapterExport)
})

export function toComponentExportName(type: ComponentType): string {
  const adapter = COMPONENT_ADAPTER_EXPORTS.get(type)
  if (adapter) {
    return adapter
  }
  return toPascalCase(type)
}

export function toValidIdentifier(value: string, prefix = 'component'): string {
  if (!value) {
    return prefix
  }
  const normalized = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
  const pascal = toPascalCase(normalized)
  const safe = pascal || prefix
  return /^[A-Za-z_]/.test(safe) ? safe : `${prefix}${safe}`
}
