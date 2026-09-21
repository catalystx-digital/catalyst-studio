import { defineQuestion } from '../registry'

const shared = {
  version: 1,
  owner: 'import',
  facets: ['structure'] as ['structure'],
  maxChars: 14_000 + '\n[truncated]'.length
}

defineQuestion({
  ...shared,
  id: 'import.block.component',
  shape: 'choice',
  instructions: 'Which catalogue page-level component type best represents this block? Choose one type using the headings, media, repetition and DOM evidence.',
  criteria: async () => {
    const { default: manifest } = await import('@/lib/studio/components/cms/_generated/component-manifest.json')
    const { filterPageContentCandidateTypes } = await import('@/lib/studio/import/detection/candidate-types')
    const types = filterPageContentCandidateTypes(manifest.components.map(component => component.type))
    return Object.fromEntries(types.map(type => [
      type,
      [...new Set(manifest.components.filter(component => component.type === type).map(component => component.description))].join(' / ')
    ]))
  },
  // Selection uses the full distribution, without a confidence gate.
  threshold: Number.MIN_VALUE,
  fallback: () => null,
  failSafe: null
})

defineQuestion({
  ...shared,
  id: 'import.block.multiple',
  shape: 'boolean',
  instructions: 'Does this block contain more than one independent page-level component? Items within one grid, carousel, navigation or repeated list are children of one component, not multiple page-level components.',
  criteria: {
    true: 'Two or more independent page-level components.',
    false: 'One page-level component, possibly containing repeated child items.'
  },
  threshold: 0.5,
  fallback: () => false,
  failSafe: false
})
