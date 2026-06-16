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

  it('excludes navigation containers when no main element exists', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head><title>Example</title></head>
          <body>
            <div class="desktop-header">
              <div class="dropdown-navigation technology-nav-menu">
                <span>DXP</span>
                <a href="/kentico">Kentico</a>
                <span>Marketing Optimisation</span>
              </div>
            </div>
            <section class="hero"><h1>Real homepage hero</h1><p>Primary page content.</p></section>
            <div class="mobile-menu"><a href="/hidden">Hidden mobile item</a></div>
            <section><h2>Client results</h2><p>Visible supporting content.</p></section>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serialized = JSON.stringify(mainNodes)

    expect(serialized).toContain('Real homepage hero')
    expect(serialized).toContain('Client results')
    expect(serialized).not.toContain('Marketing Optimisation')
    expect(serialized).not.toContain('Hidden mobile item')
  })

  it('preserves long media URLs in resource summaries and section attributes', async () => {
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
    const main = outline.sections?.find(section => section.key.startsWith('main:'))

    expect(outline.resourcesSummary?.images[0]?.src).toBe(longImageUrl)
    expect(main).toBeDefined()

    const mainSection = await tools.getSection({ handle: outline.handle, key: main!.key })
    const serialized = JSON.stringify(mainSection.slice)

    expect(serialized).toContain(longImageUrl)
    expect(serialized).toContain('A Guide to Digital Product Strategy')
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
    const main = outline.sections?.find(section => section.key.startsWith('main:'))

    expect(JSON.stringify(outline.resourcesSummary)).not.toContain('data:image/png;base64')
    expect(outline.resourcesSummary?.images[0]?.src).toBeUndefined()
    expect(outline.resourcesSummary?.images[0]?.srcset).toBe(`${realImage} 2x`)

    const mainSection = await tools.getSection({ handle: outline.handle, key: main!.key })
    const serialized = JSON.stringify(mainSection.slice)

    expect(serialized).toContain('data:image/png;base64')
    expect(serialized).not.toContain('a'.repeat(1000))
  })

  it('exposes header-like containers as header sections when no header element exists', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head><title>Example</title></head>
          <body>
            <div class="desktop-header">
              <a href="/" aria-label="Example home">Example</a>
              <div class="mega-menu main-navigation">
                <a href="/services">Services</a>
                <a href="/work">Work</a>
                <a href="/contact">Contact</a>
              </div>
            </div>
            <section class="hero"><h1>Real homepage hero</h1></section>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const header = outline.sections?.find(section => section.key === 'header')

    expect(header).toBeDefined()

    const headerSection = await tools.getSection({ handle: outline.handle, key: 'header' })
    const serializedHeader = JSON.stringify(headerSection.slice)

    expect(serializedHeader).toContain('Services')
    expect(serializedHeader).toContain('Contact')

    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serializedMain = JSON.stringify(mainNodes)

    expect(serializedMain).toContain('Real homepage hero')
    expect(serializedMain).not.toContain('Services')
    expect(serializedMain).not.toContain('Contact')
  })

  it('keeps source-backed navigation roots when responsive CSS hides header classes', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head>
            <title>Example</title>
            <style>
              .desktop-header { display: none; }
              .mobile-header { display: none; }
            </style>
          </head>
          <body>
            <div class="desktop-header">
              <a href="/" class="logo">Example Agency</a>
              <div class="mega-menu main-navigation">
                <button>Services</button>
                <button>Work</button>
                <button>Technology</button>
              </div>
              <nav class="main-nav-wrapper">
                <a href="/blog">Insights</a>
                <a href="/about">About</a>
              </nav>
              <a href="/contact" class="menu-cta">Contact Us</a>
            </div>
            <main>
              <section><h1>Visible hero</h1><p>Visible supporting content.</p></section>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })

    expect(outline.sections?.some(section => section.key === 'header')).toBe(true)

    const headerSection = await tools.getSection({ handle: outline.handle, key: 'header' })
    const serializedHeader = JSON.stringify(headerSection.slice)

    expect(serializedHeader).toContain('Services')
    expect(serializedHeader).toContain('Work')
    expect(serializedHeader).toContain('Insights')
    expect(serializedHeader).toContain('Contact Us')

    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serializedMain = JSON.stringify(mainNodes)

    expect(serializedMain).toContain('Visible hero')
    expect(serializedMain).not.toContain('Services')
    expect(serializedMain).not.toContain('Contact Us')
  })

  it('does not leak class-hidden navigation outside the selected header root', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head>
            <title>Example</title>
            <style>
              .desktop-header { display: none; }
              .hidden-panel { display: none; }
            </style>
          </head>
          <body>
            <div class="desktop-header">
              <a href="/" class="logo">Example</a>
              <nav class="main-navigation"><a href="/services">Services</a></nav>
              <nav class="hidden-panel"><a href="/hidden-header">Hidden header nav</a></nav>
            </div>
            <main>
              <section><h1>Visible hero</h1></section>
              <nav class="hidden-panel"><a href="/hidden-main">Hidden main nav</a></nav>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const headerSection = await tools.getSection({ handle: outline.handle, key: 'header' })
    const serializedHeader = JSON.stringify(headerSection.slice)

    expect(serializedHeader).toContain('Services')
    expect(serializedHeader).not.toContain('Hidden header nav')

    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serializedMain = JSON.stringify(mainNodes)

    expect(serializedMain).toContain('Visible hero')
    expect(serializedMain).not.toContain('Hidden main nav')
  })

  it('does not promote footer navigation as a header section', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head><title>Example</title></head>
          <body>
            <section class="hero"><h1>Real homepage hero</h1></section>
            <footer>
              <nav class="main-navigation">
                <a href="/privacy">Privacy</a>
              </nav>
            </footer>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })

    expect(outline.sections?.some(section => section.key === 'header')).toBe(false)
  })

  it('excludes deterministically hidden nodes from extracted main sections', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head>
            <title>Example</title>
            <style>
              #title-row { display: none; }
              .hidden-panel { visibility: hidden !important; }
              .deferred-panel { content-visibility: hidden; }
            </style>
          </head>
          <body>
            <main>
              <section><h1>Visible heading</h1><p>Visible supporting content.</p></section>
              <div id="title-row"><h1>Hidden page title</h1><img src="/hidden-title.jpg" alt="Hidden title image"></div>
              <div class="hidden-panel">Hidden CSS class title</div>
              <div class="deferred-panel">Hidden content visibility title</div>
              <div style="display:none">Inline hidden title</div>
              <div style="visibility: hidden !important">Inline visibility hidden title</div>
              <div hidden>Hidden attr title</div>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serialized = JSON.stringify(mainNodes)

    expect(serialized).toContain('Visible heading')
    expect(serialized).toContain('Visible supporting content')
    expect(serialized).not.toContain('Hidden page title')
    expect(serialized).not.toContain('Hidden CSS class title')
    expect(serialized).not.toContain('Hidden content visibility title')
    expect(serialized).not.toContain('Inline hidden title')
    expect(serialized).not.toContain('Inline visibility hidden title')
    expect(serialized).not.toContain('Hidden attr title')
    expect(serialized).not.toContain('/hidden-title.jpg')
  })

  it('does not globally exclude responsive visibility classes', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head>
            <title>Example</title>
            <style>
              @media (max-width: 767px) { .hidden-xs { display: none !important; } }
            </style>
          </head>
          <body>
            <main>
              <div class="hidden-xs"><h2>Desktop carousel content</h2></div>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serialized = JSON.stringify(mainNodes)

    expect(serialized).toContain('Desktop carousel content')
  })

  it('does not apply print-only stylesheet visibility rules to screen extraction', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/print.css')) {
        return {
          ok: true,
          status: 200,
          url,
          headers: new Headers({ 'content-type': 'text/css' }),
          text: async () => `.site-footer { display: none !important; }`
        } as Response
      }

      return {
        status: 200,
        url: 'https://example.com/',
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => `<!doctype html>
          <html>
            <head>
              <title>Example</title>
              <link rel="stylesheet" href="/print.css" media="print">
            </head>
            <body>
              <main><h1>Visible content</h1></main>
              <footer class="site-footer"><p>Visible screen footer</p></footer>
            </body>
          </html>`
      } as Response
    })

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const footer = outline.sections?.find(section => section.key === 'footer')

    expect(footer).toBeDefined()

    const footerSection = await tools.getSection({ handle: outline.handle, key: 'footer' })
    expect(JSON.stringify(footerSection.slice)).toContain('Visible screen footer')
  })

  it('does not globalize compound hidden selectors', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html>
        <html>
          <head>
            <title>Example</title>
            <style>
              .carousel .slide:not(.active) { display: none; }
              #app .hidden-panel { display: none; }
            </style>
          </head>
          <body>
            <main>
              <div id="app">
                <section class="carousel">
                  <article class="slide active"><h2>Visible active slide</h2></article>
                </section>
              </div>
            </main>
          </body>
        </html>`
    } as Response))

    const tools = getWebFetchTools()
    const outline = await tools.fetchOutline({ url: 'https://example.com/' })
    const mainSections = outline.sections?.filter(section => section.key.startsWith('main:')) ?? []
    const mainNodes = (
      await Promise.all(mainSections.map(section => tools.getSection({ handle: outline.handle, key: section.key })))
    ).flatMap(section => section.slice)
    const serialized = JSON.stringify(mainNodes)

    expect(serialized).toContain('Visible active slide')
  })
})
