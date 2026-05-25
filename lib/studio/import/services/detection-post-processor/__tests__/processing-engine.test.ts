/**
 * Tests for Component Processing Engine
 *
 * Comprehensive test coverage for all engine functions:
 * - executeMultiRowDetection
 * - executeBackgroundPromotion
 * - executeDeduplication
 */

import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import {
  executeMultiRowDetection,
  executeBackgroundPromotion,
  executeDeduplication
} from '../processing-engine'

// ============================================================================
// Multi-Row Navigation Detection Tests
// ============================================================================

describe('executeMultiRowDetection', () => {
  it('should not split when rules are disabled', () => {
    const components: DetectedComponent[] = [
      {
        type: 'navbar' as any,
        component: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Services', href: '/services' },
            { label: 'Products', href: '/products' },
            { label: 'News', href: '/news' },
            { label: 'Contact', href: '/contact' },
            { label: 'Login', href: '/login' }
          ]
        }
      }
    ]

    executeMultiRowDetection(components, { enabled: false })

    expect(components[0].content.utilityNav).toBeUndefined()
    expect(components[0].content.menuItems).toHaveLength(7)
  })

  it('should split navbar into utility and primary nav when patterns match', () => {
    const components: DetectedComponent[] = [
      {
        type: 'navbar' as any,
        component: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Login', href: '/login' },
            {
              label: 'Services',
              href: '/services',
              children: [{ label: 'Consulting' }, { label: 'Support' }, { label: 'Training' }]
            },
            {
              label: 'Products',
              href: '/products',
              children: [{ label: 'Platform' }, { label: 'Apps' }, { label: 'Integrations' }]
            },
            {
              label: 'Research',
              href: '/research',
              children: [{ label: 'Reports' }, { label: 'Insights' }, { label: 'Labs' }]
            }
          ]
        }
      }
    ]

    const rules = {
      enabled: true,
      utilityPatterns: ['home', 'about', 'contact', 'login']
    }

    executeMultiRowDetection(components, rules)

    expect(components[0].content.utilityNav).toBeDefined()
    expect(components[0].content.utilityNav).toHaveLength(4)
    expect(components[0].content.menuItems).toHaveLength(3)
    expect(components[0].content.layout).toBe('multi-row')
    expect(components[0].metadata?.navbarLayout).toBe('multi-row')
  })

  it('should not split navbar with too few items (< 7)', () => {
    const components: DetectedComponent[] = [
      {
        type: 'navbar' as any,
        component: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Services', href: '/services' },
            { label: 'Contact', href: '/contact' }
          ]
        }
      }
    ]

    const rules = {
      enabled: true,
      utilityPatterns: ['home', 'about', 'contact']
    }

    executeMultiRowDetection(components, rules)

    expect(components[0].content.utilityNav).toBeUndefined()
  })

  it('should not split when insufficient utility or primary items', () => {
    const components: DetectedComponent[] = [
      {
        type: 'navbar' as any,
        component: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { label: 'Home', href: '/' },
            { label: 'Services', href: '/services' },
            { label: 'Products', href: '/products' },
            { label: 'Research', href: '/research' },
            { label: 'News', href: '/news' },
            { label: 'Blog', href: '/blog' },
            { label: 'Events', href: '/events' }
          ]
        }
      }
    ]

    const rules = {
      enabled: true,
      utilityPatterns: ['home'] // Only 1 utility item
    }

    executeMultiRowDetection(components, rules)

    expect(components[0].content.utilityNav).toBeUndefined()
  })

  it('should skip navbar that already has utilityNav', () => {
    const components: DetectedComponent[] = [
      {
        type: 'navbar' as any,
        component: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { label: 'Services', href: '/services' }
          ],
          utilityNav: [
            { label: 'Login', href: '/login' }
          ]
        }
      }
    ]

    const rules = {
      enabled: true,
      utilityPatterns: ['login']
    }

    const originalUtilityNav = components[0].content.utilityNav

    executeMultiRowDetection(components, rules)

    expect(components[0].content.utilityNav).toBe(originalUtilityNav)
  })
})

// ============================================================================
// Background Image Promotion Tests
// ============================================================================

describe('executeBackgroundPromotion', () => {
  it('should not promote when rules are disabled', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const html = '<div id="banner-wrap" style="background-image: url(/hero.jpg)"></div>'

    executeBackgroundPromotion(components, { enabled: false }, { domSnapshot: html })

    expect(components[0].type).toBe('hero-simple')
    expect(components[0].content.backgroundImage).toBeUndefined()
  })

  it('should promote hero-simple to hero-banner when background found', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const html = '<div id="banner-wrap" style="background-image: url(\'/hero.jpg\')"></div>'

    const rules = {
      enabled: true,
      domSelectors: ['banner-wrap']
    }

    executeBackgroundPromotion(components, rules, { domSnapshot: html, pageUrl: 'https://example.com' })

    expect(components[0].type).toBe('hero-banner')
    expect(components[0].component).toBe('hero-banner')
    expect(components[0].content.backgroundImage).toContain('hero.jpg')
    expect(components[0].metadata?.variant).toBe('banner')
  })

  it('should find selector backgrounds when style appears before id with spaced attributes', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const html = '<div style = "background-image: url(/wrong.jpg)"></div><section style = "background-image: url(\'/hero.jpg\')" id = "banner-wrap"></section>'

    executeBackgroundPromotion(components, { enabled: true, domSelectors: ['banner-wrap'] }, {
      domSnapshot: html,
      pageUrl: 'https://example.com'
    })

    expect(components[0].type).toBe('hero-banner')
    expect(components[0].content.backgroundImage).toContain('hero.jpg')
    expect(components[0].content.backgroundImage).not.toContain('wrong.jpg')
  })

  it('should not promote if hero already has background', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome',
          backgroundImage: '/existing.jpg'
        }
      }
    ]

    const html = '<div id="banner-wrap" style="background-image: url(\'/hero.jpg\')"></div>'

    const rules = {
      enabled: true,
      domSelectors: ['banner-wrap']
    }

    executeBackgroundPromotion(components, rules, { domSnapshot: html })

    expect(components[0].type).toBe('hero-simple')
    expect(components[0].content.backgroundImage).toBe('/existing.jpg')
  })

  it('should extract mobile background from mobile-specific selector', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const html = `
      <div id="banner-wrap" style="background-image: url('/hero-desktop.jpg')"></div>
      <div id="banner-wrap-mobile" style="background-image: url('/hero-mobile.jpg')"></div>
    `

    const rules = {
      enabled: true,
      domSelectors: ['banner-wrap', 'banner-wrap-mobile']
    }

    executeBackgroundPromotion(components, rules, { domSnapshot: html, pageUrl: 'https://example.com' })

    expect(components[0].content.backgroundImage).toContain('hero-desktop.jpg')
    expect(components[0].content.metadata?.mobileBackgroundImage).toContain('hero-mobile.jpg')
  })

  it('should fallback to first background-image if no selectors match', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const html = '<div style="background-image: url(\'/fallback.jpg\')"></div>'

    const rules = {
      enabled: true,
      domSelectors: ['nonexistent-selector']
    }

    executeBackgroundPromotion(components, rules, { domSnapshot: html })

    expect(components[0].content.backgroundImage).toContain('fallback.jpg')
  })

  it('should not promote when no DOM snapshot provided', () => {
    const components: DetectedComponent[] = [
      {
        type: 'hero-simple' as any,
        component: 'hero-simple',
        confidence: 0.9,
        content: {
          heading: 'Welcome'
        }
      }
    ]

    const rules = {
      enabled: true,
      domSelectors: ['banner-wrap']
    }

    executeBackgroundPromotion(components, rules, { domSnapshot: null })

    expect(components[0].type).toBe('hero-simple')
  })
})

// ============================================================================
// CTA Deduplication Tests
// ============================================================================

describe('executeDeduplication', () => {
  it('should not deduplicate when rules are disabled', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          primaryButton: { text: 'Learn More', url: '/learn' }
        }
      },
      {
        type: 'two-column' as any,
        component: 'two-column',
        confidence: 0.9,
        content: {
          leftColumn: {
            cta: { text: 'Learn More', url: '/learn' }
          }
        }
      }
    ]

    executeDeduplication(components, { enabled: false })

    expect(components).toHaveLength(2)
    expect(components[0].type).toBe('cta-simple')
  })

  it('should remove CTA when duplicate found in adjacent two-column', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          primaryButton: { text: 'Learn More', url: '/learn' }
        }
      },
      {
        type: 'two-column' as any,
        component: 'two-column',
        confidence: 0.9,
        content: {
          leftColumn: {
            cta: { text: 'Learn More', url: '/learn' }
          }
        }
      }
    ]

    const rules = {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn],
      context: 'adjacent'
    }

    executeDeduplication(components, rules)

    expect(components).toHaveLength(1)
    expect(components[0].type).toBe('two-column')
  })

  it('should remove CTA when duplicate found in previous adjacent component', () => {
    const components: DetectedComponent[] = [
      {
        type: 'timeline' as any,
        component: 'timeline',
        confidence: 0.9,
        content: {
          events: [
            { cta: { text: 'Apply Now', url: '/apply' } }
          ]
        }
      },
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          primaryButton: { text: 'Apply Now', url: '/apply' }
        }
      }
    ]

    const rules = {
      enabled: true,
      deduplicateWith: [ComponentType.Timeline],
      context: 'adjacent'
    }

    executeDeduplication(components, rules)

    expect(components).toHaveLength(1)
    expect(components[0].type).toBe('timeline')
  })

  it('should not remove CTA when no duplicate found', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          primaryButton: { text: 'Learn More', url: '/learn' }
        }
      },
      {
        type: 'two-column' as any,
        component: 'two-column',
        confidence: 0.9,
        content: {
          leftColumn: {
            cta: { text: 'Different CTA', url: '/different' }
          }
        }
      }
    ]

    const rules = {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn],
      context: 'adjacent'
    }

    executeDeduplication(components, rules)

    expect(components).toHaveLength(2)
  })

  it('should not remove CTA when adjacent component type not in deduplicateWith', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          primaryButton: { text: 'Learn More', url: '/learn' }
        }
      },
      {
        type: 'text-block' as any,
        component: 'text-block',
        confidence: 0.9,
        content: {
          body: 'Learn More at /learn'
        }
      }
    ]

    const rules = {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn], // text-block not included
      context: 'adjacent'
    }

    executeDeduplication(components, rules)

    expect(components).toHaveLength(2)
  })

  it('should handle CTA with ctaButtons array', () => {
    const components: DetectedComponent[] = [
      {
        type: 'cta-simple' as any,
        component: 'cta-simple',
        confidence: 0.9,
        content: {
          ctaButtons: [
            { text: 'Get Started', url: '/start' }
          ]
        }
      },
      {
        type: 'two-column' as any,
        component: 'two-column',
        confidence: 0.9,
        content: {
          rightColumn: {
            link: '/start',
            text: 'Get Started'
          }
        }
      }
    ]

    const rules = {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn],
      context: 'adjacent'
    }

    executeDeduplication(components, rules)

    expect(components).toHaveLength(1)
    expect(components[0].type).toBe('two-column')
  })
})
