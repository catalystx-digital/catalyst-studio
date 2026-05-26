import { getMainRegionComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

const PAGE_CONTENT_COMPONENT_TYPES = getMainRegionComponentTypes()

export function isPageContentCandidateType(type: string): boolean {
  return PAGE_CONTENT_COMPONENT_TYPES.has(type)
}

export function filterPageContentCandidateTypes(types: Iterable<string>): string[] {
  const filtered = new Set<string>()
  for (const type of types) {
    if (isPageContentCandidateType(type)) {
      filtered.add(type)
    }
  }
  return Array.from(filtered).sort()
}
