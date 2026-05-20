import { resolveReferences } from '../../optimizely/reference-resolver'

const compiled = {
  byKey: {
    page: {
      key: 'page', name: 'Page', baseType: 'page',
      fields: [
        { name: 'image', valueType: 'contentReference' },
        { name: 'blocks', valueType: 'array<contentReference>' },
      ]
    },
    image: { key: 'image', name: 'Image', baseType: 'component', fields: [] },
    block: {
      key: 'block', name: 'Block', baseType: 'component',
      fields: [{ name: 'media', valueType: 'contentReference' }]
    },
  },
  all: []
} as any

describe('reference-resolver', () => {
  it('creates children depth-first and replaces with cms refs (conservative)', async () => {
    const created: string[] = []
    const createChild = async ({ typeKey }: any) => {
      const id = `${typeKey}-${created.length + 1}`
      created.push(id)
      return { id }
    }

    const props = {
      image: { type: 'image', props: { alt: 'x' } },
      blocks: [
        { type: 'block', properties: { media: { type: 'image', props: { alt: 'y' } } } }
      ]
    }

    const { properties, result } = await resolveReferences({
      mode: 'conservative', compiled, parentTypeKey: 'page', properties: props as any, createChild,
    })

    // Ensure for the block, its inner media image is created before the block itself
    const idxMedia = created.findIndex(id => id.startsWith('image-'))
    const idxBlock = created.findIndex(id => id.startsWith('block-'))
    expect(idxMedia).toBeGreaterThan(-1)
    expect(idxBlock).toBeGreaterThan(idxMedia)

    expect(String(properties.image)).toMatch(/^cms:\/\/content\/image-/)
    expect(Array.isArray((properties as any).blocks)).toBe(true)
    expect(String(((properties as any).blocks[0]).reference)).toMatch(/^cms:\/\/content\/block-/)
    expect(result.replacements.length).toBeGreaterThanOrEqual(2)
  })

  it('records CreationFailed on child create errors (e.g., 404) and continues', async () => {
    const props = {
      image: { type: 'image', props: { alt: 'x' } },
    }
    const createChild = async () => { throw new Error('404 Not Found') }
    const { properties, result } = await resolveReferences({
      mode: 'conservative', compiled, parentTypeKey: 'page', properties: props as any, createChild,
    })
    // Should not crash, should keep original (no replacement since creation failed)
    expect(typeof properties.image).toBe('object')
    // Error captured
    expect(result.errors.some(e => e.type === 'CreationFailed')).toBe(true)
  })

  it('emits PlanError when max depth is exceeded (cycle/too-deep)', async () => {
    const compiledCyclic = {
      byKey: {
        a: { key: 'a', fields: [{ name: 'next', valueType: 'contentReference' }] },
      },
      all: []
    } as any
    const props = { next: { type: 'a', props: { next: { type: 'a', props: { next: { type: 'a' } } } } } }
    const { result } = await resolveReferences({
      mode: 'conservative', compiled: compiledCyclic, parentTypeKey: 'a', properties: props as any,
      createChild: async () => ({ id: 'a-1' }), maxDepth: 1
    })
    expect(result.errors.some(e => e.type === 'PlanError' && String(e.details).includes('MaxDepthExceeded'))).toBe(true)
  })
})
