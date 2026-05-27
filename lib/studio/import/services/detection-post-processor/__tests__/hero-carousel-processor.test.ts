import { collapseAdjacentHeroSlides, enrichHeroCarouselFromSource } from '../hero-carousel-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

function component(type: string, content: Record<string, unknown>, region = 'main'): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    metadata: { region },
    content,
  }
}

describe('collapseAdjacentHeroSlides', () => {
  it('collapses adjacent top hero-with-image components into one hero carousel', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'First slide',
        body: 'First body',
        image: { src: { url: '/first.jpg', mediaType: 'image', mediaId: 'first' }, alt: 'First' },
        ctaButtons: [{ label: 'Read more', href: { type: 'internal', path: '/first' } }],
        alignment: 'left',
      }, 'hero'),
      component('hero-with-image', {
        heading: 'Second slide',
        subheading: 'Second subheading',
        image: { src: { url: '/second.jpg', mediaType: 'image', mediaId: 'second' }, alt: 'Second' },
      }, 'hero'),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
    ]

    const result = collapseAdjacentHeroSlides(components)

    expect(result).toHaveLength(3)
    expect(result[1].type).toBe('hero-carousel')
    expect(result[1].content).toMatchObject({
      autoPlay: true,
      pauseOnHover: true,
      showIndicators: true,
      showControls: true,
      loop: true,
      height: 'large',
      transitionStyle: 'fade',
      alignment: 'left',
      slides: [
        {
          id: 'slide-1',
          heading: 'First slide',
          body: 'First body',
          image: { src: { url: '/first.jpg', mediaType: 'image', mediaId: 'first' }, alt: 'First' },
          ctaButtons: [{ label: 'Read more', href: { type: 'internal', path: '/first' } }],
        },
        {
          id: 'slide-2',
          heading: 'Second slide',
          subheading: 'Second subheading',
          image: { src: { url: '/second.jpg', mediaType: 'image', mediaId: 'second' }, alt: 'Second' },
        },
      ],
    })
  })

  it('collapses top hero slides even when model emitted non-hero region metadata', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'First slide',
        image: { src: { url: '/first.jpg' } },
      }),
      component('hero-with-image', {
        heading: 'Second slide',
        image: { src: { url: '/second.jpg' } },
      }),
    ]

    const result = collapseAdjacentHeroSlides(components)

    expect(result).toHaveLength(2)
    expect(result[1].type).toBe('hero-carousel')
    expect(result[1].metadata?.region).toBe('hero')
  })

  it('collapses a top hero followed by a hero-image listing into one carousel', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'Appointment notifications',
        body: 'Appointment copy',
        image: { src: { url: '/hero_images/appointment-carousel.jpg' } },
      }, 'hero'),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          {
            title: 'Nicotine use among teens',
            excerpt: 'Poll copy',
            href: { type: 'external', url: 'https://example.com/poll' },
            image: { src: { url: '/hero_images/poll-homepage.jpg' }, alt: 'Poll' },
          },
          {
            title: 'AI Ambient Scribes',
            excerpt: 'Scribe copy',
            href: { type: 'internal', path: '/news/ai' },
            image: { src: { url: '/hero_images/ai-homepage.jpg' }, alt: 'AI' },
          },
        ],
      }),
      component('hero-with-image', {
        heading: 'Travel a long way',
        image: { src: { url: '/hero_images/travel.jpg' } },
      }, 'hero'),
    ]

    const result = collapseAdjacentHeroSlides(components)

    expect(result).toHaveLength(3)
    expect(result[1].type).toBe('hero-carousel')
    expect(result[1].content.slides).toHaveLength(3)
    expect((result[1].content.slides as any[]).map(slide => slide.heading)).toEqual([
      'Appointment notifications',
      'Nicotine use among teens',
      'AI Ambient Scribes',
    ])
    expect(result[2]).toBe(components[3])
  })

  it('preserves listing images from imageUrl and thumbnail fields when building slides', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'Main hero',
        image: { src: { url: '/hero_images/main.jpg' } },
      }, 'hero'),
      component('card-grid', {
        cards: [
          {
            title: 'Image URL slide',
            imageUrl: '/hero_images/image-url-slide.jpg',
          },
          {
            title: 'Thumbnail slide',
            thumbnail: { url: '/homepage-thumbnail-slide.jpg', alt: 'Thumbnail alt' },
          },
        ],
      }),
    ]

    const result = collapseAdjacentHeroSlides(components)
    const slides = result[1].content.slides as any[]

    expect(slides[1].image).toEqual({
      src: {
        mediaId: 'detected:image-url-slide',
        mediaType: 'image',
        url: '/hero_images/image-url-slide.jpg',
      },
      alt: 'Image URL slide',
    })
    expect(slides[2].image).toEqual({
      src: {
        mediaId: 'detected:thumbnail-slide',
        mediaType: 'image',
        url: '/homepage-thumbnail-slide.jpg',
      },
      alt: 'Thumbnail alt',
    })
  })

  it('does not collapse a single hero-with-image component', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'Only slide',
        image: { src: { url: '/only.jpg' } },
      }, 'hero'),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
    ]

    expect(collapseAdjacentHeroSlides(components)).toEqual(components)
  })

  it('does not collapse adjacent hero components without images', () => {
    const components = [
      component('hero-with-image', { heading: 'First' }, 'hero'),
      component('hero-with-image', { heading: 'Second' }, 'hero'),
    ]

    expect(collapseAdjacentHeroSlides(components)).toEqual(components)
  })

  it('does not collapse later-page hero components after main content', () => {
    const components = [
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
      component('hero-with-image', {
        heading: 'First later hero',
        image: { src: { url: '/first.jpg' } },
      }, 'hero'),
      component('hero-with-image', {
        heading: 'Second later hero',
        image: { src: { url: '/second.jpg' } },
      }, 'hero'),
    ]

    expect(collapseAdjacentHeroSlides(components)).toEqual(components)
  })

  it('does not collapse hero components separated by main content', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'First hero',
        image: { src: { url: '/first.jpg' } },
      }, 'hero'),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
      component('hero-with-image', {
        heading: 'Second hero',
        image: { src: { url: '/second.jpg' } },
      }, 'hero'),
    ]

    expect(collapseAdjacentHeroSlides(components)).toEqual(components)
  })
})

describe('enrichHeroCarouselFromSource', () => {
  const sourceCarouselHtml = `
    <div id="rch-featured-carousel" class="carousel slide hidden-xs">
      <div class="carousel-inner">
        <div class="item active" style="background-image:url('/hero_images/appointment.jpg')">
          <div class="rch-ccaption">
            <h2>Appointment notifications now straight to your phone</h2>
            <p>Appointment copy. <a href="/appointments/">Click here to find out more.</a></p>
          </div>
        </div>
        <div class="item" style="background-image:url('/hero_images/food.jpg')">
          <div class="rch-ccaption">
            <h2>Teens and food</h2>
            <p>Food copy. <a href="https://poll.example/food/">Click here to learn more.</a></p>
          </div>
        </div>
        <div class="item" style="background-image:url('/hero_images/travel.jpg')">
          <div class="rch-ccaption">
            <h2>Travel a long way to get to the RCH?</h2>
            <p>Travel copy. <a href="/telehealth/">Click here to find out more.</a></p>
          </div>
        </div>
      </div>
    </div>
    <div id="rch-featured-carousel-xs" class="carousel slide visible-xs">
      <div class="carousel-inner">
        <div class="item"><h2>Appointment notifications now straight to your phone</h2></div>
        <div class="item"><h2>Travel a long way to get to the RCH?</h2></div>
      </div>
    </div>
  `

  it('replaces a partial imported carousel with the larger source carousel and drops duplicated standalone heroes', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-carousel', {
        slides: [
          {
            id: 'slide-1',
            heading: 'Appointment notifications now straight to your phone',
            image: { src: { url: '/hero_images/appointment.jpg' } },
          },
          {
            id: 'slide-2',
            heading: 'Travel a long way to get to the RCH?',
            image: { src: { url: '/hero_images/travel.jpg' } },
          },
        ],
      }, 'hero'),
      component('hero-with-image', {
        heading: 'Travel a long way to get to the RCH?',
        image: { src: { url: '/hero_images/travel.jpg' } },
      }, 'hero'),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
    ]

    const result = enrichHeroCarouselFromSource(components, {
      domSnapshot: sourceCarouselHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result).toHaveLength(3)
    expect(result[1].type).toBe('hero-carousel')
    expect((result[1].content.slides as any[]).map(slide => slide.heading)).toEqual([
      'Appointment notifications now straight to your phone',
      'Teens and food',
      'Travel a long way to get to the RCH?',
    ])
    expect((result[1].content.slides as any[])[1]).toMatchObject({
      body: 'Food copy.',
      image: {
        src: {
          url: 'https://www.rch.org.au/hero_images/food.jpg',
          mediaType: 'image',
        },
      },
      ctaButtons: [
        {
          label: 'Click here',
          href: {
            url: 'https://poll.example/food/',
            type: 'external',
          },
        },
      ],
    })
    expect(result[2].type).toBe('card-grid')
  })

  it('does not enrich when source carousel titles do not overlap the imported carousel', () => {
    const components = [
      component('hero-carousel', {
        slides: [
          { id: 'slide-1', heading: 'Different imported slide' },
          { id: 'slide-2', heading: 'Another imported slide' },
        ],
      }, 'hero'),
    ]

    expect(enrichHeroCarouselFromSource(components, {
      domSnapshot: sourceCarouselHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })).toEqual(components)
  })

  it('creates a source-backed carousel from split top heroes and recap cards', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'Appointment notifications now straight to your phone',
        image: { src: { url: '/hero_images/appointment.jpg' } },
      }, 'hero'),
      component('hero-with-image', {
        heading: 'Travel a long way to get to the RCH?',
        image: { src: { url: '/hero_images/travel.jpg' } },
      }, 'hero'),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Teens and food' },
          { title: 'Travel a long way to get to the RCH?' },
        ],
      }),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
    ]

    const result = enrichHeroCarouselFromSource(components, {
      domSnapshot: sourceCarouselHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result).toHaveLength(3)
    expect(result[1].type).toBe('hero-carousel')
    expect((result[1].content.slides as any[]).map(slide => slide.heading)).toEqual([
      'Appointment notifications now straight to your phone',
      'Teens and food',
      'Travel a long way to get to the RCH?',
    ])
    expect(result[2].type).toBe('card-grid')
    expect((result[2].content as any).cards).toEqual([{ title: 'Quick link' }])
  })

  it('does not consume later sections that happen to overlap carousel titles', () => {
    const components = [
      component('navbar', {}, 'header'),
      component('hero-with-image', {
        heading: 'Appointment notifications now straight to your phone',
        image: { src: { url: '/hero_images/appointment.jpg' } },
      }, 'hero'),
      component('hero-with-image', {
        heading: 'Travel a long way to get to the RCH?',
        image: { src: { url: '/hero_images/travel.jpg' } },
      }, 'hero'),
      component('card-grid', {
        cards: [
          { title: 'Appointment notifications now straight to your phone' },
          { title: 'Teens and food' },
          { title: 'Travel a long way to get to the RCH?' },
        ],
      }),
      component('card-grid', { cards: [{ title: 'Quick link' }] }),
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'Teens and food' },
          { title: 'Travel a long way to get to the RCH?' },
        ],
      }),
    ]

    const result = enrichHeroCarouselFromSource(components, {
      domSnapshot: sourceCarouselHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result.map(item => item.type)).toEqual([
      'navbar',
      'hero-carousel',
      'card-grid',
      'content-feed',
    ])
    expect((result[3].content as any).heading).toBe('Latest News')
  })
})
