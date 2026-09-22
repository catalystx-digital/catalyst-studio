import { getWebFetchTools } from '../web-tools'

/**
 * These pin the <title> coming out of the head.
 *
 * It used not to. buildHeadMeta traversed the head asking for zero characters
 * of text per node, then checked that node's text to find the title — so the
 * check could never pass and headMeta.title was null on every page ever
 * imported. Nothing caught it because nothing asserted on the title, and the
 * downstream fallback (a component heading, else the URL slug) produces a
 * plausible-looking title, so imports looked fine.
 *
 * Meta and link tags were never affected: they read attributes, not text.
 */
describe('web-tools head metadata', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    getWebFetchTools().clearCache()
  })

  function serveHead(head: string): void {
    global.fetch = jest.fn(async () => ({
      status: 200,
      url: 'https://example.com/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => `<!doctype html><html lang="en"><head>${head}</head>` +
        `<body><section><h1>A heading that is not the title</h1></section></body></html>`
    } as Response))
  }

  it('reads the page title', async () => {
    serveHead('<title>Home - The Example Community Council</title>')

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.headMeta?.title).toBe('Home - The Example Community Council')
  })

  it('reads a title split across several lines', async () => {
    // A hospital site used this format, which is how the bug surfaced.
    serveHead('<title>\n      The Example Children\'s Hospital\n      : Sampletown\n    </title>')

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.headMeta?.title).toBe("The Example Children's Hospital : Sampletown")
  })

  it('does not mistake head script or style text for a title', async () => {
    serveHead(
      '<style>body { content: "Styled"; }</style>' +
      '<script>var pageTitle = "Scripted";</script>' +
      '<title>The real title</title>'
    )

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.headMeta?.title).toBe('The real title')
  })

  it('leaves the title unset when the page has none', async () => {
    serveHead('<meta name="description" content="No title on this page">')

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.headMeta?.title).toBeUndefined()
  })

  it('still reads canonical and lang alongside the title', async () => {
    // The attribute-driven fields; this guards against a fix to the title
    // breaking what was never broken.
    serveHead(
      '<title>Contact us</title>' +
      '<link rel="canonical" href="https://example.com/contact">'
    )

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })

    expect(outline.headMeta?.title).toBe('Contact us')
    expect(outline.headMeta?.language).toBe('en')
    expect(outline.headMeta?.canonical).toBe('https://example.com/contact')
  })

  it('carries meta values, not just meta names', async () => {
    // These were dropped for the life of the importer: `content` and
    // `property` were not in the shared attribute allowlist, so every meta tag
    // arrived with a name and no value. buildPageMetadataFromHead reads both,
    // which left every imported page with an empty SEO description, no social
    // preview, and no robots or viewport setting.
    serveHead(
      '<title>Contact us</title>' +
      '<meta name="description" content="What this page is about">' +
      '<meta name="robots" content="index,follow">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta property="og:title" content="Contact us | Example">' +
      '<meta property="og:image" content="https://example.com/social-preview.png">' +
      '<meta name="twitter:card" content="summary_large_image">'
    )

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })
    const headMeta = outline.headMeta

    expect(headMeta?.robots).toBe('index,follow')
    expect(headMeta?.viewport).toBe('width=device-width, initial-scale=1')
    expect(headMeta?.openGraph?.['og:title']).toBe('Contact us | Example')
    expect(headMeta?.openGraph?.['og:image']).toBe('https://example.com/social-preview.png')
    expect(headMeta?.twitter?.['twitter:card']).toBe('summary_large_image')

    const description = headMeta?.meta?.find(entry => entry.name === 'description')
    expect(description?.content).toBe('What this page is about')
  })

  it('does not clip a long description or preview image at 160 characters', async () => {
    // The default attribute cap is 160, tuned for body attributes. A meta
    // description sits right at that length by SEO convention and an og:image
    // is a full URL, so the head needs its own, larger cap.
    const longDescription = 'A '.repeat(150) + 'end.'
    const longImageUrl = 'https://example.com/' + 'very-long-path-segment/'.repeat(10) + 'image.png'
    expect(longDescription.length).toBeGreaterThan(160)
    expect(longImageUrl.length).toBeGreaterThan(160)

    serveHead(
      `<meta name="description" content="${longDescription}">` +
      `<meta property="og:image" content="${longImageUrl}">`
    )

    const outline = await getWebFetchTools().fetchOutline({ url: 'https://example.com/' })
    const headMeta = outline.headMeta

    expect(headMeta?.meta?.find(entry => entry.name === 'description')?.content).toBe(longDescription)
    expect(headMeta?.openGraph?.['og:image']).toBe(longImageUrl)
  })
})
