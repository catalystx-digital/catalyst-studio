/** @jest-environment node */
import { setDecisionClient } from '@/lib/studio/decisions'
import * as parse5 from 'parse5'
import { pickBlockTypes, renderPickEvidence, selectBlockCandidates } from './block-pick'

const previous = { ...process.env }
afterEach(() => { process.env = { ...previous }; setDecisionClient(null) })

test('malformed boolean answer keeps the same fallback candidates with a per-call catalogue', async () => {
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'test-key'
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

test('decision evidence matches the original image count and text', () => {
  const trees = (parse5.parseFragment('<section><video src="/clip.mp4"></video><img src="/photo.jpg" alt="Photo"><h2>Title</h2><p>Body</p></section>') as any).childNodes
  const input = { issues: [], trees, block: { order: 2, region: 'main', id: 'fixture' } } as any
  expect(renderPickEvidence(input).state).toBe([
    'Block 2; region main',
    'Counts: 2 images, 0 inline backgrounds, 0 links, 0 buttons, 1 headings.',
    'Repeated child groups: []',
    'Headings in order:\nh2: Title',
    'DOM outline:\nsection\n  video IMAGE\n  img IMAGE alt="Photo"\n  h2 "Title"\n  p "Body"'
  ].join('\n'))
})

test('image and text in two measured columns adds two-column beyond the decision top three', async () => {
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'test-key'
  const types = {
    'cta-simple': 'Compact call to action',
    'hero-banner': 'Hero banner',
    'text-block': 'Text section',
    'two-column': 'Image and text layout'
  }
  setDecisionClient({ askRaw: async () => ({ answers: {
    'import.block.component': {
      value: 'cta-simple', probability: 0.4,
      distribution: { 'cta-simple': 0.4, 'hero-banner': 0.3, 'text-block': 0.2, 'two-column': 0.1 }
    },
    'import.block.multiple': { value: true, probability: 0.9 }
  } }) })
  const input = (html: string, columns?: number) => ({
    url: 'https://example.test/', issues: [],
    trees: (parse5.parseFragment(html) as any).childNodes,
    nodes: [], block: { order: 2, region: 'main', id: 'fixture', ...(columns === undefined ? {} : { columns }) }
  }) as any
  const selection = { allowedTypes: Object.keys(types) } as any
  const cases = [
    { name: 'stacked image and text', html: '<section><img src="/club.jpg"><p>Join the club.</p></section>', columns: undefined, offered: false },
    { name: 'three-card image grid', html: '<section><article><img src="/a.jpg"><h3>One</h3></article><article><img src="/b.jpg"><h3>Two</h3></article><article><img src="/c.jpg"><h3>Three</h3></article></section>', columns: 3, offered: false },
    { name: 'two-column image and heading', html: '<section><img src="/club.jpg"><h2>Join the club</h2></section>', columns: 2, offered: true },
    { name: 'two-column image and body', html: '<section><img src="/club.jpg"><p>Join the club.</p></section>', columns: 2, offered: true },
    { name: 'two-column text only', html: '<section><h2>Join the club</h2></section>', columns: 2, offered: false },
    { name: 'two-column image only', html: '<section><img src="/club.jpg"></section>', columns: 2, offered: false }
  ]
  for (const fixture of cases) {
    const blockInput = input(fixture.html, fixture.columns)
    if (fixture.offered) expect(selectBlockCandidates(blockInput, blockInput.url).allowedTypes).toContain('two-column')
    const result = await pickBlockTypes(blockInput, selection, { types })
    expect(result.source).toBe('model')
    expect(result.allowedTypes.includes('two-column')).toBe(fixture.offered)
  }
  setDecisionClient({ askRaw: async () => ({ answers: {
    'import.block.component': {
      value: 'two-column', probability: 0.7,
      distribution: { 'cta-simple': 0.1, 'hero-banner': 0.1, 'text-block': 0.1, 'two-column': 0.7 }
    },
    'import.block.multiple': { value: false, probability: 0.9 }
  } }) })
  const stacked = await pickBlockTypes(input(cases[0].html), selection, { types })
  expect(stacked.allowedTypes).toContain('two-column')
})

test('non-pair text columns retain two-column when the decision ranks it in the top three', async () => {
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'test-key'
  const types = {
    'cta-simple': 'Compact call to action',
    'hero-banner': 'Hero banner',
    'text-block': 'Text section',
    'two-column': 'Two column layout'
  }
  setDecisionClient({ askRaw: async () => ({ answers: {
    'import.block.component': {
      value: 'text-block', probability: 0.4,
      distribution: { 'cta-simple': 0.1, 'hero-banner': 0.2, 'text-block': 0.4, 'two-column': 0.3 }
    },
    'import.block.multiple': { value: true, probability: 0.9 }
  } }) })
  const input = {
    url: 'https://example.test/', issues: [], nodes: [],
    trees: (parse5.parseFragment('<section><div>First column</div><div>Second column</div></section>') as any).childNodes,
    block: { order: 2, region: 'main', id: 'text-columns', columns: 2 }
  } as any
  const result = await pickBlockTypes(input, { allowedTypes: Object.keys(types) } as any, { types })
  expect(result.source).toBe('model')
  expect(result.allowedTypes).toEqual(['text-block', 'two-column', 'hero-banner'])
})
