/** @jest-environment node */
import { setDecisionClient } from '@/lib/studio/decisions'
import { pickBlockTypes } from './block-pick'

const previous = { ...process.env }
afterEach(() => { process.env = { ...previous }; setDecisionClient(null) })

test('malformed boolean answer keeps the same fallback candidates with a per-call catalogue', async () => {
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  const types = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`type-${i}`, `Type ${i}`]))
  const allowedTypes = Object.keys(types)
  setDecisionClient({ askRaw: async () => ({ answers: {
    'import.block.component': { value: allowedTypes[0], probability: 1, distribution: Object.fromEntries(allowedTypes.map((type, i) => [type, i === 0 ? 1 : 0])) },
    'import.block.multiple': { value: null, probability: null }
  } }) })
  const input = { url: 'https://example.test/', issues: [], trees: [], nodes: [], block: { order: 1, region: 'main', id: 'fixture' } } as any
  const selection = { allowedTypes } as any
  const production = await pickBlockTypes(input, selection)
  const override = await pickBlockTypes(input, selection, { types })
  expect(production.allowedTypes).toEqual(allowedTypes)
  expect(override.allowedTypes).toEqual(production.allowedTypes)
  expect(override.source).toBe('error')
  expect(override.answer['import.block.multiple']).toMatchObject({ source: 'error', probability: null })
})
