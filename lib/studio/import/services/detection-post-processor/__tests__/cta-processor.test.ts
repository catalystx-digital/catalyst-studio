import { cleanupCtas, removeHollowCtaBanners } from '../cta-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

function component(type: string, content: Record<string, unknown>): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content,
  }
}

describe('removeHollowCtaBanners', () => {
  it('drops heading-only cta banners adjacent to listing content', () => {
    const components = [
      component('hero-carousel', { slides: [{ heading: 'Hero' }] }),
      component('cta-banner', { heading: 'Featured' }),
      component('card-grid', {
        heading: 'Your guide',
        cards: [{ title: 'Kids Health Info' }],
      }),
    ]

    removeHollowCtaBanners(components)

    expect(components).toEqual([components[0], components[1]])
    expect(components.map(entry => entry.type)).toEqual(['hero-carousel', 'card-grid'])
  })

  it('keeps cta banners with meaningful body content', () => {
    const components = [
      component('card-grid', { cards: [{ title: 'Previous' }] }),
      component('cta-banner', {
        heading: 'Flu 2026',
        subheading: 'Parents can read the latest vaccine guidance.',
        backgroundColor: '#82C341',
      }),
      component('card-grid', { cards: [{ title: 'Next' }] }),
    ]

    removeHollowCtaBanners(components)

    expect(components).toHaveLength(3)
    expect(components[1]?.type).toBe('cta-banner')
  })

  it('keeps cta banners with primary or secondary buttons', () => {
    const components = [
      component('card-grid', { cards: [{ title: 'Previous' }] }),
      component('cta-banner', {
        heading: 'Donate',
        primaryButton: {
          label: 'Donate now',
          href: { url: 'https://example.com/donate', type: 'external' },
        },
        secondaryButton: {
          label: 'Learn more',
          href: { path: '/support', type: 'internal' },
        },
      }),
      component('card-grid', { cards: [{ title: 'Next' }] }),
    ]

    removeHollowCtaBanners(components)

    expect(components).toHaveLength(3)
    expect(components[1]?.type).toBe('cta-banner')
  })

  it('keeps standalone page-title cta banners without nearby listings', () => {
    const components = [
      component('cta-banner', { heading: 'Support Us' }),
      component('text-block', { heading: 'Donate', body: 'Donation details' }),
    ]

    removeHollowCtaBanners(components)

    expect(components).toHaveLength(2)
    expect(components[0]?.type).toBe('cta-banner')
  })
})

describe('cleanupCtas', () => {
  it('runs hollow cta cleanup as part of cta cleanup', () => {
    const components = [
      component('card-grid', { cards: [{ title: 'A' }] }),
      component('cta-banner', { heading: 'Featured' }),
    ]

    cleanupCtas(components)

    expect(components.map(entry => entry.type)).toEqual(['card-grid'])
  })
})
