import path from 'node:path'
import { loadFamilies } from './families'
import { familySchemas, familyJsonSchemas } from './family-schemas'
import { runProductionBlocks, type RunFixtures } from './blocks-production'
import { loadPages } from './pages'
import type { BlockCatalogueOverride } from '@/lib/studio/import/detection/blocks/block-catalogue'

export async function familyCatalogueOverride(): Promise<{ override: BlockCatalogueOverride; familySha256: string }> {
  const families = await loadFamilies(path.join(__dirname, 'component-families.json'), 'C')
  const descriptions = Object.fromEntries(families.entries.map(entry => [entry.type, entry.description]))
  const override: BlockCatalogueOverride = {
    types: descriptions,
    contract: [
      '=== COMPONENT FAMILY CATALOGUE ===',
      ...families.entries.map(entry => entry.type + ': ' + entry.description),
      '=== FAMILY CONTENT CONTRACTS ===',
      JSON.stringify(familyJsonSchemas),
      'Copy the source words exactly; do not summarise or invent.',
      'Keep every link with its label and full address.',
      'Keep every picture with its address and alt text when present.',
      'Put repeated items in items in source order.'
    ].join('\n'),
    omitRules: [...new Set([
      ...families.entries.flatMap(entry => entry.types).filter(type => !Object.hasOwn(descriptions, type)),
      'MediaReference', 'mediaId', 'mediaType'
    ])],
    validateContent(type, content) {
      const result = familySchemas[type]?.safeParse(content)
      if (!result?.success) throw new Error(result?.error.message ?? 'Unknown component family: ' + type)
      return result.data as Record<string, unknown>
    },
    location(type, content) {
      const placement = content.placement
      if (placement === 'header' || placement === 'main' || placement === 'sidebar' || placement === 'footer') return placement
      return type === 'site-header' ? 'header' : type === 'site-footer' ? 'footer' : 'main'
    },
    templateEquivalent(type) {
      const entry = families.entries.find(entry => entry.type === type)
      if (!entry) throw new Error('Unknown component family: ' + type)
      return entry.types[0]
    }
  }
  return { override, familySha256: families.sha256 }
}

export async function runFamilyFill(page: string, directory: string, dryRun: boolean, record: any, fixtures?: RunFixtures) {
  const entry = (await loadPages())[page]
  if (!entry || entry.heldOut) throw new Error('Family fill requires a development page')
  const { override, familySha256 } = await familyCatalogueOverride()
  record.families = { set: 'C', sha256: familySha256 }
  await runProductionBlocks(page, directory, dryRun, record, fixtures, override)
}
