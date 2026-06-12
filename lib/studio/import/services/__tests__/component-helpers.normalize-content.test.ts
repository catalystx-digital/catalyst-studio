import { extractComponentPayload } from '../page-builder/component-helpers'
import {
  consumeNormalizationWarnings,
  getNormalizationWarningSeverity,
  isFatalNormalizationIssue
} from '../page-builder/normalization-telemetry'
import { normalizeImage, SUBCOMPONENT_NORMALIZERS } from '../page-builder/subcomponent-normalizers'
import { ContentFeedDef } from '@/lib/studio/components/cms/content/content-feed/content-feed.def'
import { HtmlBlockDef } from '@/lib/studio/components/cms/content/html-block/html-block.def'
import { TextBlockDef } from '@/lib/studio/components/cms/content/text-block/text-block.def'
import { TwoColumnDef } from '@/lib/studio/components/cms/content/two-column/two-column.def'
import { CTABannerDef } from '@/lib/studio/components/cms/cta/cta-banner/cta-banner.def'
import { CTASimpleDef } from '@/lib/studio/components/cms/cta/cta-simple/cta-simple.def'
import { StatisticsDef } from '@/lib/studio/components/cms/data/statistics/statistics.def'
import { TeamGridDef } from '@/lib/studio/components/cms/about/team-grid/team-grid.def'
import { QuoteBlockDef } from '@/lib/studio/components/cms/content/quote-block/quote-block.def'
import { HeroBannerDef } from '@/lib/studio/components/cms/heroes/hero-banner/hero-banner.def'
import { HeroCarouselDef } from '@/lib/studio/components/cms/heroes/hero-carousel/hero-carousel.def'
import { HeroSimpleDef } from '@/lib/studio/components/cms/heroes/hero-simple/hero-simple.def'
import { HeroSplitDef } from '@/lib/studio/components/cms/heroes/hero-split/hero-split.def'
import { HeroWithImageDef } from '@/lib/studio/components/cms/heroes/hero-with-image/hero-with-image.def'
import { BreadcrumbsDef } from '@/lib/studio/components/cms/navigation/breadcrumbs/breadcrumbs.def'
import { FooterDef } from '@/lib/studio/components/cms/navigation/footer/footer.def'
import { SideMenuDef } from '@/lib/studio/components/cms/navigation/sidemenu/sidemenu.def'
import { LogoStripDef } from '@/lib/studio/components/cms/social-proof/logo-strip/logo-strip.def'
import { TestimonialSliderDef } from '@/lib/studio/components/cms/social-proof/testimonial-slider/testimonial-slider.def'
import ctaBannerAtlasSpec from '@/prompts/component-atlas/spec/components/cta-banner.json'
import ctaSimpleAtlasSpec from '@/prompts/component-atlas/spec/components/cta-simple.json'
import breadcrumbAtlasSpec from '@/prompts/component-atlas/spec/components/breadcrumb.json'
import breadcrumbsAtlasSpec from '@/prompts/component-atlas/spec/components/breadcrumbs.json'
import heroBannerAtlasSpec from '@/prompts/component-atlas/spec/components/hero-banner.json'
import heroCarouselAtlasSpec from '@/prompts/component-atlas/spec/components/hero-carousel.json'
import heroSimpleAtlasSpec from '@/prompts/component-atlas/spec/components/hero-simple.json'
import heroSplitAtlasSpec from '@/prompts/component-atlas/spec/components/hero-split.json'
import heroWithImageAtlasSpec from '@/prompts/component-atlas/spec/components/hero-with-image.json'
import logoCloudAtlasSpec from '@/prompts/component-atlas/spec/components/logo-cloud.json'
import quoteBlockAtlasSpec from '@/prompts/component-atlas/spec/components/quote-block.json'
import statisticsAtlasSpec from '@/prompts/component-atlas/spec/components/statistics.json'
import teamGridAtlasSpec from '@/prompts/component-atlas/spec/components/team-grid.json'
import testimonialsAtlasSpec from '@/prompts/component-atlas/spec/components/testimonials.json'
import sidemenuAtlasSpec from '@/prompts/component-atlas/spec/components/sidemenu.json'
import type { DetectionResult, ComponentType as ImportComponentType } from '../interfaces'

const baseBounds = { x: 0, y: 0, width: 100, height: 100 }

const createComponentType = (type: string): ImportComponentType =>
  ({
    id: `type-${type}`,
    type,
    key: type,
    category: 'hero',
    source: 'canonical',
    metadata: {},
    defaultConfig: { props: {} },
    placeholderData: {},
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    aiMetadata: {},
    styles: {},
    version: '1.0.0',
    isGlobal: false,
    patterns: []
  } as unknown as ImportComponentType)

function extractComponentProps(detection: DetectionResult, componentType: ImportComponentType): Record<string, any> {
  const payload = extractComponentPayload(detection, componentType)
  return { ...payload.props, content: payload.content }
}

it('selects the largest usable srcset image candidate during normalization', () => {
  const image = normalizeImage({
    src: 'https://cdn.example.com/hero.jpg?w=320',
    srcset: [
      'https://cdn.example.com/hero.jpg?w=320 320w',
      'https://cdn.example.com/hero.jpg?w=780 780w',
      'https://cdn.example.com/hero.jpg?w=1200 1200w'
    ].join(', '),
    alt: 'Hero'
  })

  expect(image).toMatchObject({
    src: 'https://cdn.example.com/hero.jpg?w=1200',
    originalUrl: 'https://cdn.example.com/hero.jpg?w=1200',
    alt: 'Hero'
  })
  expect(image).not.toHaveProperty('renditions')
})

it('parses raw srcset-shaped image strings instead of treating them as URLs', () => {
  const image = normalizeImage(
    'https://cdn.example.com/hero.jpg?w=320 320w, https://cdn.example.com/hero.jpg?w=1200 1200w',
    'Hero'
  )

  expect(image).toEqual({
    src: 'https://cdn.example.com/hero.jpg?w=1200',
    originalUrl: 'https://cdn.example.com/hero.jpg?w=1200',
    alt: 'Hero'
  })
})

it('parses srcset-shaped values from non-srcset image fields', () => {
  const image = normalizeImage({
    src: 'https://cdn.example.com/hero.jpg?w=320 320w, https://cdn.example.com/hero.jpg?w=1200 1200w',
    alt: 'Hero'
  })

  expect(image).toMatchObject({
    src: 'https://cdn.example.com/hero.jpg?w=1200',
    originalUrl: 'https://cdn.example.com/hero.jpg?w=1200',
    alt: 'Hero'
  })
})

describe('normalizeComponentContent through extractComponentPayload', () => {
  beforeEach(() => {
    consumeNormalizationWarnings()
  })

  it('keeps normalized content on the canonical payload instead of props mirrors', () => {
    const detection: DetectionResult = {
      type: 'hero-simple',
      confidence: 0.9,
      bounds: baseBounds,
      content: { heading: 'Hello' }
    }

    const payload = extractComponentPayload(detection, createComponentType('hero-simple'))

    expect(payload.content).toEqual(expect.objectContaining({ heading: 'Hello' }))
    expect(payload.props).not.toHaveProperty('content')
    expect(payload.props).not.toHaveProperty('text')
  })

  it('normalizes text-block aliases and numeric fields into schema-valid content', () => {
    const detection: DetectionResult = {
      id: 'text-block-aliases',
      type: 'text-block',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        heading: 'Welcome',
        bodyHtml: '<p>Hello from imported HTML.</p>',
        alignment: 'justify',
        columns: '2',
        headingLevel: 'h3',
        region: 'main'
      }
    }

    const props = extractComponentProps(detection, createComponentType('text-block'))

    expect(props.content).toEqual({
      heading: 'Welcome',
      body: '<p>Hello from imported HTML.</p>',
      alignment: 'justify',
      columns: 2,
      headingLevel: 3
    })
    expect(TextBlockDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes html-block aliases into schema-valid bodyHtml content', () => {
    const detection: DetectionResult = {
      id: 'html-block-aliases',
      type: 'html-block',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        title: 'About this service',
        html: '<p>Long-form content belongs here.</p>',
        url: '/source-page',
        body: '<p>Lower priority body.</p>',
        region: 'main'
      }
    }

    const props = extractComponentProps(detection, createComponentType('html-block'))

    expect(props.content).toEqual({
      title: 'About this service',
      bodyHtml: '<p>Long-form content belongs here.</p>',
      sourceUrl: '/source-page'
    })
    expect(HtmlBlockDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes quote-block aliases and attribution media into schema-valid content', () => {
    const detection: DetectionResult = {
      type: 'quote-block',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        text: 'This service changed how our team works.',
        person: 'Mina Patel',
        role: 'Operations Director',
        organization: 'Northwind Health',
        avatar: 'https://cdn.example.com/customers/mina.jpg',
        style: 'testimonial',
        alignment: 'center',
        size: 'large'
      }
    }

    const props = extractComponentPayload(detection, createComponentType('quote-block'))

    expect(props.content).toEqual({
      quote: 'This service changed how our team works.',
      attribution: {
        author: 'Mina Patel',
        title: 'Operations Director',
        organization: 'Northwind Health',
        image: {
          src: {
            mediaId: 'detected:cdn-example-com-customers-mina-jpg',
            mediaType: 'image',
            url: 'https://cdn.example.com/customers/mina.jpg',
            alt: 'Mina Patel'
          },
          alt: 'Mina Patel',
          originalUrl: 'https://cdn.example.com/customers/mina.jpg'
        }
      },
      style: 'testimonial',
      align: 'center',
      size: 'large'
    })
    expect(QuoteBlockDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('coerces schema-valid team-grid column strings without defaulting invalid values', () => {
    const validDetection: DetectionResult = {
      type: 'team-grid',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        heading: 'Meet the team',
        columns: {
          mobile: '1',
          tablet: '2',
          desktop: '5',
          large: '5'
        }
      }
    }
    const invalidDetection: DetectionResult = {
      type: 'team-grid',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        heading: 'Meet the team',
        columns: {
          mobile: '3',
          tablet: 'wide'
        }
      }
    }

    expect(extractComponentPayload(validDetection, createComponentType('team-grid')).content.columns).toEqual({
      mobile: 1,
      tablet: 2,
      desktop: 5,
      large: 5
    })
    expect(extractComponentPayload(invalidDetection, createComponentType('team-grid')).content.columns).toEqual({
      mobile: '3',
      tablet: 'wide'
    })
  })

  it('normalizes team-grid member aliases into schema-valid members', () => {
    const detection: DetectionResult = {
      type: 'team-grid',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        heading: 'Leadership',
        staff: [
          {
            fullName: 'Ava Chen',
            role: 'Chief Product Officer',
            avatar: { src: 'https://cdn.example.com/team/ava.jpg', alt: 'Ava Chen portrait' },
            linkedIn: 'https://linkedin.com/in/ava',
            profileUrl: '/team/ava-chen'
          },
          { title: 'Missing name' }
        ]
      }
    }

    const props = extractComponentPayload(detection, createComponentType('team-grid'))

    expect(props.content.members).toEqual([
      {
        id: 'team-member-ava-chen',
        name: 'Ava Chen',
        title: 'Chief Product Officer',
        photo: 'https://cdn.example.com/team/ava.jpg',
        photoAlt: 'Ava Chen portrait',
        linkedin: 'https://linkedin.com/in/ava',
        profileUrl: '/team/ava-chen'
      }
    ])
    expect(TeamGridDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'team-grid',
          issue: 'missing-required-field',
          field: 'members'
        })
      ])
    )
  })

  it('normalizes statistics aliases into schema-valid stat items', () => {
    const detection: DetectionResult = {
      type: 'statistics',
      confidence: 0.9,
      bounds: baseBounds,
      content: {
        title: 'Impact',
        columns: '4',
        metrics: [
          { title: 'Patient visits', number: '12,500', suffix: '+', deltaValue: '8', trend: 'up' },
          { value: 99 }
        ]
      }
    }

    const props = extractComponentPayload(detection, createComponentType('statistics'))

    expect(props.content).toMatchObject({
      title: 'Impact',
      columns: 4,
      stats: [
        {
          id: 'stat-patient-visits',
          label: 'Patient visits',
          value: 12500,
          suffix: '+',
          delta: { value: 8, trend: 'up' }
        }
      ]
    })
    expect(StatisticsDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'statistics',
          issue: 'missing-required-field',
          field: 'stats'
        })
      ])
    )
  })

  it('classifies fatal and nonfatal normalization issues', () => {
    expect(isFatalNormalizationIssue('media-src-missing')).toBe(true)
    expect(isFatalNormalizationIssue('missing-required-field')).toBe(true)
    expect(isFatalNormalizationIssue('invalid-subcomponent')).toBe(true)
    expect(isFatalNormalizationIssue('unsupported-subcomponent')).toBe(true)
    expect(isFatalNormalizationIssue('normalizer-missing')).toBe(true)
    expect(isFatalNormalizationIssue('invalid-value')).toBe(true)
    expect(isFatalNormalizationIssue('unknown-field')).toBe(true)
    expect(isFatalNormalizationIssue('suspicious-value')).toBe(false)
    expect(getNormalizationWarningSeverity({ issue: 'suspicious-value' })).toBe('warning')
  })

  it('normalizes hero-simple CTA and supporting link payloads', () => {
    const detection: DetectionResult = {
      id: 'hero-simple-1',
      type: 'hero-simple',
      bounds: baseBounds,
      content: {
        heading: 'Need help resolving a telco issue?',
        subheading: 'We can investigate complaints and keep you informed.',
        ctaButtons: [
          { label: 'Contact us', href: '/complaints', variant: 'primary', external: true, icon: 'arrow-right' },
          { label: 'See pricing', href: '/pricing', variant: 'outline' },
          'ignore me'
        ],
        supportingLinks: [
          { text: 'Learn more', link: '/about', opensInNewTab: 'true' },
          'ignore me',
          { title: 'Docs', href: '/resources', iconName: 'book' }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-simple'))

    expect(props.content?.ctaButtons).toEqual([
      {
        label: 'Contact us',
        href: {
          type: 'internal',
          pageId: 'complaints',
          path: '/complaints'
        },
        variant: 'primary',
        external: true,
        icon: 'arrow-right'
      },
      {
        label: 'See pricing',
        href: {
          type: 'internal',
          pageId: 'pricing',
          path: '/pricing'
        },
        variant: 'outline'
      }
    ])

    expect(props.content?.supportingLinks).toEqual([
      expect.objectContaining({
        label: 'Learn more',
        href: {
          type: 'internal',
          pageId: 'about',
          path: '/about'
        },
        external: true
      }),
      expect.objectContaining({
        label: 'Docs',
        href: {
          type: 'internal',
          pageId: 'resources',
          path: '/resources'
        },
        icon: 'book'
      })
    ])

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'hero-simple',
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('payload is not an object')
        })
      ])
    )
  })

  it('hydrates hero-simple background imagery emitted as top-level aliases', () => {
    const detection: DetectionResult = {
      id: 'hero-simple-background-string',
      type: 'hero-simple',
      bounds: baseBounds,
      content: {
        heading: 'Welcome to Catalyst Studio',
        backgroundImage: 'https://cdn.example.com/assets/hero-background.jpg',
        backgroundOverlayColor: 'rgba(0,0,0,0.45)',
        backgroundOverlayOpacity: '65%',
        backgroundPosition: 'top center'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-simple'))

    expect(props.content?.background).toEqual(
      expect.objectContaining({
        overlayColor: 'rgba(0,0,0,0.45)',
        overlayOpacity: 0.65,
        imagePosition: 'top center',
        image: expect.objectContaining({
          src: 'https://cdn.example.com/assets/hero-background.jpg',
          focalPoint: 'top'
        })
      })
    )
    expect(props.content?.backgroundImage).toBeUndefined()

    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('maps hero-banner nested background payloads to schema fields', () => {
    const detection: DetectionResult = {
      id: 'hero-banner-background-object',
      type: 'hero-banner',
      bounds: baseBounds,
      content: {
        heading: 'Welcome to the hospital',
        background: {
          image: 'https://cdn.example.com/assets/banner.jpg',
          overlayColor: '#000000',
          overlayOpacity: '55%'
        },
        backgroundPosition: 'center top'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-banner'))

    expect(props.content?.backgroundImage).toBe('https://cdn.example.com/assets/banner.jpg')
    expect(props.content?.overlay).toEqual(
      expect.objectContaining({
        enabled: true,
        color: '#000000',
        opacity: 0.55
      })
    )
    expect(props.content?.background).toBeUndefined()
    expect(props.content?.backgroundPosition).toBeUndefined()
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes breadcrumb url aliases into schema-valid links', () => {
    const detection: DetectionResult = {
      id: 'breadcrumbs-url-aliases',
      type: 'breadcrumbs',
      bounds: baseBounds,
      content: {
        items: [
          { label: 'Home', url: '/' },
          { label: 'Resources', href: 'example.com/resources' },
          { type: 'anchor', label: 'Section', href: '#section' }
        ],
        separator: '>',
        showHome: 'false',
        region: 'header'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('breadcrumbs'))

    expect(props.content).toEqual({
      items: [
        {
          label: 'Home',
          href: {
            type: 'internal',
            pageId: 'home',
            path: '/'
          }
        },
        {
          label: 'Resources',
          href: {
            type: 'external',
            url: 'https://example.com/resources'
          }
        },
        {
          label: 'Section',
          href: {
            type: 'anchor',
            href: '#section',
            label: 'Section'
          }
        }
      ],
      separator: '>',
      showHome: false
    })
    expect(BreadcrumbsDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('keeps breadcrumb atlas samples schema-valid', () => {
    expect(BreadcrumbsDef.schema.safeParse(breadcrumbsAtlasSpec.content).success).toBe(true)
    expect(BreadcrumbsDef.schema.safeParse(breadcrumbAtlasSpec.content).success).toBe(true)
  })

  it('does not warn for malformed hero background candidates when another candidate is usable', () => {
    const detection: DetectionResult = {
      id: 'hero-banner-background-candidate-order',
      type: 'hero-banner',
      bounds: baseBounds,
      content: {
        heading: 'Welcome to the hospital',
        background: {
          image: { decorative: true }
        },
        backgroundImage: 'https://cdn.example.com/assets/banner.jpg'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-banner'))

    expect(props.content?.backgroundImage).toBe('https://cdn.example.com/assets/banner.jpg')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('does not warn for malformed hero background candidates when a media background image is already present', () => {
    const detection: DetectionResult = {
      id: 'hero-banner-background-media-candidate-order',
      type: 'hero-banner',
      bounds: baseBounds,
      content: {
        heading: 'Welcome to the hospital',
        background: {
          image: { decorative: true }
        },
        backgroundImage: {
          mediaId: 'asset-banner',
          mediaType: 'image',
          url: 'https://cdn.example.com/assets/banner.jpg'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-banner'))

    expect(props.content?.backgroundImage).toBe('https://cdn.example.com/assets/banner.jpg')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('preserves hero-simple background media references from nested payloads', () => {
    const detection: DetectionResult = {
      id: 'hero-simple-background-media',
      type: 'hero-simple',
      bounds: baseBounds,
      content: {
        heading: 'Media backed background',
        background: {
          color: '#0f172a',
          image: {
            mediaId: 'asset-hero-bg',
            originalUrl: 'https://cdn.example.com/assets/hero-nested.png',
            alt: 'Night skyline'
          },
          overlayColor: 'rgba(15,23,42,0.7)',
          overlayOpacity: '0.4'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-simple'))

    expect(props.content?.background).toEqual(
      expect.objectContaining({
        color: '#0f172a',
        overlayColor: 'rgba(15,23,42,0.7)',
        overlayOpacity: 0.4,
        image: expect.objectContaining({
          mediaId: 'asset-hero-bg',
          originalUrl: 'https://cdn.example.com/assets/hero-nested.png',
          src: 'https://cdn.example.com/assets/hero-nested.png',
          alt: 'Night skyline'
        })
      })
    )

    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('retains hero-simple background media when src is emitted as nested object', () => {
    const detection: DetectionResult = {
      id: 'hero-simple-background-nested-src',
      type: 'hero-simple',
      bounds: baseBounds,
      content: {
        heading: 'Nested sources',
        background: {
          image: {
            src: {
              mediaId: 'asset-hero-bg-src-wrapper',
              originalUrl: 'https://cdn.example.com/assets/hero-nested-src.png'
            }
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-simple'))
    expect(props.content?.background?.image).toEqual(
      expect.objectContaining({
        mediaId: 'asset-hero-bg-src-wrapper',
        src: 'https://cdn.example.com/assets/hero-nested-src.png',
        originalUrl: 'https://cdn.example.com/assets/hero-nested-src.png'
      })
    )
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('forces quick-exit cta-simple instances into the header region without writing region into content', () => {
    const detection: DetectionResult = {
      id: 'cta-quick-exit',
      type: 'cta-simple',
      bounds: baseBounds,
      metadata: { region: 'main' },
      content: {
        heading: 'Quick Exit',
        body: '<p>Leave this site quickly if you feel unsafe.</p>',
        region: 'main',
        metadata: { region: 'main' },
        primaryButton: { text: 'Leave site', url: 'https://www.tio.com.au/quick-exit' }
      }
    }

    const props = extractComponentProps(detection, createComponentType('cta-simple'))

    expect(props.region).toBe('header')
    expect(props.metadata).toEqual(expect.objectContaining({ region: 'header' }))
    expect(props.content).not.toHaveProperty('region')
    expect(props.content).not.toHaveProperty('metadata')
  })

  it('preserves detector-supplied header regions even when default props specify main', () => {
    const detection: DetectionResult = {
      id: 'cta-header',
      type: 'cta-simple',
      bounds: baseBounds,
      metadata: { region: 'header' },
      content: {
        heading: 'Need support?',
        body: '<p>Call us any time.</p>',
        region: 'header',
        metadata: { region: 'header' },
        primaryButton: { text: 'Contact us', url: '/contact' }
      }
    }
    const type = createComponentType('cta-simple')
    ;(type.defaultConfig as any) = { props: { region: 'main' } }

    const props = extractComponentProps(detection, type)

    expect(props.region).toBe('header')
    expect(props.metadata).toEqual(expect.objectContaining({ region: 'header' }))
    expect(props.content).not.toHaveProperty('region')
    expect(props.content).not.toHaveProperty('metadata')
  })

  it('does not copy catalog defaultConfig props into extracted instance props', () => {
    const detection: DetectionResult = {
      id: 'hero-without-defaults',
      type: 'hero-simple',
      bounds: baseBounds,
      content: {
        heading: 'Detector heading',
        body: '<p>Detector body.</p>'
      }
    }
    const type = createComponentType('hero-simple')
    ;(type.defaultConfig as any) = {
      props: {
        catalogOnlySentinel: 'default-config-sentinel',
        nestedCatalogOnly: { value: 'nested-default-sentinel' }
      }
    }

    const props = extractComponentProps(detection, type)

    expect(props).not.toHaveProperty('catalogOnlySentinel')
    expect(props).not.toHaveProperty('nestedCatalogOnly')
    expect(JSON.stringify(props)).not.toContain('default-config-sentinel')
    expect(JSON.stringify(props.content)).not.toContain('default-config-sentinel')
  })

  it('ignores regions emitted inside content when detection metadata disagrees', () => {
    const detection: DetectionResult = {
      id: 'cta-header-content',
      type: 'cta-simple',
      bounds: baseBounds,
      metadata: { region: 'main' },
      content: {
        heading: 'Safety CTA',
        region: 'header',
        metadata: { region: 'header' },
        primaryButton: { text: 'Leave site', url: 'https://example.com/exit' }
      }
    }
    const type = createComponentType('cta-simple')
    ;(type.defaultConfig as any) = { props: { region: 'main' } }

    const props = extractComponentProps(detection, type)

    expect(props.region).toBe('main')
    expect(props.metadata).toEqual(expect.objectContaining({ region: 'main' }))
    expect(props.content).not.toHaveProperty('region')
    expect(props.content).not.toHaveProperty('metadata')
  })

  it('preserves hero-with-image payloads emitted by the detector', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-1',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Still deciding?',
        body: "<h5>Attend the next enrolment open day or school tour at any of our 80 schools.</h5><p>A Catholic education in the Diocese of Parramatta is innovative, personalised and relevant to the needs of today's learner. The individual child is the focus of the learning and teaching with a curriculum that caters for a wide range of int</p><p>Start your child’s learning journey today!</p>",
        layout: 'image-left',
        image: {
          src: 'https://www.parra.catholic.edu.au/-/media/project/cedp/cathedparra/images/page-images/2021-squares/why-us-still-deciding.jpg',
          alt: 'St John XXIII Catholic College Stanhope - Catholic Schools Parramatta Diocese Ltd'
        },
        ctaButtons: [
          {
            label: 'Find a school',
            href: '/our-schools/find-a-school',
            variant: 'primary',
            style: 'primary'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content).toEqual({
      heading: 'Still deciding?',
      body: "<h5>Attend the next enrolment open day or school tour at any of our 80 schools.</h5><p>A Catholic education in the Diocese of Parramatta is innovative, personalised and relevant to the needs of today's learner. The individual child is the focus of the learning and teaching with a curriculum that caters for a wide range of int</p><p>Start your child’s learning journey today!</p>",
      layout: 'image-left',
      image: {
        originalUrl: 'https://www.parra.catholic.edu.au/-/media/project/cedp/cathedparra/images/page-images/2021-squares/why-us-still-deciding.jpg',
        src: {
          mediaType: 'image',
          mediaId: 'detected:www-parra-catholic-edu-au-media-project-cedp-cat',
          url: 'https://www.parra.catholic.edu.au/-/media/project/cedp/cathedparra/images/page-images/2021-squares/why-us-still-deciding.jpg',
          alt: 'St John XXIII Catholic College Stanhope - Catholic Schools Parramatta Diocese Ltd'
        },
        alt: 'St John XXIII Catholic College Stanhope - Catholic Schools Parramatta Diocese Ltd'
      },
      ctaButtons: [
        {
          label: 'Find a school',
          href: {
            type: 'internal',
            pageId: 'our-schools-find-a-school',
            path: '/our-schools/find-a-school'
          },
          variant: 'primary'
        }
      ]
    })

    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('keeps core hero atlas samples schema-valid', () => {
    expect(HeroSimpleDef.schema.safeParse(heroSimpleAtlasSpec.content).success).toBe(true)
    expect(HeroBannerDef.schema.safeParse(heroBannerAtlasSpec.content).success).toBe(true)
    expect(HeroWithImageDef.schema.safeParse(heroWithImageAtlasSpec.content).success).toBe(true)
    expect(HeroCarouselDef.schema.safeParse(heroCarouselAtlasSpec.content).success).toBe(true)
    expect(HeroSplitDef.schema.safeParse(heroSplitAtlasSpec.content).success).toBe(true)
  })

  it('normalizes hero-carousel legacy slide aliases into schema-valid slides', () => {
    const detection: DetectionResult = {
      id: 'hero-carousel-legacy',
      type: 'hero-carousel',
      bounds: baseBounds,
      content: {
        autoplay: 'true',
        intervalMs: '6000',
        slides: [
          {
            heading: 'Spring Collection',
            image: 'https://cdn.example.com/hero/spring.jpg',
            alt: 'Spring fashion',
            cta: { text: 'Shop now', url: '/shop', style: 'filled' }
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-carousel'))

    expect(props.content).toMatchObject({
      autoPlay: true,
      autoPlayInterval: 6000,
      slides: [
        {
          heading: 'Spring Collection',
          image: {
            src: {
              mediaType: 'image',
              url: 'https://cdn.example.com/hero/spring.jpg'
            },
            originalUrl: 'https://cdn.example.com/hero/spring.jpg'
          },
          ctaButtons: [
            {
              label: 'Shop now',
              href: {
                type: 'internal',
                pageId: 'shop',
                path: '/shop'
              },
              variant: 'primary'
            }
          ]
        }
      ]
    })
    expect(HeroCarouselDef.schema.safeParse(props.content).success).toBe(true)
  })

  it.each([
    ['right', 'image-right'],
    [' RIGHT ', 'image-right'],
    ['left', 'image-left'],
    [' Left ', 'image-left'],
    ['image-right', 'image-right'],
    ['image-left', 'image-left'],
    ['center', 'center']
  ])('normalizes hero-with-image layout alias %s to %s', (layout, expectedLayout) => {
    const detection: DetectionResult = {
      id: `hero-with-image-layout-${String(layout).trim()}`,
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Layout hero',
        layout,
        image: {
          src: 'https://cdn.example.com/assets/hero-layout.jpg',
          alt: 'Layout hero'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.layout).toBe(expectedLayout)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('preserves hero-with-image mediaId when src payload nests media metadata', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-nested-src',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Nested hero image',
        image: {
          src: {
            mediaId: 'nested-hero-media',
            originalUrl: 'https://cdn.example.com/assets/hero-nested-object.jpg'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))
    expect(props.content?.image).toEqual(
      expect.objectContaining({
        src: expect.objectContaining({
          mediaId: 'nested-hero-media',
          mediaType: 'image',
          url: 'https://cdn.example.com/assets/hero-nested-object.jpg'
        }),
        originalUrl: 'https://cdn.example.com/assets/hero-nested-object.jpg'
      })
    )
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('retains mediaId-backed hero image payloads with originalUrl fallback', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-media',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Media backed hero',
        layout: 'image-right',
        image: {
          mediaId: 'media-123',
          originalUrl: 'https://cdn.example.com/assets/hero.jpg'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.image).toEqual(
      expect.objectContaining({
        src: expect.objectContaining({
          mediaId: 'media-123',
          mediaType: 'image',
          url: 'https://cdn.example.com/assets/hero.jpg'
        }),
        originalUrl: 'https://cdn.example.com/assets/hero.jpg'
      })
    )

    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('emits diagnostics when mediaId-backed hero image lacks a usable URL', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-missing-src',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Broken hero image',
        image: {
          mediaId: 'media-missing-src'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.image).toEqual(
      expect.objectContaining({
        src: expect.objectContaining({
          mediaId: 'media-missing-src',
          mediaType: 'image'
        })
      })
    )

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'hero-with-image',
          field: 'image',
          issue: 'media-src-missing'
        })
      ])
    )
  })

  it('emits fatal-classified warnings for malformed hero image payloads', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-malformed-object',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Broken media payload',
        image: {
          asset: {
            id: 'asset-without-url'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.image).toBeUndefined()

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'hero-with-image',
          field: 'image',
          issue: 'invalid-subcomponent'
        })
      ])
    )
    expect(warnings.some(warning => getNormalizationWarningSeverity(warning) === 'fatal')).toBe(true)
  })

  it('warns on malformed hero-with-image entries while keeping valid detector data', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-invalid',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'Check coverage',
        image: '   ',
        heroImage: { src: 'https://cdn.example.com/hero.jpg', altText: 'Coverage map' },
        ctaButtons: ['not-an-object', { label: 'See plans', href: '/plans', variant: 'secondary' }, 42]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content).toMatchObject({
      heading: 'Check coverage',
      image: {
        src: {
          mediaType: 'image',
          mediaId: 'detected:cdn-example-com-hero-jpg',
          url: 'https://cdn.example.com/hero.jpg',
          alt: 'Coverage map'
        },
        alt: 'Coverage map'
      },
      ctaButtons: [
        {
          label: 'See plans',
          href: {
            type: 'internal',
            pageId: 'plans',
            path: '/plans'
          },
          variant: 'secondary'
        }
      ]
    })

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'hero-with-image',
          field: 'ctaButtons',
          issue: 'invalid-subcomponent'
        }),
        expect.objectContaining({
          parentType: 'hero-with-image',
          field: 'image',
          issue: 'invalid-subcomponent'
        })
      ])
    )
  })

  it('preserves structured hero-with-image CTA smart links from detector output', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-structured-ctas',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'We are Example Agency',
        image: {
          src: {
            mediaId: 'detected:example-agency-hero',
            mediaType: 'image',
            url: 'https://example.com/example-agency.jpg'
          },
          alt: 'Example Agency hero'
        },
        ctaButtons: [
          {
            label: 'View the timeline',
            href: {
              type: 'internal',
              pageId: 'timeline',
              path: '/timeline'
            },
            variant: 'primary'
          },
          {
            label: 'Visit Example Agency',
            href: {
              type: 'external',
              url: 'https://agency.example.com/'
            },
            variant: 'secondary'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.ctaButtons).toEqual([
      {
        label: 'View the timeline',
        href: {
          type: 'internal',
          pageId: 'timeline',
          path: '/timeline'
        },
        variant: 'primary'
      },
      {
        label: 'Visit Example Agency',
        href: {
          type: 'external',
          url: 'https://agency.example.com/'
        },
        variant: 'secondary'
      }
    ])
    expect(consumeNormalizationWarnings()).toEqual([])
  })

  it('keeps labeled hero-with-image CTA content when the source link is empty', () => {
    const detection: DetectionResult = {
      id: 'hero-with-image-empty-cta-href',
      type: 'hero-with-image',
      bounds: baseBounds,
      content: {
        heading: 'We are Example Agency',
        image: {
          src: {
            mediaId: 'detected:example-agency-hero',
            mediaType: 'image',
            url: 'https://example.com/example-agency.jpg'
          },
          alt: 'Example Agency hero'
        },
        ctaButtons: [
          {
            label: 'Watch our showreel',
            href: {
              type: 'external',
              url: ''
            },
            variant: 'primary'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('hero-with-image'))

    expect(props.content?.ctaButtons).toEqual([
      {
        label: 'Watch our showreel',
        variant: 'primary'
      }
    ])

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'hero-with-image',
          field: 'ctaButtons',
          issue: 'suspicious-value'
        })
      ])
    )
    expect(warnings.some(warning => getNormalizationWarningSeverity(warning) === 'fatal')).toBe(false)
  })

  it('normalizes two-column layout payloads without using props content mirrors', () => {
    const detection: DetectionResult = {
      id: 'two-column-1',
      type: 'two-column',
      bounds: baseBounds,
      content: {
        leftColumn: [
          {
            type: 'text-block',
            heading: 'Supporting every student',
            body: '<p>We back every learner with personalised attention.</p>'
          },
          {
            type: 'cta-simple',
            heading: 'Explore programs',
            primaryButton: {
              text: 'Explore programs',
              url: '/programs',
              variant: 'primary',
              external: true
            }
          }
        ],
        rightColumn: [
          {
            type: 'image-gallery',
            images: [
              {
                url: 'https://cdn.example.com/library/students.jpg',
                alt: 'Students collaborating in a shared workspace'
              }
            ]
          }
        ],
        columnRatio: '60-40',
        reverseOnMobile: true,
        gap: 'medium',
        region: 'main'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('two-column'))

    expect(props.content).toMatchObject({
      columnRatio: '60-40',
      reverseOnMobile: true,
      gap: 'medium',
      leftColumn: [
        {
          type: 'text-block',
          content: expect.objectContaining({
            body: '<p>We back every learner with personalised attention.</p>'
          })
        },
        {
          type: 'cta-simple',
          content: expect.objectContaining({
            primaryButton: {
              label: 'Explore programs',
              href: {
                type: 'internal',
                pageId: 'programs',
                path: '/programs'
              },
              variant: 'primary',
              external: true
            }
          })
        }
      ],
      rightColumn: [
        {
          type: 'image-gallery',
          content: expect.objectContaining({
            images: [
              expect.objectContaining({
                originalUrl: 'https://cdn.example.com/library/students.jpg'
              })
            ]
          })
        }
      ]
    })
    expect(TwoColumnDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'two-column',
          issue: 'suspicious-value',
          message: expect.stringContaining('legacy text/url/link fields')
        })
      ])
    )
  })

  it('normalizes image-gallery media aliases into canonical image entries', () => {
    const detection: DetectionResult = {
      id: 'gallery-1',
      type: 'image-gallery',
      bounds: baseBounds,
      content: {
        images: [
          'https://cdn.example.com/gallery/office-1.jpg',
          {
            url: 'https://cdn.example.com/gallery/office-2.jpg',
            alt: 'Office collaboration',
            caption: 'Collaboration space',
            width: '1200',
            height: '800'
          },
          {
            src: {
              mediaId: 'media-gallery-3',
              mediaType: 'image',
              url: 'https://cdn.example.com/gallery/office-3.jpg'
            },
            alt: 'Design review'
          }
        ],
        layout: 'masonry',
        columns: '4',
        gap: 'compact',
        showCaptions: 'yes',
        enableLightbox: 'false',
        heading: 'Gallery heading'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('image-gallery'))

    expect(props.content).toEqual({
      images: [
        {
          originalUrl: 'https://cdn.example.com/gallery/office-1.jpg',
          alt: 'Gallery image 1'
        },
        {
          originalUrl: 'https://cdn.example.com/gallery/office-2.jpg',
          alt: 'Office collaboration',
          caption: 'Collaboration space',
          width: 1200,
          height: 800
        },
        {
          src: {
            mediaId: 'media-gallery-3',
            mediaType: 'image',
            url: 'https://cdn.example.com/gallery/office-3.jpg',
            alt: 'Design review'
          },
          originalUrl: 'https://cdn.example.com/gallery/office-3.jpg',
          alt: 'Design review'
        }
      ],
      displayMode: 'masonry',
      columns: 4,
      spacing: 'tight',
      showCaptions: true,
      enableLightbox: false
    })
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'image-gallery',
          field: 'heading',
          issue: 'unknown-field'
        })
      ])
    )
  })

  it('reports invalid image-gallery images instead of persisting empty media entries', () => {
    const detection: DetectionResult = {
      id: 'gallery-invalid',
      type: 'image-gallery',
      bounds: baseBounds,
      content: {
        images: [
          '/departments/about/',
          null
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('image-gallery'))
    const warnings = consumeNormalizationWarnings()

    expect(props.content.images).toEqual([])
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'image-gallery',
          field: 'images.0',
          issue: 'invalid-value'
        }),
        expect.objectContaining({
          parentType: 'image-gallery',
          field: 'images.1',
          issue: 'invalid-value'
        })
      ])
    )
  })

  it('drops image-gallery media references without renderable URLs', () => {
    const detection: DetectionResult = {
      id: 'gallery-media-id-only',
      type: 'image-gallery',
      bounds: baseBounds,
      content: {
        images: [
          {
            src: {
              mediaId: 'media-without-url',
              mediaType: 'image'
            },
            alt: 'Missing resolved URL'
          },
          {
            src: {
              mediaId: 'media-with-url',
              mediaType: 'image',
              url: 'https://cdn.example.com/gallery/valid.jpg'
            },
            alt: 'Resolved URL'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('image-gallery'))
    const warnings = consumeNormalizationWarnings()

    expect(props.content.images).toEqual([
      {
        src: {
          mediaId: 'media-with-url',
          mediaType: 'image',
          url: 'https://cdn.example.com/gallery/valid.jpg',
          alt: 'Resolved URL'
        },
        originalUrl: 'https://cdn.example.com/gallery/valid.jpg',
        alt: 'Resolved URL'
      }
    ])
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'image-gallery',
          field: 'images.0',
          issue: 'invalid-value'
        })
      ])
    )
  })

  it('normalizes content-feed item aliases into strict pinned entries', () => {
    const detection: DetectionResult = {
      id: 'content-feed-1',
      type: 'content-feed',
      bounds: baseBounds,
      content: {
        heading: 'Latest news',
        layout: 'tiles',
        source: {
          path: '/news',
          ancestor: 'news-root',
          site: 'site-1'
        },
        items: [
          {
            headline: 'Hospital update published',
            summary: 'A short update from the team.',
            url: '/news/hospital-update',
            thumbnailUrl: 'https://cdn.example.com/news/update.jpg',
            publishDate: '2024-05-01',
            categories: ['News'],
            trackingId: 'unsupported'
          },
          {
            title: 'Media announcement',
            href: { type: 'external', url: 'https://example.com/media' },
            image: {
              src: {
                mediaId: 'media-feed-2',
                mediaType: 'image',
                url: 'https://cdn.example.com/news/media.jpg'
              },
              alt: 'Media room'
            },
            tag: 'Media'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('content-feed'))
    const warnings = consumeNormalizationWarnings()

    expect(props.content).toEqual({
      heading: 'Latest news',
      layout: 'card-grid',
      source: {
        pathPrefix: '/news',
        ancestorId: 'news-root',
        siteId: 'site-1'
      },
      pinned: [
        {
          title: 'Hospital update published',
          excerpt: 'A short update from the team.',
          href: {
            type: 'internal',
            pageId: 'news-hospital-update',
            path: '/news/hospital-update'
          },
          image: {
            alt: 'Hospital update published',
            originalUrl: 'https://cdn.example.com/news/update.jpg'
          },
          date: '2024-05-01',
          category: 'News'
        },
        {
          title: 'Media announcement',
          href: { type: 'external', url: 'https://example.com/media' },
          image: {
            src: {
              mediaId: 'media-feed-2',
              mediaType: 'image',
              url: 'https://cdn.example.com/news/media.jpg',
              alt: 'Media room'
            },
            alt: 'Media room',
            originalUrl: 'https://cdn.example.com/news/media.jpg'
          },
          category: 'Media'
        }
      ]
    })
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'content-feed',
          field: 'pinned',
          issue: 'unknown-field'
        })
      ])
    )
    expect(ContentFeedDef.schema.safeParse(props.content).success).toBe(true)
  })

  it('drops content-feed pinned entries without titles and images without renderable URLs', () => {
    const detection: DetectionResult = {
      id: 'content-feed-invalid',
      type: 'content-feed',
      bounds: baseBounds,
      content: {
        pinned: [
          { excerpt: 'Missing title', href: '/news/missing-title' },
          {
            title: 'Valid title',
            image: {
              src: {
                mediaId: 'media-no-url',
                mediaType: 'image'
              },
              alt: 'No URL'
            }
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('content-feed'))
    const warnings = consumeNormalizationWarnings()

    expect(props.content.pinned).toEqual([
      {
        title: 'Valid title'
      }
    ])
    expect(props.content.source).toBeUndefined()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'content-feed',
          field: 'pinned',
          issue: 'missing-required-field'
        }),
        expect.objectContaining({
          parentType: 'content-feed',
          field: 'pinned.1.image',
          issue: 'invalid-value'
        })
      ])
    )
    expect(ContentFeedDef.schema.safeParse(props.content).success).toBe(true)
  })

  it('preserves extensionless CDN thumbnail URLs for content-feed imports', () => {
    const detection: DetectionResult = {
      id: 'content-feed-extensionless-cdn',
      type: 'content-feed',
      bounds: baseBounds,
      content: {
        pinned: [
          {
            title: 'Extensionless CDN image',
            thumbnailUrl: 'https://cdn.example.com/post'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('content-feed'))

    expect(props.content.pinned).toEqual([
      {
        title: 'Extensionless CDN image',
        image: {
          alt: 'Extensionless CDN image',
          originalUrl: 'https://cdn.example.com/post'
        }
      }
    ])
    expect(ContentFeedDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([])
  })

  it('canonicalizes typed content-feed link objects before schema validation', () => {
    const detection: DetectionResult = {
      id: 'content-feed-typed-links',
      type: 'content-feed',
      bounds: baseBounds,
      content: {
        pinned: [
          {
            title: 'External link with href',
            href: {
              type: 'external',
              href: 'https://example.com/news/external'
            }
          },
          {
            title: 'Bare domain external link',
            href: {
              type: 'external',
              url: 'example.com/news/bare'
            }
          },
          {
            title: 'Internal link with href',
            href: {
              type: 'internal',
              href: '/news/internal'
            }
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('content-feed'))

    expect(props.content.pinned).toEqual([
      {
        title: 'External link with href',
        href: {
          type: 'external',
          url: 'https://example.com/news/external'
        }
      },
      {
        title: 'Bare domain external link',
        href: {
          type: 'external',
          url: 'https://example.com/news/bare'
        }
      },
      {
        title: 'Internal link with href',
        href: {
          type: 'internal',
          pageId: 'news-internal',
          path: '/news/internal'
        }
      }
    ])
    expect(ContentFeedDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([])
  })

  it('normalizes logo-cloud aliases into schema-valid logo items', () => {
    const detection: DetectionResult = {
      id: 'logo-cloud-1',
      type: 'logo-cloud',
      bounds: baseBounds,
      content: {
        caption: 'Trusted by leading teams',
        logoSize: 'large',
        grayscale: 'false',
        animateScroll: 'yes',
        logos: [
          {
            name: 'Acme',
            url: 'https://cdn.example.com/logos/acme',
            link: 'https://acme.example.com',
            caption: 'Launch partner'
          },
          {
            id: 'northwind',
            src: {
              mediaId: 'media-northwind',
              mediaType: 'image',
              url: 'https://cdn.example.com/logos/northwind.svg'
            },
            alt: 'Northwind'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('logo-cloud'))

    expect(props.content).toEqual({
      caption: 'Trusted by leading teams',
      size: 'large',
      grayscale: false,
      animateScroll: true,
      logos: [
        {
          id: 'acme',
          alt: 'Acme',
          originalUrl: 'https://cdn.example.com/logos/acme',
          href: {
            type: 'external',
            url: 'https://acme.example.com'
          },
          caption: 'Launch partner'
        },
        {
          id: 'northwind',
          src: {
            mediaId: 'media-northwind',
            mediaType: 'image',
            url: 'https://cdn.example.com/logos/northwind.svg',
            alt: 'Northwind'
          },
          alt: 'Northwind',
          originalUrl: 'https://cdn.example.com/logos/northwind.svg'
        }
      ]
    })
    expect(LogoStripDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.0.href',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('preserves extensionless Kontent asset logo URLs for logo-cloud imports', () => {
    const detection: DetectionResult = {
      id: 'logo-cloud-kontent-assets',
      type: 'logo-cloud',
      bounds: baseBounds,
      content: {
        logos: [
          {
            id: 'clipsal',
            src: {
              mediaId: 'detected:clipsal-logo',
              mediaType: 'image',
              url: 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/54398a66-317a-4eb7-b62e-a25662b73955/Clipsal%20by%20Schneider%20logo%20-%20DARK'
            },
            alt: 'Clipsal logo'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('logo-cloud'))

    expect(props.content).toEqual({
      logos: [
        {
          id: 'clipsal',
          src: {
            mediaId: 'detected:clipsal-logo',
            mediaType: 'image',
            url: 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/54398a66-317a-4eb7-b62e-a25662b73955/Clipsal%20by%20Schneider%20logo%20-%20DARK',
            alt: 'Clipsal logo'
          },
          alt: 'Clipsal logo',
          originalUrl: 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/54398a66-317a-4eb7-b62e-a25662b73955/Clipsal%20by%20Schneider%20logo%20-%20DARK'
        }
      ]
    })
    expect(LogoStripDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([])
  })

  it('normalizes logo-cloud collection aliases and bare logo hrefs', () => {
    const detection: DetectionResult = {
      id: 'logo-cloud-aliases',
      type: 'logo-cloud',
      bounds: baseBounds,
      content: {
        brands: [
          {
            name: 'Bare Domain',
            logo: 'https://cdn.example.com/logos/bare.svg',
            website: 'www.bare-example.com'
          },
          {
            name: 'Protocol Relative',
            logo: 'https://cdn.example.com/logos/protocol.svg',
            website: '//protocol.example.com'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('logo-cloud'))

    expect(props.content.logos).toEqual([
      expect.objectContaining({
        id: 'bare-domain',
        originalUrl: 'https://cdn.example.com/logos/bare.svg',
        href: { type: 'external', url: 'https://www.bare-example.com' }
      }),
      expect.objectContaining({
        id: 'protocol-relative',
        originalUrl: 'https://cdn.example.com/logos/protocol.svg',
        href: { type: 'external', url: 'https://protocol.example.com' }
      })
    ])
    expect(LogoStripDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.0.href',
          issue: 'suspicious-value'
        }),
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.1.href',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('drops text-only logo-cloud brand labels without failing the component', () => {
    const detection: DetectionResult = {
      id: 'logo-cloud-text-only',
      type: 'logo-cloud',
      bounds: baseBounds,
      content: {
        caption: 'Leading Organizations Learn from NNGroup',
        logos: [
          { id: 'visa', alt: 'Visa' },
          { id: 'pg', alt: 'P&G' },
          {
            id: 'amazon',
            src: {
              mediaId: 'detected:amazon-logo-home',
              mediaType: 'image',
              url: 'https://media.nngroup.com/static/img/logos/amazon-logo-home.svg'
            },
            alt: 'Amazon Logo'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('logo-cloud'))

    expect(props.content.logos).toEqual([
      expect.objectContaining({
        id: 'amazon',
        alt: 'Amazon Logo',
        src: expect.objectContaining({
          mediaId: 'detected:amazon-logo-home',
          mediaType: 'image',
          url: 'https://media.nngroup.com/static/img/logos/amazon-logo-home.svg'
        })
      })
    ])
    expect(LogoStripDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.0',
          issue: 'suspicious-value'
        }),
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.1',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('keeps all-text-only logo-cloud entries empty and warning-backed for cleanup', () => {
    const detection: DetectionResult = {
      id: 'logo-cloud-all-text-only',
      type: 'logo-cloud',
      bounds: baseBounds,
      content: {
        caption: 'Trusted by leading organizations',
        logos: [
          { id: 'visa', alt: 'Visa' },
          { id: 'pg', alt: 'P&G' }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('logo-cloud'))

    expect(props.content).toEqual({
      caption: 'Trusted by leading organizations',
      logos: []
    })
    expect(LogoStripDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.0',
          issue: 'suspicious-value'
        }),
        expect.objectContaining({
          parentType: 'logo-cloud',
          field: 'logos.1',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('keeps the logo-cloud atlas sample schema-valid', () => {
    expect(LogoStripDef.schema.safeParse(logoCloudAtlasSpec.content).success).toBe(true)
  })

  it('normalizes nested sidemenu aliases inside two-column columns', () => {
    const detection: DetectionResult = {
      id: 'two-column-example-health-sidemenu',
      type: 'two-column',
      bounds: baseBounds,
      content: {
        columnRatio: '25-75',
        leftColumn: [
          {
            id: 'sidemenu-example-health',
            type: 'sidemenu',
            content: {
              heading: 'In this section',
              menuItems: [
                {
                  label: 'About the Example Health',
                  href: {
                    type: 'internal',
                    pageId: 'about',
                    path: '/example-health/about/'
                  }
                }
              ]
            }
          }
        ],
        rightColumn: []
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('two-column'))

    expect(props.content?.leftColumn?.[0]).toEqual({
      id: 'sidemenu-example-health',
      type: 'sidemenu',
      content: {
        title: 'In this section',
        items: [
          {
            label: 'About the Example Health',
            href: {
              type: 'internal',
              pageId: 'about',
              path: '/example-health/about/'
            }
          }
        ]
      }
    })
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes sidemenu section links into schema-valid grouped items', () => {
    const detection: DetectionResult = {
      id: 'sidemenu-section-links',
      type: 'sidemenu',
      bounds: baseBounds,
      content: {
        title: 'Resources',
        sections: [
          {
            heading: 'Documentation',
            links: [
              { label: 'Overview', href: '/docs' },
              { label: 'External', href: 'example.com/docs' }
            ]
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('sidemenu'))

    expect(props.content).toEqual({
      title: 'Resources',
      sections: [
        {
          heading: 'Documentation',
          items: [
            {
              label: 'Overview',
              href: {
                type: 'internal',
                pageId: 'docs',
                path: '/docs'
              }
            },
            {
              label: 'External',
              href: {
                type: 'external',
                url: 'https://example.com/docs'
              }
            }
          ]
        }
      ]
    })
    expect(SideMenuDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('keeps the sidemenu atlas sample schema-valid', () => {
    expect(SideMenuDef.schema.safeParse(sidemenuAtlasSpec.content).success).toBe(true)
  })

  it('normalizes cta-simple legacy buttons into schema-valid CTAButton objects', () => {
    const detection: DetectionResult = {
      id: 'cta-simple-1',
      type: 'cta-simple',
      bounds: baseBounds,
      content: {
        heading: 'Explore our 80 schools',
        body: 'Catholic schools have a history of academic excellence.',
        primaryButton: {
          text: 'Find a school',
          url: '/our-schools/find-a-school',
          variant: 'primary'
        },
        secondaryButton: {
          text: 'Contact us',
          url: '/contact',
          variant: 'secondary'
        },
        alignment: 'center',
        backgroundVariant: 'surface',
        region: 'main'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-simple'))

    expect(props.content).toMatchObject({
      heading: 'Explore our 80 schools',
      body: 'Catholic schools have a history of academic excellence.',
      primaryButton: {
        label: 'Find a school',
        href: {
          type: 'internal',
          pageId: 'our-schools-find-a-school',
          path: '/our-schools/find-a-school'
        },
        variant: 'primary'
      },
      secondaryButton: {
        label: 'Contact us',
        href: {
          type: 'internal',
          pageId: 'contact',
          path: '/contact'
        },
        variant: 'secondary'
      },
      alignment: 'center',
      backgroundVariant: 'surface'
    })
    expect(props.content).not.toHaveProperty('region')
    expect(CTASimpleDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'cta-simple',
          issue: 'suspicious-value',
          message: expect.stringContaining('legacy text/url/link fields')
        })
      ])
    )
  })

  it('normalizes cta-banner legacy buttons and media references into schema-valid content', () => {
    const detection: DetectionResult = {
      id: 'cta-banner-1',
      type: 'cta-banner',
      bounds: baseBounds,
      content: {
        heading: 'Support the hospital',
        subheading: 'Your support helps children and families.',
        primaryButton: {
          text: 'Donate now',
          url: '/donate',
          variant: 'filled'
        },
        secondaryButton: {
          label: 'Learn more',
          href: 'www.example.com/support',
          variant: 'ghost'
        },
        backgroundImage: {
          src: {
            mediaId: 'detected:cta-bg',
            mediaType: 'image',
            url: 'https://cdn.example.com/cta-bg.jpg'
          }
        },
        fullWidth: 'true',
        alignment: 'center',
        region: 'main'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-banner'))

    expect(props.content).toMatchObject({
      heading: 'Support the hospital',
      subheading: 'Your support helps children and families.',
      primaryButton: {
        label: 'Donate now',
        href: {
          type: 'internal',
          pageId: 'donate',
          path: '/donate'
        },
        variant: 'primary'
      },
      secondaryButton: {
        label: 'Learn more',
        href: {
          type: 'external',
          url: 'https://www.example.com/support'
        },
        variant: 'outline'
      },
      backgroundImage: 'https://cdn.example.com/cta-bg.jpg',
      fullWidth: true,
      alignment: 'center'
    })
    expect(props.content).not.toHaveProperty('region')
    expect(CTABannerDef.schema.safeParse(props.content).success).toBe(true)
  })

  it('canonicalizes cta-banner external buttons with relative URLs as internal links', () => {
    const detection: DetectionResult = {
      id: 'cta-banner-relative-external',
      type: 'cta-banner',
      bounds: baseBounds,
      content: {
        heading: 'Get access to our Digital Product Design Guide',
        primaryButton: {
          label: 'Get it now',
          href: {
            type: 'external',
            url: '/digital-product-design-guide'
          }
        },
        backgroundColor: '#300a44'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-banner'))

    expect(props.content?.primaryButton).toEqual({
      label: 'Get it now',
      href: {
        type: 'internal',
        pageId: 'digital-product-design-guide',
        path: '/digital-product-design-guide'
      }
    })
    expect(CTABannerDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([])
  })

  it('keeps labeled cta-banner buttons without href as nonfatal content', () => {
    const detection: DetectionResult = {
      id: 'cta-banner-label-only',
      type: 'cta-banner',
      bounds: baseBounds,
      content: {
        heading: 'Talk to our team',
        primaryButton: {
          label: 'Contact us',
          href: ''
        },
        backgroundColor: '#300a44'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-banner'))

    expect(props.content?.primaryButton).toEqual({
      label: 'Contact us'
    })
    expect(CTABannerDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([
      expect.objectContaining({
        parentType: 'cta-banner',
        field: 'primaryButton',
        issue: 'suspicious-value'
      })
    ])
  })

  it('repairs cta-banner trusted KC background image URLs with dangling extensions', () => {
    const detection: DetectionResult = {
      id: 'cta-banner-dangling-kc-image',
      type: 'cta-banner',
      bounds: baseBounds,
      content: {
        heading: 'Supporting Partner of Beyond Blue',
        backgroundImage: 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/034a4c92-7336-41a8-bd49-b0847153ffcb/Beyond%20Blue%20Proud%20Partner%20Graphic.'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-banner'))

    expect(props.content?.backgroundImage).toBe(
      'https://assets-us-01.kc-usercontent.com/90e79cae-25c6-00b5-6f5b-27efe5c250ab/034a4c92-7336-41a8-bd49-b0847153ffcb/Beyond%20Blue%20Proud%20Partner%20Graphic.png'
    )
    expect(CTABannerDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([
      expect.objectContaining({
        parentType: 'cta-banner',
        field: 'backgroundImage',
        issue: 'suspicious-value',
        message: expect.stringContaining('dangling trusted asset extension')
      })
    ])
  })

  it('repairs cta-banner trusted KC background image URLs with dangling extensions before query params', () => {
    const detection: DetectionResult = {
      id: 'cta-banner-dangling-kc-image-query',
      type: 'cta-banner',
      bounds: baseBounds,
      content: {
        heading: 'Supporting Partner of Beyond Blue',
        backgroundImage: 'https://assets-us-01.kc-usercontent.com:443/90e79cae-25c6-00b5-6f5b-27efe5c250ab/034a4c92-7336-41a8-bd49-b0847153ffcb/Beyond%20Blue%20Proud%20Partner%20Graphic.?w=900&amp;fm=webp'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-banner'))

    expect(props.content?.backgroundImage).toBe(
      'https://assets-us-01.kc-usercontent.com/90e79cae-25c6-00b5-6f5b-27efe5c250ab/034a4c92-7336-41a8-bd49-b0847153ffcb/Beyond%20Blue%20Proud%20Partner%20Graphic.png?w=900&fm=webp'
    )
    expect(CTABannerDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual([
      expect.objectContaining({
        parentType: 'cta-banner',
        field: 'backgroundImage',
        issue: 'suspicious-value',
        message: expect.stringContaining('dangling trusted asset extension')
      })
    ])
  })

  it('preserves typed CTA SmartLinks for email and phone buttons', () => {
    const detection: DetectionResult = {
      id: 'cta-simple-smartlinks',
      type: 'cta-simple',
      bounds: baseBounds,
      content: {
        heading: 'Need help?',
        primaryButton: {
          label: 'Email us',
          href: { type: 'email', href: 'hello@example.com' }
        },
        secondaryButton: {
          label: 'Call now',
          href: { type: 'phone', href: '+61234567890' }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-simple'))

    expect(props.content?.primaryButton?.href).toEqual({ type: 'email', href: 'hello@example.com' })
    expect(props.content?.secondaryButton?.href).toEqual({ type: 'phone', href: '+61234567890' })
    expect(CTASimpleDef.schema.safeParse(props.content).success).toBe(true)
  })

  it('keeps CTA atlas samples schema-valid', () => {
    expect(CTASimpleDef.schema.safeParse(ctaSimpleAtlasSpec.content).success).toBe(true)
    expect(CTABannerDef.schema.safeParse(ctaBannerAtlasSpec.content).success).toBe(true)
  })

  it('keeps statistics quote team and testimonials atlas samples schema-valid', () => {
    expect(StatisticsDef.schema.safeParse(statisticsAtlasSpec.content).success).toBe(true)
    expect(QuoteBlockDef.schema.safeParse(quoteBlockAtlasSpec.content).success).toBe(true)
    expect(TeamGridDef.schema.safeParse(teamGridAtlasSpec.content).success).toBe(true)
    expect(TestimonialSliderDef.schema.safeParse(testimonialsAtlasSpec.content).success).toBe(true)
  })

  it('sets timeline variant to progress when progress cues are present', () => {
    const detection: DetectionResult = {
      id: 'timeline-progress',
      type: 'timeline',
      bounds: baseBounds,
      content: {
        title: 'Our process',
        semanticTokens: ['progress-stepper'],
        className: 'timeline progress-stepper',
        metadata: {
          keywords: ['Journey progress', 'Steps overview']
        },
        events: [
          {
            type: 'timeline-event',
            date: '1',
            title: 'Start',
            description: 'Submit your info.'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('timeline'))

    expect(props.content?.variant).toBe('progress')
    expect(props.variant).toBe('progress')
  })

  it('warns and drops invalid CTA buttons while preserving valid fields', () => {
    const detection: DetectionResult = {
      id: 'cta-simple-invalid',
      type: 'cta-simple',
      bounds: baseBounds,
      content: {
        heading: 'Call us',
        primaryButton: 'not-an-object',
        secondaryButton: {
          text: 'Learn more'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-simple'))

    expect(props.content).toEqual({
      heading: 'Call us'
    })

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'cta-simple',
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('Dropped primaryButton')
        }),
        expect.objectContaining({
          parentType: 'cta-simple',
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('Dropped secondaryButton')
        })
      ])
    )
  })

  it('normalizes testimonials aliases into schema-valid testimonial items', () => {
    const detection: DetectionResult = {
      id: 'testimonials-1',
      type: 'testimonials',
      bounds: baseBounds,
      content: {
        reviews: [
          {
            type: 'testimonial-item',
            text: 'We encourage our students to embrace their culture.',
            person: 'Julie Waddell',
            title: 'Jarara Indigenous Education Unit',
            image: { src: 'https://cdn.example.com/avatars/julie.jpg' },
            rating: '5',
            extra: 'remove me'
          },
          {
            type: 'testimonial-item',
            author: 'Missing Quote'
          }
        ],
        autoPlayInterval: '5000',
        showNavigation: 'true'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('testimonials'))

    expect(props.content).toEqual({
      testimonials: [
        {
          id: 'testimonial-item-julie-waddell',
          quote: 'We encourage our students to embrace their culture.',
          author: 'Julie Waddell',
          role: 'Jarara Indigenous Education Unit',
          avatar: 'https://cdn.example.com/avatars/julie.jpg',
          rating: 5
        }
      ],
      autoPlayInterval: 5000,
      showNavigation: true
    })
    expect(TestimonialSliderDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'testimonials',
          issue: 'missing-required-field',
          field: 'testimonials'
        })
      ])
    )
  })

  it('warns and drops invalid testimonial entries while preserving valid ones', () => {
    const valid = {
      type: 'testimonial-item',
      id: 'testimonial-item-vivian-orji',
      quote: 'The best school ever!',
      author: 'Vivian Orji',
      avatar: 'https://cdn.example.com/avatars/vivian.jpg'
    }

    const validResult = SUBCOMPONENT_NORMALIZERS['testimonial-item'](valid, {
      canonicalType: 'testimonial-item',
      parentCanonicalType: 'testimonials',
      field: 'testimonials',
      index: 0
    })

    expect(validResult.value).toEqual(valid)
    expect(validResult.warnings).toHaveLength(0)

    const invalidResult = SUBCOMPONENT_NORMALIZERS['testimonial-item']('not-an-object', {
      canonicalType: 'testimonial-item',
      parentCanonicalType: 'testimonials',
      field: 'testimonials',
      index: 1
    })

    expect(invalidResult.value).toBeNull()
    expect(invalidResult.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('testimonial-item')
        })
      ])
    )
  })

  it('preserves hero-carousel slides from the detector and skips default scaffolding', () => {
    const detection: DetectionResult = {
      id: 'hero-carousel-1',
      type: 'hero-carousel',
      bounds: baseBounds,
      content: {
        slides: [
          {
            id: 'detector-slide-1',
            heading: 'Coffee with a Cop',
            body: 'Join local officers for conversations over coffee.',
            image: {
              src: 'https://cdn.example.com/hero/coffee.jpg',
              alt: 'Community members enjoying coffee with officers.'
            },
            ctaButtons: [
              { label: 'Read more', href: '/promotions/coffee-with-a-cop', variant: 'primary' },
              { text: 'Plan your visit', url: '/visit', variant: 'secondary' }
            ]
          }
        ]
      },
      metadata: {}
    }

    const defaultScaffold = {
      slides: [
        {
          id: 'default-slide',
          heading: 'Default Heading',
          body: 'Default body copy',
          ctaButtons: [{ label: 'Default CTA', href: '/default' }]
        }
      ]
    }

    const heroCarouselType = {
      ...createComponentType('hero-carousel'),
      defaultConfig: { props: defaultScaffold }
    } as unknown as ImportComponentType

    const propsWithSlides = extractComponentProps(detection, heroCarouselType)

    expect(propsWithSlides.content?.slides).toEqual([
      {
        id: 'detector-slide-1',
        heading: 'Coffee with a Cop',
        body: 'Join local officers for conversations over coffee.',
        image: {
          src: {
            mediaType: 'image',
            mediaId: 'detected:cdn-example-com-hero-coffee-jpg',
            url: 'https://cdn.example.com/hero/coffee.jpg',
            alt: 'Community members enjoying coffee with officers.'
          },
          originalUrl: 'https://cdn.example.com/hero/coffee.jpg',
          alt: 'Community members enjoying coffee with officers.'
        },
        ctaButtons: [
          {
            label: 'Read more',
            href: {
              type: 'internal',
              pageId: 'promotions-coffee-with-a-cop',
              path: '/promotions/coffee-with-a-cop'
            },
            variant: 'primary'
          },
          {
            label: 'Plan your visit',
            href: {
              type: 'internal',
              pageId: 'visit',
              path: '/visit'
            },
            variant: 'secondary'
          }
        ]
      }
    ])
    expect(propsWithSlides).not.toHaveProperty('slides')
    expect(consumeNormalizationWarnings()).toHaveLength(0)

    const detectionWithoutSlides: DetectionResult = {
      id: 'hero-carousel-2',
      type: 'hero-carousel',
      bounds: baseBounds,
      content: {},
      metadata: {}
    }

    const propsWithoutSlides = extractComponentProps(detectionWithoutSlides, heroCarouselType)

    expect(propsWithoutSlides.content?.slides).toEqual([])
    expect(propsWithoutSlides).not.toHaveProperty('slides')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('passes cta-with-form payloads through without mutation', () => {
    const detection: DetectionResult = {
      id: 'cta-with-form-1',
      type: 'cta-with-form',
      bounds: baseBounds,
      content: {
        heading: 'Stay in the loop with Bathurst City Centre!',
        subheading:
          "I agree to the and wish to receive Bathurst City Centre's newsletter containing the latest news and offers.",
        placeholder: 'Email address',
        buttonText: 'Sign up',
        privacyText: 'privacy policy',
        privacyLink: 'https://www.qicre.com/privacy-policy',
        layout: 'horizontal',
        region: 'main'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-with-form'))

    const { region: _region, ...expectedContent } = detection.content as Record<string, unknown>
    expect(props.content).toMatchObject(expectedContent)
    expect(props.content).not.toHaveProperty('region')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('retains html consent copy for cta-with-form payloads', () => {
    const detection: DetectionResult = {
      id: 'cta-with-form-2',
      type: 'cta-with-form',
      bounds: baseBounds,
      content: {
        heading: 'Stay informed',
        subheading: 'I agree to the <a href="https://example.com/privacy">privacy policy</a> and marketing emails.',
        placeholder: 'Email address',
        buttonText: 'Subscribe'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-with-form'))

    expect(props.content?.subheadingHtml).toContain('<a href="https://example.com/privacy">')
    expect(props.content?.subheading).toBe('I agree to the privacy policy and marketing emails.')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes footer links, socials, and logo into schema-valid content', () => {
    const rawFooter = {
      logo: {
        src: {
          mediaId: 'footer-logo-media',
          mediaType: 'image',
          url: 'https://cdn.example.com/logo.svg'
        },
        alt: 'Catalyst'
      },
      description: 'Digital experience platform',
      columns: [
        {
          type: 'columnItem',
          id: 'columnItem-company',
          title: 'Company',
          links: [
            {
              type: 'nav-menu-item',
              id: 'nav-menu-item-about',
              label: 'About',
              href: '/about',
              external: false
            },
            {
              type: 'nav-menu-item',
              id: 'nav-menu-item-careers',
              label: 'Careers',
              href: 'https://jobs.example.com',
              external: true
            }
          ]
        }
      ],
      legalLinks: [
        {
          type: 'nav-menu-item',
          id: 'nav-menu-item-privacy',
          label: 'Privacy Policy',
          href: '/privacy',
          external: false
        }
      ],
      socialLinks: [
        {
          type: 'socialLinkItem',
          id: 'socialLinkItem-twitter',
          platform: 'X',
          href: 'https://x.com/catalyst',
          label: 'Twitter'
        }
      ],
      region: 'footer'
    }

    const detection: DetectionResult = {
      id: 'footer-1',
      type: 'footer',
      bounds: baseBounds,
      content: rawFooter,
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('footer'))

    expect(props.content).toEqual({
      logo: {
        src: {
          mediaId: 'footer-logo-media',
          mediaType: 'image',
          url: 'https://cdn.example.com/logo.svg',
          alt: 'Catalyst'
        },
        alt: 'Catalyst',
        originalUrl: 'https://cdn.example.com/logo.svg'
      },
      description: 'Digital experience platform',
      columns: [
        {
          title: 'Company',
          links: [
            {
              label: 'About',
              href: {
                type: 'internal',
                pageId: 'about',
                path: '/about'
              },
              external: false
            },
            {
              label: 'Careers',
              href: {
                type: 'external',
                url: 'https://jobs.example.com'
              },
              external: true
            }
          ]
        }
      ],
      legalLinks: [
        {
          label: 'Privacy Policy',
          href: {
            type: 'internal',
            pageId: 'privacy',
            path: '/privacy'
          },
          external: false
        }
      ],
      socialLinks: [
        {
          platform: 'twitter',
          url: 'https://x.com/catalyst',
          label: 'Twitter'
        }
      ]
    })
    expect(FooterDef.schema.safeParse(props.content).success).toBe(true)
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'footer',
          issue: 'unknown-field'
        })
      ])
    )
  })

  it('does not inject defaults for empty cta-with-form payloads', () => {
    const detection: DetectionResult = {
      id: 'cta-with-form-empty',
      type: 'cta-with-form',
      bounds: baseBounds,
      content: {},
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('cta-with-form'))

    expect(props.content).toEqual({})
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('coerces video embed URLs and boolean flags', () => {
    const detection: DetectionResult = {
      id: 'video-embed-1',
      type: 'video-embed',
      bounds: baseBounds,
      content: {
        url: { mediaId: 'abc123', originalUrl: 'https://youtube.com/watch?v=xyz' },
        autoPlay: 'true',
        allowFullScreen: 'yes',
        muted: '0',
        startTime: ' 120 '
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('video-embed'))

    expect(props.content?.url).toBe('https://youtube.com/watch?v=xyz')
    expect(props.content?.autoPlay).toBe(true)
    expect(props.content?.allowFullScreen).toBe(true)
    expect(props.content?.muted).toBe(false)
    expect(props.content?.startTime).toBe(120)

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toHaveLength(0)
  })

  it('omits article-header placeholders and warns for missing required fields', () => {
    const detection: DetectionResult = {
      id: 'article-header-empty',
      type: 'article-header',
      bounds: baseBounds,
      content: {
        subtitle: 'A short deck'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('article-header'))

    expect(props.content?.title).toBeUndefined()
    expect(props.content?.author).toBeUndefined()
    expect(props.content?.publishDate).toBeUndefined()
    expect(JSON.stringify(props.content)).not.toContain('Article')
    expect(JSON.stringify(props.content)).not.toContain('Guest author')
    expect(JSON.stringify(props.content)).not.toContain('TBD')

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parentType: 'article-header', field: 'title', issue: 'missing-required-field' }),
        expect.objectContaining({ parentType: 'article-header', field: 'author', issue: 'missing-required-field' }),
        expect.objectContaining({ parentType: 'article-header', field: 'publishDate', issue: 'missing-required-field' })
      ])
    )
  })
})
  it('normalizes navbar logos with nested media payloads', () => {
    const detection: DetectionResult = {
      id: 'navbar-logo-nested',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        menuItems: [{ label: 'Home', href: '/' }],
        logo: {
          href: '/home',
          src: {
            mediaId: 'nav-logo-asset',
            signedUrl: 'https://cdn.example.com/object/sign/logos/nav-logo-asset.png',
            originalUrl: 'https://cdn.example.com/assets/nav-logo.svg'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))
    expect(props.content?.logo).toEqual(
      expect.objectContaining({
        mediaId: 'nav-logo-asset',
        src: 'https://cdn.example.com/object/sign/logos/nav-logo-asset.png',
        originalUrl: 'https://cdn.example.com/assets/nav-logo.svg',
        href: '/home'
      })
    )
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('skips consent vendor navbar logo candidates and keeps the site logo', () => {
    consumeNormalizationWarnings()
    const detection: DetectionResult = {
      id: 'navbar-logo-consent-vendor',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        menuItems: [{ label: 'Home', href: '/' }],
        logo: {
          alt: 'Cookieyes logo',
          text: 'CookieYes consent',
          href: 'https://www.cookieyes.com/',
          src: {
            mediaId: 'detected:poweredbtcky-svg',
            mediaType: 'image',
            url: 'https://cdn-cookieyes.com/assets/images/poweredbtcky.svg'
          }
        },
        logoImage: {
          alt: 'Nielsen Norman Group',
          src: {
            mediaId: 'detected:site-logo-svg',
            mediaType: 'image',
            url: 'https://www.example.com/themes/logo.svg'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.logo).toEqual(
      expect.objectContaining({
        alt: 'Nielsen Norman Group',
        originalUrl: 'https://www.example.com/themes/logo.svg',
        src: expect.objectContaining({
          mediaId: 'detected:site-logo-svg',
          mediaType: 'image',
          url: 'https://www.example.com/themes/logo.svg'
        })
      })
    )
    expect(JSON.stringify(props.content?.logo)).not.toContain('Cookieyes')
    expect(JSON.stringify(props.content?.logo)).not.toContain('CookieYes')
    expect(JSON.stringify(props.content?.logo)).not.toContain('poweredbtcky')
    expect(props.content?.logo?.href).toBeUndefined()
    expect(props.content?.logo?.text).toBeUndefined()
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'navbar',
          field: 'logo',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('drops consent vendor navbar logos instead of preserving them as base logos', () => {
    consumeNormalizationWarnings()
    const detection: DetectionResult = {
      id: 'navbar-logo-only-consent-vendor',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        menuItems: [{ label: 'Home', href: '/' }],
        logo: {
          alt: 'Cookieyes logo',
          src: {
            mediaId: 'detected:poweredbtcky-svg',
            mediaType: 'image',
            url: 'https://cdn-cookieyes.com/assets/images/poweredbtcky.svg'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.menuItems).toEqual([{ label: 'Home', href: '/' }])
    expect(props.content?.logo).toBeUndefined()
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'navbar',
          field: 'logo',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('converts malformed navbar logo image payloads with alt text into text logos', () => {
    const detection: DetectionResult = {
      id: 'navbar-logo-link-as-src',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        menuItems: [{ label: 'Home', href: '/' }],
        logo: {
          src: '/',
          alt: 'Example Agency'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.logo).toEqual(
      expect.objectContaining({
        text: 'Example Agency',
        alt: 'Example Agency'
      })
    )
    expect(props.content?.logo?.src).toBeUndefined()
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes navbar row style aliases into the canonical styles object', () => {
    const detection: DetectionResult = {
      id: 'navbar-row-colors',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        layout: 'multi-row',
        menuItems: [{ label: 'Patients and Families', href: '/' }],
        primaryNavBackgroundColor: '#6f8434',
        primaryNavTextColor: '#ffffff',
        primaryRowBorderColor: 'rgba(255, 255, 255, 0.6)',
        rootRowBackgroundColor: '#ffffff',
        rootRowTextColor: '#111827',
        rootRowBorderColor: '#e5e7eb',
        topRowBackgroundColor: '#ffffff',
        topRowTextColor: '#334e5c',
        styles: {
          primaryItems: [
            {
              label: 'Patients and Families',
              backgroundColor: '#F68D39',
              color: '#ffffff'
            },
            {
              label: 'Invalid',
              backgroundColor: 'bg-orange'
            },
            {
              backgroundColor: '#000000'
            }
          ]
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.styles).toEqual({
      rootRow: {
        backgroundColor: '#ffffff',
        textColor: '#111827',
        borderColor: '#e5e7eb'
      },
      utilityRow: {
        backgroundColor: '#ffffff',
        textColor: '#334e5c'
      },
      primaryRow: {
        backgroundColor: '#6f8434',
        textColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.6)'
      },
      primaryItems: [
        {
          label: 'Patients and Families',
          backgroundColor: '#F68D39',
          textColor: '#ffffff'
        }
      ]
    })
    expect(props.content?.rootRowBackgroundColor).toBeUndefined()
    expect(props.content?.primaryNavBackgroundColor).toBeUndefined()
    expect(props.content?.topRowBackgroundColor).toBeUndefined()
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'navbar',
          field: 'styles.primaryItems.1.backgroundColor',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('wraps bare smart-link breadcrumb items into canonical link entries', () => {
    const detection: DetectionResult = {
      id: 'example-health-breadcrumbs-bare-link',
      type: 'breadcrumbs',
      bounds: baseBounds,
      content: {
        items: [
          {
            type: 'internal',
            pageId: 'home',
            path: '/'
          }
        ],
        separator: '>',
        showHome: true,
        homeLabel: 'Example Health'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('breadcrumbs'))

    expect(props.content).toEqual({
      items: [
        {
          label: 'Example Health',
          href: {
            type: 'internal',
            pageId: 'home',
            path: '/'
          }
        }
      ],
      separator: '>',
      showHome: true,
      homeLabel: 'Example Health'
    })
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('does not infer breadcrumb labels from non-home paths', () => {
    const detection: DetectionResult = {
      id: 'breadcrumbs-unlabeled-path',
      type: 'breadcrumbs',
      bounds: baseBounds,
      content: {
        items: [
          {
            type: 'internal',
            pageId: 'about',
            path: '/example-health/about/'
          }
        ],
        separator: '>'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('breadcrumbs'))

    expect(props.content?.items).toEqual([
      {
        href: {
          type: 'internal',
          pageId: 'about',
          path: '/example-health/about/'
        }
      }
    ])
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('rejects invalid navbar row style color values during normalization', () => {
    consumeNormalizationWarnings()
    const detection: DetectionResult = {
      id: 'navbar-invalid-row-colors',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        layout: 'multi-row',
        menuItems: [{ label: 'Patients and Families', href: '/' }],
        styles: {
          primaryRow: {
            backgroundColor: 'bg-green',
            textColor: '#ffffff'
          }
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.styles).toEqual({
      primaryRow: {
        textColor: '#ffffff'
      }
    })
    expect(consumeNormalizationWarnings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'navbar',
          field: 'styles.primaryRow.backgroundColor',
          issue: 'suspicious-value'
        })
      ])
    )
  })

  it('emits fatal-classified warnings and drops malformed navbar logo image payloads', () => {
    consumeNormalizationWarnings()
    const malformedLogo = {
      asset: {
        id: 'nav-logo-without-url'
      },
      alt: 'Broken logo asset'
    }
    const detection: DetectionResult = {
      id: 'navbar-logo-malformed-object',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        title: 'Site title is not a logo fallback',
        menuItems: [{ label: 'Home', href: '/' }],
        logo: malformedLogo
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.logo).toBeUndefined()
    expect(props.content?.logo).not.toEqual(malformedLogo)

    const warnings = consumeNormalizationWarnings()
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentType: 'navbar',
          field: 'logo',
          issue: 'invalid-subcomponent'
        })
      ])
    )
    expect(warnings.some(warning => getNormalizationWarningSeverity(warning) === 'fatal')).toBe(true)
  })

  it('preserves card-grid card value-object media references', () => {
    const detection: DetectionResult = {
      id: 'card-grid-nested-media',
      type: 'card-grid',
      bounds: baseBounds,
      content: {
        heading: 'Features',
        cards: [
          {
            type: 'card-item',
            id: 'card-1',
            title: 'Secure ingestion',
            description: 'Handles nested payloads safely.',
            image: {
              src: {
                mediaId: 'card-media-asset',
                originalUrl: 'https://cdn.example.com/assets/card-thumb.png'
              }
            },
            link: 'https://example.com/features/security'
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('card-grid'))
    expect(props.content?.cards?.[0]?.image?.src).toEqual(
      expect.objectContaining({
        mediaId: 'card-media-asset',
        originalUrl: 'https://cdn.example.com/assets/card-thumb.png'
      })
    )
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('preserves untyped card-grid cards as value objects', () => {
    const detection: DetectionResult = {
      id: 'card-grid-untyped-card',
      type: 'card-grid',
      bounds: baseBounds,
      content: {
        heading: 'Features',
        cards: [
          {
            title: 'Secure ingestion',
            description: 'Handles nested payloads safely.',
            href: { type: 'external', url: 'https://example.com/features/security' }
          }
        ]
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('card-grid'))

    expect(props.content?.cards?.[0]).toEqual(
      expect.objectContaining({
        title: 'Secure ingestion',
        description: 'Handles nested payloads safely.'
      })
    )
    expect(props.content?.cards?.[0]?.type).toBeUndefined()
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })
