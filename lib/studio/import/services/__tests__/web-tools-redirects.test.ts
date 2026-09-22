import { getWebFetchTools, isExternalUrl } from '../web-tools'

describe('web-tools redirect URL classification', () => {
  it('treats apex-to-www canonical redirects as same-site', () => {
    expect(isExternalUrl('https://www.levo.com.au/', 'https://levo.com.au/')).toBe(false)
  })

  it('treats www-to-apex canonical redirects as same-site', () => {
    expect(isExternalUrl('https://example.com/about', 'https://www.example.com/')).toBe(false)
  })

  it('keeps unrelated hosts external', () => {
    expect(isExternalUrl('https://other.example.com/', 'https://example.com/')).toBe(true)
  })
})

describe('web-tools body fallback main extraction', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    getWebFetchTools().clearCache()
  })

  it('filters body-fallback navigation out of resource summaries', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<html><body>
        <header><a href="/home">Home</a></header>
        <section><a href="/content">Main content</a></section>
        <nav><a href="/nav">Navigation</a></nav>
        <div class="main-navigation"><a href="/menu">Menu</a></div>
        <div role="navigation"><a href="/role-menu">Role menu</a></div>
        <footer><a href="/privacy">Privacy</a></footer>
      </body></html>`
    } as Response))

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.resourcesSummary?.anchors.map(anchor => anchor.href)).toEqual(['/home', '/content', '/privacy'])
  })

  it('detects a class-hidden header root outside main for resource summaries', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<html><head><style>.desktop-header { display: none; }</style></head><body>
        <div class="desktop-header"><nav><a href="/services">Services</a></nav></div>
        <main><a href="/content">Main content</a></main>
      </body></html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })

    expect(tools.getPageStyling(outline.handle).bgImageMap.hiddenByClass.has('desktop-header')).toBe(true)
    expect(outline.resourcesSummary?.anchors.map(anchor => anchor.href)).toEqual(['/services', '/content'])
  })

  it('excludes deterministically hidden resources while retaining visible resources', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<html><head><style>
        #title-row { display: none; }
        .hidden-panel { visibility: hidden !important; }
        .deferred-panel { content-visibility: hidden; }
      </style></head><body><main>
        <a href="/visible">Visible content</a><img src="/visible.jpg">
        <div id="title-row"><img src="/hidden-title.jpg"></div>
        <div class="hidden-panel"><a href="/hidden-class">Hidden class</a></div>
        <div class="deferred-panel"><a href="/hidden-deferred">Deferred</a></div>
        <div style="display:none"><a href="/hidden-display">Display</a></div>
        <div style="visibility: hidden !important"><a href="/hidden-visibility">Visibility</a></div>
        <div hidden><a href="/hidden-attr">Attribute</a></div>
      </main></body></html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const { bgImageMap } = tools.getPageStyling(outline.handle)

    expect(bgImageMap.hiddenById.has('title-row')).toBe(true)
    expect([...bgImageMap.hiddenByClass].sort()).toEqual(['deferred-panel', 'hidden-panel'])
    expect(outline.resourcesSummary?.anchors.map(anchor => anchor.href)).toEqual(['/visible'])
    expect(outline.resourcesSummary?.images.map(image => image.src)).toEqual(['/visible.jpg'])
  })

  it('preserves long media URLs in resource summaries', async () => {
    const longImageUrl = 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/a5dc2c3a-f059-44ed-b81a-6216def1c73a/A%20Guide%20to%20Digital%20Product%20Strategy.jpg?h=474&fm=webp'

    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/guide',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head><title>Guide</title></head>
          <body>
            <main>
              <section class="page-header">
                <img src="${longImageUrl}" alt="Guide cover">
                <h1>A Guide to Digital Product Strategy</h1>
              </section>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/guide' })

    expect(outline.resourcesSummary?.images[0]?.src).toBe(longImageUrl)

  })

  it('does not preserve long data image placeholders unbounded', async () => {
    const dataImage = `data:image/png;base64,${'a'.repeat(5000)}`
    const realImage = '/assets/hero.jpg'

    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/data-image',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <body>
            <main>
              <section>
                <img src="${dataImage}" srcset="${dataImage} 1x, ${realImage} 2x" alt="Inline placeholder">
                <h1>Inline placeholder page</h1>
              </section>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/data-image' })

    expect(JSON.stringify(outline.resourcesSummary)).not.toContain('data:image/png;base64')
    expect(outline.resourcesSummary?.images[0]?.src).toBeUndefined()
    expect(outline.resourcesSummary?.images[0]?.srcset).toBe(`${realImage} 2x`)

  })

})
