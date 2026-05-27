import { collapseDuplicateListingSurfaces } from '../structural-deduplication-processor'
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
          { title: 'Introducing AI Ambient Scribes to the RCH!', image: { src: { url: '/ai.jpg' } } },
          { title: 'Do you have a clinic appointment?', image: { src: { url: '/clinic.jpg' } } },
          { title: 'Teen Health Info fact sheets now live', image: { src: { url: '/teen.jpg' } } },
        ],
      }),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Nicotine use among teens' },
          { title: 'Introducing AI Ambient Scribes to the RCH!' },
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
        heading: 'RCH News',
        pinned: [
          { title: 'Hope at last for butterfly children' },
          { title: 'A visit from the Duke and Duchess of Sussex' },
        ],
      }),
      component('card-grid', {
        heading: 'RCH News',
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
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://blogs.rch.org.au/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://blogs.rch.org.au/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://blogs.rch.org.au/news/tommy/' } },
        ],
      }),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://blogs.rch.org.au/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://blogs.rch.org.au/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://blogs.rch.org.au/news/tommy/' } },
        ],
      }),
    ]

    expect(collapseDuplicateListingSurfaces(components)).toEqual([components[0]])
  })

  it('collapses RCH home repeated news cluster while preserving unrelated sections', () => {
    const components = [
      component('hero-carousel', { slides: [{ heading: 'Hero' }] }),
      component('hero-with-image', { heading: 'Travel a long way', image: { src: { url: '/travel.jpg' } } }),
      component('card-grid', { cards: [{ title: 'Your guide to the RCH' }, { title: 'Find a doctor' }] }),
      component('content-feed', {
        heading: 'RCH News',
        pinned: [{ title: 'Hope at last for butterfly children', href: { url: 'https://blogs.rch.org.au/news/hope/' } }],
      }),
      component('card-grid', {
        cards: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://blogs.rch.org.au/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://blogs.rch.org.au/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://blogs.rch.org.au/news/tommy/' } },
        ],
      }),
      component('card-grid', {
        heading: 'RCH News',
        cards: [
          { title: 'Emma’s story', href: { url: 'https://blogs.rch.org.au/news/emma/' } },
          { title: 'Chief of Medicine named as finalist for Human Rights Medal', href: { url: 'https://blogs.rch.org.au/news/chief/' } },
          { title: 'Hazel’s story: little fighter from the farm', href: { url: 'https://blogs.rch.org.au/news/hazel/' } },
          { title: 'Hope at last for butterfly children', href: { url: 'https://blogs.rch.org.au/news/hope/' } },
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://blogs.rch.org.au/news/duke/' } },
        ],
      }),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'A visit from the Duke and Duchess of Sussex', href: { url: 'https://blogs.rch.org.au/news/duke/' } },
          { title: 'Media release: Parents in the dark about teens’ nicotine use', href: { url: 'https://blogs.rch.org.au/news/nicotine/' } },
          { title: 'Tommy the fearless farm boy', href: { url: 'https://blogs.rch.org.au/news/tommy/' } },
        ],
      }),
      component('content-feed', {
        heading: "The Royal Children's Hospital",
        pinned: [
          { title: 'Emma’s story', href: { url: 'https://blogs.rch.org.au/news/emma/' } },
          { title: 'Chief of Medicine named as finalist for Human Rights Medal', href: { url: 'https://blogs.rch.org.au/news/chief/' } },
          { title: 'Hazel’s story: little fighter from the farm', href: { url: 'https://blogs.rch.org.au/news/hazel/' } },
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
})
