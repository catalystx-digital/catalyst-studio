import { detectionParserInternals, parseDetectionResponse, parseSectionDetectionResponse } from '../response-parser'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'
import { canonicalizeComponentType } from '@/lib/studio/components/cms/_core/canonicalization'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'
import type { ComponentPattern } from '../types'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { refreshComponentContracts } from '@/lib/studio/components/catalog/component-contracts'

const buildTemplate = (
  templateKey: string,
  category: PageTemplateCategory,
  routeHints?: string[]
): PageCatalogTemplateSummary => ({
  templateKey,
  name: templateKey,
  category,
  isHomeEligible: category === PageTemplateCategory.Marketing && templateKey.includes('home'),
  description: `${templateKey} description`,
  requiredRegions: [],
  optionalRegions: [],
  propsMeta: undefined,
  aiMetadata: {
    keywords: [],
    layoutGuidelines: [],
    contentGuidelines: undefined,
    recommendedComponents: undefined,
    discouragedComponents: undefined,
    exampleUseCases: undefined,
    routeHints
  },
  canonical: undefined,
  detectionGuidance: undefined,
  regionPolicies: undefined
})

const summary: PageCatalogSummary = {
  total: 2,
  generatedAt: new Date().toISOString(),
  templates: [
    buildTemplate('marketing/home-default', PageTemplateCategory.Marketing, ['/', '/home']),
    buildTemplate('blog/post-standard', PageTemplateCategory.Blog, ['/blog/'])
  ],
  categories: [],
  homeEligibleTemplates: ['marketing/home-default']
}

const patterns: ComponentPattern[] = [
  { type: 'navbar', category: 'navigation', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'blog-post', category: 'blog', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'text-block', category: 'content', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'cta-banner', category: 'cta', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'cta-simple', category: 'cta', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'content-feed', category: 'content', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'card-grid', category: 'content', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'contact-form', category: 'contact', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'video-embed', category: 'content', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'accordion', category: 'content', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'statistics', category: 'data', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'footer', category: 'navigation', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'team-grid', category: 'about', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'logo-cloud', category: 'social-proof', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'hero-banner', category: 'hero', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'hero-carousel', category: 'hero', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'hero-simple', category: 'hero', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'hero-with-image', category: 'hero', confidence: 0.9, keywords: [], patterns: [] }
]

beforeAll(async () => {
  await initializeCMSComponents()
  refreshComponentContracts()
})

describe('resolvePageTemplate strict contract', () => {
  it('retains registered model template predictions', () => {
    const result = detectionParserInternals.resolvePageTemplate(
      { templateKey: 'blog/post-standard', confidence: 0.9, reason: 'Model selected blog post' },
      summary,
      'https://example.com/blog/foo'
    )

    expect(result).toEqual({
      templateKey: 'blog/post-standard',
      confidence: 0.9,
      reason: 'Model selected blog post',
      source: 'model'
    })
  })

  it('rejects omitted template predictions instead of selecting a fallback', () => {
    expect(() =>
      detectionParserInternals.resolvePageTemplate(
        {},
        summary,
        'https://example.com/articles/foo'
      )
    ).toThrow('pageTemplate.templateKey is required')
  })

  it('rejects unknown template predictions instead of selecting a fallback', () => {
    expect(() =>
      detectionParserInternals.resolvePageTemplate(
        { templateKey: 'unknown-template', confidence: 0.6 },
        summary,
        'https://example.com/articles/foo'
      )
    ).toThrow('is not registered')
  })

  it('rejects home templates on non-home routes', () => {
    expect(() =>
      detectionParserInternals.resolvePageTemplate(
        { templateKey: 'marketing/home-default', confidence: 0.8 },
        summary,
        'https://example.com/guides/Example Agency-resume'
      )
    ).toThrow('is not route-eligible')
  })

  it.each(['https://example.com/', 'https://example.com/home'])('allows home templates on home route %s', url => {
    const result = detectionParserInternals.resolvePageTemplate(
      { templateKey: 'marketing/home-default', confidence: 0.8 },
      summary,
      url
    )

    expect(result.templateKey).toBe('marketing/home-default')
  })
})

describe('parseComponentsArray strict contract', () => {
  it('keeps literal contact-form canonical instead of aliasing it to cta-simple', () => {
    expect(canonicalizeComponentType('contact-form')).toBe('contact-form')
  })

  it('parses contract-shaped component objects', () => {
    const components = detectionParserInternals.parseComponentsArray(
      [
        { component: 'navbar', confidence: 0.9, content: { menuItems: [{ label: 'Home', href: { type: 'external', url: 'https://example.com/' } }] } },
        { component: 'blog-post', confidence: 0.95, content: { bodyHtml: '<p>Hello</p>' } }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect(components).toHaveLength(2)
    expect(components[0].component).toBe('navbar')
    expect(components[1].component).toBe('blog-post')
    expect((components[1].content as any)?.bodyHtml).toBe('<p>Hello</p>')
  })

  it('rejects tuple-shaped legacy component output', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          ['navbar', 0.9, { region: 'header' }]
        ] as any,
        patterns,
        0.25,
        'https://example.com/test'
      )
    ).toThrow('components[0] must be an object')
  })

  it('rejects legacy string navbar hrefs and logo image URLs', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'navbar',
            confidence: 0.9,
            content: {
              logo: {
                src: 'https://example.com/logo.svg',
                alt: 'Example'
              },
              menuItems: [
                { label: 'Home', href: '/' }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/test'
      )
    ).toThrow('logo.src:invalid_type')
  })

  it('accepts structured navbar links and logo media references', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'navbar',
          confidence: 0.9,
          content: {
            logo: {
              src: {
                mediaId: 'detected:brand-logo',
                mediaType: 'image',
                url: 'https://example.com/logo.svg'
              },
              alt: 'Brand'
            },
            menuItems: [
              {
                label: 'Home',
                href: { type: 'internal', pageId: 'home', path: '/' }
              }
            ]
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect((parsed[0].content.logo as any).src).toEqual(expect.objectContaining({
      mediaId: 'detected:brand-logo',
      mediaType: 'image',
      url: 'https://example.com/logo.svg'
    }))
  })

  it('accepts structured hero image media references', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'hero-with-image',
          confidence: 0.9,
          content: {
            heading: 'AI strategy',
            image: {
              src: {
                mediaId: 'detected:ai-strategy',
                mediaType: 'image',
                url: 'https://example.com/ai.jpg'
              },
              alt: 'AI strategy'
            }
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect((parsed[0].content.image as any).src).toEqual(expect.objectContaining({
      mediaId: 'detected:ai-strategy',
      mediaType: 'image',
      url: 'https://example.com/ai.jpg'
    }))
  })

  it('canonicalizes hero-with-image right and left layout aliases during parser validation', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'hero-with-image',
          confidence: 0.9,
          content: {
            heading: 'Right layout',
            layout: ' RIGHT ',
            image: {
              src: {
                mediaId: 'detected:right-layout',
                mediaType: 'image',
                url: 'https://example.com/right.jpg'
              },
              alt: 'Right layout'
            }
          }
        },
        {
          component: 'hero-with-image',
          confidence: 0.9,
          content: {
            heading: 'Left layout',
            layout: 'left',
            image: {
              src: {
                mediaId: 'detected:left-layout',
                mediaType: 'image',
                url: 'https://example.com/left.jpg'
              },
              alt: 'Left layout'
            }
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect(parsed.map(component => component.content.layout)).toEqual(['image-right', 'image-left'])
  })

  it('keeps unsupported hero-with-image layout values strict during parser validation', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'hero-with-image',
            confidence: 0.9,
            content: {
              heading: 'Unsupported layout',
              layout: 'center',
              image: {
                src: {
                  mediaId: 'detected:center-layout',
                  mediaType: 'image',
                  url: 'https://example.com/center.jpg'
                },
                alt: 'Unsupported layout'
              }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/test'
      )
    ).toThrow('layout:invalid_enum_value')
  })

  it('coerces statistics column counts emitted as numeric strings', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'statistics',
          confidence: 0.9,
          content: {
            title: 'Some stats',
            stats: [
              { value: 26, label: 'Years in operation.', suffix: '+' },
              { value: 85, label: 'Trees planted.', suffix: '+' }
            ],
            layout: 'grid',
            columns: '2'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/about'
    )

    expect(parsed[0].content.columns).toBe(2)
  })

  it('coerces team-grid responsive column counts emitted as numeric strings', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'team-grid',
          confidence: 0.9,
          content: {
            heading: 'Meet the team',
            members: [{ name: 'Adam Griffith', photo: 'https://example.com/adam.jpg' }],
            columns: {
              mobile: '1',
              tablet: '2',
              desktop: '5',
              large: '5'
            },
            linkToProfile: true
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/about'
    )

    expect(parsed[0].content.columns).toEqual({
      mobile: 1,
      tablet: 2,
      desktop: 5,
      large: 5
    })
  })

  it('normalizes video-embed videoUrl aliases and infers provider from the URL', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'video-embed',
          confidence: 0.9,
          content: {
            videoUrl: 'https://www.youtube.com/embed/wGxC3_9GZJ4',
            title: 'YouTube video player'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/about'
    )

    expect(parsed[0].content).toEqual(expect.objectContaining({
      provider: 'youtube',
      url: 'https://www.youtube.com/embed/wGxC3_9GZJ4',
      title: 'YouTube video player'
    }))
  })

  it('normalizes video-embed URL aliases and title-cased providers', () => {
    for (const alias of ['embedUrl', 'source', 'src']) {
      const parsed = detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'video-embed',
            confidence: 0.9,
            content: {
              [alias]: 'https://vimeo.com/123456',
              provider: 'Vimeo'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/about'
      )

      expect(parsed[0].content).toEqual(expect.objectContaining({
        provider: 'vimeo',
        url: 'https://vimeo.com/123456'
      }))
      expect(parsed[0].content).not.toHaveProperty(alias)
    }
  })

  it('infers video provider from URL host, not query text', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'video-embed',
          confidence: 0.9,
          content: {
            url: 'https://example.com/player?next=youtube.com/watch',
            title: 'Hosted embed'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/about'
    )

    expect(parsed[0].content).toEqual(expect.objectContaining({
      provider: 'iframe',
      url: 'https://example.com/player?next=youtube.com/watch'
    }))
  })

  it('normalizes legacy text-block bodyHtml into the current body field only', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'text-block',
          confidence: 0.9,
          content: {
            heading: 'About Us',
            bodyHtml: '<p>We create brighter digital experiences.</p>'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/about'
    )

    expect(parsed[0].content).toEqual({
      heading: 'About Us',
      body: '<p>We create brighter digital experiences.</p>'
    })
  })

  it('accepts real contact-form payloads with fields and submit buttons', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'contact-form',
          confidence: 0.9,
          content: {
            title: 'Project Details',
            fields: [
              { name: 'message', type: 'textarea', label: 'What do you need help with?', required: true },
              { name: 'email', type: 'email', label: 'Email address', required: true }
            ],
            submitButton: { text: 'Submit' },
            endpoint: '/contact/thanks/sales',
            method: 'POST'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/contact'
    )

    expect(parsed[0].content).toEqual(expect.objectContaining({
      title: 'Project Details',
      submitButton: { text: 'Submit' },
      endpoint: '/contact/thanks/sales',
      method: 'POST'
    }))
  })

  it('preserves strict content-feed pinned item shapes', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'content-feed',
          confidence: 0.9,
          content: {
            heading: 'Latest news',
            layout: 'card-grid',
            source: {},
            pinned: [
              {
                title: 'Community Event',
                excerpt: 'Join the community event.',
                href: { type: 'internal', pageId: 'news-community-event', path: '/news/community-event' },
                image: {
                  src: {
                    mediaId: 'detected:community-event',
                    mediaType: 'image',
                    url: 'https://example.com/community.jpg'
                  },
                  alt: 'Community event'
                },
                date: '2024-02-15',
                category: 'Events'
              }
            ]
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/news'
    )

    expect((parsed[0].content.pinned as any[])[0]).toEqual(expect.objectContaining({
      title: 'Community Event',
      excerpt: 'Join the community event.',
      href: { type: 'internal', pageId: 'news-community-event', path: '/news/community-event' },
      image: expect.objectContaining({
        src: expect.objectContaining({
          mediaId: 'detected:community-event',
          mediaType: 'image',
          url: 'https://example.com/community.jpg'
        })
      }),
      date: '2024-02-15',
      category: 'Events'
    }))
  })

  it('normalizes direct content-feed pinned author objects into metadata before strict validation', () => {
    const parsed = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'content-feed',
          confidence: 0.95,
          content: {
            heading: 'Latest articles',
            pinned: [
              {
                title: 'Mozilla sets up UK data firm',
                excerpt: 'Mozilla sets up UK data firm',
                href: {
                  type: 'external',
                  url: 'https://www.themorningintelligence.uk/mozilla-sets-up-uk-data-firm/'
                },
                category: 'News',
                author: {
                  name: 'The Morning Intelligence'
                }
              }
            ]
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/news'
    )

    expect((parsed[0].content.pinned as any[])[0]).toEqual(expect.objectContaining({
      title: 'Mozilla sets up UK data firm',
      category: 'News',
      metadata: expect.objectContaining({
        author: 'The Morning Intelligence'
      })
    }))
    expect((parsed[0].content.pinned as any[])[0]).not.toHaveProperty('author')
  })

  it('rejects legacy nested card-grid card fields', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'card-grid',
            confidence: 0.9,
            content: {
              cards: [
                {
                  title: 'Project',
                  description: 'Project summary',
                  href: { type: 'internal', pageId: 'project', path: '/project' },
                  linkText: 'Read more',
                  metadata: { category: 'Projects' }
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('cards.0:unrecognized_keys')
  })

  it('rejects null optional nested card-grid card fields', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'card-grid',
            confidence: 0.9,
            content: {
              cards: [
                {
                  title: 'Project',
                  description: 'Project summary',
                  href: { type: 'internal', pageId: 'project', path: '/project' },
                  icon: null
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('cards.0.icon:invalid_type')
  })

  it('rejects flattened nested card-grid image media references', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'card-grid',
            confidence: 0.9,
            content: {
              cards: [
                {
                  title: 'Project',
                  image: {
                    mediaId: 'detected:project',
                    mediaType: 'image',
                    url: 'https://example.com/project.jpg',
                    alt: 'Project'
                  },
                  href: { type: 'internal', pageId: 'project', path: '/project' }
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('cards.0.image:unrecognized_keys')
  })

  it('rejects partially flattened nested card-grid image media identifiers', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'card-grid',
            confidence: 0.9,
            content: {
              cards: [
                {
                  title: 'Project',
                  image: {
                    mediaId: 'detected:project',
                    alt: 'Project'
                  }
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('cards.0.image:unrecognized_keys')
  })

  it('rejects hero-carousel slide media references missing required mediaType', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'hero-carousel',
            confidence: 0.9,
            content: {
              slides: [
                {
                  heading: 'Feature',
                  image: {
                    src: {
                      mediaId: 'detected:feature',
                      url: 'https://example.com/feature.jpg'
                    },
                    alt: 'Feature'
                  }
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('slides.0.image.src.mediaType:invalid_type')
  })

  it('rejects invented hero-simple variant fields', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'hero-simple',
            confidence: 0.9,
            content: {
              heading: 'Framework',
              subheading: 'See how we make it work',
              variant: 'primary'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('variant:unknown-field')
  })

  it('rejects title-cased footer social platform values', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'footer',
            confidence: 0.9,
            content: {
              socialLinks: [
                { platform: 'LinkedIn', url: 'https://linkedin.com/company/example' }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('socialLinks.0.platform:invalid_enum_value')
  })

  it('rejects malformed content-feed pinned entries instead of synthesizing placeholders', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'content-feed',
            confidence: 0.9,
            content: {
              source: {},
              pinned: ['not a valid entry']
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/news'
      )
    ).toThrow('pinned:invalid-subcomponent')
  })

  it('rejects project sections mapped to content-feed instead of card-grid', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'content-feed',
            confidence: 0.9,
            content: {
              heading: 'Some of our latest projects',
              source: {},
              pinned: [
                {
                  title: 'MCG and MCC',
                  href: { type: 'internal', pageId: 'mcg', path: '/mcg-and-melbourne-cricket-club' }
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('conflicts with section taxonomy')
  })

  it('rejects component types missing from the catalog', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          { component: 'hero-carousel', confidence: 0.88, content: { region: 'hero', slides: [] } }
        ],
        [patterns[0]],
        0.25,
        'https://example.com/home'
      )
    ).toThrow('is not registered')
  })

  it('rejects unsupported component content fields before persistence', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-banner',
            confidence: 0.9,
            content: {
              heading: 'Build faster',
              body: 'Unsupported field from model output'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('body:unknown-field')
  })

  it('rejects schema-invalid statistics column strings after normalization', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'statistics',
            confidence: 0.9,
            content: {
              title: 'Some stats',
              stats: [
                { value: 26, label: 'Years in operation.', suffix: '+' }
              ],
              layout: 'grid',
              columns: '5'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/about'
      )
    ).toThrow('columns:invalid_union')
  })

  it('rejects schema-invalid team-grid column strings after normalization', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'team-grid',
            confidence: 0.9,
            content: {
              heading: 'Meet the team',
              members: [{ name: 'Adam Griffith' }],
              columns: {
                mobile: '3',
                tablet: '2',
                desktop: '5',
                large: '5'
              }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/about'
      )
    ).toThrow('columns.mobile:invalid_union')
  })

  it('rejects empty contact-form content against the actual form contract', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'contact-form',
            confidence: 0.9,
            content: {}
          }
        ],
        patterns,
        0.25,
        'https://example.com/contact'
      )
    ).toThrow('fields:missing-required-field')
  })

  it('accepts heading-only cta-banner section-title payloads', () => {
    const components = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'cta-banner',
          confidence: 0.9,
          content: {
            heading: 'Advance Care Planning',
            alignment: 'left'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/services'
    )

    expect(components[0].content).toEqual({
      heading: 'Advance Care Planning',
      alignment: 'left'
    })
  })

  it('rejects nested cta-banner button alias fields', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-banner',
            confidence: 0.9,
            content: {
              heading: 'Support the Hospital',
              primaryButton: {
                text: 'Donate Now',
                url: '/donate',
                variant: 'primary'
              }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/support'
      )
    ).toThrow('primaryButton.label:invalid_type')
  })

  it('rejects model bookkeeping fields inside component content', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'hero-banner',
            confidence: 0.92,
            content: {
              heading: 'Blog',
              backgroundImage: 'https://example.com/blog.jpg',
              region: 'hero',
              metadata: { source: 'model' }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/blog'
      )
    ).toThrow('region:unknown-field')
  })

  it('rejects unknown top-level fields even when a custom normalizer exists', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-simple',
            confidence: 0.91,
            content: {
              heading: 'Talk to us',
              primaryButton: { text: 'Contact', url: '/contact' },
              unexpectedModelField: 'legacy passthrough'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/contact'
      )
    ).toThrow('unexpectedModelField:unknown-field')
  })

  it('rejects accordion FAQ items with empty answers before persistence', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'accordion',
            confidence: 0.9,
            content: {
              items: [
                {
                  question: 'Technology',
                  answer: ''
                }
              ]
            }
          }
        ],
        patterns,
        0.25,
        'https://agency.example.com/'
      )
    ).toThrow('items.0.answer:too_small')
  })
})

describe('parseSectionDetectionResponse', () => {
  it('parses an empty section artifact with matching section key', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({ sectionKey: 'main:0-99', components: [] }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://example.com',
      confidenceThreshold: 0.25
    })

    expect(parsed).toEqual({ sectionKey: 'main:0-99', components: [] })
  })

  it('rejects mismatched section keys', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({ sectionKey: 'footer', components: [] }),
        sectionKey: 'main:0-99',
        availableComponents: patterns,
        url: 'https://example.com',
        confidenceThreshold: 0.25
      })
    ).toThrow('sectionKey must be "main:0-99"')
  })

  it('rejects missing section keys', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({ components: [] }),
        sectionKey: 'main:0-99',
        availableComponents: patterns,
        url: 'https://example.com',
        confidenceThreshold: 0.25
      })
    ).toThrow('sectionKey must be "main:0-99"')
  })

  it('accepts missing section keys only when the section harness opts in', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({ components: [] }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://example.com',
      confidenceThreshold: 0.25,
      allowMissingSectionKey: true
    })

    expect(parsed).toEqual({ sectionKey: 'main:0-99', components: [] })
  })

  it('rejects explicitly wrong section keys', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({ sectionKey: 'footer', components: [] }),
        sectionKey: 'main:0-99',
        availableComponents: patterns,
        url: 'https://example.com',
        confidenceThreshold: 0.25,
        allowMissingSectionKey: true
      })
    ).toThrow('sectionKey must be "main:0-99"')
  })

  it('isolates invalid component content when the section harness opts in', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({
        sectionKey: 'main:0-99',
        components: [
          { component: 'text-block', confidence: 0.9, content: { text: 'Valid section copy' } },
          { component: 'logo-cloud', confidence: 0.9, content: { '': null } }
        ]
      }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://example.com/about',
      confidenceThreshold: 0.25,
      isolateInvalidComponents: true
    })

    expect(parsed.components).toHaveLength(1)
    expect(parsed.components[0].type).toBe('text-block')
    expect(parsed.invalidComponents).toEqual([
      expect.objectContaining({
        index: 1,
        component: 'logo-cloud',
        type: 'logo-cloud',
        reason: expect.stringContaining('content is invalid')
      })
    ])
  })

  it('drops duplicate empty card grids during invalid component isolation', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({
        sectionKey: 'main:0-99',
        components: [
          {
            component: 'text-block',
            confidence: 0.9,
            content: { heading: 'Deep platform knowledge', body: 'Deep platform knowledge' }
          },
          {
            component: 'card-grid',
            confidence: 0.9,
            content: { heading: 'Deep platform knowledge', cards: [] }
          }
        ]
      }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://agency.example.com/',
      confidenceThreshold: 0.25,
      isolateInvalidComponents: true
    })

    expect(parsed.components.map(component => component.type)).toEqual(['text-block'])
    expect(parsed.invalidComponents).toBeUndefined()
    expect(parsed.parserRepairs).toEqual([
      expect.objectContaining({
        index: 1,
        component: 'card-grid',
        type: 'card-grid',
        action: 'drop_duplicate_empty_card_grid',
        reason: expect.stringContaining('valid sibling text-block already represents heading "deep platform knowledge"')
      })
    ])
  })

  it('keeps non-duplicate empty card grids invalid during isolation', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({
        sectionKey: 'main:0-99',
        components: [
          {
            component: 'text-block',
            confidence: 0.9,
            content: { heading: 'Different content', body: 'Different content' }
          },
          {
            component: 'card-grid',
            confidence: 0.9,
            content: { heading: 'Deep platform knowledge', cards: [] }
          }
        ]
      }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://agency.example.com/',
      confidenceThreshold: 0.25,
      isolateInvalidComponents: true
    })

    expect(parsed.components.map(component => component.type)).toEqual(['text-block'])
    expect(parsed.invalidComponents).toEqual([
      expect.objectContaining({
        index: 1,
        component: 'card-grid',
        type: 'card-grid',
        reason: expect.stringContaining('cards:missing-required-field')
      })
    ])
  })

  it('does not drop empty card grids on loose substring heading matches', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({
        sectionKey: 'main:0-99',
        components: [
          {
            component: 'text-block',
            confidence: 0.9,
            content: { heading: 'Services', body: 'Services' }
          },
          {
            component: 'card-grid',
            confidence: 0.9,
            content: { heading: 'Services and support', cards: [] }
          }
        ]
      }),
      sectionKey: 'main:0-99',
      availableComponents: patterns,
      url: 'https://example.com/',
      confidenceThreshold: 0.25,
      isolateInvalidComponents: true
    })

    expect(parsed.components.map(component => component.type)).toEqual(['text-block'])
    expect(parsed.parserRepairs).toBeUndefined()
    expect(parsed.invalidComponents).toEqual([
      expect.objectContaining({
        index: 1,
        component: 'card-grid',
        type: 'card-grid'
      })
    ])
  })

  it('normalizes unsupported nested navbar menu teaser images before schema validation', () => {
    const parsed = parseSectionDetectionResponse({
      rawResponse: JSON.stringify({
        sectionKey: 'header',
        components: [
          {
            component: 'navbar',
            confidence: 0.95,
            content: {
              menuItems: [
                {
                  label: 'Services',
                  children: [
                    {
                      label: 'Explore. Build. Grow',
                      href: { type: 'internal', pageId: 'explore-build-grow', path: '/explore-build-grow' },
                      description: 'Framework overview',
                      image: {
                        src: { mediaId: 'detected:ebg', mediaType: 'image', url: 'https://cdn.example.com/ebg.png' },
                        alt: 'Explore Build Grow'
                      }
                    }
                  ]
                }
              ]
            }
          }
        ]
      }),
      sectionKey: 'header',
      availableComponents: patterns,
      url: 'https://agency.example.com/acoustic',
      confidenceThreshold: 0.25
    })

    expect(parsed.components).toHaveLength(1)
    expect(parsed.components[0].type).toBe('navbar')
    expect(parsed.components[0].content.menuItems[0].children[0]).toEqual({
      label: 'Explore. Build. Grow',
      href: { type: 'internal', pageId: 'explore-build-grow', path: '/explore-build-grow' },
      description: 'Framework overview',
      icon: 'Explore Build Grow'
    })
  })

  it('does not hide image-only navbar menu teaser items', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({
          sectionKey: 'header',
          components: [
            {
              component: 'navbar',
              confidence: 0.95,
              content: {
                menuItems: [
                  {
                    label: 'Teaser',
                    image: {
                      src: { mediaId: 'detected:teaser', mediaType: 'image', url: 'https://cdn.example.com/teaser.png' },
                      alt: 'Teaser image'
                    }
                  }
                ]
              }
            }
          ]
        }),
        sectionKey: 'header',
        availableComponents: patterns,
        url: 'https://agency.example.com/acoustic',
        confidenceThreshold: 0.25
      })
    ).toThrow('menuItems.0:unrecognized_keys')
  })

  it('keeps invalid component content strict unless isolation is explicitly enabled', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({
          sectionKey: 'main:0-99',
          components: [
            { component: 'text-block', confidence: 0.9, content: { text: 'Valid section copy' } },
            { component: 'logo-cloud', confidence: 0.9, content: { '': null } }
          ]
        }),
        sectionKey: 'main:0-99',
        availableComponents: patterns,
        url: 'https://example.com/about',
        confidenceThreshold: 0.25
      })
    ).toThrow('content is invalid for component "logo-cloud"')
  })

  it('keeps unregistered components strict even when invalid-content isolation is enabled', () => {
    expect(() =>
      parseSectionDetectionResponse({
        rawResponse: JSON.stringify({
          sectionKey: 'main:0-99',
          components: [
            { component: 'not-registered', confidence: 0.9, content: null }
          ]
        }),
        sectionKey: 'main:0-99',
        availableComponents: patterns,
        url: 'https://example.com/about',
        confidenceThreshold: 0.25,
        isolateInvalidComponents: true
      })
    ).toThrow('component "not-registered" is not registered')
  })
})

describe('parseDetectionResponse strict contract', () => {
  it('parses valid JSON object responses end-to-end', () => {
    const rawResponse = JSON.stringify({
      components: [
        { component: 'navbar', confidence: 0.9, content: { menuItems: [{ label: 'Home', href: { type: 'external', url: 'https://example.com/' } }] } },
        { component: 'blog-post', confidence: 0.95, content: { bodyHtml: '<p>Hello</p>' } }
      ],
      pageTemplate: { templateKey: 'blog/post-standard', confidence: 0.95, reason: 'LLM classified page as blog post' }
    })

    const result = parseDetectionResponse({
      rawResponse,
      availableComponents: patterns,
      pageSummary: summary,
      url: 'https://example.com/recipes/hashbrown-egg-cups',
      confidenceThreshold: 0.25
    })

    expect(result.components.find(component => component.component === 'blog-post')).toBeDefined()
    expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
  })

  it('rejects fenced or otherwise non-JSON responses', () => {
    expect(() =>
      parseDetectionResponse({
        rawResponse: '```json\n{"components":[],"pageTemplate":{"templateKey":"blog/post-standard"}}\n```',
        availableComponents: patterns,
        pageSummary: summary,
        url: 'https://example.com/blog/post',
        confidenceThreshold: 0.25
      })
    ).toThrow()
  })
})
