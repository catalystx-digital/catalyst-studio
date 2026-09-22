import { launchHeadlessChromium } from '@/lib/studio/design-system/dom-probe/launch-headless-chromium'
import { instrumentHtml, renderAndCut } from './block-cutter'

jest.mock('@/lib/studio/design-system/dom-probe/launch-headless-chromium', () => ({ launchHeadlessChromium: jest.fn() }))

test('captures script-built repeated children with computed visibility in the geometry evaluation', async () => {
  const html = '<html><head><style>*{opacity:1}.hidden-card{display:none}</style></head><body><main id="grid"></main></body></html>'
  const prepared = new DOMParser().parseFromString(instrumentHtml(html).html, 'text/html')
  document.head.innerHTML = prepared.head.innerHTML
  document.body.innerHTML = prepared.body.innerHTML
  for (const sheet of Array.from(document.styleSheets)) {
    Object.defineProperty(sheet, 'media', { value: { mediaText: '' } })
  }
  const grid = document.getElementById('grid')!
  for (let index = 0; index < 3; index++) {
    const card = document.createElement('article')
    card.innerHTML = '<h3>Card</h3><p>Description</p>'
    if (index === 2) card.className = 'hidden-card'
    grid.append(card)
  }
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return { x: 0, y: 0, width: 1000, height: this.tagName === 'MAIN' ? 600 : 100 } as DOMRect
  })
  let now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now += 1000)
  const page = {
    on: jest.fn(), route: jest.fn(), goto: jest.fn(), waitForTimeout: jest.fn(),
    evaluate: jest.fn(async (fn: Function | string, args: unknown) => {
      if (fn.toString().includes('ownTextLength')) return typeof fn === 'string' ? new Function('return ' + fn)() : fn(args)
      if (fn.toString().includes('scrollHeight')) return 1000
    })
  }
  const close = jest.fn()
  jest.mocked(launchHeadlessChromium).mockResolvedValue({
    newContext: async () => ({ newPage: async () => page }), close
  } as any)
  try {
    const result = await renderAndCut({ html, finalUrl: 'https://example.com/grid' })
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].anchor?.id).toBe('grid')
    expect(result.blocks[0].repeatedChildren).toEqual([{ signature: 'main#grid / article>h3,p', count: 2 }])
    expect(page.evaluate.mock.calls.filter(([fn]) => fn.toString().includes('ownTextLength'))).toHaveLength(1)
    expect(close).toHaveBeenCalledTimes(1)
  } finally {
    jest.restoreAllMocks()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  }
})
