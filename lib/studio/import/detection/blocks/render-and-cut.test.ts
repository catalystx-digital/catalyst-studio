/** @jest-environment node */
import { launchHeadlessChromium } from '@/lib/studio/design-system/dom-probe/launch-headless-chromium'
import { BlockCutError, renderAndCut, type Geometry } from './block-cutter'

jest.mock('@/lib/studio/design-system/dom-probe/launch-headless-chromium', () => ({ launchHeadlessChromium: jest.fn() }))
const launch = jest.mocked(launchHeadlessChromium)
const html = '<body>' + Array.from({ length: 5 }, (_, i) => '<p id="p' + i + '">Example paragraph</p>').join('') + '</body>'
const finalUrl = 'https://example.com/page#part'
function browserFixture(resolved = 5, styling = { declared: 0, applied: 0 }) {
  const children: Geometry[] = Array.from({ length: 5 }, (_, i) => ({
    key: String(i + 1), tag: 'p', region: 'main', anchorKey: i < resolved ? String(i) : null,
    box: { x: 0, y: i * 800, width: 1440, height: 800 }, visible: true, meaningful: true, ownTextLength: 20, children: []
  }))
  const tree: Geometry = { key: 'body', tag: 'body', region: 'main', box: { x: 0, y: 0, width: 1440, height: 4000 }, visible: true, meaningful: true, children }
  const frame = {}
  const page = {
    on: jest.fn(), route: jest.fn(), goto: jest.fn(), mainFrame: () => frame,
    waitForTimeout: jest.fn(),
    evaluate: jest.fn(async (fn: Function) => {
      const source = fn.toString()
      if (source.includes('ownTextLength')) return { tree, ...styling }
      if (source.includes('scrollHeight')) return 1000
    })
  }
  const context = { newPage: jest.fn().mockResolvedValue(page) }
  const browser = { newContext: jest.fn().mockResolvedValue(context), close: jest.fn() }
  launch.mockResolvedValueOnce(browser as unknown as Awaited<ReturnType<typeof launchHeadlessChromium>>)
  return { browser, page, frame }
}
beforeEach(() => {
  jest.clearAllMocks()
  let now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now += 1000)
})
afterEach(() => jest.restoreAllMocks())

test('launch failure throws a plain BlockCutError and never falls back', async () => {
  launch.mockRejectedValueOnce(new Error('Executable unavailable'))
  await expect(renderAndCut({ html, finalUrl })).rejects.toMatchObject({ name: 'BlockCutError', message: expect.stringContaining('Chromium could not start. Executable unavailable') })
  expect(launch).toHaveBeenCalledTimes(1)
})
test('declared stylesheets with none applied throw and close the browser', async () => {
  const { browser } = browserFixture(5, { declared: 1, applied: 0 })
  await expect(renderAndCut({ html, finalUrl })).rejects.toThrow(BlockCutError)
  expect(browser.close).toHaveBeenCalledTimes(1)
  expect(launch).toHaveBeenCalledTimes(1)
})
test('source stylesheet declaration is retained when scripts remove it', async () => {
  browserFixture()
  await expect(renderAndCut({ html: '<style>p{color:red}</style>' + html, finalUrl })).rejects.toThrow('no styling was applied')
})
test.each([4, 5])('%i of five resolving anchors keeps JavaScript on', async resolved => {
  const { browser } = browserFixture(resolved)
  const result = await renderAndCut({ html, finalUrl })
  expect(result.anchorResolutionShare).toBe(resolved / 5)
  expect(result.javascriptEnabled).toBe(true)
  expect(launch).toHaveBeenCalledTimes(1)
  expect(browser.close).toHaveBeenCalledTimes(1)
})
test('below 80 percent uses exactly one JavaScript-off recut and records it', async () => {
  const first = browserFixture(3), second = browserFixture(5)
  const result = await renderAndCut({ html, finalUrl })
  expect(result.javascriptEnabled).toBe(false)
  expect(result.anchorResolutionShare).toBe(1)
  expect(result.issues).toContain('Fewer than 80% of block anchors resolved with JavaScript on; used JavaScript-off render.')
  expect(first.browser.newContext).toHaveBeenCalledWith(expect.objectContaining({ javaScriptEnabled: true }))
  expect(second.browser.newContext).toHaveBeenCalledWith(expect.objectContaining({ javaScriptEnabled: false }))
  expect(first.browser.close).toHaveBeenCalledTimes(1)
  expect(second.browser.close).toHaveBeenCalledTimes(1)
  expect(launch).toHaveBeenCalledTimes(2)
})
test('explicit JavaScript off never recuts unresolved anchors', async () => {
  browserFixture(0)
  const result = await renderAndCut({ html, finalUrl, javascript: false })
  expect(result.javascriptEnabled).toBe(false)
  expect(result.anchorResolutionShare).toBe(0)
  expect(launch).toHaveBeenCalledTimes(1)
})
test('a still-unresolved second render is returned without a third attempt', async () => {
  browserFixture(0)
  browserFixture(2)
  expect((await renderAndCut({ html, finalUrl })).anchorResolutionShare).toBe(0.4)
  expect(launch).toHaveBeenCalledTimes(2)
})
test('serves only the initial main document at the final URL and measures geometry once', async () => {
  const { browser, page, frame } = browserFixture()
  await renderAndCut({ html, finalUrl })
  const [matches, handler] = page.route.mock.calls[0]
  expect(matches(new URL('https://example.com/page'))).toBe(true)
  expect(matches(new URL('https://example.com/style.css'))).toBe(false)
  const route = { request: () => ({ isNavigationRequest: () => true, frame: () => frame }), fulfill: jest.fn(), fallback: jest.fn() }
  await handler(route)
  expect(route.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Example paragraph') }))
  await handler(route)
  expect(route.fallback).toHaveBeenCalledTimes(1)
  expect(page.evaluate.mock.calls.filter(([fn]) => fn.toString().includes('ownTextLength'))).toHaveLength(1)
  expect(browser.newContext).toHaveBeenCalledWith(expect.objectContaining({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' }))
})
test('navigation failures close the browser without a fallback', async () => {
  const { browser, page } = browserFixture()
  page.goto.mockRejectedValueOnce(new Error('Navigation timeout'))
  await expect(renderAndCut({ html, finalUrl })).rejects.toThrow('Navigation timeout')
  expect(browser.close).toHaveBeenCalledTimes(1)
  expect(launch).toHaveBeenCalledTimes(1)
})

test.each([302, 404])('external stylesheet HTTP %i does not count as loaded despite inline styling', async status => {
  const { browser, page, frame } = browserFixture(5, { declared: 3, applied: 1 })
  page.goto.mockImplementation(async () => {
    const request = { resourceType: () => 'stylesheet', frame: () => frame }
    page.on.mock.calls.find(([event]) => event === 'response')![1]({ status: () => status, request: () => request, url: () => 'https://example.com/one.css' })
    page.on.mock.calls.find(([event]) => event === 'requestfinished')![1](request)
  })
  await expect(renderAndCut({ html: '<style>p{color:red}</style><link rel="stylesheet" href="/one.css"><link rel="stylesheet" href="/two.css">' + html, finalUrl })).rejects.toMatchObject({
    name: 'BlockCutError', message: expect.stringContaining('2 external stylesheets were declared but none loaded')
  })
  expect(browser.close).toHaveBeenCalledTimes(1)
  expect(page.evaluate.mock.calls.some(([fn]) => fn.toString().includes('ownTextLength'))).toBe(false)
})

test.each(['print', ' PRINT ', '(print)', 'print, print'])('print-only links do not require external styling: %s', async media => {
  browserFixture()
  const result = await renderAndCut({ html: '<link rel="stylesheet" media="' + media + '" href="/print.css">' + html, finalUrl })
  expect(result.blocks).toHaveLength(5)
})

test('some external stylesheets failing records issues and keeps cutting', async () => {
  const { page, frame } = browserFixture(5, { declared: 3, applied: 1 })
  page.goto.mockImplementation(async () => {
    const emit = (name: string, value: unknown) => page.on.mock.calls.find(([event]) => event === name)![1](value)
    const loaded = { resourceType: () => 'stylesheet', frame: () => frame }
    emit('response', { status: () => 200, request: () => loaded })
    emit('requestfinished', loaded)
    emit('requestfailed', { url: () => 'https://example.com/missing.css', failure: () => ({ errorText: 'net::ERR_ABORTED' }) })
  })
  const result = await renderAndCut({ html: '<style>p{color:red}</style><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/missing.css">' + html, finalUrl })
  expect(result.blocks).toHaveLength(5)
  expect(result.issues).toContain('Resource failed: https://example.com/missing.css net::ERR_ABORTED')
})
