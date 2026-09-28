/** @jest-environment node */
import { WebFetchTools, extractBackgroundImages, parseCssForBackgroundColors, traverseToNodes } from '../web-tools'

const originalFetch = global.fetch
afterEach(() => { global.fetch = originalFetch })

test('background colours only come from class-only compounds, simple classes, and simple ids', () => {
  const css = '/* note */ .card.util-pad.promo{background-color:#001122} .util-pad{padding:1rem} .hero{background-color:#123456} .wrap .inner{background-color:#abcdef} #main{background-color:#fefefe} .hover:hover{background-color:#112233} section.dark{background-color:#445566} .card[data-state="on"]{background-color:#778899}'
  const classes = new Map<string, string>()
  const ids = new Map<string, string>()
  const classSets: Array<{ classes: string[]; color: string }> = []

  parseCssForBackgroundColors(css, classes, ids, classSets)

  expect([...classes.entries()]).toEqual([['hero', '#123456']])
  expect([...ids.entries()]).toEqual([['main', '#fefefe']])
  expect(classSets).toEqual([{ classes: ['card', 'promo', 'util-pad'], color: '#001122' }])
})

test('a comment before a simple selector does not hide its background colour', () => {
  const classes = new Map<string, string>()
  parseCssForBackgroundColors('/* note */ .hero{background-color:#123456}', classes, new Map(), [])
  expect([...classes.entries()]).toEqual([['hero', '#123456']])
})

test('compound class colours apply only when all classes are on the element', () => {
  const css = '.card.util-pad.promo{background-color:#001122} .section.dark{background-color:#111111} .promo.util-pad.card{background-color:#ffffff} .card{background-color:#abcdef}'
  const map = extractBackgroundImages(`<style>${css}</style>`)
  const classNames = ['util-pad', 'card util-pad promo extra', 'section dark', 'section', 'card']
  const root = {
    nodeName: 'main', tagName: 'main', attrs: [],
    childNodes: classNames.map(value => ({ nodeName: 'div', tagName: 'div', attrs: [{ name: 'class', value }], childNodes: [] }))
  }
  const nodes = traverseToNodes(root, { maxTextPerNode: 160, bgImageMap: map })

  expect(nodes.slice(1).map(node => node.bgColor)).toEqual([undefined, '#001122', '#111111', undefined, '#abcdef'])
  expect(map.bgColorByClassSet).toEqual([
    { classes: ['card', 'promo', 'util-pad'], color: '#001122' },
    { classes: ['dark', 'section'], color: '#111111' }
  ])
})

test('cached styling retains stylesheet texts for blocks', async () => {
  const html = '<head><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/missing.css"><link rel="stylesheet" href="https://other.example.com/site.css"></head><body><main><p>Example</p></main></body>'
  const css = '.hero{background-color:#123456}'
  global.fetch = jest.fn(async input => {
    const url = String(input)
    return new Response(url.endsWith('.css') ? css : html, {
      status: url.endsWith('/missing.css') ? 404 : 200,
      headers: { 'content-type': url.endsWith('.css') ? 'text/css' : 'text/html' }
    })
  })
  const web = new WebFetchTools()
  const outline = await web.fetchOutline({ url: 'https://example.com/page' })
  expect(outline.error).not.toBe(true)
  expect(web.getPageStyling(outline.handle)).toMatchObject({
    stylesheets: [{ url: 'https://example.com/site.css', text: css }]
  })
  expect(web.getPageStyling(outline.handle).bgImageMap.bgColorByClass.get('hero')).toBe('#123456')
  expect(global.fetch).toHaveBeenCalledTimes(3)
  web.release(outline.handle)
  expect(web.getCacheStats().entries).toBe(0)
  expect(() => web.getPageStyling(outline.handle)).toThrow('Invalid handle')
})

test('inline-only pages have no saved external stylesheets', async () => {
  global.fetch = jest.fn(async () => new Response('<style>body{color:red}</style><main>Example</main>', { headers: { 'content-type': 'text/html' } }))
  const web = new WebFetchTools()
  const outline = await web.fetchOutline({ url: 'https://example.com/page' })
  expect(web.getPageStyling(outline.handle).stylesheets).toEqual([])
  web.release(outline.handle)
})
