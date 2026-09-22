/** @jest-environment node */
import * as launcher from '@/lib/studio/design-system/dom-probe/launch-headless-chromium'
import { createServer } from 'node:http'
import { renderAndCut, instrumentHtml, BlockCutError } from './block-cutter'

jest.mock('@/lib/studio/design-system/dom-probe/launch-headless-chromium', () => ({
  ...jest.requireActual('@/lib/studio/design-system/dom-probe/launch-headless-chromium'),
  launchHeadlessChromium: jest.fn()
}))

const browserTest = process.env.CHROMIUM_EXECUTABLE_PATH ? test : test.skip
browserTest.each([false, true])('renders an intercepted example.com fixture with esbuild names: %s (skipped without CHROMIUM_EXECUTABLE_PATH)', async esbuildNames => {
  const toString = Function.prototype.toString
  let injected = false
  const sourceSpy = jest.spyOn(Function.prototype, 'toString').mockImplementation(function (this: Function) {
    const source = toString.call(this)
    if (esbuildNames && source.includes('const isVisible =') && source.includes('let applied = 0')) {
      injected = true
      return source.replace('let applied = 0', "__name(() => {}, 'browserRegression'); let applied = 0")
    }
    return source
  })
  const launch = jest.requireActual<typeof launcher>('@/lib/studio/design-system/dom-probe/launch-headless-chromium').launchHeadlessChromium
  const browsers: Awaited<ReturnType<typeof launch>>[] = []
  const spy = jest.mocked(launcher.launchHeadlessChromium).mockImplementation(async () => {
    const browser = await launch()
    browsers.push(browser)
    const newContext = browser.newContext.bind(browser)
    jest.spyOn(browser, 'newContext').mockImplementation(async options => {
      const context = await newContext(options)
      await context.route('**/*', route => route.abort())
      return context
    })
    return browser
  })
  const html = '<!doctype html><html><head><style>body{margin:0}header,footer{height:100px}header a{display:block;height:100px}section{height:600px}h2,p{margin:0}</style></head><body>' +
    '<header><a href="/">Example navigation</a></header><main><section id="one"><h2>Example heading</h2><p>First example.</p></section>' +
    '<section id="two"><h2>Another heading</h2><p>Second example.</p></section></main><footer>Example footer</footer></body></html>'
  try {
    const result = await renderAndCut({ html, finalUrl: 'https://example.com/saved-page' })
    expect(injected).toBe(esbuildNames)
    expect(result.javascriptEnabled).toBe(true)
    expect(result.anchorResolutionShare).toBe(1)
    expect(result.blocks.map(b => b.region)).toEqual(['header', 'main', 'main', 'footer'])
    expect(result.blocks.map(b => b.box.height)).toEqual([100, 600, 600, 100])
    expect(result.blocks.map(b => b.order)).toEqual([1, 2, 3, 4])
    const anchors = Object.values(instrumentHtml(html).anchors).map(anchor => JSON.stringify(anchor))
    expect(result.blocks.every(b => b.anchor && anchors.includes(JSON.stringify(b.anchor)))).toBe(true)
    expect(result.issues).toEqual([])
    expect(browsers.every(b => !b.isConnected())).toBe(true)
  } finally {
    sourceSpy.mockRestore()
    spy.mockRestore()
    await Promise.all(browsers.map(b => b.close()))
  }
}, 30000)

browserTest.each(['all-aborted', 'all-http-errors', 'some-failed', 'supplied', 'print-only'])('external stylesheet loading: %s (skipped without CHROMIUM_EXECUTABLE_PATH)', async mode => {
  const requests: string[] = []
  const css = 'body{margin:0}section{height:600px}h2,p{margin:0}'
  const server = createServer((request, response) => {
    requests.push(request.url!)
    response.writeHead(request.url === '/missing.css' ? 404 : 200, { 'Content-Type': 'text/css' })
    response.end(request.url === '/site.css' ? css : '')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  const launch = jest.requireActual<typeof launcher>('@/lib/studio/design-system/dom-probe/launch-headless-chromium').launchHeadlessChromium
  const browsers: Awaited<ReturnType<typeof launch>>[] = []
  const spy = jest.mocked(launcher.launchHeadlessChromium).mockImplementation(async () => {
    const browser = await launch()
    browsers.push(browser)
    const newContext = browser.newContext.bind(browser)
    jest.spyOn(browser, 'newContext').mockImplementation(async options => {
      const context = await newContext(options)
      await context.route('**/*', route => {
        if (!route.request().url().startsWith(origin + '/') || mode === 'all-aborted') return route.abort()
        return route.continue()
      })
      return context
    })
    return browser
  })
  const failing = mode.startsWith('all-')
  const html = mode === 'print-only'
    ? '<head><link rel="stylesheet" media="print" href="/missing.css"></head><body><main><p>Print-only page</p></main></body>'
    : '<head><style>body{color:red}</style><link rel="stylesheet" href="' + (failing ? '/missing.css' : '/site.css') + '">' +
    '<link rel="stylesheet" href="' + (mode === 'supplied' ? '/network.css' : '/missing.css') + '"></head>' +
    '<body><main><section><h2>First</h2><p>First section</p></section><section><h2>Second</h2><p>Second section</p></section></main></body>'
  try {
    const result = renderAndCut({ html, finalUrl: origin + '/saved-page', stylesheets: mode === 'supplied' ? [{ url: origin + '/site.css', text: css }] : [] })
    if (failing) {
      await expect(result).rejects.toBeInstanceOf(BlockCutError)
      await expect(result).rejects.toThrow('2 external stylesheets were declared but none loaded')
    } else {
      const cut = await result
      if (mode === 'print-only') {
        expect(cut.blocks.length).toBeGreaterThan(0)
      } else {
        expect(cut.blocks.map(block => block.box.height)).toEqual([600, 600])
      }
      if (mode === 'supplied') {
        expect(requests).not.toContain('/site.css')
        expect(requests).toContain('/network.css')
        expect(cut.issues).toEqual([])
      } else if (mode === 'some-failed') {
        expect(requests).toContain('/site.css')
        expect(cut.issues).toContain('Resource HTTP 404: ' + origin + '/missing.css')
      }
    }
    expect(browsers.every(browser => !browser.isConnected())).toBe(true)
  } finally {
    spy.mockRestore()
    await Promise.all(browsers.map(browser => browser.close()))
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}, 30000)
