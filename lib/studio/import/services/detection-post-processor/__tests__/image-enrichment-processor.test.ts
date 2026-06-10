import { enrichComponentImages } from '../image-enrichment-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

describe('image enrichment processor', () => {
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('rejects tracking, logo, flag, and interpreter utility images', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Emergency Department', description: 'Emergency Department care' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <img src="https://www.facebook.com/tr?id=123" alt="">
        <img src="https://health.example.org/TemplateAssets/images/global/site-logo.png" alt="Example Health">
        <img src="https://health.example.org/assets/flags/vietnam.png" alt="Vietnamese">
        <img src="/TemplateAssets/images/global/community_flag.png" alt="Community Flag">
        <img src="/SiteAssets/images/global/inclusion_flag.png" alt="Inclusion Flag">
        <img src="https://health.example.org/assets/auslan-interpreter.svg" alt="Auslan">
        <h2>Emergency Department</h2>
        <p>Emergency Department care</p>
        <img src="/uploaded/ed-waiting-room.jpg" alt="Emergency Department waiting room">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://health.example.org/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              mediaId: 'detected:ed-waiting-room',
              mediaType: 'image',
              url: 'https://health.example.org/uploaded/ed-waiting-room.jpg',
            },
            alt: 'Emergency Department waiting room',
          },
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('facebook.com/tr')
    expect(JSON.stringify(result[0].content)).not.toContain('site-logo')
    expect(JSON.stringify(result[0].content)).not.toContain('flags/vietnam')
    expect(JSON.stringify(result[0].content)).not.toContain('community_flag')
    expect(JSON.stringify(result[0].content)).not.toContain('inclusion_flag')
    expect(JSON.stringify(result[0].content)).not.toContain('auslan-interpreter')
  })

  it('does not log added image when a matched candidate cannot mutate the component schema', () => {
    const components: DetectedComponent[] = [
      {
        type: 'text-block',
        component: 'text-block',
        confidence: 0.9,
        content: { heading: 'Emergency Department', body: 'Emergency Department care' },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Emergency Department</h2>
        <p>Emergency Department care</p>
        <img src="/uploaded/ed-waiting-room.jpg" alt="Emergency Department waiting room">
      </section>
    `

    enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://health.example.org/home/',
    })

    expect(logSpy).not.toHaveBeenCalledWith(
      '[ImageEnrichment] Added image to component:',
      expect.anything()
    )
    expect(logSpy).toHaveBeenCalledWith(
      '[ImageEnrichment] Skipped image candidate:',
      expect.objectContaining({ reason: 'schema_unsupported_or_no_item_match' })
    )
  })

  it('does not reject content images merely because the filename contains flag or logo', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Red flag symptoms', description: 'Red flag symptoms to monitor' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Red flag symptoms</h2>
        <p>Red flag symptoms to monitor</p>
        <img src="/uploaded/red-flag-symptoms.jpg" alt="Red flag symptoms">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://health.example.org/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: 'https://health.example.org/uploaded/red-flag-symptoms.jpg',
            },
          },
        },
      ],
    })
  })

  it('does not attach brand logo assets as card-grid content images', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Advertising tools', description: 'Advertising tools for publishers' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Advertising tools</h2>
        <p>Advertising tools for publishers</p>
        <img src="/media/img/logos/product/brand-wordmark.svg" alt="Brand wordmark">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://brand.example.com/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          title: 'Advertising tools',
          description: 'Advertising tools for publishers',
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('brand-wordmark')
  })

  it.each([
    'logo-design-workshop.jpg',
    'logo-design-workshop.webp',
    'logo-history.png',
  ])('keeps legitimate raster card image %s when the filename contains logo', (filename) => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Logo design workshop', description: 'Hands-on brand design training' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Logo design workshop</h2>
        <p>Hands-on brand design training</p>
        <img src="/uploads/${filename}" alt="Workshop participants sketching logos">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://brand.example.com/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: `https://brand.example.com/uploads/${filename}`,
            },
            alt: 'Workshop participants sketching logos',
          },
        },
      ],
    })
  })

  it('removes model-emitted utility flag images from card-grid cards', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          heading: 'Quick Links',
          cards: [
            {
              title: 'Community health',
              description: 'Cultural support services',
              image: {
                src: {
                  mediaId: 'detected:community_flag',
                  mediaType: 'image',
                  url: 'https://health.example.org/TemplateAssets/images/global/community_flag.png',
                },
                alt: 'Community Flag',
              },
            },
            {
              title: 'Inclusion support',
              description: 'Support services',
              image: {
                src: {
                  mediaId: 'detected:inclusion_flag',
                  mediaType: 'image',
                  url: 'https://health.example.org/SiteAssets/images/global/inclusion_flag.png',
                },
                alt: 'Inclusion Flag',
              },
            },
            {
              title: 'Regional community health',
              description: 'Cultural support services',
              image: {
                src: {
                  mediaId: 'detected:regional_community_flag',
                  mediaType: 'image',
                  url: 'https://health.example.org/SiteAssets/images/global/regional_community_flag.png',
                },
                alt: 'Regional Community Flag',
              },
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Quick Links</h2>
        <img src="/TemplateAssets/images/global/community_flag.png" alt="Community Flag">
        <img src="/SiteAssets/images/global/inclusion_flag.png" alt="Inclusion Flag">
        <img src="/SiteAssets/images/global/regional_community_flag.png" alt="Regional Community Flag">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://health.example.org/home/',
    })

    const content = result[0].content as { cards: Array<{ image?: unknown }> }
    expect(content.cards.every(card => card.image === undefined)).toBe(true)
    expect(result[0].metadata?.sourceEvidence).toMatchObject({
      nonContentCardImageRemoval: {
        reason: 'card-image-url-is-non-content',
        heading: 'Quick Links',
      },
    })
    expect(JSON.stringify(result[0].content)).not.toContain('community_flag')
    expect(JSON.stringify(result[0].content)).not.toContain('inclusion_flag')
    expect(JSON.stringify(result[0].content)).not.toContain('torres_strait')
  })

  it('removes model-emitted brand logo images from card-grid cards', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          heading: 'Products',
          cards: [
            {
              title: 'Advertising tools',
              description: 'Advertising tools for publishers',
              image: {
                src: {
                  mediaId: 'detected:brand-wordmark',
                  mediaType: 'image',
                  url: 'https://brand.example.com/media/img/logos/product/brand-wordmark.svg',
                },
                alt: 'Brand wordmark',
              },
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Products</h2>
        <article>
          <h3>Advertising tools</h3>
          <p>Advertising tools for publishers</p>
          <img src="/media/img/logos/product/brand-wordmark.svg" alt="Brand wordmark">
        </article>
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://brand.example.com/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          title: 'Advertising tools',
          description: 'Advertising tools for publishers',
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('brand-wordmark')
    expect(result[0].metadata?.sourceEvidence).toMatchObject({
      nonContentCardImageRemoval: {
        reason: 'card-image-url-is-non-content',
        heading: 'Products',
      },
    })
  })

  it('removes model-emitted utility flag images from headingless card-grid cards', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [
            {
              title: 'Community health',
              image: {
                src: {
                  mediaId: 'detected:community_flag',
                  mediaType: 'image',
                  url: 'https://health.example.org/SiteAssets/images/global/community_flag.png',
                },
                alt: 'Community Flag',
              },
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <img src="/SiteAssets/images/global/community_flag.png" alt="Community Flag">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://health.example.org/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          title: 'Community health',
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('community_flag')
    expect(result[0].metadata?.sourceEvidence).toMatchObject({
      nonContentCardImageRemoval: {
        reason: 'card-image-url-is-non-content',
      },
    })
  })

  it('matches card images using description text, not only title/body', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Services', description: 'Digital strategy and product delivery' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h3>Services</h3>
        <p>Digital strategy and product delivery</p>
        <img src="/work/digital-strategy.jpg" alt="Digital strategy workshop">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: 'https://agency.example.com/work/digital-strategy.jpg',
            },
            alt: 'Digital strategy workshop',
          },
        },
      ],
    })
  })

  it('adds matched CTA banner images to the supported backgroundImage field', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-banner',
        component: 'cta-banner',
        confidence: 0.9,
        content: {
          heading: 'Transform your digital experience',
          subheading: 'Digital teams launch better products with Example Agency',
          primaryButton: { label: 'Contact us', href: { type: 'external', url: 'https://agency.example.com/contact/' } },
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Transform your digital experience</h2>
        <p>Digital teams launch better products with Example Agency</p>
        <img src="/assets/digital-experience.jpg" alt="Digital product team">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toMatchObject({
      backgroundImage: 'https://agency.example.com/assets/digital-experience.jpg',
    })
    expect(JSON.stringify(result[0].content)).not.toContain('"image"')
    expect(JSON.stringify(result[0].content)).not.toContain('"images"')
  })

  it('adds matched CTA banner images from div-based source markup', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-banner',
        component: 'cta-banner',
        confidence: 0.9,
        content: {
          heading: 'Book an appointment',
          subheading: 'Talk to the digital care team',
        },
      },
    ]
    const domSnapshot = `
      <main>
        <div class="homepage-cta">
          <h2>Book an appointment</h2>
          <p>Talk to the digital care team</p>
          <img src="/appointments/team.jpg" alt="Care team">
        </div>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/',
    })

    expect(result[0].content).toMatchObject({
      backgroundImage: 'https://www.example.com/appointments/team.jpg',
    })
  })

  it('does not use an unrelated earlier main image for div-based CTA markup', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-banner',
        component: 'cta-banner',
        confidence: 0.9,
        content: {
          heading: 'Book an appointment',
          subheading: 'Talk to the digital care team',
        },
      },
    ]
    const domSnapshot = `
      <main>
        <div class="article-card">
          <h2>Article</h2>
          <p>Book an appointment with unrelated copy elsewhere in main.</p>
          <img src="/articles/unrelated.jpg" alt="Unrelated">
        </div>
        <div class="homepage-cta">
          <h2>Book an appointment</h2>
          <p>Talk to the digital care team</p>
          <img src="/appointments/team.jpg" alt="Care team">
        </div>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/',
    })

    expect(result[0].content).toMatchObject({
      backgroundImage: 'https://www.example.com/appointments/team.jpg',
    })
  })

  it('matches content-feed images using excerpt text', () => {
    const components: DetectedComponent[] = [
      {
        type: 'content-feed',
        component: 'content-feed',
        confidence: 0.9,
        content: {
          heading: 'Insights',
          pinned: [{ title: 'Latest article', excerpt: 'Composable platforms improve digital delivery' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h3>Latest article</h3>
        <p>Composable platforms improve digital delivery</p>
        <img src="/insights/composable-platforms.jpg" alt="Composable platform diagram">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toMatchObject({
      pinned: [
        {
          image: {
            src: {
              url: 'https://agency.example.com/insights/composable-platforms.jpg',
            },
            alt: 'Composable platform diagram',
          },
        },
      ],
    })
  })

  it('adds matched logo images to logo-cloud logos using the component schema', () => {
    const components: DetectedComponent[] = [
      {
        type: 'logo-cloud',
        component: 'logo-cloud',
        confidence: 0.9,
        content: {
          caption: 'Trusted by Acme and Globex',
          logos: [],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <p>Trusted by Acme and Globex</p>
        <img src="/logos/acme.svg" alt="Acme">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toMatchObject({
      logos: [
        {
          id: 'acme',
          src: {
            url: 'https://agency.example.com/logos/acme.svg',
          },
          alt: 'Acme',
          originalUrl: 'https://agency.example.com/logos/acme.svg',
        },
      ],
    })
  })

  it('does not duplicate existing logo URLs', () => {
    const components: DetectedComponent[] = [
      {
        type: 'logo-cloud',
        component: 'logo-cloud',
        confidence: 0.9,
        content: {
          caption: 'Trusted by Acme and Globex',
          logos: [
            {
              id: 'acme',
              src: {
                mediaId: 'detected:acme',
                mediaType: 'image',
                url: 'https://agency.example.com/logos/acme.svg',
              },
              alt: 'Acme',
              originalUrl: 'https://agency.example.com/logos/acme.svg',
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <p>Trusted by Acme and Globex</p>
        <img src="/logos/acme.svg" alt="Acme">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect((result[0].content as { logos: unknown[] }).logos).toHaveLength(1)
  })

  it('does not add unrelated images to listing or logo components', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Services', description: 'Digital strategy and product delivery' }],
        },
      },
      {
        type: 'logo-cloud',
        component: 'logo-cloud',
        confidence: 0.9,
        content: {
          caption: 'Trusted by Acme and Globex',
          logos: [],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <p>Careers and office culture</p>
        <img src="/careers/team.jpg" alt="Office team">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toEqual({
      cards: [{ title: 'Services', description: 'Digital strategy and product delivery' }],
    })
    expect(result[1].content).toEqual({
      caption: 'Trusted by Acme and Globex',
      logos: [],
    })
  })

  it('does not attach later author thumbnails to a text-only Example Agency framework grid', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          heading: 'Our flexible 3 stage framework to craft digital experiences',
          cards: [
            { title: 'Explore', description: 'Discover what matters before you build.' },
            {
              title: 'Build',
              description: 'Bring specialists together to build the experience.',
              image: {
                src: {
                  url: 'https://agency.example.com/authors/Adam_thumb.jpg',
                  mediaType: 'image',
                },
                alt: 'Adam',
              },
            },
            { title: 'Grow', description: 'Measure and improve after launch.' },
          ],
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="ebg-framework">
          <h2>Our flexible 3 stage framework to craft digital experiences</h2>
          <article><h3>Explore</h3><p>Discover what matters before you build.</p></article>
          <article><h3>Build</h3><p>Bring specialists together to build the experience.</p></article>
          <article><h3>Grow</h3><p>Measure and improve after launch.</p></article>
        </section>
        <section class="latest-guides">
          <h2>Latest guides</h2>
          <article>
            <h3>Build better teams</h3>
            <p>Bring specialists together to build the experience.</p>
            <img src="/authors/Adam_thumb.jpg" alt="Adam" />
          </article>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(JSON.stringify(result[0].content)).not.toContain('Adam_thumb')
    expect((result[0].content as { cards: Array<{ image?: unknown }> }).cards[1].image).toBeUndefined()
  })

  it('keeps legitimate unlinked card-grid images when the source section contains that image', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          heading: 'Care options',
          cards: [
            {
              title: 'Emergency care',
              description: 'Urgent treatment options',
              image: {
                src: {
                  url: 'https://www.example.com/images/emergency-care.jpg',
                  mediaType: 'image',
                },
                alt: 'Emergency care',
              },
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section>
          <h2>Care options</h2>
          <article>
            <picture><source srcset="/images/emergency-care.webp"></picture>
            <img src="/images/emergency-care.jpg" alt="Emergency care">
            <h3>Emergency care</h3>
            <p>Urgent treatment options</p>
          </article>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/',
    })

    expect((result[0].content as { cards: Array<{ image?: unknown }> }).cards[0].image).toBeDefined()
  })

  it('keeps legitimate unlinked card-grid images from CSS background source markup', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          heading: 'Care options',
          cards: [
            {
              title: 'Emergency care',
              description: 'Urgent treatment options',
              image: {
                src: {
                  url: 'https://www.example.com/images/emergency-care.jpg',
                  mediaType: 'image',
                },
                alt: 'Emergency care',
              },
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section>
          <h2>Care options</h2>
          <article style="background-image:url('/images/emergency-care.jpg')">
            <h3>Emergency care</h3>
            <p>Urgent treatment options</p>
          </article>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/',
    })

    expect((result[0].content as { cards: Array<{ image?: unknown }> }).cards[0].image).toBeDefined()
  })

  it('corrects a Example Agency CTA image when the existing image is from another source section', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-banner',
        component: 'cta-banner',
        confidence: 0.9,
        content: {
          heading: 'Example Agency has earned B Corp Certification',
          subheading: 'We are proud to be part of a global community balancing purpose and profit.',
          backgroundImage: {
            url: 'https://assets.example.com/EBG%20Graphic.png',
            mediaId: 'existing-wrong',
            mediaType: 'image',
          },
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="mega-menu-card">
          <h3>Explore. Build. Grow.</h3>
          <img src="https://assets.example.com/EBG%20Graphic.png" alt="Explore Build Grow" />
        </section>
        <section class="featured-cta-section">
          <h2>Example Agency has earned B Corp Certification</h2>
          <p>We are proud to be part of a global community balancing purpose and profit.</p>
          <img src="https://assets.example.com/B%20Corp%20Certified.png" alt="B Corp Certified" />
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    expect(result[0].content).toMatchObject({
      backgroundImage: {
        url: 'https://assets.example.com/B%20Corp%20Certified.png',
        mediaType: 'image',
      },
    })
  })

  it('reconciles Example Agency award logos to the matched logo section and removes unrelated images', () => {
    const components: DetectedComponent[] = [
      {
        type: 'logo-cloud',
        component: 'logo-cloud',
        confidence: 0.9,
        content: {
          caption: 'Awards and recognition',
          logos: [
            { id: 'webby', src: { url: 'https://assets.example.com/webby.svg' }, alt: 'Webby' },
            { id: 'byd', src: { url: 'https://assets.example.com/hero_BYD.png' }, alt: 'BYD' },
            { id: 'gptw-dupe', src: { url: 'https://assets.example.com/gptw.svg' }, alt: 'Great Place to Work' },
          ],
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="projects">
          <h2>Some of our latest projects</h2>
          <img src="https://assets.example.com/hero_BYD.png" alt="BYD" />
        </section>
        <section class="awards">
          <h2>Awards and recognition</h2>
          <img src="https://assets.example.com/webby.svg" alt="Webby" />
          <img src="https://assets.example.com/good-design.svg" alt="Good Design" />
          <img src="https://assets.example.com/gptw.svg" alt="Great Place to Work" />
          <img src="https://assets.example.com/driven-x-design.svg" alt="Driven x Design" />
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/',
    })

    const logos = (result[0].content as { logos: Array<{ alt: string }> }).logos
    expect(logos.map(logo => logo.alt)).toEqual([
      'Webby',
      'Good Design',
      'Great Place to Work',
      'Driven x Design',
    ])
    expect(JSON.stringify(result[0].content)).not.toContain('hero_BYD')
  })

  it('reconciles team-grid member photos from source resource image alt text without a DOM snapshot', () => {
    const wrongBobUrl = 'https://assets-us-01.kc-usercontent.com/site/files/5a2e6f3e-cea9-46e5-a13f-2d048137c95a/Bob_mid.jpg?w=300&fm=webp'
    const sourceBobUrl = 'https://assets-us-01.kc-usercontent.com/site/files/5a2e6e3f-cea9-46e5-a13f-2d048137c95a/Bob_mid.jpg?w=300&fm=webp'
    const components: DetectedComponent[] = [
      {
        type: 'team-grid',
        component: 'team-grid',
        confidence: 0.9,
        content: {
          heading: 'Our team',
          members: [
            {
              name: 'Bob Haring',
              title: 'Chief Technology Officer',
              photo: wrongBobUrl,
              profileUrl: 'https://agency.example.com/bridget',
            },
          ],
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://agency.example.com/about',
      resourcesSummary: {
        anchors: [
          {
            href: '/bob',
            textPreview: 'Bob Haring',
            pathId: 'main/team/a[4]',
          },
        ],
        images: [
          {
            src: sourceBobUrl,
            alt: 'Bob Haring',
            pathId: 'main/team/a[4]/img',
          },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect((result[0].content as { members: Array<{ photo?: string; photoAlt?: string; profileUrl?: string }> }).members[0]).toMatchObject({
      photo: sourceBobUrl,
      photoAlt: 'Bob Haring',
      profileUrl: 'https://agency.example.com/bob',
    })
    expect(result[0].metadata?.sourceEvidence).toMatchObject({
      teamGridImageCorrections: [
        {
          memberName: 'Bob Haring',
          previous: wrongBobUrl,
          replacement: sourceBobUrl,
          evidence: 'resources-summary',
        },
      ],
      teamGridLinkCorrections: [
        {
          memberName: 'Bob Haring',
          previous: 'https://agency.example.com/bridget',
          replacement: 'https://agency.example.com/bob',
          evidence: 'resources-summary',
        },
      ],
    })
  })

  it('repairs model-truncated image URLs from exact source image prefixes', () => {
    const truncatedUrl = 'https://assets-us-01.kc-usercontent.com/site/files/A%20Guide%20to%20Digital%20Product%20Strateg'
    const sourceUrl = 'https://assets-us-01.kc-usercontent.com/site/files/A%20Guide%20to%20Digital%20Product%20Strategy.jpg?h=474&fm=webp'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'A Guide to Digital Product Strategy',
          image: {
            src: {
              mediaId: 'detected:guide',
              mediaType: 'image',
              url: truncatedUrl,
            },
            originalUrl: truncatedUrl,
          },
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://agency.example.com/a-guide-to-digital-product-strategy-lp',
      resourcesSummary: {
        anchors: [],
        images: [
          {
            src: sourceUrl,
            alt: 'A Guide to Digital Product Strategy',
            pathId: 'main/hero/img',
          },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: sourceUrl,
        },
        originalUrl: sourceUrl,
      },
    })
    expect(result[0].metadata?.sourceEvidence).toMatchObject({
      truncatedImageUrlCorrections: [
        {
          previous: truncatedUrl,
          replacement: sourceUrl,
          evidence: 'resources-summary',
        },
        {
          previous: truncatedUrl,
          replacement: sourceUrl,
          evidence: 'resources-summary',
        },
      ],
    })
  })

  it('uses story-header hero images as content evidence for truncated URL repair', () => {
    const truncatedUrl = 'https://assets-us-01.kc-usercontent.com/site/files/A%20Guide%20to%20Digital%20Product%20Strateg'
    const sourceUrl = 'https://assets-us-01.kc-usercontent.com/site/files/A%20Guide%20to%20Digital%20Product%20Strategy.jpg?h=474&fm=webp'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'A Guide to Digital Product Strategy',
          image: {
            src: {
              mediaId: 'detected:guide',
              mediaType: 'image',
              url: truncatedUrl,
            },
          },
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="story-header header-image-crop">
          <div class="image-wrapper">
            <img src="${sourceUrl.replace(/&/g, '&amp;')}" alt="men holding a phone displaying online store">
          </div>
          <h1>A Guide to Digital Product Strategy</h1>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/a-guide-to-digital-product-strategy-lp',
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: sourceUrl,
        },
      },
    })
  })

  it('uses page-header hero images as content evidence for truncated URL repair', () => {
    const truncatedUrl = 'https://assets.example.com/pages/services-her'
    const sourceUrl = 'https://assets.example.com/pages/services-hero.jpg'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'Services',
          image: {
            src: {
              mediaId: 'detected:services',
              mediaType: 'image',
              url: truncatedUrl,
            },
          },
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="page-header">
          <img src="${sourceUrl}" alt="Services">
          <h1>Services</h1>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/services',
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: sourceUrl,
        },
      },
    })
  })

  it('does not use site-header wrapper images as content evidence for truncated URL repair', () => {
    const truncatedUrl = 'https://assets.example.com/nav/header-log'
    const sourceUrl = 'https://assets.example.com/nav/header-logo.png'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'Welcome',
          image: {
            src: {
              mediaId: 'detected:hero',
              mediaType: 'image',
              url: truncatedUrl,
            },
          },
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="site-header">
          <img src="${sourceUrl}" alt="Example logo">
          <nav>Home About Contact</nav>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.example.com/',
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: truncatedUrl,
        },
      },
    })
    expect(result[0].metadata?.sourceEvidence?.truncatedImageUrlCorrections).toBeUndefined()
  })

  it('does not rewrite complete image URLs when a longer source URL shares the prefix', () => {
    const completeUrl = 'https://assets.example.com/images/product.jpg'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'Product',
          image: {
            src: {
              mediaId: 'detected:product',
              mediaType: 'image',
              url: completeUrl,
            },
          },
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://www.example.com/',
      resourcesSummary: {
        anchors: [],
        images: [
          {
            src: 'https://assets.example.com/images/product.jpg?width=1200&format=webp',
            alt: 'Product',
          },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: completeUrl,
        },
      },
    })
    expect(result[0].metadata?.sourceEvidence?.truncatedImageUrlCorrections).toBeUndefined()
  })

  it('does not rewrite valid extensionless image-service URLs', () => {
    const extensionlessUrl = 'https://assets.example.com/image/abc123'
    const components: DetectedComponent[] = [
      {
        type: 'hero-with-image',
        component: 'hero-with-image',
        confidence: 0.95,
        content: {
          heading: 'Product',
          image: {
            src: {
              mediaId: 'detected:product',
              mediaType: 'image',
              url: extensionlessUrl,
            },
          },
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://www.example.com/',
      resourcesSummary: {
        anchors: [],
        images: [
          {
            src: 'https://assets.example.com/image/abc123-large.jpg',
            alt: 'Product',
          },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect(result[0].content).toMatchObject({
      image: {
        src: {
          url: extensionlessUrl,
        },
      },
    })
    expect(result[0].metadata?.sourceEvidence?.truncatedImageUrlCorrections).toBeUndefined()
  })

  it('does not replace team-grid member photos without an exact source alt/name match', () => {
    const existingUrl = 'https://assets.example.com/team/bob.jpg'
    const components: DetectedComponent[] = [
      {
        type: 'team-grid',
        component: 'team-grid',
        confidence: 0.9,
        content: {
          members: [
            {
              name: 'Bob Haring',
              photo: existingUrl,
            },
          ],
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://agency.example.com/about',
      resourcesSummary: {
        anchors: [],
        images: [
          {
            src: 'https://assets.example.com/team/alice.jpg',
            alt: 'Alice Smith',
            pathId: 'main/team/a[1]/img',
          },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect((result[0].content as { members: Array<{ photo?: string }> }).members[0].photo).toBe(existingUrl)
    expect(result[0].metadata?.sourceEvidence).toBeUndefined()
  })

  it('reconciles Example Agency-style team-grid photos and profile links from source DOM anchor markup', () => {
    const wrongBobUrl = 'https://assets-us-01.kc-usercontent.com/site/files/5a2e6f3e-cea9-46e5-a13f-2d048137c95a/Bob_mid.jpg?w=300&fm=webp'
    const sourceBobUrl = 'https://assets-us-01.kc-usercontent.com/site/files/5a2e6e3f-cea9-46e5-a13f-2d048137c95a/Bob_mid.jpg?w=300&fm=webp'
    const components: DetectedComponent[] = [
      {
        type: 'team-grid',
        component: 'team-grid',
        confidence: 0.9,
        content: {
          members: [
            {
              name: 'Bob Haring',
              photo: wrongBobUrl,
              profileUrl: 'https://agency.example.com/bridget',
            },
          ],
        },
      },
    ]
    const domSnapshot = `
      <main>
        <section class="team-list">
          <a class="team-member-item" href="/bob">
            <img src="${sourceBobUrl.replace(/&/g, '&amp;')}" alt="Bob Haring" />
            <span>Bob Haring</span>
            <span>Chief Technology Officer</span>
          </a>
        </section>
      </main>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://agency.example.com/about',
    })

    expect((result[0].content as { members: Array<{ photo?: string; profileUrl?: string }> }).members[0]).toMatchObject({
      photo: sourceBobUrl,
      profileUrl: 'https://agency.example.com/bob',
    })
  })

  it('does not replace team-grid photos or links when source member name matches are ambiguous', () => {
    const existingPhoto = 'https://assets.example.com/team/jordan-old.jpg'
    const existingProfileUrl = 'https://www.example.com/jordan-old'
    const components: DetectedComponent[] = [
      {
        type: 'team-grid',
        component: 'team-grid',
        confidence: 0.9,
        content: {
          members: [
            {
              name: 'Jordan Lee',
              photo: existingPhoto,
              profileUrl: existingProfileUrl,
            },
          ],
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://www.example.com/team',
      resourcesSummary: {
        anchors: [
          { href: '/team/jordan-a', textPreview: 'Jordan Lee', pathId: 'main/team/a[1]' },
          { href: '/speakers/jordan', textPreview: 'Jordan Lee', pathId: 'main/speakers/a[4]' },
        ],
        images: [
          { src: '/team/jordan-a.jpg', alt: 'Jordan Lee', pathId: 'main/team/a[1]/img' },
          { src: '/speakers/jordan.jpg', alt: 'Jordan Lee', pathId: 'main/speakers/a[4]/img' },
        ],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect((result[0].content as { members: Array<{ photo?: string; profileUrl?: string }> }).members[0]).toMatchObject({
      photo: existingPhoto,
      profileUrl: existingProfileUrl,
    })
    expect(result[0].metadata?.sourceEvidence).toBeUndefined()
  })

  it('reconciles team-grid manualMembers from source resources', () => {
    const components: DetectedComponent[] = [
      {
        type: 'team-grid',
        component: 'team-grid',
        confidence: 0.9,
        content: {
          manualMembers: [
            {
              name: 'Avery Stone',
              photo: 'https://assets.example.com/team/wrong.jpg',
              profileUrl: 'https://www.example.com/wrong',
            },
          ],
        },
      },
    ]

    const result = enrichComponentImages(components, {
      pageUrl: 'https://www.example.com/team',
      resourcesSummary: {
        anchors: [{ href: '/team/avery-stone', textPreview: 'Avery Stone', pathId: 'main/team/a[2]' }],
        images: [{ src: '/team/avery-stone.jpg', alt: 'Avery Stone', pathId: 'main/team/a[2]/img' }],
        videos: [],
        forms: [],
        links: [],
      },
    })

    expect((result[0].content as { manualMembers: Array<{ photo?: string; profileUrl?: string }> }).manualMembers[0]).toMatchObject({
      photo: 'https://www.example.com/team/avery-stone.jpg',
      profileUrl: 'https://www.example.com/team/avery-stone',
    })
  })
})
