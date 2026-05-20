import { toOptiProperties } from '../../lib/providers/optimizely/schema/payload-mapper'

// Minimal CompiledTypeIndex stub matching the mapper contract
const compiledIndex = {
  byKey: {
    primitive_sample: {
      key: 'primitive_sample',
      name: 'Primitive Sample',
      baseType: 'component',
      fields: [
        { name: 'title', valueType: 'string' },
        { name: 'count', valueType: 'number' },
        { name: 'enabled', valueType: 'boolean' },
        { name: 'body', valueType: 'richText' },
        { name: 'tags', valueType: 'array<string>' },
      ],
    },
  },
  all: [],
} as any

describe('payload-mapper primitives', () => {
  const typeKey = 'primitive_sample'

  it('coerces string fields correctly', () => {
    const props = toOptiProperties(compiledIndex, typeKey, {
      title: 'Hello',
    })
    expect(props.title).toBe('Hello')
  })

  it('coerces number fields correctly', () => {
    const props = toOptiProperties(compiledIndex, typeKey, {
      count: '42',
    })
    expect(props.count).toBe(42)

    const bad = toOptiProperties(compiledIndex, typeKey, {
      count: 'NaN!!',
    })
    expect(bad.count).toBeNull()
  })

  it('coerces boolean fields correctly', () => {
    const t = (v: any) => toOptiProperties(compiledIndex, typeKey, { enabled: v }).enabled
    expect(t(true)).toBe(true)
    expect(t(false)).toBe(false)
    expect(t('true')).toBe(true)
    expect(t('false')).toBe(false)
  })

  it('coerces richText fields as strings', () => {
    const p1 = toOptiProperties(compiledIndex, typeKey, { body: '<p>X</p>' })
    expect(p1.body).toBe('<p>X</p>')

    const p2 = toOptiProperties(compiledIndex, typeKey, { body: { html: '<p>Y</p>' } })
    // Currently objects are JSON-stringified for string-like types
    expect(typeof p2.body).toBe('string')
    expect(p2.body).toContain('html')
  })

  it('coerces array<string> fields, stringifying non-strings', () => {
    const props = toOptiProperties(compiledIndex, typeKey, {
      tags: ['a', 'b', { x: 1 }],
    })
    expect(Array.isArray(props.tags)).toBe(true)
    expect(props.tags[0]).toBe('a')
    expect(props.tags[2]).toContain('x')
  })
})

