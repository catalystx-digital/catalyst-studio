/** @jest-environment node */
import { WebFetchTools } from '../web-tools'
import { DetectionConfig } from '../../config'

const originalFetch = global.fetch
const originalHarness = DetectionConfig.detectionHarness
afterEach(() => { global.fetch = originalFetch; DetectionConfig.detectionHarness = originalHarness })

test.each(['blocks', 'section'] as const)('cached styling retains stylesheet texts only for blocks: %s', async harness => {
  DetectionConfig.detectionHarness = harness
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
    stylesheets: harness === 'blocks' ? [{ url: 'https://example.com/site.css', text: css }] : []
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
