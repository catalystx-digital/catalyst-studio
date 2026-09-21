/** @jest-environment node */
import { createReplayTools } from './replay'
import { fixtureSnapshot } from './fixtures'
import { WebFetchTools } from '@/lib/studio/import/services/web-tools'
import { identifier, pageSlug, saveSnapshot, loadSnapshot } from './storage'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('saved web tools',()=>{
  test('returns exact outline and payloads without fetch and isolates mutations',async()=>{
    const snapshot=fixtureSnapshot(), tools=createReplayTools(snapshot)
    const outline=await tools.fetchOutline({url:snapshot.manifest.url})
    expect(outline).toEqual(snapshot.outline)
    for(const key of snapshot.manifest.sectionKeys) expect(await tools.getSection({handle:outline.handle,key})).toEqual(snapshot.sections[key])
    outline.sections!.pop()
    const section=await tools.getSection({handle:outline.handle,key:'header'});section.slice[0].tag='changed'
    expect((await tools.fetchOutline({url:snapshot.manifest.url})).sections).toHaveLength(3)
    expect((await tools.getSection({handle:outline.handle,key:'header'})).slice[0].tag).toBe('header')
    tools.release(outline.handle)
    expect(tools.getLastFetchOutline()).toEqual(snapshot.outline)
  })
  test('rejects unsaved URLs, keys, handles and mismatched options',async()=>{
    const snapshot=fixtureSnapshot(), tools=createReplayTools(snapshot)
    await expect(tools.fetchOutline({url:'https://example.com/other'})).rejects.toThrow('outside')
    await expect(tools.fetchOutline({url:snapshot.manifest.url,stripScriptsStyles:false})).rejects.toThrow('settings')
    await expect(tools.getSection({handle:'other',key:'header'})).rejects.toThrow('handle')
    await expect(tools.getSection({handle:snapshot.outline.handle,key:'__proto__'})).rejects.toThrow('section')
    expect(()=>tools.release('other')).toThrow('handle')
  })
  test('caps sections explicitly without changing saved data',async()=>{
    const snapshot=fixtureSnapshot(), tools=createReplayTools(snapshot,1)
    expect(tools.omitted).toEqual(['main:0-1023','footer'])
    expect((await tools.fetchOutline({url:snapshot.manifest.url})).sections).toHaveLength(1)
    await expect(tools.getSection({handle:snapshot.outline.handle,key:'footer'})).rejects.toThrow('section')
    expect(snapshot.outline.sections).toHaveLength(3)
  })
  test('safe identifiers and slugs omit credentials, query and fragments',()=>{
    expect(()=>identifier('../outside')).toThrow()
    expect(pageSlug('https://example.com/garden?token=private-value#hidden')).not.toMatch(/private|token|hidden/)
    expect(pageSlug('https://example.com/garden?a=1')).not.toBe(pageSlug('https://example.com/garden?a=2'))
    expect(()=>pageSlug('https://name:secret@example.com/')).toThrow()
  })
})


function styledSnapshot() {
  const snapshot = fixtureSnapshot()
  snapshot.html = snapshot.html.replace('</head>', '<link rel="stylesheet" href="/assets/css/site.css"><style>.surface{background-color:#123456} #inline-hidden{display:none}</style></head>')
  snapshot.stylesheets = ['.concealed-external{display:none} #external-hidden{visibility:hidden} .surface{background-image:url(../images/texture.png);background-color:#ffffff} #banner{background-color:#abcdef}']
  return snapshot
}

test('legacy replay uses the guessed stylesheet URL for the map only', async () => {
  const snapshot = styledSnapshot(), web = new WebFetchTools()
  const tools = createReplayTools(snapshot, undefined, web)
  await tools.fetchOutline({ url: snapshot.manifest.url })
  const { bgImageMap: map, stylesheets } = web.getPageStyling(snapshot.outline.handle)
  expect(stylesheets).toEqual([])
  expect(web.getRawHtml(snapshot.outline.handle)).toBe(snapshot.html)
  expect(map.byClass.get('surface')).toBe('https://example.com/assets/images/texture.png')
  expect(map.bgColorByClass.get('surface')).toBe('#123456')
  expect(map.bgColorById.get('banner')).toBe('#abcdef')
  expect([...map.hiddenByClass]).toEqual(['concealed', 'concealed-external'])
  expect([...map.hiddenById]).toEqual(['inline-hidden', 'external-hidden'])
  expect(tools.styling).toEqual({ rebuilt: true, stylesheetsSaved: 1, stylesheetsPaired: 0, baseUsed: 'stylesheet-links', stylesheetIssues: ['Saved stylesheets are map only: URL/text pairs were not saved; none supplied to the browser.'], hiddenSelectors: 4, backgroundImages: 1 })
  map.byClass.clear()
  await tools.fetchOutline({ url: snapshot.manifest.url })
  expect(web.getPageStyling(snapshot.outline.handle).bgImageMap.byClass.size).toBe(1)
  tools.release(snapshot.outline.handle)
  expect(web.getCacheStats().entries).toBe(0)
  expect(() => web.getPageStyling(snapshot.outline.handle)).toThrow('handle')
})

test('mismatched stylesheet counts use the final page URL and report the fallback', async () => {
  const snapshot = styledSnapshot()
  snapshot.manifest.finalUrl = 'https://example.com/redirected/pages/garden'
  snapshot.stylesheets.push('.second-surface{background-image:url(./second.png)}')
  const tools = createReplayTools(snapshot)
  await tools.fetchOutline({ url: snapshot.manifest.url })
  const { bgImageMap: map } = tools.getPageStyling(snapshot.outline.handle)
  expect(map.byClass.get('surface')).toBe('https://example.com/redirected/images/texture.png')
  expect(map.byClass.get('second-surface')).toBe('https://example.com/redirected/pages/second.png')
  expect(map.hiddenByClass.has('concealed-external')).toBe(true)
  expect(tools.getPageStyling(snapshot.outline.handle).stylesheets).toEqual([])
  expect(tools.styling).toMatchObject({ rebuilt: true, stylesheetsSaved: 2, stylesheetsPaired: 0, baseUsed: 'page-url', stylesheetIssues: ['Saved stylesheets are map only: URL/text pairs were not saved; none supplied to the browser.'] })
})

test('map-only URL guesses use production link filtering and the five-file limit', async () => {
  const snapshot = fixtureSnapshot()
  snapshot.html = '<link rel="stylesheet" href="https://other.example.com/site.css"><link rel="stylesheet" media="print" href="/print.css">' +
    Array.from({ length: 6 }, (_, i) => '<link rel="stylesheet" href="/assets/' + i + '/site.css">').join('')
  snapshot.stylesheets = Array.from({ length: 5 }, (_, i) => '.surface-' + i + '{background-image:url(image.png);} .first-wins{background-image:url(image.png);}')
  const tools = createReplayTools(snapshot)
  await tools.fetchOutline({ url: snapshot.manifest.url })
  const { bgImageMap: map } = tools.getPageStyling(snapshot.outline.handle)
  for (let i = 0; i < 5; i++) expect(map.byClass.get('surface-' + i)).toBe('https://example.com/assets/' + i + '/image.png')
  expect(map.byClass.get('first-wins')).toBe('https://example.com/assets/0/image.png')
  expect(tools.getPageStyling(snapshot.outline.handle).stylesheets).toEqual([])
  expect(tools.styling).toMatchObject({ stylesheetsPaired: 0, baseUsed: 'stylesheet-links', stylesheetIssues: [expect.stringContaining('map only')] })
})

test('saved stylesheet URLs survive storage and take precedence over HTML links', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'import-lab-replay-'))
  const previous = process.env.IMPORT_LAB_ROOT
  process.env.IMPORT_LAB_ROOT = directory
  try {
    const snapshot = fixtureSnapshot()
    snapshot.stylesheets = ['.surface{background-image:url(../image.png)}']
    snapshot.manifest.stylesheetUrls = ['https://example.com/original/css/site.css']
    await saveSnapshot(path.join(directory, 'pages', 'fixture'), snapshot)
    const loaded = await loadSnapshot('fixture')
    expect(loaded.manifest.stylesheetUrls).toEqual(snapshot.manifest.stylesheetUrls)
    loaded.html += '<link rel="stylesheet" href="/different/site.css">'
    const tools = createReplayTools(loaded)
    await tools.fetchOutline({ url: loaded.manifest.url })
    expect(tools.getPageStyling(loaded.outline.handle).bgImageMap.byClass.get('surface')).toBe('https://example.com/original/image.png')
    expect(tools.getPageStyling(loaded.outline.handle).stylesheets).toEqual([{ url: snapshot.manifest.stylesheetUrls[0], text: snapshot.stylesheets[0] }])
    expect(tools.styling).toMatchObject({ stylesheetsPaired: 1, baseUsed: 'saved-urls' })
  } finally {
    if (previous === undefined) delete process.env.IMPORT_LAB_ROOT
    else process.env.IMPORT_LAB_ROOT = previous
    await fs.rm(directory, { recursive: true, force: true })
  }
})
