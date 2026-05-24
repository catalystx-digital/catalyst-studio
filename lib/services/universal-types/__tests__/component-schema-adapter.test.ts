import { getFieldsForComponentType } from '@/lib/services/universal-types/component-schema-adapter'
import { buildDetectionSchemaBundle } from '@/lib/studio/evals/detection/schema'

describe('component schema adapter', () => {
  it('expands registered value-object fields for component schemas', async () => {
    const fields = await getFieldsForComponentType('article-header')
    const author = fields.find(field => field.name === 'author')

    expect(author).toEqual(expect.objectContaining({
      name: 'author',
      type: 'object',
      rawType: 'Author',
    }))
    expect(author?.fields?.map(field => field.name)).toEqual([
      'name',
      'avatar',
      'bio',
      'title',
      'url',
    ])
  })

  it('builds detection schema bundle with nested value-object metadata', async () => {
    const bundle = await buildDetectionSchemaBundle(true)
    const author = bundle.components['article-header'].fields.find(field => field.name === 'author')

    expect(author).toEqual(expect.objectContaining({
      name: 'author',
      type: 'object',
    }))
    expect((author as { fields?: Array<{ name: string }> })?.fields?.map(field => field.name)).toContain('name')
  })
})
