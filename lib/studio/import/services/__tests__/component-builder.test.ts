import { ComponentBuilder } from '../page-builder/component-builder'
import type { DetectionResult, ComponentType as ImportComponentType } from '../interfaces'
import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import { SUBCOMPONENT_NORMALIZERS } from '../page-builder/subcomponent-normalizers'

const baseBounds = { x: 0, y: 0, width: 100, height: 100 }

const createComponentType = (type: string): ImportComponentType =>
  ({
    id: `type-${type}`,
    type,
    key: type,
    category: 'content',
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
    isGlobal: false
  } as unknown as ImportComponentType)

const cloneDetection = (value: DetectionResult): DetectionResult =>
  JSON.parse(JSON.stringify(value)) as DetectionResult

describe('ComponentBuilder region mapping', () => {
  const builder = new ComponentBuilder()
  const baseType = {
    id: 'type-blog-post',
    type: 'blog-post',
    key: 'blog-post',
    category: 'blog',
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
    isGlobal: false
  } as unknown as ImportComponentType

  it('does not infer region from content when metadata is missing', () => {
    const detection: DetectionResult = {
      id: 'det-1',
      type: 'blog-post',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0.95,
      content: {
        region: 'main',
        title: 'Detection Title'
      },
      metadata: {}
    }

    const [instance] = builder.mapToComponentInstances([detection], [baseType])

    expect(instance.props.region).toBe('main')
    expect(instance.props.metadata?.region).toBe('main')
    expect(instance.componentType).toBe(CmsComponentType.BlogPost)
    expect(instance.componentTypeId).toBe(baseType.id)
    expect(instance.typeId).toBe(baseType.id)
    expect(instance.props.type).toBe(CmsComponentType.BlogPost)
  })

  it('preserves explicit metadata region', () => {
    const detection: DetectionResult = {
      id: 'det-2',
      type: 'blog-post',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0.88,
      content: {},
      metadata: { region: 'hero' }
    }

    const [instance] = builder.mapToComponentInstances([detection], [baseType])

    expect(instance.props.region).toBe('hero')
    expect(instance.props.metadata.region).toBe('hero')
    expect(instance.componentType).toBe(CmsComponentType.BlogPost)
    expect(instance.componentTypeId).toBe(baseType.id)
    expect(instance.typeId).toBe(baseType.id)
    expect(instance.props.type).toBe(CmsComponentType.BlogPost)
  })

  it('does not overwrite explicit metadata region when content region differs', () => {
    const detection: DetectionResult = {
      id: 'det-conflict',
      type: 'blog-post',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0.9,
      content: {
        region: 'main',
        title: 'Detection Title'
      },
      metadata: { region: 'hero' }
    }

    const [instance] = builder.mapToComponentInstances([detection], [baseType])

    expect(instance.props.region).toBe('hero')
    expect(instance.props.metadata.region).toBe('hero')
    expect(instance.props.content.region).toBe('main')
  })

  it('does not overwrite content metadata region when content region differs', () => {
    const detection: DetectionResult = {
      id: 'det-content-metadata-conflict',
      type: 'blog-post',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0.9,
      content: {
        region: 'main',
        metadata: { region: 'hero' },
        title: 'Detection Title'
      },
      metadata: {}
    }

    const [instance] = builder.mapToComponentInstances([detection], [baseType])

    expect(instance.props.region).toBe('main')
    expect(instance.props.metadata.region).toBe('main')
    expect(instance.props.content.region).toBe('main')
    expect(instance.props.content.metadata.region).toBe('hero')
  })
})

describe('ComponentBuilder type resolution', () => {
  it('throws when a detected component type cannot be resolved', () => {
    const builder = new ComponentBuilder()
    const detection: DetectionResult = {
      id: 'unknown-1',
      type: 'mystery-widget',
      bounds: baseBounds,
      confidence: 0.81,
      content: {},
      metadata: {}
    }

    expect(() => builder.mapToComponentInstances([detection], [createComponentType('text-block')]))
      .toThrow('Raw type: "mystery-widget". Canonical type: "mystery-widget"')
  })

  it('preserves CTA variant types without collapsing to cta', () => {
    const builder = new ComponentBuilder()
    const ctaType = {
      id: 'type-cta-inline',
      type: 'cta-inline',
      key: 'cta-inline',
      category: 'marketing',
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
      isGlobal: false
    } as unknown as ImportComponentType

    const detection: DetectionResult = {
      id: 'cta-inline-1',
      type: 'cta-inline',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      confidence: 0.87,
      content: {
        heading: 'Need help?',
        body: 'Speak to our team today.',
        ctaButtons: [{ text: 'Contact us', href: '/contact' }]
      },
      metadata: { region: 'footer' }
    }

    const [instance] = builder.mapToComponentInstances([detection], [ctaType])

    expect(instance.type).toBe('cta-inline')
    expect(instance.typeId).toBe(ctaType.id)
  })
})

describe('ComponentBuilder inline CTA merging for two-column', () => {
  const builder = new ComponentBuilder()
  const twoColumnType = createComponentType('two-column')
  const ctaType = createComponentType('cta-simple')

  const types = [twoColumnType, ctaType]

  const twoColumnDetection: DetectionResult = {
    id: 'two-column-inline',
    type: 'two-column',
    bounds: baseBounds,
    content: {
      areas: {
        left: [
          {
            id: 'text-block-left',
            type: 'text-block',
            content: {
              body: '<p>We help resolve issues.</p>'
            }
          }
        ],
        right: []
      }
    },
    metadata: {}
  }

  const ctaDetection: DetectionResult = {
    id: 'cta-inline',
    type: 'cta-simple',
    bounds: baseBounds,
    content: {
      heading: 'Learn more about us',
      primaryButton: {
        text: 'Learn more',
        url: '/about'
      }
    },
    metadata: {}
  }

  it('moves leading CTAs into the previous two-column text block', () => {
    const detections = [cloneDetection(ctaDetection), cloneDetection(twoColumnDetection)]
    const instances = builder.mapToComponentInstances(detections, types)

    expect(instances).toHaveLength(1)
    expect(instances[0].type).toBe('two-column')

    const leftArea = (instances[0].props.content.areas.left as any[])[0]
    expect(leftArea.content.body).toContain('href="/about"')
    expect(leftArea.content.body).toContain('Learn more')
  })

  it('moves trailing CTAs into the preceding two-column text block', () => {
    const detections = [cloneDetection(twoColumnDetection), cloneDetection(ctaDetection)]
    const instances = builder.mapToComponentInstances(detections, types)

    expect(instances).toHaveLength(1)
    const leftArea = (instances[0].props.content.areas.left as any[])[0]
    expect(leftArea.content.body).toContain('href="/about"')
    expect(leftArea.content.body).toContain('Learn more')
  })
})

describe('Subcomponent normalizers', () => {
  const run = (
    type: string,
    input: unknown,
    context: Partial<{
      parentCanonicalType: string
      field: string
      index: number
      pageUrl?: string
    }> = {}
  ) =>
    SUBCOMPONENT_NORMALIZERS[type](input, {
      canonicalType: type,
      parentCanonicalType: context.parentCanonicalType ?? 'test-parent',
      field: context.field ?? 'items',
      index: context.index ?? 0,
      pageUrl: context.pageUrl
    })

  it('passes through navigation-related subcomponents without mutation', () => {
    const navPayload = {
      type: 'nav-menu-item',
      id: 'nav-menu-item-solutions',
      label: 'Solutions',
      href: 'https://example.com/solutions',
      external: false,
      children: [
        {
          type: 'nav-menu-item',
          id: 'nav-menu-item-overview',
          label: 'Overview',
          href: '/solutions/overview',
          external: true
        }
      ]
    }

    const nav = run('nav-menu-item', navPayload, { parentCanonicalType: 'navbar', field: 'menuItems' })

    expect(nav.warnings).toHaveLength(0)
    expect(nav.value).toEqual(navPayload)

    const columnPayload = {
      type: 'columnItem',
      id: 'columnItem-company',
      title: 'Company',
      links: [
        { type: 'nav-menu-item', id: 'nav-menu-item-about', label: 'About', href: '/about', external: false },
        { type: 'nav-menu-item', id: 'nav-menu-item-careers', label: 'Careers', href: '/careers', external: true }
      ]
    }

    const column = run('columnitem', columnPayload, { parentCanonicalType: 'footer', field: 'columns' })

    expect(column.warnings).toHaveLength(0)
    expect(column.value).toEqual(columnPayload)

    const socialPayload = {
      type: 'socialLinkItem',
      id: 'socialLinkItem-instagram',
      platform: 'instagram',
      url: 'https://instagram.com/example',
      label: 'Instagram'
    }

    const social = run('sociallinkitem', socialPayload, { parentCanonicalType: 'footer', field: 'socialLinks' })

    expect(social.warnings).toHaveLength(0)
    expect(social.value).toEqual(socialPayload)
  })

  it('records warnings when navigation payloads are not objects', () => {
    const nav = run('nav-menu-item', 'not-an-object', { parentCanonicalType: 'navbar', field: 'menuItems' })

    expect(nav.value).toBeNull()
    expect(nav.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('nav-menu-item')
        })
      ])
    )

    const social = run('sociallinkitem', null, { parentCanonicalType: 'footer', field: 'socialLinks' })

    expect(social.value).toBeNull()
    expect(social.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: 'invalid-subcomponent',
          message: expect.stringContaining('socialLinkItem')
        })
      ])
    )
  })

  it('normalizes interactive content subcomponents', () => {
    const accordion = run(
      'accordion-item',
      {
        heading: 'What is Catalyst Studio?',
        body: 'Catalyst Studio is a studio web builder.',
        expanded: true
      },
      { parentCanonicalType: 'accordion' }
    )

    expect(accordion.value).toMatchObject({
      type: 'accordion-item',
      title: 'What is Catalyst Studio?',
      content: 'Catalyst Studio is a studio web builder.',
      defaultOpen: true
    })

    const tab = run(
      'tab-item',
      {
        title: 'Details',
        content: 'Deep dive',
        disabled: 'true',
        icon: 'layers',
        badge: 3
      },
      { parentCanonicalType: 'tabs' }
    )

    expect(tab.value).toMatchObject({
      type: 'tab-item',
      label: 'Details',
      content: 'Deep dive',
      icon: 'layers',
      disabled: true,
      badge: '3'
    })
  })

  it('passes marketing subcomponents through verbatim when already contract-shaped', () => {
    const featurePayload = {
      type: 'feature-item',
      id: 'feature-item-secure-default',
      icon: 'shield',
      title: 'Secure by default',
      description: 'Built with security best practices.',
      link: { text: 'Learn more', url: '/security' }
    }

    const feature = run('feature-item', featurePayload, { parentCanonicalType: 'feature-grid' })

    expect(feature.value).toEqual(featurePayload)
    expect(feature.warnings).toHaveLength(0)

    const showcase = run(
      'showcase-section',
      {
        title: 'Unified dashboard',
        description: 'Monitor everything from a single view.',
        image: { url: '/img/dashboard.png', description: 'Dashboard screenshot' },
        items: [{ icon: 'check', text: 'Real-time metrics' }, 'Granular controls'],
        cta: { text: 'Request demo', url: '/demo' },
        imageSide: 'Left'
      },
      { parentCanonicalType: 'feature-showcase', field: 'sections' }
    )

    expect(showcase.value).toMatchObject({
      type: 'showcase-section',
      title: 'Unified dashboard',
      description: 'Monitor everything from a single view.',
      cta: { text: 'Request demo', url: '/demo' },
      imagePosition: 'left'
    })
    expect(showcase.value?.features).toEqual([
      expect.objectContaining({ icon: 'check', text: 'Real-time metrics' }),
      { text: 'Granular controls' }
    ])

    const featureWithoutId = run(
      'feature-item',
      {
        type: 'feature-item',
        icon: 'sparkle',
        title: 'Delightful UX',
        description: 'Thoughtful defaults and responsive layouts.'
      },
      { parentCanonicalType: 'feature-grid', index: 1, field: 'features', pageUrl: 'https://example.com/features' }
    )

    expect(featureWithoutId.value).toEqual({
      type: 'feature-item',
      icon: 'sparkle',
      title: 'Delightful UX',
      description: 'Thoughtful defaults and responsive layouts.'
    })
    expect(featureWithoutId.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: 'missing-required-field',
          message: expect.stringContaining('feature-item.id')
        })
      ])
    )

    const testimonial = run(
      'testimonial-item',
      {
        quote: 'Catalyst transformed our workflow.',
        person: 'Jordan Blake',
        role: 'Product Lead',
        company: 'Northwind',
        rating: '4.5/5',
        image: 'https://cdn.example.com/avatar.jpg'
      },
      { parentCanonicalType: 'testimonial-grid', field: 'testimonials' }
    )

    expect(testimonial.value).toEqual({
      quote: 'Catalyst transformed our workflow.',
      person: 'Jordan Blake',
      role: 'Product Lead',
      company: 'Northwind',
      rating: '4.5/5',
      image: 'https://cdn.example.com/avatar.jpg',
      type: 'testimonial-item'
    })
    expect(testimonial.warnings).toHaveLength(0)
  })

  it('normalizes data and editorial subcomponents', () => {
    const timeline = run(
      'timeline-event',
      {
        title: 'Founded',
        eventDate: '2018-01-01',
        summary: 'Company incorporated.',
        eventType: 'Milestone',
        icon: 'flag',
        link: { text: 'Read story', url: '/about/story' },
        image: { src: '/img/event.jpg', alt: 'Launch party' }
      },
      { parentCanonicalType: 'timeline', field: 'events' }
    )

    expect(timeline.value).toMatchObject({
      title: 'Founded',
      date: '2018-01-01',
      description: 'Company incorporated.',
      icon: 'flag',
      link: { text: 'Read story', url: '/about/story' },
      type: 'milestone'
    })
    expect(typeof timeline.value?.id).toBe('string')

    const teamMember = run(
      'team-member',
      {
        name: 'Alex Murphy',
        role: 'CTO',
        department: 'Engineering',
        photo: { src: '/img/alex.jpg', alt: 'Portrait of Alex' },
        bio: 'Leading the platform strategy.',
        social: { linkedin: 'https://linkedin.com/in/alex', twitter: 'https://twitter.com/alex' },
        skills: ['Leadership', 'Systems'],
        education: [{ degree: 'BSc Computer Science', institution: 'Monash', year: '2010' }],
        experience: [
          {
            position: 'VP Engineering',
            organization: 'Acme Corp',
            duration: '2015-2019',
            description: 'Scaled platform teams.'
          }
        ],
        achievements: ['Invented automation pipeline'],
        layout: 'Compact'
      },
      { parentCanonicalType: 'team-grid', field: 'members' }
    )

    expect(teamMember.value).toMatchObject({
      type: 'team-member',
      name: 'Alex Murphy',
      title: 'CTO',
      department: 'Engineering',
      bio: 'Leading the platform strategy.',
      linkedin: 'https://linkedin.com/in/alex',
      twitter: 'https://twitter.com/alex',
      displayMode: 'compact'
    })
    expect(teamMember.value?.skills).toEqual(['Leadership', 'Systems'])
    expect(teamMember.value?.education).toEqual([
      { degree: 'BSc Computer Science', institution: 'Monash', year: '2010' }
    ])
    expect(teamMember.value?.experience?.[0]).toMatchObject({
      position: 'VP Engineering',
      company: 'Acme Corp',
      duration: '2015-2019'
    })

    const blogCard = run(
      'blog-card',
      {
        title: 'Shipping velocity: 5 playbooks',
        summary: 'How we scale delivery.',
        image: 'https://cdn.example.com/blog/velocity.jpg',
        authorName: 'Jamie Lee',
        publishDate: '2024-06-01',
        updated: '2024-06-15',
        readingTime: '6',
        categories: ['Engineering'],
        tags: 'velocity,productivity',
        url: 'https://example.com/blog/shipping-velocity',
        featured: 'true',
        likes: '120',
        comments: 4,
        views: '1024'
      },
      { parentCanonicalType: 'blog-list', field: 'posts' }
    )

    expect(blogCard.value).toMatchObject({
      type: 'blog-card',
      title: 'Shipping velocity: 5 playbooks',
      excerpt: 'How we scale delivery.',
      thumbnail: 'https://cdn.example.com/blog/velocity.jpg',
      author: { name: 'Jamie Lee' },
      publishDate: '2024-06-01',
      updatedDate: '2024-06-15',
      slug: 'blog/shipping-velocity',
      featured: true,
      likes: 120,
      comments: 4,
      views: 1024,
      readingTime: 6
    })
    expect(blogCard.value?.categories).toEqual(['Engineering'])
    expect(blogCard.value?.tags).toEqual(['velocity', 'productivity'])
  })
})

describe('ComponentBuilder normalization', () => {
  const builder = new ComponentBuilder()
  const cardGridType = {
    id: 'type-card-grid',
    type: 'card-grid',
    key: 'card-grid',
    category: 'content',
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
    isGlobal: false
  } as unknown as ImportComponentType
  const footerType = {
    id: 'type-footer',
    type: 'footer',
    key: 'footer',
    category: 'layout',
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
    isGlobal: true
  } as unknown as ImportComponentType

  it('preserves contract-compliant card items', () => {
    const rawCards = [
      {
        type: 'card-item',
        id: 'card-item-new-looks-new-vibes',
        title: 'New Looks, New Vibes!',
        description: 'Article',
        image: {
          src: 'data:image/png;base64,AAA',
          alt: 'WTS1025SOCIALNEWSEASON1200Wx1200pxH'
        },
        link: '/Stores/Retail-Stores/Williams-Shoes/Articles/2025/08/New-Looks-New-Vibes',
        linkText: 'New Looks, New Vibes!',
        imageAlt: 'WTS1025SOCIALNEWSEASON1200Wx1200pxH'
      },
      {
        type: 'card-item',
        id: 'card-item-spendless-spring-sale',
        title: 'Spendless Spring Sale',
        description: 'Offer from 21 Oct to 9 Nov at Spendless Shoes',
        image: {
          src: 'data:image/png;base64,BBB',
          alt: '800x800_11'
        },
        link: '/Stores/Retail-Stores/Spendless-Shoes/Promotions/2025/10/Spendless-Spring-Sale',
        linkText: 'Spendless Spring Sale',
        imageAlt: '800x800_11'
      },
      {
        type: 'card-item',
        id: 'card-item-oktoberfest',
        title: 'Oktoberfest at The Village',
        description: 'Join us for live music and German-inspired treats.',
        link: '/Events/Oktoberfest',
        linkText: 'Plan your visit'
      }
    ]
    const detection: DetectionResult = {
      id: 'det-card-grid',
      type: 'card-grid',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      confidence: 0.92,
      pageUrl: 'https://example.com/whats-on',
      content: JSON.stringify({
        cards: rawCards,
        heading: "What's On",
        subheading: 'This month',
        columns: 3
      }),
      metadata: {}
    } as unknown as DetectionResult

    const [instance] = builder.mapToComponentInstances([detection], [cardGridType])
    const cards = instance.props.content.cards

    expect(Array.isArray(cards)).toBe(true)
    expect(cards).toHaveLength(rawCards.length)
    expect(cards).toEqual(rawCards)
  })

  it('preserves contract-compliant footer payloads', () => {
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
        },
        {
          type: 'columnItem',
          id: 'columnItem-resources',
          title: 'Resources',
          links: [
            {
              type: 'nav-menu-item',
              id: 'nav-menu-item-docs',
              label: 'Docs',
              href: '/docs',
              external: false
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
        },
        {
          type: 'nav-menu-item',
          id: 'nav-menu-item-terms',
          label: 'Terms of Service',
          href: '/terms',
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
        },
        {
          type: 'socialLinkItem',
          id: 'socialLinkItem-linkedin',
          platform: 'linkedin',
          url: 'https://linkedin.com/company/catalyst',
          label: 'LinkedIn'
        }
      ],
      newsletter: {
        heading: 'Stay in touch',
        description: 'Monthly updates and insights.',
        placeholder: 'Enter your email',
        buttonText: 'Join'
      },
      logo: '/assets/logo.svg',
      logoAlt: 'Catalyst Studio',
      description: 'Build better experiences with Catalyst Studio.',
      copyright: '© 2024 Catalyst Studio',
      backgroundColor: '#000000',
      textColor: '#ffffff',
      region: 'footer'
    }

    const detection: DetectionResult = {
      id: 'det-footer',
      type: 'footer',
      bounds: { x: 0, y: 0, width: 1200, height: 400 },
      confidence: 0.9,
      pageUrl: 'https://example.com',
      content: JSON.stringify(rawFooter),
      metadata: {}
    } as unknown as DetectionResult

    const [instance] = builder.mapToComponentInstances([detection], [footerType])
    const footerContent = instance.props.content

    expect(footerContent).toMatchObject(rawFooter)
  })

  it('preserves contract-compliant promo items', () => {
    const rawPromo = {
      type: 'promo-item',
      id: 'promo-item-catholic-school-open-days',
      headline: 'Catholic School Open Days',
      body: "We are enrolling now! Attend your local Catholic school's Open Day to find out more.",
      image: 'https://cdn.example.com/open-days.jpg',
      imageAlt: 'Catholic School Open Days',
      cta: { label: 'Find out more', url: 'https://info.parra.catholic.edu.au/open-days-listing' }
    }
    const detection: DetectionResult = {
      id: 'det-promo-grid',
      type: 'card-grid',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      confidence: 0.88,
      content: JSON.stringify({
        cards: [rawPromo]
      }),
      metadata: {}
    } as unknown as DetectionResult

    const [instance] = builder.mapToComponentInstances([detection], [cardGridType])
    const promo = instance.props.content.cards[0]

    expect(promo).toMatchObject({
      ...rawPromo,
      image: expect.objectContaining({
        src: rawPromo.image,
        alt: rawPromo.imageAlt
      })
    })
  })
})
