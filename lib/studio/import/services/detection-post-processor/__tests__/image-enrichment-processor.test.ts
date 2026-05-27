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
        <img src="https://www.rch.org.au/assets/RCH-Master-500-000.png" alt="RCH">
        <img src="https://www.rch.org.au/assets/flags/vietnam.png" alt="Vietnamese">
        <img src="https://www.rch.org.au/assets/auslan-interpreter.svg" alt="Auslan">
        <h2>Emergency Department</h2>
        <p>Emergency Department care</p>
        <img src="/uploaded/ed-waiting-room.jpg" alt="Emergency Department waiting room">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              mediaId: 'detected:ed-waiting-room',
              mediaType: 'image',
              url: 'https://www.rch.org.au/uploaded/ed-waiting-room.jpg',
            },
            alt: 'Emergency Department waiting room',
          },
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('facebook.com/tr')
    expect(JSON.stringify(result[0].content)).not.toContain('RCH-Master')
    expect(JSON.stringify(result[0].content)).not.toContain('flags/vietnam')
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
      pageUrl: 'https://www.rch.org.au/home/',
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
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: 'https://www.rch.org.au/uploaded/red-flag-symptoms.jpg',
            },
          },
        },
      ],
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
      pageUrl: 'https://www.luminary.com/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: 'https://www.luminary.com/work/digital-strategy.jpg',
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
          subheading: 'Digital teams launch better products with Luminary',
          primaryButton: { label: 'Contact us', href: { type: 'external', url: 'https://www.luminary.com/contact/' } },
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Transform your digital experience</h2>
        <p>Digital teams launch better products with Luminary</p>
        <img src="/assets/digital-experience.jpg" alt="Digital product team">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.luminary.com/',
    })

    expect(result[0].content).toMatchObject({
      backgroundImage: 'https://www.luminary.com/assets/digital-experience.jpg',
    })
    expect(JSON.stringify(result[0].content)).not.toContain('"image"')
    expect(JSON.stringify(result[0].content)).not.toContain('"images"')
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
      pageUrl: 'https://www.luminary.com/',
    })

    expect(result[0].content).toMatchObject({
      pinned: [
        {
          image: {
            src: {
              url: 'https://www.luminary.com/insights/composable-platforms.jpg',
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
      pageUrl: 'https://www.luminary.com/',
    })

    expect(result[0].content).toMatchObject({
      logos: [
        {
          id: 'acme',
          src: {
            url: 'https://www.luminary.com/logos/acme.svg',
          },
          alt: 'Acme',
          originalUrl: 'https://www.luminary.com/logos/acme.svg',
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
                url: 'https://www.luminary.com/logos/acme.svg',
              },
              alt: 'Acme',
              originalUrl: 'https://www.luminary.com/logos/acme.svg',
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
      pageUrl: 'https://www.luminary.com/',
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
      pageUrl: 'https://www.luminary.com/',
    })

    expect(result[0].content).toEqual({
      cards: [{ title: 'Services', description: 'Digital strategy and product delivery' }],
    })
    expect(result[1].content).toEqual({
      caption: 'Trusted by Acme and Globex',
      logos: [],
    })
  })
})
