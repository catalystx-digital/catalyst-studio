import { extractComponentPayload } from '../page-builder/component-helpers'
import {
  consumeNormalizationWarnings,
  getNormalizationWarningSeverity,
  isFatalNormalizationIssue
} from '../page-builder/normalization-telemetry'
import { SUBCOMPONENT_NORMALIZERS } from '../page-builder/subcomponent-normalizers'
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
        href: '/complaints',
        variant: 'primary',
        external: true,
        icon: 'arrow-right'
      },
      {
        label: 'See pricing',
        href: '/pricing',
        variant: 'outline'
      }
    ])

    expect(props.content?.supportingLinks).toEqual([
      expect.objectContaining({ label: 'Learn more', href: '/about', external: true }),
      expect.objectContaining({ label: 'Docs', href: '/resources', icon: 'book' })
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
    })

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
        mediaId: 'nested-hero-media',
        src: 'https://cdn.example.com/assets/hero-nested-object.jpg',
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
        mediaId: 'media-123',
        src: 'https://cdn.example.com/assets/hero.jpg',
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
        mediaId: 'media-missing-src'
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
        src: 'https://cdn.example.com/hero.jpg',
        alt: 'Coverage map'
      },
      ctaButtons: [
        {
          label: 'See plans',
          href: '/plans',
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
        { type: 'text-block' },
        { type: 'cta-simple' }
      ],
      rightColumn: [
        { type: 'image-gallery' }
      ]
    })
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('normalizes nested sidemenu aliases inside two-column columns', () => {
    const detection: DetectionResult = {
      id: 'two-column-rch-sidemenu',
      type: 'two-column',
      bounds: baseBounds,
      content: {
        columnRatio: '25-75',
        leftColumn: [
          {
            id: 'sidemenu-rch',
            type: 'sidemenu',
            content: {
              heading: 'In this section',
              menuItems: [
                {
                  label: 'About the RCH',
                  href: {
                    type: 'internal',
                    pageId: 'about',
                    path: '/rch/about/'
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
      id: 'sidemenu-rch',
      type: 'sidemenu',
      content: {
        title: 'In this section',
        items: [
          {
            label: 'About the RCH',
            href: {
              type: 'internal',
              pageId: 'about',
              path: '/rch/about/'
            }
          }
        ]
      }
    })
    expect(consumeNormalizationWarnings()).toHaveLength(0)
  })

  it('passes cta-simple payloads through unchanged', () => {
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

    const { region: _region, ...expectedContent } = detection.content as Record<string, unknown>
    expect(props.content).toMatchObject(expectedContent)
    expect(props.content).not.toHaveProperty('region')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
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

  it('passes testimonials payloads through unchanged', () => {
    const detection: DetectionResult = {
      id: 'testimonials-1',
      type: 'testimonials',
      bounds: baseBounds,
      content: {
        testimonials: [
          {
            type: 'testimonial-item',
            id: 'testimonial-item-julie-waddell',
            quote: 'We encourage our students to embrace their culture.',
            author: 'Julie Waddell',
            role: 'Jarara Indigenous Education Unit',
            avatar: 'https://cdn.example.com/avatars/julie.jpg'
          },
          {
            type: 'testimonial-item',
            id: 'testimonial-item-emilio-nacua',
            quote: 'Our school helps students choose their future.',
            author: 'Emilio Nacua',
            role: 'Student, Parramatta Marist High',
            avatar: 'https://cdn.example.com/avatars/emilio.jpg'
          }
        ],
        autoPlayInterval: 5000,
        showNavigation: true
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('testimonials'))

    const { region: _region, ...expectedContent } = detection.content as Record<string, unknown>
    expect(props.content).toMatchObject(expectedContent)
    expect(props.content).not.toHaveProperty('region')
    expect(consumeNormalizationWarnings()).toHaveLength(0)
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

    expect(propsWithSlides.content?.slides).toEqual(detection.content.slides)
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

    expect(propsWithoutSlides.content?.slides).toBeUndefined()
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

  it('passes footer payloads through without restructuring', () => {
    const rawFooter = {
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
          platform: 'twitter',
          url: 'https://twitter.com/catalyst',
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

    const { region: _region, ...expectedFooter } = rawFooter
    expect(props.content).toEqual(expectedFooter)
    expect(consumeNormalizationWarnings()).toHaveLength(0)
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

  it('converts malformed navbar logo image payloads with alt text into text logos', () => {
    const detection: DetectionResult = {
      id: 'navbar-logo-link-as-src',
      type: 'navbar',
      bounds: baseBounds,
      content: {
        menuItems: [{ label: 'Home', href: '/' }],
        logo: {
          src: '/',
          alt: 'Luminary'
        }
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('navbar'))

    expect(props.content?.logo).toEqual(
      expect.objectContaining({
        text: 'Luminary',
        alt: 'Luminary'
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
      id: 'rch-breadcrumbs-bare-link',
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
        homeLabel: 'RCH'
      },
      metadata: {}
    }

    const props = extractComponentProps(detection, createComponentType('breadcrumbs'))

    expect(props.content).toEqual({
      items: [
        {
          label: 'RCH',
          href: {
            type: 'internal',
            pageId: 'home',
            path: '/'
          }
        }
      ],
      separator: '>',
      showHome: true,
      homeLabel: 'RCH'
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
            path: '/rch/about/'
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
          path: '/rch/about/'
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
