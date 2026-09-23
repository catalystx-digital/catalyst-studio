/** @jest-environment node */
import * as parse5 from 'parse5'
import { traverseToNodes, extractBackgroundImages, removeScriptsStylesAndComments, WebFetchTools } from '@/lib/studio/import/services/web-tools'
import { buildBlockInput, splitBlockInput, type BlockInputArgs } from './block-input'
import type { Block } from './block-cutter'

function block(index = 0, extra: Partial<Block> = {}): Block {
  return { id: 'section-' + index, order: index + 1, region: 'main', anchor: { path: [index], tag: 'section', id: '', classes: [] }, anchorResolved: true, box: { x: 0, y: index * 300, width: 1440, height: 300 }, children: [], oversized: false, ...extra }
}
const section = '<section><div></div><p>Repeated invented note</p></section>'

test('block nodes equal production traversal of the same cleaned subtree and map', () => {
  const html = '<section><style>.panel{background-color:#123456}</style><!-- comment --><script>ignored()</script><p class="panel">Example   note</p></section>'
  const bgImageMap = extractBackgroundImages(html)
  const tree = parse5.parseFragment(removeScriptsStylesAndComments(html).replace(/\s+/g, ' ')).childNodes[0]
  const input = buildBlockInput({ html, block: block(), bgImageMap })
  expect(input.nodes).toEqual(traverseToNodes(tree, { maxTextPerNode: 1500, bgImageMap }))
  expect(input.nodes.map(node => node.tag)).toEqual(['section', 'p'])
  expect(input.nodes[1].bgColor).toBe('#123456')
})

test('cached external stylesheet map filters hidden nodes and preserves background images', async () => {
  const html = '<html><head><link rel="stylesheet" href="/styles/theme.css"></head><body><main><section class="hero"><p class="hidden-panel">Hidden example</p><p id="hidden-note">Hidden by ID</p><a href="/visit">Visit</a></section></main></body></html>'
  const css = '.hidden-panel{display:none}#hidden-note{visibility:hidden}.hero{background-image:url(../hero.png);background-color:#123456}'
  const previousFetch = globalThis.fetch
  globalThis.fetch = jest.fn(async url => new Response(String(url).endsWith('.css') ? css : html, { headers: { 'content-type': String(url).endsWith('.css') ? 'text/css' : 'text/html' } }))
  try {
    const web = new WebFetchTools()
    const outline = await web.fetchOutline({ url: 'https://example.com/workshop' })
    expect(outline.error).not.toBe(true)
    const { bgImageMap } = web.getPageStyling(outline.handle)
    expect(web.getPageStyling(outline.handle).bgImageMap).toBe(bgImageMap)
    expect(bgImageMap.hiddenByClass.has('hidden-panel')).toBe(true)
    expect(bgImageMap.hiddenById.has('hidden-note')).toBe(true)
    const input = buildBlockInput({ html, bgImageMap, block: block(0, { anchor: { path: [0], tag: 'main', id: '', classes: [] } }) })
    const tree = (parse5.parseFragment(html).childNodes.find((node: any) => node.tagName === 'main') as any)
    expect(input.nodes).toEqual(traverseToNodes(tree, { maxTextPerNode: 1500, bgImageMap }))
    expect(input.nodes.map(node => node.tag)).toEqual(['main', 'section', 'a'])
    expect(input.nodes[1]).toMatchObject({ bgImage: 'https://example.com/hero.png', bgColor: '#123456' })
    expect(input.resourcesSummary.anchors).toHaveLength(1)
    web.clearCache()
    expect(() => web.getPageStyling(outline.handle)).toThrow('Invalid handle')
  } finally { globalThis.fetch = previousFetch }
})

test('slick carousel keeps each real slide once and filters hidden content', () => {
  const html = `
    <style>.slick-slide{display:none}.slick-initialized .slick-slide{display:block}.hidden-panel{display:none}</style>
    <section><div class="slick-slider slick-initialized"><div class="slick-list"><div class="slick-track">
      <div class="slick-slide slick-cloned" aria-hidden="true"><img src="/first.png"><h4>First</h4></div>
      <div class="slick-slide slick-active" aria-hidden="false" tabindex="-1"><img src="/first.png"><h4>First</h4></div>
      <div class="slick-slide" aria-hidden="true" tabindex="-1"><img src="/second.png"><h4>Second</h4></div>
      <div class="slick-slide slick-cloned" aria-hidden="true"><img src="/second.png"><h4>Second</h4></div>
      <div class="slick-slide" hidden><img src="/hidden-attribute.png"><h4>Hidden attribute</h4></div>
      <div class="slick-slide" style="display:none"><img src="/hidden-style.png"><h4>Hidden style</h4></div>
      <div class="slick-slide hidden-panel"><img src="/hidden-class.png"><h4>Hidden class</h4></div>
    </div></div></div><div class="slick-slide"><img src="/uninitialized.png"></div></section>`
  const input = buildBlockInput({ html, block: block(), bgImageMap: extractBackgroundImages(html) })
  const realSlides = input.nodes.filter(node => node.class?.split(/\s+/).includes('slick-slide') && !node.class?.split(/\s+/).includes('slick-cloned'))
  expect(realSlides).toHaveLength(3)
  expect(realSlides.map(node => node.aria?.['aria-hidden'])).toEqual(['false', 'true', undefined])
  expect(input.nodes.filter(node => node.tag === 'img').map(node => node.attrs?.src)).toEqual(['/first.png', '/second.png', '/uninitialized.png'])
  expect(input.nodes.filter(node => node.tag === 'h4').map(node => node.text)).toEqual(['First', 'Second'])
  expect(input.nodes.some(node => node.attrs?.src === '/hidden-attribute.png' || node.attrs?.src === '/hidden-style.png' || node.attrs?.src === '/hidden-class.png')).toBe(false)
})

test('carousel items and tab panels survive class hiding while other hidden content stays excluded', () => {
  const html = `<style>
    .carousel-item{display:none}.carousel-item.active{display:block}
    .tab-pane{display:none}.tab-pane.active{display:block}
    .modal{display:none}.modal.show{display:block}
    .cookie-banner{display:none}.cookie-banner.show{display:block}
    .mobile-nav{display:none}.is-open .mobile-nav{display:block}
    .is-hidden{display:none}
  </style><section>
    <div class="carousel-item active"><img src="/active.png"></div>
    <div class="carousel-item"><img src="/inactive.png"></div>
    <div class="tab-pane active"><img src="/active-tab.png"></div>
    <div class="tab-pane"><img src="/inactive-tab.png"></div>
    <div class="modal show"><img src="/modal.png"></div>
    <div class="cookie-banner show"><img src="/cookie.png"></div>
    <div class="is-open"><div class="mobile-nav"><img src="/mobile-nav.png"></div></div>
    <div class="is-hidden"><img src="/hidden-class.png"></div>
    <div class="carousel-item" style="display:none"><img src="/hidden-style.png"></div>
    <div class="carousel-item" hidden><img src="/hidden-attribute.png"></div>
  </section>`
  const input = buildBlockInput({ html, block: block(), bgImageMap: extractBackgroundImages(html) })
  expect(input.nodes.filter(node => node.tag === 'img').map(node => node.attrs?.src)).toEqual(['/active.png', '/inactive.png', '/active-tab.png', '/inactive-tab.png'])
})

test.each(['slick-slide', 'swiper-slide', 'carousel-item', 'splide__slide', 'glide__slide', 'flickity-cell', 'owl-item', 'tab-pane'])('%s stays in block input when CSS hides its base class', className => {
  const html = `<style>.${className}{display:none}</style><section><div class="${className}"><img src="/real.png"></div><div class="${className} is-hidden"><img src="/hidden.png"></div></section>`
  const bgImageMap = extractBackgroundImages(html + '<style>.is-hidden{display:none}</style>')
  expect(buildBlockInput({ html, block: block(), bgImageMap }).nodes.filter(node => node.tag === 'img').map(node => node.attrs?.src)).toEqual(['/real.png'])
})

test.each([
  'slick-slide slick-cloned',
  'swiper-slide swiper-slide-duplicate',
  'splide__slide splide__slide--clone',
  'owl-item cloned'
])('%s clone is omitted while its real slide remains', className => {
  const baseClass = className.split(' ')[0]
  const html = `<section><div class="${className}"><img src="/clone.png"></div><div class="${baseClass}"><img src="/real.png"></div></section>`
  expect(buildBlockInput({ html, block: block(), bgImageMap: extractBackgroundImages('') }).nodes.filter(node => node.tag === 'img').map(node => node.attrs?.src)).toEqual(['/real.png'])
})

test('a non-Owl cloned class is retained', () => {
  const html = '<section><div class="cloned"><img src="/real.png"></div></section>'
  expect(buildBlockInput({ html, block: block(), bgImageMap: extractBackgroundImages('') }).nodes.filter(node => node.tag === 'img').map(node => node.attrs?.src)).toEqual(['/real.png'])
})

test('only a header block preserves its class-hidden navigation root', () => {
  const html = '<nav class="desktop-header"><a href="/">Example</a><nav class="hidden-panel"><a href="/hidden">Hidden</a></nav></nav>'
  const bgImageMap = extractBackgroundImages('<style>.desktop-header{display:none}.hidden-panel{display:none}</style>')
  const header = block(0, { region: 'header', anchor: { path: [0], tag: 'nav', id: '', classes: ['desktop-header'] } })
  const tree = parse5.parseFragment(html).childNodes[0]
  const input = buildBlockInput({ html, bgImageMap, block: header })
  expect(input.nodes).toEqual(traverseToNodes(tree, { maxTextPerNode: 1500, bgImageMap, preserveClassHiddenRoot: true }))
  expect(input.nodes.map(node => node.tag)).toEqual(['nav', 'a'])
  for (const region of ['main', 'footer'] as const) {
    expect(buildBlockInput({ html, bgImageMap, block: { ...header, region } }).nodes).toEqual([])
  }
})

test.each([
  { anchorResolved: false },
  { anchor: null },
  { anchor: { path: [99, 0], tag: 'section', id: '', classes: [] } },
  { anchor: { path: [-1], tag: 'section', id: '', classes: [] } },
  { anchor: { path: [0], tag: 'article', id: '', classes: [] } }
])('unresolved or invalid anchor throws: %j', change => {
  expect(() => buildBlockInput({ html: section, block: block(0, change), bgImageMap: extractBackgroundImages('') })).toThrow(/anchor/i)
})
test('table fragments retain their original parsing context', () => {
  const html = '<table><tbody><tr><td>Example cell</td></tr></tbody></table>'
  const input = buildBlockInput({ html, bgImageMap: extractBackgroundImages(''), block: block(0, { anchor: { path: [0, 0, 0], tag: 'tr', id: '', classes: [] } }) })
  expect(input.nodes.map(n => n.tag)).toEqual(['tr', 'td'])
})
function splitFixture(): BlockInputArgs {
  const children = [block(0, { anchor: { path: [0, 0], tag: 'section', id: '', classes: [] } }), block(1, { anchor: { path: [0, 1], tag: 'section', id: '', classes: [] } })]
  return { html: '<main>' + section + section + '</main>', bgImageMap: extractBackgroundImages(''), block: block(0, { id: 'parent', anchor: { path: [0], tag: 'main', id: '', classes: [] }, children: children.reverse() }) }
}
test('oversized input splits only at child boundaries in order', () => {
  const args = splitFixture()
  const result = splitBlockInput(args, input => input.nodes.length <= 3)
  expect(result.parts.map(p => p.block.id)).toEqual(['section-0', 'section-1'])
  expect(result.parts.every(p => p.nodes.length === 3)).toBe(true)
  expect(result.splits).toHaveLength(1)
  expect(splitBlockInput(args, () => true).parts).toHaveLength(1)
  expect(() => splitBlockInput({ ...args, block: { ...args.block, children: [] } }, () => false)).toThrow('no safe saved child boundaries')
})
test('split refuses lost parent text, overlapping children, and outside anchors', () => {
  const args = splitFixture()
  expect(() => splitBlockInput({ ...args, html: args.html.replace('<main>', '<main>Text must survive.') }, () => false)).toThrow('lose parent text/media')
  expect(() => splitBlockInput({ ...args, block: { ...args.block, children: [args.block.children[0], args.block.children[0]] } }, () => false)).toThrow('overlap')
  expect(() => splitBlockInput({ ...args, block: { ...args.block, children: [block(2), block(3)] } }, () => false)).toThrow('outside parent')
})

test.each([false, true])('block input applies body-fallback filters only without main: %s', async hasMain => {
  const section = '<section><h1>Example heading</h1><nav><a href="/nav">Navigation</a></nav><div class="main-navigation"><a href="/menu">Menu</a></div><div role="navigation">Other menu</div><header>Header</header><footer>Footer</footer><p>Example content</p></section>'
  const html = '<html><body>' + (hasMain ? '<main>' + section + '</main>' : section) + '</body></html>'
  const previousFetch = globalThis.fetch
  globalThis.fetch = jest.fn().mockResolvedValue(new Response(html, { headers: { 'content-type': 'text/html' } }))
  try {
    const web = new WebFetchTools()
    const outline = await web.fetchOutline({ url: 'https://example.com/page' })
    const { bgImageMap } = web.getPageStyling(outline.handle)
    const input = buildBlockInput({ html, bgImageMap, block: block(0, { anchor: { path: hasMain ? [0, 0] : [0], tag: 'section', id: '', classes: [] } }) })
    // The production-traversal cross-check went with the section path; this verifies block input's body-fallback filtering and retained content.
    expect(input.nodes.some(node => node.tag === 'header')).toBe(hasMain)
    expect(input.nodes.some(node => node.tag === 'footer')).toBe(hasMain)
    expect(input.nodes.some(node => node.text === 'Example content')).toBe(true)
    expect(input.nodes.some(node => node.tag === 'nav')).toBe(hasMain)
  } finally { globalThis.fetch = previousFetch }
})

test('a body anchor retains its root without adding a synthetic head', () => {
  const html = '<html><body>Example note<p>Example paragraph</p></body></html>'
  const body = (parse5.parse(html).childNodes.find((node: any) => node.tagName === 'html') as any).childNodes.find((node: any) => node.tagName === 'body')
  const bgImageMap = extractBackgroundImages(html)
  const input = buildBlockInput({ html, bgImageMap, block: block(0, { anchor: { path: [], tag: 'body', id: '', classes: [] } }) })
  expect(input.nodes).toEqual(traverseToNodes(body, { maxTextPerNode: 1500, bgImageMap }))
})
