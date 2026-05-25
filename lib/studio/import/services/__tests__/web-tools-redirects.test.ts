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
})
