import { collapseDuplicateListingSurfaces, removeEmptyFooterArtifacts } from '../structural-deduplication-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

function component(type: string, content: Record<string, unknown>): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content,
  }
}

describe('collapseDuplicateListingSurfaces', () => {
  it('drops no-image responsive card lists that duplicate recent visible surfaces', () => {
    const components = [
      component('hero-with-image', { heading: 'Appointment notifications now straight to your phone' }),
      component('card-grid', {
        cards: [
          { title: 'Nicotine use among teens', image: { src: { url: '/nicotine.jpg' } } },
          { title: 'Introducing AI Ambient Scribes to the Example Health!', image: { src: { url: '/ai.jpg' } } },
          { title: 'Do you have a clinic appointment?', image: { src: { url: '/clinic.jpg' } } },
          { title: 'Teen Health Info fact sheets now live', image: { src: { url: '/teen.jpg' } } },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Nicotine use among teens' },
          { title: 'Introducing AI Ambient Scribes to the Example Health!' },
          { title: 'Do you have a clinic appointment?' },
          { title: 'Teen Health Info fact sheets now live' },
        ],
      }),
    ]

    const result = collapseDuplicateListingSurfaces(components)

    expect(result.map(entry => entry.content)).toHaveLength(2)
    expect(result).not.toContain(components[2])
  })

  it('drops repeated news listing variants with overlapping item titles', () => {
    const components = [
      component('content-feed', {
        heading: 'Health News',
        pinned: [
          { title: 'Hope at last for butterfly children' },
          { title: 'A visit from the Duke and Duchess of Sussex' },
        ],
      }),
      component('card-grid', {
        heading: 'Health News',
        cards: [
          { title: 'Hope at last for butterfly children', image: { src: { url: '/hope.jpg' } } },
          { title: 'A visit from the Duke and Duchess of Sussex', image: { src: { url: '/duke.jpg' } } },
          { title: 'Emma’s story', image: { src: { url: '/emma.jpg' } } },
          { title: 'Hazel’s story: little fighter from the farm', image: { src: { url: '/hazel.jpg' } } },
        ],
      }),
      component('content-feed', {
        heading: 'News',
        pinned: [
          { title: 'Emma’s story' },
          { title: 'Hazel’s story: little fighter from the farm' },
        ],
      }),
    ]

    const result = collapseDuplicateListingSurfaces(components)

    expect(result).toEqual([components[1]])
  })

  it('keeps legitimate repeated sections with distinct item titles', () => {
    const components = [
      component('card-grid', {
        heading: 'Programs',
        cards: [{ title: 'Emergency care' }, { title: 'Telehealth' }],
      }),
      component('card-grid', {
        heading: 'Programs',
        cards: [{ title: 'Research grants' }, { title: 'Clinical trials' }],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('does not let non-listing hero titles cause listing removal', () => {
    const components = [
      component('hero-with-image', { heading: 'Emergency care Telehealth Research grants' }),
      component('card-grid', {
        heading: 'Programs',
        cards: [
          { title: 'Emergency care' },
          { title: 'Telehealth' },
          { title: 'Research grants' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('does not use an already dropped variant to remove a later legitimate listing', () => {
    const components = [
      component('card-grid', {
        heading: 'Featured',
        cards: [
          { title: 'Alpha', image: { src: { url: '/alpha.jpg' } } },
          { title: 'Beta', image: { src: { url: '/beta.jpg' } } },
          { title: 'Gamma', image: { src: { url: '/gamma.jpg' } } },
        ],
      }),
      component('card-grid', {
        heading: 'Featured',
        cards: [
          { title: 'Alpha' },
          { title: 'Beta' },
          { title: 'Gamma' },
        ],
      }),
      component('card-grid', {
        heading: 'Featured',
        cards: [
          { title: 'Gamma' },
          { title: 'Delta' },
          { title: 'Epsilon' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0], components[2]])
  })

  it('drops exact duplicate editorial listings across card-grid and content-feed', () => {
    const components = [
      component('card-grid', {
        cards: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://news.example.org/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://news.example.org/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://news.example.org/news/tommy/' } },
        ],
      }),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://news.example.org/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://news.example.org/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://news.example.org/news/tommy/' } },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0]])
  })

  it('drops no-image card grids that repeat prior hero-carousel slide titles', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          { heading: 'Appointment notifications now straight to your phone' },
          { heading: 'Nicotine use among teens' },
          { heading: 'Introducing AI Ambient Scribes to the Example Health!' },
          { heading: 'Do you have a clinic appointment?' },
          { heading: 'Teen Health Info fact sheets now live' },
          { heading: 'My Health Portal: Your record at your fingertips' },
        ],
      }),
      component('hero-with-image', { heading: 'Travel a long way to get to the Example Health?' }),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Teens and food' },
          { title: 'Nicotine use among teens' },
          { title: 'Introducing AI Ambient Scribes to the Example Health!' },
          { title: 'Do you have a clinic appointment?' },
          { title: 'Teen Health Info fact sheets now live' },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Your guide to the Example Health' },
          { title: 'Kids Health Info' },
          { title: 'Clinical Practice Guidelines' },
          { title: 'My Health Portal' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([
      components[0],
      components[1],
      components[3],
    ])
  })

  it('drops single hero and CTA fragments that repeat prior hero-carousel slide titles', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          {
            heading: 'Appointment notifications now straight to your phone',
            body: 'Appointment copy',
          },
          {
            heading: 'Flu 2026',
            body: 'Flu copy',
          },
          {
            heading: 'Introducing AI Ambient Scribes to the Example Health!',
            body: 'AI copy',
          },
        ],
      }),
      component('cta-banner', {
        heading: 'Appointment notifications now straight to your phone',
        subheading: 'Appointment copy',
      }),
      component('cta-banner', {
        heading: 'Flu 2026',
        subheading: 'Flu copy',
      }),
      component('hero-banner', {
        heading: 'Introducing AI Ambient Scribes to the Example Health!',
        body: 'AI copy',
      }),
      component('card-grid', {
        cards: [
          { title: 'Your guide to the Example Health' },
          { title: 'Kids Health Info' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([
      components[0],
      components[4],
    ])
  })

  it('keeps single fragments that do not repeat hero-carousel slide titles', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          { heading: 'Featured story one' },
          { heading: 'Featured story two' },
        ],
      }),
      component('cta-banner', {
        heading: 'Book an appointment',
        subheading: 'Contact the clinic team.',
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('keeps fragments that only match carousel CTA labels or image alt text', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          {
            heading: 'Featured story one',
            image: { alt: 'Donate' },
            ctaButtons: [{ label: 'Donate' }],
          },
          {
            heading: 'Featured story two',
            ctaButtons: [{ label: 'Learn more' }],
          },
        ],
      }),
      component('cta-banner', {
        heading: 'Donate',
        subheading: 'Support the hospital foundation.',
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('keeps no-image card grids that do not mostly repeat hero-carousel slides', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          { heading: 'Featured story one' },
          { heading: 'Featured story two' },
          { heading: 'Featured story three' },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Program one' },
          { title: 'Program two' },
          { title: 'Program three' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('drops no-image grids that recap a recent sequence of extracted hero slides', () => {
    const components = [
      component('hero-with-image', { heading: 'Appointment notifications now straight to your phone' }),
      component('hero-with-image', { heading: 'Nicotine use among teens' }),
      component('hero-with-image', { heading: 'Introducing AI Ambient Scribes to the Example Health!' }),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Teens and food' },
          { title: 'Nicotine use among teens' },
          { title: 'Introducing AI Ambient Scribes to the Example Health!' },
          { title: 'Do you have a clinic appointment?' },
          { title: 'Teen Health Info fact sheets now live' },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Your guide to the Example Health' },
          { title: 'Kids Health Info' },
          { title: 'Clinical Practice Guidelines' },
          { title: 'My Health Portal' },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([
      components[0],
      components[1],
      components[2],
      components[4],
    ])
  })

  it('collapses Example Health home repeated news cluster while preserving unrelated sections', () => {
    const components = [
      component('hero-carousel', { slides: [{ heading: 'Hero' }] }),
      component('hero-with-image', { heading: 'Travel a long way', image: { src: { url: '/travel.jpg' } } }),
      component('card-grid', { cards: [{ title: 'Your guide to the Example Health' }, { title: 'Find a doctor' }] }),
      component('content-feed', {
        heading: 'Health News',
        pinned: [{ title: 'Hope at last for butterfly children', href: { url: 'https://news.example.org/news/hope/' } }],
      }),
      component('card-grid', {
        cards: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://news.example.org/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://news.example.org/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://news.example.org/news/tommy/' } },
        ],
      }),
      component('card-grid', {
        heading: 'Health News',
        cards: [
          { title: 'Emma’s story', href: { url: 'https://news.example.org/news/emma/' } },
          { title: 'Chief of Medicine named as finalist for Human Rights Medal', href: { url: 'https://news.example.org/news/chief/' } },
          { title: 'Hazel’s story: little fighter from the farm', href: { url: 'https://news.example.org/news/hazel/' } },
          { title: 'Hope at last for butterfly children', href: { url: 'https://news.example.org/news/hope/' } },
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://news.example.org/news/duke/' } },
        ],
      }),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://news.example.org/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://news.example.org/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://news.example.org/news/tommy/' } },
        ],
      }),
      component('content-feed', {
        heading: "Example Health",
        pinned: [
          { title: 'Emma’s story', href: { url: 'https://news.example.org/news/emma/' } },
          { title: 'Chief of Medicine named as finalist for Human Rights Medal', href: { url: 'https://news.example.org/news/chief/' } },
          { title: 'Hazel’s story: little fighter from the farm', href: { url: 'https://news.example.org/news/hazel/' } },
        ],
      }),
      component('card-grid', { cards: [{ title: 'Donate' }, { title: 'Volunteer' }] }),
    ]

    const result = collapseDuplicateListingSurfaces(components)

    expect(result).toEqual([
      components[0],
      components[1],
      components[2],
      components[4],
      components[5],
      components[8],
    ])
  })

  it('drops one-card feature repeats after the source-backed feature grid', () => {
    const components = [
      component('card-grid', {
        cards: [
          { title: 'Emergency Department status', image: { src: { url: '/ed.png' } } },
          { title: 'Teen Health Info fact sheets', image: { src: { url: '/teen.png' } } },
          { title: 'Translation resources', image: { src: { url: '/translation.png' } } },
          { title: 'Telehealth appointments', image: { src: { url: '/telehealth.png' } } },
        ],
      }),
      component('card-grid', {
        heading: 'Translation resources',
        cards: [
          { title: 'Translation resources', image: { src: { url: '/translation.png' } } },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0]])
  })

  it('drops two-column blocks that only contain source navigation crumbs and a heading', () => {
    const components = [
      component('cta-banner', { heading: 'Support Us' }),
      component('two-column', {
        leftColumn: [
          {
            type: 'sidemenu',
            content: {
              props: {
                items: [{ label: 'About the Example Health', href: { path: '/example-health/about/' } }],
              },
            },
          },
        ],
        rightColumn: [
          {
            type: 'breadcrumbs',
            content: { props: { items: [{ label: 'Example Health', href: '/' }] } },
          },
          {
            type: 'html-block',
            content: { props: { bodyHtml: "<h1>Example Health</h1>" } },
          },
        ],
      }),
      component('footer', { columns: [] }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0], components[2]])
  })

  it('keeps sidebar layouts when they include real body content', () => {
    const components = [
      component('two-column', {
        leftColumn: [
          {
            type: 'sidemenu',
            content: { props: { items: [{ label: 'About', href: '/about/' }] } },
          },
        ],
        rightColumn: [
          {
            type: 'html-block',
            content: { props: { bodyHtml: '<h1>About</h1><p>Useful page body.</p>' } },
          },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })

  it('drops top-level card grids that duplicate nested two-column listing cards', () => {
    const components = [
      component('two-column', {
        leftColumn: [
          {
            type: 'card-grid',
            content: {
              cards: [
                {
                  title: 'Emergency Department status',
                  description: 'View the page for a real time guide to how busy we are.',
                  image: { src: { url: '/ed-home-lg.png' } },
                },
              ],
            },
          },
        ],
        rightColumn: [
          {
            type: 'card-grid',
            content: {
              cards: [
                {
                  title: 'Teen Health Info fact sheets',
                  description: 'for young people aged 12 to 25.',
                  image: { src: { url: '/poll.png' } },
                },
              ],
            },
          },
        ],
      }),
      component('card-grid', {
        cards: [
          {
            title: 'Emergency Department status',
            description: 'View the page for a real time guide to how busy we are.',
            image: { src: { url: '/ed.png' } },
          },
          {
            title: 'Teen Health Info fact sheets',
            description: 'for young people aged 12 to 25.',
            image: { src: { url: '/poll-sm.png' } },
          },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0]])
  })

  it('keeps later card grids with additional distinct cards beyond a nested two-column listing', () => {
    const components = [
      component('two-column', {
        leftColumn: [
          {
            type: 'card-grid',
            content: {
              cards: [{ title: 'Emergency Department status', image: { src: { url: '/ed-home-lg.png' } } }],
            },
          },
        ],
        rightColumn: [
          {
            type: 'card-grid',
            content: {
              cards: [{ title: 'Teen Health Info fact sheets', image: { src: { url: '/poll.png' } } }],
            },
          },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Emergency Department status', image: { src: { url: '/ed.png' } } },
          { title: 'Teen Health Info fact sheets', image: { src: { url: '/poll-sm.png' } } },
          { title: 'Translation resources', image: { src: { url: '/translation.png' } } },
          { title: 'Telehealth appointments', image: { src: { url: '/telehealth.png' } } },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual(components)
  })
})

describe('removeEmptyFooterArtifacts', () => {
  it('drops footers with only empty arrays and styling', () => {
    const components = [
      component('navbar', { menuItems: [{ label: 'Home' }] }),
      component('footer', {
        columns: [],
        legalLinks: [],
        socialLinks: [],
        backgroundColor: '#577581',
      }),
    ]

    expect(removeEmptyFooterArtifacts(components)).toEqual([components[0]])
  })

  it('keeps footers with meaningful imported content', () => {
    const components = [
      component('footer', {
        columns: [
          {
            title: 'Support',
            links: [{ label: 'Contact', href: '/contact' }],
          },
        ],
        backgroundColor: '#577581',
      }),
      component('footer', {
        copyright: '© 2026 Healthdirect',
      }),
    ]

    expect(removeEmptyFooterArtifacts(components)).toEqual(components)
  })
})
