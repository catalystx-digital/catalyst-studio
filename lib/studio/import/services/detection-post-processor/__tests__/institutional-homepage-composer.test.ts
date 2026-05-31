import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import type { ImportDesignProfile, PresentationSkeletonSelection } from '@/lib/studio/import/types/design-profile.types'
import { composeInstitutionalHomepageIfEligible } from '../institutional-homepage-composer'

const skeleton: PresentationSkeletonSelection = {
  key: 'institutional-home',
  confidence: 0.82,
  reason: 'hospital evidence',
  diagnostics: [],
}

const designProfile: ImportDesignProfile = {
  sourceUrl: 'https://example.org/',
  capturedAt: '2026-05-28T00:00:00.000Z',
  confidence: 0.72,
  palette: {
    primary: { source: 'domProbe.palette.primary', value: '#0e0048', confidence: 'high' },
    foreground: { source: 'domProbe.palette.text', value: '#111111', confidence: 'high' },
  },
  typography: {},
  spacing: { density: 'comfortable' },
  brandAssets: {
    logo: { source: 'navbar.logo.src', value: 'https://example.org/logo.svg', confidence: 'high' },
  },
  imagery: { detectedCount: 1, evidence: [{ source: 'hero.image', value: 'https://example.org/hero.jpg', confidence: 'high' }] },
  diagnostics: [],
}

function component(type: ComponentType, content: Record<string, unknown>, metadata: Record<string, unknown> = {}): DetectedComponent {
  return {
    component: type,
    type,
    confidence: 0.9,
    content,
    metadata,
  }
}

function menuHref(path: string) {
  return { type: 'internal', pageId: `imported:${path}`, path }
}

function baseComponents(): DetectedComponent[] {
  return [
    component(ComponentType.CardGrid, {
      heading: 'Latest news',
      cards: [{ title: 'Hospital update', link: '/news/update' }],
    }),
    component(ComponentType.HeroCarousel, {
      slides: [{
        content: {
          heading: 'A news carousel item',
          body: 'Specialist care for children and families.',
          image: { src: { url: 'https://example.org/hero.jpg' }, alt: 'Hospital entrance' },
        },
      }],
    }),
    component(ComponentType.NavBar, {
      logo: { src: { url: 'https://example.org/logo.svg' }, alt: 'Example Hospital' },
      utilityNav: [
        { label: 'Contact', href: menuHref('/contact') },
      ],
      menuItems: [
        { label: 'Patients and families', href: menuHref('/patients') },
        { label: 'Health professionals', href: menuHref('/professionals') },
      ],
      cta: { label: 'Donate', href: menuHref('/donate'), variant: 'primary' },
    }),
    component(ComponentType.CardGrid, {
      heading: 'Quick access',
      cards: [
        { title: 'Your guide', link: '/guide', backgroundColor: '#0076ad' },
        { title: 'Kids Health Info', link: '/kids-health-info', backgroundColor: '#fdb913' },
        { title: 'Clinical Practice Guidelines', link: '/clinical-guidelines', backgroundColor: '#82c341' },
        { title: 'My Hospital Portal', link: '/portal', backgroundColor: '#f26c52' },
      ],
    }),
    component(ComponentType.TextBlock, {
      heading: 'Specialist hospital services',
      body: 'Care, research and education for the community.',
    }),
  ]
}

describe('composeInstitutionalHomepageIfEligible', () => {
  it('composes an institutional homepage from sourced navbar, hero, and quick links', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients and families.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components.map(entry => entry.type).slice(0, 4)).toEqual([
      ComponentType.NavBar,
      ComponentType.HeroWithImage,
      ComponentType.CardGrid,
      ComponentType.CardGrid,
    ])
    expect(result.components[1].content.heading).toBe('Example Children Hospital')
    expect(result.components[1].content.body).toBe('Specialist care for children and families.')
    expect(result.components[2].content.cards).toHaveLength(4)
    expect(result.components[2].content).not.toHaveProperty('featureFirstCard')
    expect((result.components[0].metadata as any).homepageComposer.status).toBe('applied')
    expect((result.components[0].metadata as any).homepageComposer.selected.titleSource).toBe('pageMetadata.title')
  })

  it('does not invent navbar links or quick-link hrefs', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    const nav = result.components[0].content
    expect(nav.menuItems).toEqual([
      { label: 'Patients and families', href: menuHref('/patients') },
      { label: 'Health professionals', href: menuHref('/professionals') },
    ])
    expect(result.components[2].content.cards).toEqual([
      expect.objectContaining({ title: 'Your guide', href: menuHref('/guide') }),
      expect.objectContaining({ title: 'Kids Health Info', href: menuHref('/kids-health-info') }),
      expect.objectContaining({ title: 'Clinical Practice Guidelines', href: menuHref('/clinical-guidelines') }),
      expect.objectContaining({ title: 'My Hospital Portal', href: menuHref('/portal') }),
    ])
  })

  it('normalizes same-origin absolute quick-link hrefs to internal links', () => {
    const components = baseComponents()
    components[3] = component(ComponentType.CardGrid, {
      heading: 'Quick access',
      cards: [
        { title: 'Your guide', link: 'https://example.org/guide' },
        { title: 'Kids Health Info', link: 'https://example.org/kids-health-info' },
        { title: 'Clinical Practice Guidelines', link: 'https://example.org/clinical-guidelines' },
      ],
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.components[2].content.cards).toEqual([
      expect.objectContaining({ href: menuHref('/guide') }),
      expect.objectContaining({ href: menuHref('/kids-health-info') }),
      expect.objectContaining({ href: menuHref('/clinical-guidelines') }),
    ])
  })

  it('does not invent a quick-link section heading when the source has none', () => {
    const components = baseComponents()
    components[3] = component(ComponentType.CardGrid, {
      cards: [
        { title: 'Your guide', link: '/guide' },
        { title: 'Kids Health Info', link: '/kids-health-info' },
        { title: 'Clinical Practice Guidelines', link: '/clinical-guidelines' },
      ],
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[2].content).not.toHaveProperty('heading')
  })

  it('selects the real utility quick-link grid over earlier news grids', () => {
    const components = baseComponents()
    components.splice(3, 0, component(ComponentType.CardGrid, {
      heading: 'Latest news',
      cards: [
        { title: 'Hospital update', link: '/news/hospital-update', metadata: { date: '2026-01-01' } },
        { title: 'Research story', link: '/news/research-story', metadata: { date: '2026-01-02' } },
        { title: 'Media announcement', link: '/news/media-announcement', metadata: { date: '2026-01-03' } },
      ],
    }))

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[2].content.cards).toEqual([
      expect.objectContaining({ title: 'Your guide' }),
      expect.objectContaining({ title: 'Kids Health Info' }),
      expect.objectContaining({ title: 'Clinical Practice Guidelines' }),
      expect.objectContaining({ title: 'My Hospital Portal' }),
    ])
  })

  it('cleans duplicated SEO metadata titles before using them as hero headings', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'The Royal Children Hospital : The Royal Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.components[1].content.heading).toBe('The Royal Children Hospital')
  })

  it('skips non-home pages with explicit audit metadata', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/about',
      pageMetadata: { title: 'Example Children Hospital', pageType: 'home' },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect((result.components[0].metadata as any).homepageComposer).toMatchObject({
      status: 'skipped',
      reason: 'non-homepage',
    })
  })

  it('applies to root-ish /home homepage paths', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[1].type).toBe(ComponentType.HeroWithImage)
  })

  it('preserves a sourced multi-slide hero carousel instead of collapsing it to one hero', () => {
    const components = baseComponents()
    components[1] = component(ComponentType.HeroCarousel, {
      slides: [
        {
          content: {
            heading: 'Appointment notifications now straight to your phone',
            body: 'Outpatient appointment changes will be sent via text message.',
            image: { src: { url: 'https://example.org/appointments.jpg' }, alt: 'Appointment message' },
          },
        },
        {
          content: {
            heading: 'Teen Health Info fact sheets now live',
            body: 'Plain language health topics for young people.',
            image: { src: { url: 'https://example.org/teen-health.jpg' }, alt: 'Teen health information' },
          },
        },
        {
          content: {
            heading: 'My Hospital Portal',
            body: 'Connect with your medical record.',
            image: { src: { url: 'https://example.org/portal.jpg' }, alt: 'Portal preview' },
          },
        },
      ],
    }, { source: 'source-carousel-enrichment' })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('preserve-source-hero-carousel')
    expect(result.components[1].type).toBe(ComponentType.HeroCarousel)
    expect((result.components[1].content.slides as unknown[])).toHaveLength(3)
    expect(result.components[3].content.cards).toEqual([
      expect.objectContaining({ title: 'Your guide', backgroundColor: '#0076ad' }),
      expect.objectContaining({ title: 'Kids Health Info', backgroundColor: '#fdb913' }),
      expect.objectContaining({ title: 'Clinical Practice Guidelines', backgroundColor: '#82c341' }),
      expect.objectContaining({ title: 'My Hospital Portal', backgroundColor: '#f26c52' }),
    ])
  })

  it('does not skip composition for a lower-page carousel after another source hero', () => {
    const components = baseComponents()
    components[1] = component(ComponentType.HeroWithImage, {
      heading: 'Hospital care for families',
      body: 'Specialist care for children and families.',
      image: { src: { url: 'https://example.org/hero.jpg' }, alt: 'Hospital entrance' },
    })
    components.push(component(ComponentType.HeroCarousel, {
      slides: [
        {
          content: {
            heading: 'Story one',
            image: { src: { url: 'https://example.org/story-one.jpg' }, alt: 'Story one' },
          },
        },
        {
          content: {
            heading: 'Story two',
            image: { src: { url: 'https://example.org/story-two.jpg' }, alt: 'Story two' },
          },
        },
      ],
    }))

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[1].type).toBe(ComponentType.HeroWithImage)
    expect(result.audit.reason).toBe('institutional homepage evidence satisfied')
  })

  it('omits copied hero CTA buttons without usable hrefs', () => {
    const components = baseComponents()
    components[1] = component(ComponentType.HeroCarousel, {
      slides: [{
        content: {
          heading: 'Hospital care for families',
          body: 'Specialist care for children and families.',
          image: { src: { url: 'https://example.org/hero.jpg' }, alt: 'Hospital entrance' },
          ctaButtons: [{ label: 'Click here' }],
        },
      }],
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[1].type).toBe(ComponentType.HeroWithImage)
    expect(result.components[1].content?.ctaButtons).toBeUndefined()
  })

  it('preserves valid copied hero CTA buttons as SmartLinks', () => {
    const components = baseComponents()
    components[1] = component(ComponentType.HeroCarousel, {
      slides: [{
        content: {
          heading: 'Hospital care for families',
          body: 'Specialist care for children and families.',
          image: { src: { url: 'https://example.org/hero.jpg' }, alt: 'Hospital entrance' },
          ctaButtons: [{ label: 'Book now', href: '/book', variant: 'primary' }],
        },
      }],
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[1].content?.ctaButtons).toEqual([
      { label: 'Book now', href: menuHref('/book'), variant: 'primary' },
    ])
  })

  it('throws when composed output violates component schemas', () => {
    const components = baseComponents()
    components[2] = component(ComponentType.NavBar, {
      logo: { src: { url: 'https://example.org/logo.svg' }, alt: 'Example Hospital' },
      menuItems: [
        { label: 'Patients and families', href: menuHref('/patients') },
        { label: 'Health professionals', href: menuHref('/professionals') },
      ],
      cta: { label: 'Donate', href: menuHref('/donate'), variant: 'large' },
    })

    expect(() => composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })).toThrow(/navbar-schema-invalid/)
  })

  it('recovers a navbar from sourced DOM header links when detection misses navbar', () => {
    const components = baseComponents().filter(entry => entry.type !== ComponentType.NavBar)
    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      domSnapshot: `
        <header>
          <a href="/about">About us</a>
          <a href="/contact">Contact</a>
          <nav>
            <a href="/patients">Patients and families</a>
            <a href="/professionals">Health professionals</a>
            <a href="/departments">Departments and services</a>
            <a href="/research">Research</a>
          </nav>
          <a href="/donate">Donate</a>
        </header>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[0]).toMatchObject({
      type: ComponentType.NavBar,
      content: {
        menuItems: expect.arrayContaining([
          expect.objectContaining({ label: 'Patients and families', href: menuHref('/patients') }),
          expect.objectContaining({ label: 'Health professionals', href: menuHref('/professionals') }),
        ]),
        cta: expect.objectContaining({ label: 'Donate', href: menuHref('/donate') }),
      },
    })
    expect((result.components[0].metadata as any).source).toBe('institutional-homepage-dom-nav')
  })

  it('recovers an RCH-shaped header without choosing noisy side navigation', () => {
    const components = baseComponents().filter(entry => entry.type !== ComponentType.NavBar)
    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://www.rch.org.au/home/',
      pageMetadata: {
        title: "The Royal Children's Hospital : The Royal Children's Hospital",
        pageType: 'home',
        description: 'Hospital care for patients and families.',
      },
      domSnapshot: `
        <div class="container">
          <div id="rch-header" class="row hidden-xs">
            <div id="rch-brand">
              <a href="/"><img class="rch-logo" src="/logo.png" alt="The Royal Children's Hospital Melbourne"></a>
            </div>
            <ul id="rch-mini-nav">
              <li><a href="/home/">Home</a></li>
              <li><a href="/rch/about/">About</a></li>
              <li><a href="http://blogs.rch.org.au/news/">News</a></li>
              <li><a href="/careers/">Careers</a></li>
              <li><a href="/rch/contact/">Contact</a></li>
              <li><a href="https://www.rchfoundation.org.au/donation/rchdonation/" class="header-donate-btn">Donate</a></li>
            </ul>
          </div>
          <div class="row" id="primary-nav">
            <ul class="nav nav-justified hidden-xs">
              <li><a href="/rch/health-professionals/">Health Professionals</a></li>
              <li><a href="/rch/patients-families/">Patients and Families</a></li>
              <li><a href="/rch/departments/">Departments and Services</a></li>
              <li><a href="/research/">Research</a></li>
            </ul>
            <a href="/search/" class="navbar-search-button">Search</a>
            <input name="adsearch_query" placeholder="Search the RCH website" />
          </div>
          <div id="rch-secondary">
            <p class="nav-header">In this section</p>
            <ul id="rch-sidenav" class="nav sm sm-vertical">
              <li><a href="/rch/about/">About the RCH</a></li>
              <li><a href="/rch/about-us/pubs/">Publications</a></li>
              <li><a href="/rch/about-us/board/">RCH Board</a></li>
              <li><a href="/strategic-plan/">Our Strategic Plan</a></li>
              <li><a href="/archives/">History</a></li>
              <li><a href="/alumni/">Alumni</a></li>
            </ul>
          </div>
        </div>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[0].content.menuItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Health Professionals', href: menuHref('/rch/health-professionals/') }),
      expect.objectContaining({ label: 'Patients and Families', href: menuHref('/rch/patients-families/') }),
      expect.objectContaining({ label: 'Departments and Services', href: menuHref('/rch/departments/') }),
    ]))
    expect(result.components[0].content.menuItems).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'RCH Board' }),
      expect.objectContaining({ label: 'Our Strategic Plan' }),
    ]))
    expect(result.components[0].content.utilityNav).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Search the site' }),
    ]))
    expect(result.components[0].content.search).toEqual({ enabled: true, placeholder: 'Search' })
    expect(result.components[1].content.heading).toBe("The Royal Children's Hospital")
  })

  it('uses sourced label attributes for icon-only DOM links but filters logo and controls', () => {
    const components = baseComponents().filter(entry => entry.type !== ComponentType.NavBar)
    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      domSnapshot: `
        <div id="primary-nav" class="navbar">
          <a href="/"><img alt="Example Children Hospital logo" /></a>
          <a href="/menu" aria-label="Menu"></a>
          <a href="/patients" aria-label="Patients and families"></a>
          <a href="/professionals" title="Health professionals"></a>
          <a href="/departments"><img alt="Departments and services" /></a>
        </div>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[0].content.menuItems).toEqual([
      { label: 'Patients and families', href: menuHref('/patients') },
      { label: 'Health professionals', href: menuHref('/professionals') },
      { label: 'Departments and services', href: menuHref('/departments') },
    ])
  })

  it('does not enable navbar search from unrelated or icon-only search text', () => {
    const components = baseComponents().filter(entry => entry.type !== ComponentType.NavBar)
    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      domSnapshot: `
        <div id="primary-nav" class="navbar">
          <a href="/patients">Patients and families</a>
          <a href="/professionals">Health professionals</a>
          <a href="/departments">Departments and services</a>
          <button aria-label="Search"></button>
          <input type="hidden" name="__VIEWSTATE" value="search" />
        </div>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect(result.components[0].content).not.toHaveProperty('search')
  })

  it('skips DOM navbar recovery when anchors only appear outside header-like regions', () => {
    const components = baseComponents().filter(entry => entry.type !== ComponentType.NavBar)
    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/home/',
      pageMetadata: {
        title: 'Example Children Hospital',
        pageType: 'home',
        description: 'Hospital care for patients.',
      },
      domSnapshot: `
        <main>
          <a href="/patients">Patients and families</a>
          <a href="/professionals">Health professionals</a>
          <a href="/departments">Departments and services</a>
        </main>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('source-navbar-missing')
  })

  it('skips unknown or low-confidence skeletons', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/',
      pageMetadata: { title: 'Example Children Hospital' },
      designProfile,
      presentationSkeleton: { key: 'unknown', confidence: 0.2, reason: 'test', diagnostics: [] },
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('institutional-skeleton-not-confident')
  })

  it('skips when design profile is missing or unusable', () => {
    const result = composeInstitutionalHomepageIfEligible(baseComponents(), {
      pageUrl: 'https://example.org/',
      pageMetadata: { title: 'Example Children Hospital' },
      designProfile: {
        ...designProfile,
        confidence: 0,
        diagnostics: [{
          code: 'DESIGN_PROFILE_MISSING_PROBE',
          severity: 'warning',
          message: 'missing',
        }],
      },
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('design-profile-not-usable')
  })

  it('skips when source quick links do not have real hrefs', () => {
    const components = baseComponents()
    components[3] = component(ComponentType.CardGrid, {
      heading: 'Quick access',
      cards: [
        { title: 'Your guide' },
        { title: 'Kids Health Info' },
        { title: 'Clinical Practice Guidelines' },
      ],
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('source-quick-links-missing')
  })

  it('recovers homepage quick links from sourced DOM when model extraction misses the grid', () => {
    const components = baseComponents().filter(entry => {
      if (entry.type !== ComponentType.CardGrid) return true
      return entry.content.heading === 'Latest news'
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://www.rch.org.au/home/',
      pageMetadata: {
        title: "The Royal Children's Hospital",
        pageType: 'home',
        description: 'Hospital care for patients and families.',
      },
      domSnapshot: `
        <div id="primary-nav" class="navbar">
          <a href="/rch/health-professionals/">Health Professionals</a>
          <a href="/rch/patients-families/">Patients and Families</a>
          <a href="/rch/departments/">Departments and Services</a>
        </div>
        <div class="row rch-featured-ani-sm-container">
          <a href="/emerg_rch/status/" onclick="ga('rchTracker.send', 'event', 'InternetHomePage', 'click', 'Emergency status');" title="View the Emergency Department status page."></a>
          <h2>Emergency Department status</h2>
          <p>View the Emergency Department status page for a real time guide.</p>
        </div>
        <div class="row rch-featured-ani-sm-container">
          <a href="/teeninfo/" onclick="ga('rchTracker.send', 'event', 'InternetHomePage', 'click', 'Teen Health Info fact sheets');" title="Teen Health Info fact sheets"></a>
          <h2>Teen Health Info fact sheets</h2>
          <p>Health topics in simple language for young people.</p>
        </div>
        <div class="row rch-featured-ani-sm-container">
          <a href="/telehealth/" onclick="ga('rchTracker.send', 'event', 'InternetHomePage', 'click', 'Telehealth appointments');" title="Telehealth appointments"></a>
          <h2>Telehealth appointments</h2>
          <p>Access to RCH telehealth for patients and families.</p>
        </div>
        <div class="row rch-featured-ani-sm-container">
          <a href="/translation-resources/" onclick="ga('rchTracker.send', 'event', 'InternetHomePage', 'click', 'Translation resources');" title="Translation resources"></a>
          <h2>Translation resources</h2>
          <p>Explore translated resources in over 22 languages.</p>
        </div>
      `,
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(true)
    expect((result.components[2].metadata as any).source).toBe('institutional-homepage-dom-quick-links')
    expect(result.components[2].content.cards).toEqual([
      expect.objectContaining({ title: 'Emergency Department status', href: menuHref('/emerg_rch/status/') }),
      expect.objectContaining({ title: 'Teen Health Info fact sheets', href: menuHref('/teeninfo/') }),
      expect.objectContaining({ title: 'Telehealth appointments', href: menuHref('/telehealth/') }),
      expect.objectContaining({ title: 'Translation resources', href: menuHref('/translation-resources/') }),
    ])
    expect(result.components[2].content).not.toHaveProperty('featureFirstCard')
  })

  it('skips when the source hero has no usable image', () => {
    const components = baseComponents()
    components[1] = component(ComponentType.HeroSimple, {
      heading: 'Hospital care for families',
      body: 'Specialist care for children and families.',
    })

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care for patients.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.applied).toBe(false)
    expect(result.audit.reason).toBe('source-hero-image-missing')
  })

  it('preserves remaining non-duplicate components in source order', () => {
    const components = [
      ...baseComponents(),
      component(ComponentType.TextBlock, { heading: 'Research', body: 'Hospital research programs.' }),
      component(ComponentType.TextBlock, { heading: 'Education', body: 'Education for professionals.' }),
    ]

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care and medical research.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.components.slice(3).map(entry => entry.content.heading)).toEqual([
      'Latest news',
      'Specialist hospital services',
      'Research',
      'Education',
    ])
  })

  it('removes remaining hero surfaces so the composed homepage has one hero', () => {
    const components = [
      ...baseComponents(),
      component(ComponentType.HeroSimple, {
        heading: 'Another promoted heading',
        body: 'This should not become a second homepage hero.',
      }),
    ]

    const result = composeInstitutionalHomepageIfEligible(components, {
      pageUrl: 'https://example.org/',
      pageMetadata: {
        title: 'Example Children Hospital',
        description: 'Hospital care and medical research.',
      },
      designProfile,
      presentationSkeleton: skeleton,
    })

    expect(result.components.filter(entry => String(entry.type).startsWith('hero-'))).toHaveLength(1)
    expect(result.components[1].type).toBe(ComponentType.HeroWithImage)
  })
})
