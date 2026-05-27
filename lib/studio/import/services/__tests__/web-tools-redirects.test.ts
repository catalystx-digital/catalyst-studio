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
