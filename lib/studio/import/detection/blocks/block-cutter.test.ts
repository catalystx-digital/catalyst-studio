/** @jest-environment node */
import { instrumentHtml, proposeGeometry, childCandidates, groupRows, cutRenderedPage, TALL_BLOCK, type Geometry } from './block-cutter'

const html = '<!doctype html><body>text<!-- comment --><div id="wrapper"><section class="wide band"><h1>Example heading</h1></section></div></body>'
test('anchors use element indices, ignoring whitespace and comments', () => { const result = instrumentHtml(html); expect(result.anchors['0.0']).toEqual({ path: [0, 0], tag: 'section', id: '', classes: ['wide', 'band'] }); expect(result.html).toContain(result.marker) })

function geometry(key: string, y: number, height = 200, width = 1170, children: Geometry[] = [], extra: Partial<Geometry> = {}): Geometry {
  return { key, tag: 'div', region: 'main', box: { x: 135, y, height, width }, visible: true, meaningful: true, ownTextLength: 0, children, ...extra }
}

function document(tree: Geometry) { return { tree } }

function proposeFromGeometry(saved: {
  tree: Geometry
}) {
  const blocks = cutRenderedPage(saved.tree)
  return { blocks }
}

const keys = (nodes: Geometry[]) => nodes.map(n => n.key)

const text = (key: string, y: number, height: number) => geometry(key, y, height, 1170, [], { ownTextLength: 100 })
test('empty 21px spacer never prevents cutting the tall real-page shape', () => {
  const bands = [text('hero', 164, 500), text('tiles', 664, 200), text('features', 864, 550), text('news', 1414, 282), text('support', 1696, 300)]
  const content = geometry('content', 164, 1832, 1170, bands)
  const top = geometry('top', 0, 2025, 1170, [text('header', 0, 116), text('menu', 116, 48), content, geometry('spacer', 1996, 21, 1170, [], { meaningful: false })])
  const root = geometry('body', 0, 2645, 1440, [top, text('footer', 2025, 620)])
  expect(keys(proposeGeometry(root))).toEqual(['header', 'menu', 'hero', 'tiles', 'features', 'news', 'support', 'footer'])
})
test('centred children need not be 80% of their parent width', () => {
  const a = text('a', 0, 500), b = text('b', 500, 500)
  const narrow = geometry('narrow', 0, 1000, 900, [a, b])
  expect(keys(proposeGeometry(geometry('root', 0, 1000, 1440, [narrow])))).toEqual(['a', 'b'])
})
test('single wrappers descend but a container at 700px is retained', () => {
  const band = geometry('band', 0, TALL_BLOCK, 1170, [text('a', 0, 350), text('b', 350, 350)])
  expect(keys(proposeGeometry(geometry('wrapper', 0, 900, 1440, [band])))).toEqual(['band'])
  expect(keys(childCandidates(band))).toEqual(['a', 'b'])
})
test('a row of four tiles stays one block and never splits into its columns', () => {
  const tiles = Array.from({ length: 4 }, (_, i) => geometry('tile' + i, 0, 200, 250, [], { box: { x: i * 280, y: 0, width: 250, height: 200 } }))
  const root = geometry('tiles', 0, 200, 1170, tiles)
  expect(keys(proposeGeometry(root))).toEqual(['tiles'])
  expect(childCandidates(root)).toEqual([])
  expect(groupRows(tiles)).toHaveLength(1)
  const tall = geometry('page', 0, 1000, 1170, [...tiles, text('next', 250, 600)])
  const selected = proposeGeometry(tall)
  expect(selected).toHaveLength(2)
  expect(keys(selected[0].members!)).toEqual(['tile0', 'tile1', 'tile2', 'tile3'])
})
test('2 x 2 feature grid inside a 550px container stays one block', () => {
  const cards = Array.from({ length: 4 }, (_, i) => geometry('card' + i, Math.floor(i / 2) * 275, 250, 500, [], { box: { x: (i % 2) * 600, y: Math.floor(i / 2) * 275, width: 500, height: 250 } }))
  const root = geometry('features', 0, 550, 1170, cards)
  expect(keys(proposeGeometry(root))).toEqual(['features'])
  const candidates = childCandidates(root)
  expect(candidates).toHaveLength(2)
  expect(candidates.every(row => row.members?.length === 2)).toBe(true)
})
test('rows use strict half overlap, including unequal heights and bridging children', () => {
  expect(groupRows([text('a', 0, 200), text('b', 100, 200)])).toHaveLength(2)
  expect(groupRows([text('a', 0, 200), text('b', 99, 200)])).toHaveLength(1)
  expect(groupRows([text('a', 0, 600), text('b', 100, 100)])).toHaveLength(1)
  expect(groupRows([text('a', 0, 200), text('b', 150, 200), text('bridge', 75, 200)])).toHaveLength(1)
})
test('tall main column is cut beside an intact sidebar', () => {
  const main = geometry('main-column', 0, 1200, 600, [text('a', 0, 600), text('b', 600, 600)])
  const sidebar = geometry('sidebar', 0, 1200, 300, [text('side-a', 0, 600), text('side-b', 600, 600)], { box: { x: 1050, y: 0, width: 300, height: 1200 } })
  expect(keys(proposeGeometry(geometry('root', 0, 1200, 1440, [main, sidebar])))).toEqual(['a', 'sidebar', 'b'])
  const equal = { ...main, box: { ...main.box, width: 300 } }
  expect(proposeGeometry(geometry('root', 0, 1200, 1440, [equal, sidebar]))).toHaveLength(1)
})
test('heading-only row merges forward; prose and image rows do not qualify', () => {
  const heading = geometry('heading', 0, 80, 1170, [], { tag: 'h2', ownTextLength: 20 })
  const rows = proposeGeometry(geometry('root', 0, 1100, 1170, [heading, text('article', 100, 500), text('next', 600, 500)]))
  expect(rows).toHaveLength(2)
  expect(keys(rows[0].members!)).toEqual(['heading', 'article'])
  const prose = geometry('intro', 0, 100, 1170, [heading, text('prose', 80, 20)])
  expect(groupRows([prose, text('article', 100, 500)])).toHaveLength(2)
})
test('small content attaches forward and trailing content attaches backward', () => {
  const rows = proposeGeometry(geometry('root', 0, 1100, 1170, [text('crumb', 0, 21), text('a', 21, 500), text('b', 521, 500), text('note', 1021, 21)]))
  expect(rows).toHaveLength(2)
  expect(keys(rows[0].members!)).toEqual(['crumb', 'a'])
  expect(keys(rows[1].members!)).toEqual(['b', 'note'])
})
test('attached heading does not prevent recursive cutting of a tall following container', () => {
  const heading = geometry('heading', 0, 80, 1170, [], { tag: 'h2', ownTextLength: 20 })
  const content = geometry('content', 80, 1200, 1170, [text('a', 80, 600), text('b', 680, 600)])
  const rows = proposeGeometry(geometry('root', 0, 1400, 1170, [heading, content]))
  expect(rows).toHaveLength(2)
  expect(keys(rows[0].members!)).toEqual(['heading', 'a'])
  expect(rows[1].key).toBe('b')
})
test('invisible, empty and zero-height children are ignored, small meaningful children survive', () => {
  expect(proposeGeometry({ ...text('hidden', 0, 900), visible: false })).toEqual([])
  expect(proposeGeometry(text('zero', 0, 0))).toEqual([])
  const root = geometry('root', 0, 1000, 1170, [text('a', 0, 500), text('b', 500, 500), { ...text('hidden', 0, 1000), visible: false }, geometry('empty', 0, 1000, 1170, [], { meaningful: false })])
  expect(keys(proposeGeometry(root))).toEqual(['a', 'b'])
  expect(keys(proposeGeometry(text('crumb', 0, 21)))).toEqual(['crumb'])
})
test('single text article is kept and flagged probably under-cut without mutating its input', () => {
  const saved = document({ ...text('article', 0, 3000), tag: 'article' })
  const before = JSON.stringify(saved), result = proposeFromGeometry(saved)
  expect(result.blocks).toHaveLength(1)
  expect(result.blocks[0].box.height).toBe(3000)
  expect(result.blocks[0].oversized).toBe(true)
  expect(JSON.stringify(saved)).toBe(before)
  expect(proposeFromGeometry(JSON.parse(before))).toEqual(result)
})
test.each(['img', 'ul', 'ol'])('indivisible %s remains a block', tag => {
  expect(keys(proposeGeometry(geometry('atomic', 0, 2000, 1170, [text('a', 0, 1000), text('b', 1000, 1000)], { tag })))).toEqual(['atomic'])
})
test('tagless header and footer hints are inferred and adjacent regions merge', () => {
  const logo = geometry('logo', 0, 116, 1170, [], { tag: 'img' })
  const menu = geometry('menu', 116, 48, 1170, [{ ...text('link', 116, 48), tag: 'a' }])
  const main = text('content', 164, 600)
  const footer = geometry('footer', 764, 100, 1170, [text('copyright', 764, 100)], { classes: ['site-footer'] })
  const legal = { ...text('legal', 864, 100), role: 'contentinfo' }
  const result = proposeFromGeometry(document(geometry('body', 0, 964, 1440, [logo, menu, main, footer, legal])))
  expect(result.blocks.map(b => b.region)).toEqual(['header', 'main', 'footer'])
  expect(result.blocks.map(b => b.box.height)).toEqual([164, 600, 200])
  expect(result.blocks.every(b => b.children.every(c => c.children.length === 0))).toBe(true)
})
test.each([{ role: 'banner' }, { id: 'masthead' }, { classes: ['site-header'] }, { id: 'primary-nav' }])('tagless header identity %j survives wrapper descent', hint => {
  const head = geometry('head', 0, 100, 1170, [text('child', 0, 100)], hint)
  const result = proposeFromGeometry(document(geometry('body', 0, 900, 1440, [head, text('content', 100, 800)])))
  expect(result.blocks.map(b => b.region)).toEqual(['header', 'main'])
})
test('header/footer hints in the middle and links below 300px remain main', () => {
  const result = proposeFromGeometry(document(geometry('body', 0, 1100, 1440, [text('intro', 0, 350), { ...text('links', 350, 100), tag: 'a' }, { ...text('footer', 450, 100), id: 'footer' }, text('last', 550, 550)])))
  expect(result.blocks.every(b => b.region === 'main')).toBe(true)
})
test('retains own wrapper text instead of silently dropping it', () => {
  const root = { ...geometry('root', 0, 2000, 1170, [text('a', 0, 1000), text('b', 1000, 1000)]), ownTextLength: 1 }
  expect(keys(proposeGeometry(root))).toEqual(['root'])
})
test('1500px is the warning boundary and only taller blocks are flagged', () => {
  expect(proposeFromGeometry(document(text('article', 0, 1500))).blocks[0].oversized).toBe(false)
  expect(proposeFromGeometry(document(text('article', 0, 1501))).blocks[0].oversized).toBe(true)
})
test('120px headings stand alone, while a heading with at most 40 other characters attaches', () => {
  const heading = geometry('heading', 0, 120, 1170, [], { tag: 'h2', ownTextLength: 20 })
  expect(groupRows([heading, text('article', 120, 500)])).toHaveLength(2)
  const shortHeading = { ...heading, box: { ...heading.box, height: 60 } }
  const label = { ...text('label', 60, 20), ownTextLength: 40 }
  const row = geometry('intro', 0, 80, 1170, [shortHeading, label])
  expect(groupRows([row, text('article', 80, 500)])).toHaveLength(1)
  expect(groupRows([{ ...row, children: [shortHeading, { ...label, ownTextLength: 41 }] }, text('article', 80, 500)])).toHaveLength(2)
})
test('a tall header cuts navigation from its main banner', () => {
  const nav = geometry('nav', 0, 150, 1170, [{ ...text('link', 0, 150), tag: 'a' }], { tag: 'nav' })
  const banner = geometry('banner', 150, 550, 1170, [{ ...text('title', 150, 100), tag: 'h1' }, text('description', 250, 450)])
  const header = geometry('header', 0, 700, 1170, [nav, banner], { tag: 'header' })
  const result = proposeFromGeometry(document(geometry('body', 0, 1200, 1440, [header, { ...text('content', 700, 500), tag: 'main' }])))
  expect(result.blocks.map(b => b.region)).toEqual(['header', 'main', 'main'])
  expect(result.blocks.map(b => b.box.height)).toEqual([150, 550, 500])
})
test('adjacent header rows never merge above 300px', () => {
  const row = (key: string, y: number) => geometry(key, y, 180, 1170, [{ ...text(key + 'link', y, 180), tag: 'a' }], { tag: 'header' })
  const result = proposeFromGeometry(document(geometry('body', 0, 960, 1440, [row('one', 0), row('two', 180), { ...text('content', 360, 600), tag: 'main' }])))
  expect(result.blocks.filter(b => b.region === 'header').map(b => b.box.height)).toEqual([180, 180])
})
test('only the leading navigation rows of an oversized header remain header', () => {
  const nav = (key: string, y: number) => geometry(key, y, 100, 1170, [{ ...text(key + 'link', y, 100), tag: 'a' }], { tag: 'nav' })
  const header = geometry('header', 0, 800, 1170, [nav('first', 0), text('banner', 100, 600), nav('last', 700)], { tag: 'header' })
  expect(proposeFromGeometry(document(header)).blocks.map(b => b.region)).toEqual(['header', 'main', 'main'])
})

function newsSection(y: number): Geometry {
  const title = geometry('news-title', y, 60, 1170, [], { tag: 'h2', ownTextLength: 12 })
  const articles = geometry('articles', y + 60, 740, 1170, Array.from({ length: 4 }, (_, i) => geometry('article' + i, y + 60, 740, 270, [{ ...text('summary' + i, y + 60, 200), tag: 'p' }], { tag: 'article', box: { x: 135 + i * 290, y: y + 60, width: 270, height: 740 } })))
  return geometry('news', y, 800, 1170, [title, articles])
}
test('a leading news section inside a tall footer becomes main', () => {
  const root = geometry('footer', 0, 1000, 1170, [newsSection(0), text('legal', 800, 200)], { tag: 'footer' })
  const result = proposeFromGeometry(document(root))
  expect(result.blocks.map(b => b.region)).toEqual(['main', 'footer'])
  expect(result.blocks[0].box).toMatchObject({ y: 0, height: 800 })
  expect(result.blocks[1].box).toMatchObject({ y: 800, height: 200 })
})
test.each([{ tag: 'footer' }, { role: 'contentinfo' }, { classes: ['site-footer'] }])('news outside footer %j never merges into it', hint => {
  const news = text('news', 0, 600), note = text('news-note', 600, 25), footer = { ...text('legal', 625, 200), ...hint }
  const result = proposeFromGeometry(document(geometry('body', 0, 825, 1440, [news, note, footer])))
  expect(result.blocks.filter(b => b.region === 'footer').map(b => b.box.y)).toEqual([625])
  expect(result.blocks.filter(b => b.region === 'main').some(b => b.box.y === 600 || b.box.height === 625)).toBe(true)
})
test('a stale footer region without footer ancestry is main', () => {
  expect(proposeFromGeometry(document({ ...text('news', 0, 800), region: 'footer' })).blocks[0].region).toBe('main')
})

function gridTiles(counts: number[], height = 300): Geometry[] {
  return counts.flatMap((count, row) => Array.from({ length: count }, (_, col) => geometry('tile' + row + '-' + col, 80 + row * height, height, 350, [], { ownTextLength: 100, box: { x: 135 + col * 380, y: 80 + row * height, width: 350, height } })))
}
test('a heading and 3 x 3 sibling grid merge with original rows available to Split', () => {
  const heading = geometry('title', 0, 60, 1170, [], { tag: 'h2', ownTextLength: 20 })
  const rows = proposeGeometry(geometry('grid', 0, 980, 1170, [heading, ...gridTiles([3, 3, 3])]))
  expect(rows).toHaveLength(1)
  expect(rows[0].grouping).toBe('grid')
  const candidates = childCandidates(rows[0])
  expect(candidates).toHaveLength(3)
  expect(candidates[0].members![0].key).toBe('title')
  expect(candidates.slice(1).every(r => r.members?.length === 3)).toBe(true)
})
test('a heading outside grid wrappers stays attached to the first Split row', () => {
  const heading = geometry('title', 0, 60, 1170, [], { tag: 'h2', ownTextLength: 20 })
  const grid = geometry('grid', 80, 900, 1170, gridTiles([3, 3, 3]))
  const rows = proposeGeometry(geometry('section', 0, 1100, 1170, [heading, geometry('wrapper', 80, 900, 1170, [grid])]))
  expect(rows).toHaveLength(1)
  expect(childCandidates(rows[0])).toHaveLength(3)
  expect(childCandidates(rows[0])[0].members![0].key).toBe('title')
})
test('different column counts never merge', () => {
  const rows = proposeGeometry(geometry('grid', 0, 980, 1170, gridTiles([3, 2, 3])))
  expect(rows).toHaveLength(3)
  expect(rows.map(r => r.members!.length)).toEqual([3, 2, 3])
})
test('grid rows stop merging at 1500px and at heading-only separators', () => {
  expect(proposeGeometry(geometry('grid', 0, 1880, 1170, gridTiles([3, 3, 3], 600)))).toHaveLength(2)
  const tiles = gridTiles([3, 3, 3])
  tiles.slice(3).forEach(n => n.box.y += 60)
  const heading = geometry('separator', 380, 60, 1170, [], { tag: 'h2', ownTextLength: 20 })
  expect(proposeGeometry(geometry('grid', 0, 1040, 1170, [...tiles, heading]))).toHaveLength(2)
})
test.each(['position', 'width'])('grid column %s changes beyond five percent prevent a merge', change => {
  const tiles = gridTiles([3, 3, 3])
  tiles.slice(3, 6).forEach(n => {
    if (change === 'position') {
      n.box.x += 30
    }
    else {
      n.box.width += 30
    }
  })
  expect(proposeGeometry(geometry('grid', 0, 980, 1170, tiles))).toHaveLength(3)
})
test('aligned tiles in separate containers do not share a parent grid', () => {
  const tiles = gridTiles([3, 3, 3])
  const sections = [0, 1, 2].map(row => geometry('section' + row, 80 + row * 300, 300, 1170, tiles.slice(row * 3, row * 3 + 3)))
  expect(proposeGeometry(geometry('page', 0, 980, 1170, sections))).toHaveLength(3)
})
test('the attached heading counts toward the grid height limit', () => {
  const heading = geometry('title', 0, 60, 1170, [], { tag: 'h2', ownTextLength: 20 })
  const grid = geometry('grid', 80, 1500, 1170, gridTiles([3, 3, 3], 500))
  const rows = proposeGeometry(geometry('section', 0, 1580, 1170, [heading, grid]))
  expect(rows).toHaveLength(2)
  expect(rows.every(r => r.box.height <= 1500)).toBe(true)
})
test('column differences within five percent still merge', () => {
  const tiles = gridTiles([3, 3, 3])
  tiles.slice(3, 6).forEach(n => { n.box.x += 10; n.box.width += 10 })
  expect(proposeGeometry(geometry('grid', 0, 980, 1170, tiles))).toHaveLength(1)
})


test('merged blocks and split children retain rendered repeated groups', () => {
  const repeatedA = [{ signature: 'section#a / article>p', count: 3 }]
  const repeatedB = [{ signature: 'section#b / article>p', count: 4 }]
  const a = { ...text('a', 0, 100), tag: 'footer', repeatedChildren: repeatedA }
  const b = { ...text('b', 100, 100), tag: 'footer', repeatedChildren: repeatedB }
  const blocks = cutRenderedPage(geometry('body', 0, 200, 1440, [a, b], { tag: 'body' }))
  expect(blocks).toHaveLength(1)
  expect(blocks[0].repeatedChildren).toEqual([...repeatedA, ...repeatedB])
  expect(blocks[0].children.map(child => child.repeatedChildren)).toEqual([repeatedA, repeatedB])
})
