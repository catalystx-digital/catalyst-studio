/** @jest-environment node */
import { detectionParserInternals } from '@/lib/studio/import/detection/response-parser'
import { SmartLinkSchema } from '@/lib/studio/components/cms/_core/value-objects/schemas/smart-link.schema'
import { checkVisibleContent } from './scoring'
import { familyCatalogueOverride } from './family-fill'

const production = (type: string, content: Record<string, unknown>) =>
  detectionParserInternals.parseComponentsArray(
    [{ component: type, confidence: 0.95, content }],
    [{ type, confidence: 1 }], 0.6, 'https://example.com/'
  )[0].content

test.each([
  ['page-ID-only link', { type: 'internal', pageId: 'one' }],
  ['destinationless internal link', { type: 'internal' }],
  ['malformed external URL', { type: 'external', url: 'http://' }]
])('%s is rejected by production link validation and the family path', async (_name, link) => {
  const { override } = await familyCatalogueOverride()
  expect(SmartLinkSchema.safeParse(link).success).toBe(false)
  expect(() => production('navbar', { menuItems: [{ label: 'One', href: link }] })).toThrow()
  expect(() => override.validateContent('site-header', { links: [link] })).toThrow()
  expect(() => override.validateContent('collection', { items: [{ links: [link] }] })).toThrow()
  expect(() => override.validateContent('site-header', { links: [{ type: 'external', url: 'https://example.com/', children: [link] }] })).toThrow()
})

test('internal path wins over irrelevant URL in both arms and C4 counts one destination', async () => {
  const { override } = await familyCatalogueOverride()
  const link = { type: 'internal', path: '/one', pageId: 'one', url: '/two', label: 'One' }
  const productionContent = production('navbar', { menuItems: [{ label: 'One', href: link }] })
  expect((productionContent.menuItems as any[])[0].href).toEqual(SmartLinkSchema.parse(link))
  const content = override.validateContent('site-header', { links: [link] })
  expect(content.links).toEqual([{ type: 'internal', path: '/one', pageId: 'one', label: 'One' }])
  const source = { text: [], headings: [], links: [{ url: 'https://example.com/one', label: 'One' }], images: [], wordCount: 0, sourceText: 'One', baseUrl: 'https://example.com/' }
  const { checks } = checkVisibleContent(source, [{ type: 'site-header', content }], source.baseUrl, 'header')
  expect(checks.C4.produced).toEqual(['https://example.com/one'])
})

test('navbar presentation keys are not silently removed by the family path', async () => {
  const { override } = await familyCatalogueOverride()
  const link = { type: 'external', url: 'https://example.com/one', target: '_blank', rel: 'noopener', className: 'button' }
  expect(() => production('navbar', { menuItems: [{ label: 'One', href: { type: 'external', url: link.url }, target: link.target, rel: link.rel, className: link.className }] })).toThrow()
  expect(() => override.validateContent('site-header', { links: [link] })).toThrow()
})

test.each([
  ['whole-string footer entry', 'site-footer', { links: ['https://example.com/one'] }, 'footer', { columns: [{ title: 'Links', links: ['https://example.com/one'] }] }],
  ['card-grid top-level layout', 'collection', { items: [], layout: 'grid' }, 'card-grid', { cards: [], layout: 'grid' }],
  ['hero empty background image', 'hero', { heading: 'Invented', media: { url: '' } }, 'hero-banner', { heading: 'Invented', backgroundImage: { url: '' } }]
])('%s survives neither production nor family validation', async (_name, familyType, familyContent, productionType, productionContent) => {
  const { override } = await familyCatalogueOverride()
  expect(() => production(productionType, productionContent)).toThrow()
  expect(() => override.validateContent(familyType, familyContent)).toThrow()
})

test('production parser output with a derived internal page ID is accepted at every family link depth', async () => {
  const { override } = await familyCatalogueOverride()
  const content = {
    links: [{ type: 'internal', path: '/one', pageId: 'one', children: [{ type: 'external', url: 'https://example.com/two' }] }],
    items: [{ links: [{ type: 'internal', path: '/three', pageId: 'three' }] }]
  }
  expect(override.validateContent('collection', content)).toEqual(content)
})

test('section, item and child links each retain only their production destination', async () => {
  const { override } = await familyCatalogueOverride()
  const internal = (path: string, url: string) => ({ type: 'internal', pageId: path.slice(1), path, url })
  const content = override.validateContent('collection', {
    links: [internal('/one', '/extra-one')],
    items: [{ links: [{ ...internal('/two', '/extra-two'), children: [internal('/three', '/extra-three')] }, { type: 'external', url: 'https://example.com/four', openInNewTab: true }] }]
  })
  expect(content).toEqual({
    links: [{ type: 'internal', pageId: 'one', path: '/one' }],
    items: [{ links: [
      { type: 'internal', pageId: 'two', path: '/two', children: [{ type: 'internal', pageId: 'three', path: '/three' }] },
      { type: 'external', url: 'https://example.com/four', openInNewTab: true }
    ] }]
  })
  const urls = ['/one', '/two', '/three', '/four'].map(path => `https://example.com${path}`)
  const source = { text: [], headings: [], links: urls.map(url => ({ url, label: '' })), images: [], wordCount: 0, sourceText: '', baseUrl: 'https://example.com/' }
  expect(checkVisibleContent(source, [{ type: 'collection', content }], source.baseUrl, 'main').checks.C4.produced).toEqual(urls)
})

// INTENDED DIFFERENCE: family required fields are defining fields only. A
// collection needs >=1 item; production card-grid, hero-banner and navbar may
// require additional template fields that are not part of this comparison.
test('family defining fields reject an empty collection', async () => {
  const { override } = await familyCatalogueOverride()
  expect(() => override.validateContent('collection', { items: [] })).toThrow()
  expect(override.validateContent('site-footer', { links: [] })).toEqual({ links: [] })
})

test.each([
  [
    'footer text/href alias', 'footer',
    { columns: [{ title: 'Links', links: [{ text: 'One', href: '/one' }] }] },
    'site-footer', { links: [{ text: 'One', href: '/one' }] }, '/one'
  ],
  [
    'footer presentation keys', 'footer',
    { columns: [{ title: 'Links', links: [{ label: 'One', href: '/one', target: '_blank', rel: 'noopener', className: 'button' }] }] },
    'site-footer', { links: [{ label: 'One', href: '/one', target: '_blank', rel: 'noopener', className: 'button' }] }, '/one'
  ],
  [
    'hero CTA alias', 'hero-banner',
    { heading: 'Hello', backgroundImage: '/hero.png', ctaButtons: [{ text: 'One', href: '/one' }] },
    'hero', { heading: 'Hello', links: [{ text: 'One', href: '/one' }] }, '/one'
  ],
  [
    'hero protocol-relative URL', 'hero-banner',
    { heading: 'Hello', backgroundImage: '/hero.png', ctaButtons: [{ label: 'One', href: '//example.com/one' }] },
    'hero', { heading: 'Hello', links: [{ label: 'One', href: '//example.com/one' }] }, 'https://example.com/one'
  ]
])('%s passes production and the repaired family field', async (_name, productionType, productionContent, familyType, familyContent, destination) => {
  const { override } = await familyCatalogueOverride()
  expect(() => production(productionType, productionContent)).not.toThrow()
  const repaired = override.validateContent(familyType, familyContent)
  expect((repaired.links as any[])[0].path ?? (repaired.links as any[])[0].url).toBe(destination)
})

test('empty CTA background is removed by the production CTA normalizer in both arms', async () => {
  const { override } = await familyCatalogueOverride()
  expect(() => production('cta-banner', { heading: 'Join', backgroundImage: { url: '' } })).not.toThrow()
  expect(override.validateContent('cta', { heading: 'Join', settings: { style: 'banner', backgroundMedia: { url: '' } } })).toEqual({ heading: 'Join', settings: { style: 'banner' } })
})

test('empty footer logo is removed by the production footer normalizer in both arms', async () => {
  const { override } = await familyCatalogueOverride()
  expect(() => production('footer', { copyright: 'Legal', logo: { url: '' } })).not.toThrow()
  expect(override.validateContent('site-footer', { heading: 'Legal', media: { url: '' } })).toEqual({ heading: 'Legal' })
})

test.each(['site-header', 'site-footer'])('%s accepts a labelled nested navigation parent without a destination', async familyType => {
  const { override } = await familyCatalogueOverride()
  const parent = { label: 'Products', children: [{ label: 'One', type: 'internal', path: '/one', pageId: 'one' }] }
  const productionContent = familyType === 'site-header'
    ? { menuItems: [{ label: 'Products', children: [{ label: 'One', href: { type: 'internal', path: '/one', pageId: 'one' } }] }] }
    : { columns: [{ title: 'Links', links: [{ label: 'Products', children: [{ label: 'One', href: { type: 'internal', path: '/one', pageId: 'one' } }] }] }] }
  expect(() => production(familyType === 'site-header' ? 'navbar' : 'footer', productionContent)).not.toThrow()
  expect(override.validateContent(familyType, { links: [parent] }).links).toEqual([parent])
  expect(override.validateContent(familyType, { links: [{ ...parent, type: 'internal' }] }).links).toEqual([parent])
})

test.each(['<h2>Heading</h2>', '<p class="copy">Words</p>'])('production and content family accept rich text %s', async body => {
  const { override } = await familyCatalogueOverride()
  expect(() => production('text-block', { body })).not.toThrow()
  expect(override.validateContent('content', { intro: body }).intro).toBe(body)
})

test('production and content family accept three text columns', async () => {
  const { override } = await familyCatalogueOverride()
  expect(() => production('text-block', { body: 'Words', columns: 3 })).not.toThrow()
  expect(override.validateContent('content', { intro: 'Words', settings: { textColumns: 3 } }).settings).toEqual({ textColumns: 3 })
})

test.each([
  ['invalid hero height', 'hero-banner', { heading: 'Hello', backgroundImage: '/hero.png', height: 'invented' }, 'hero', { heading: 'Hello', settings: { height: 'invented' } }],
  ['invalid hero alignment', 'hero-banner', { heading: 'Hello', backgroundImage: '/hero.png', alignment: 'invented' }, 'hero', { heading: 'Hello', settings: { alignment: 'invented' } }],
  ['collection columns zero', 'card-grid', { cards: [{}], columns: 0 }, 'collection', { items: [{}], settings: { columns: 0 } }],
  ['collection columns seven', 'card-grid', { cards: [{}], columns: 7 }, 'collection', { items: [{}], settings: { columns: 7 } }],
  ['invented setting key', 'hero-banner', { heading: 'Hello', backgroundImage: '/hero.png', invented: true }, 'hero', { heading: 'Hello', settings: { invented: true } }]
])('%s is rejected by production and family settings', async (_name, productionType, productionContent, familyType, familyContent) => {
  const { override } = await familyCatalogueOverride()
  expect(() => production(productionType, productionContent)).toThrow()
  expect(() => override.validateContent(familyType, familyContent)).toThrow()
})

test.each(['hero', 'collection', 'form', 'table'])('%s rejects the unsupported blanket variant setting', async familyType => {
  const { override } = await familyCatalogueOverride()
  const defining = familyType === 'collection' ? { items: [{}] } : familyType === 'form' ? { fields: [] } : familyType === 'table' ? { rows: [] } : {}
  expect(() => override.validateContent(familyType, { ...defining, settings: { variant: 'invented' } })).toThrow()
})
