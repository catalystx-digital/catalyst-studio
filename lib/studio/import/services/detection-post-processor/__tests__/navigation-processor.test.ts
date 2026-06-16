import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import {
  collapseDuplicateGlobalNavigation,
  hasMeaningfulNavbarContent,
  recoverOrRemoveEmptyGlobalNavigation,
  sanitizeGlobalLogosAgainstSource,
} from '../navigation-processor'

function component(type: string, content: Record<string, unknown>): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content,
  }
}

describe('collapseDuplicateGlobalNavigation', () => {
  it('keeps the richer adjacent global navbar and removes the overlapping duplicate', () => {
    const fullNavbar = component('navbar', {
      logo: { alt: 'Example Health logo' },
      search: { enabled: true },
      cta: { label: 'Donate' },
      menuItems: [
        { label: 'Health Professionals' },
        { label: 'Patients and Families' },
        { label: 'Departments and Services' },
        { label: 'Research' },
      ],
      utilityNav: [
        { label: 'Home' },
        { label: 'About' },
        { label: 'News' },
        { label: 'Careers' },
        { label: 'Support us' },
        { label: 'Contact' },
      ],
    })
    const duplicateNavbar = component('navbar', {
      logo: { alt: "Example Health Melbourne" },
      search: { enabled: true },
      cta: { label: 'Donate' },
      menuItems: [],
      utilityNav: [
        { label: 'Home' },
        { label: 'About' },
        { label: 'News' },
        { label: 'Careers' },
        { label: 'Shop' },
        { label: 'Contact' },
      ],
    })

    expect(collapseDuplicateGlobalNavigation([
      fullNavbar,
      duplicateNavbar,
      component('hero-with-image', { heading: 'Hero' }),
    ])).toEqual([
      fullNavbar,
      component('hero-with-image', { heading: 'Hero' }),
    ])
  })

  it('does not collapse separated navbars', () => {
    const components = [
      component('navbar', { menuItems: [{ label: 'Main' }] }),
      component('hero-with-image', { heading: 'Hero' }),
      component('navbar', { menuItems: [{ label: 'Section' }] }),
    ]

    expect(collapseDuplicateGlobalNavigation(components)).toEqual(components)
  })

  it('does not collapse adjacent navbars with distinct primary menus', () => {
    const components = [
      component('navbar', {
        menuItems: [{ label: 'Products' }, { label: 'Pricing' }, { label: 'Docs' }],
        utilityNav: [{ label: 'Login' }],
      }),
      component('navbar', {
        menuItems: [{ label: 'Account' }, { label: 'Billing' }, { label: 'Security' }],
        utilityNav: [{ label: 'Help' }],
      }),
    ]

    expect(collapseDuplicateGlobalNavigation(components)).toEqual(components)
  })

  it('does not collapse primary-less navbars without utility overlap evidence', () => {
    const components = [
      component('navbar', { logo: { alt: 'Desktop logo' }, menuItems: [] }),
      component('navbar', { logo: { alt: 'Mobile logo' }, menuItems: [] }),
    ]

    expect(collapseDuplicateGlobalNavigation(components)).toEqual(components)
  })
})

describe('recoverOrRemoveEmptyGlobalNavigation', () => {
  it('drops empty navbar artifacts when no source navigation can be recovered', () => {
    const components = [
      component('navbar', { menuItems: [], styles: { rootRow: { backgroundColor: '#fff' } } }),
      component('hero-with-image', { heading: 'Hero' }),
    ]

    expect(recoverOrRemoveEmptyGlobalNavigation(components, { domSnapshot: '<main><h1>Hero</h1></main>' }))
      .toEqual([components[1]])
  })

  it('keeps navbars with real link, logo, cta, search, or utility content', () => {
    expect(hasMeaningfulNavbarContent({
      menuItems: [{ label: 'Products', href: { type: 'internal', path: '/products' } }],
    })).toBe(true)
    expect(hasMeaningfulNavbarContent({
      utilityNav: [{ label: 'Support', href: { type: 'internal', path: '/support' } }],
    })).toBe(true)
    expect(hasMeaningfulNavbarContent({ logo: { text: 'Brand' }, menuItems: [] })).toBe(true)
    expect(hasMeaningfulNavbarContent({ cta: { label: 'Donate', href: { type: 'internal', path: '/donate' } }, menuItems: [] })).toBe(true)
    expect(hasMeaningfulNavbarContent({ search: { enabled: true }, menuItems: [] })).toBe(true)
    expect(hasMeaningfulNavbarContent({ menuItems: [{ label: 'Products' }] })).toBe(false)
  })

  it('downgrades navbar logo image URLs that are not backed by source DOM evidence', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', {
        logo: {
          alt: 'The National Archives home page',
          src: {
            mediaId: 'detected:tna-logo',
            mediaType: 'image',
            url: 'https://www.nationalarchives.gov.uk/static/assets/images/logo.svg',
          },
        },
        menuItems: [
          { label: 'Visit', href: { type: 'internal', path: '/visit' } },
          { label: 'Research', href: { type: 'internal', path: '/research' } },
        ],
      }),
    ], {
      pageUrl: 'https://www.nationalarchives.gov.uk/news/',
      domSnapshot: `
        <header>
          <a class="tna-global-header__logo" href="/" aria-label="The National Archives home page">
            <span class="tna-logo"><svg><title>The National Archives home page</title></svg></span>
          </a>
          <nav class="primary-navigation">
            <a href="/visit/">Visit</a>
            <a href="/research/">Research</a>
          </nav>
        </header>
      `,
    })

    expect(result[0].content?.logo).toEqual({
      text: 'The National Archives home page',
      alt: 'The National Archives home page',
      href: '/',
    })
    expect(result[0].metadata).toEqual(expect.objectContaining({
      sanitizedUnbackedNavbarLogo: true,
      removedLogoUrl: 'https://www.nationalarchives.gov.uk/static/assets/images/logo.svg',
    }))
  })

  it('preserves navbar logo image URLs when source DOM contains the same asset', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', {
        logo: {
          alt: 'Example Brand',
          src: {
            mediaId: 'detected:brand-logo',
            mediaType: 'image',
            url: 'https://example.com/brand-lockup.svg',
          },
        },
        menuItems: [
          { label: 'Products', href: { type: 'internal', path: '/products' } },
          { label: 'Contact', href: { type: 'internal', path: '/contact' } },
        ],
      }),
    ], {
      pageUrl: 'https://example.com/',
      domSnapshot: `
        <header>
          <a class="navigation-logo-link" href="/"><img src="/brand-lockup.svg" alt="Example Brand"></a>
          <nav class="primary-navigation">
            <a href="/products/">Products</a>
            <a href="/contact/">Contact</a>
          </nav>
        </header>
      `,
    })

    expect(result[0].content?.logo).toEqual(expect.objectContaining({
      src: expect.objectContaining({
        url: 'https://example.com/brand-lockup.svg',
      }),
    }))
    expect(result[0].metadata).toBeUndefined()
  })

  it('preserves navbar logo image URLs when source DOM evidence is unavailable', () => {
    const components = [
      component('navbar', {
        logo: {
          alt: 'Example Brand',
          src: {
            mediaId: 'detected:brand-logo',
            mediaType: 'image',
            url: 'https://example.com/brand-lockup.svg',
          },
        },
        menuItems: [
          { label: 'Products', href: { type: 'internal', path: '/products' } },
          { label: 'Contact', href: { type: 'internal', path: '/contact' } },
        ],
      }),
    ]

    const result = sanitizeGlobalLogosAgainstSource(components, {
      pageUrl: 'https://example.com/',
    })

    expect(result).toBe(components)
    expect(result[0].content?.logo).toEqual(expect.objectContaining({
      src: expect.objectContaining({
        url: 'https://example.com/brand-lockup.svg',
      }),
    }))
    expect(result[0].metadata).toBeUndefined()
  })

  it('does not preserve navbar logo image URLs that only appear as content images', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', {
        logo: {
          alt: 'Image of an exhibition wall with a logo',
          src: {
            mediaId: 'detected:article-image',
            mediaType: 'image',
            url: 'https://example.com/media/article.jpg',
          },
        },
        menuItems: [
          { label: 'Products', href: { type: 'internal', path: '/products' } },
          { label: 'Contact', href: { type: 'internal', path: '/contact' } },
        ],
      }),
    ], {
      pageUrl: 'https://example.com/',
      domSnapshot: `
        <header>
          <a class="brand-logo" href="/" aria-label="Example Brand"><svg><title>Example Brand</title></svg></a>
          <nav class="primary-navigation">
            <a href="/products/">Products</a>
            <a href="/contact/">Contact</a>
          </nav>
        </header>
        <main><img src="/media/article.jpg" alt="Image of an exhibition wall with a logo"></main>
      `,
    })

    expect(result[0].content?.logo).toEqual({
      text: 'Example Brand',
      alt: 'Example Brand',
      href: '/',
    })
    expect(result[0].metadata).toEqual(expect.objectContaining({
      sanitizedUnbackedNavbarLogo: true,
      removedLogoUrl: 'https://example.com/media/article.jpg',
    }))
  })

  it('downgrades footer logo image URLs that are not backed by source footer DOM evidence', () => {
    const result = sanitizeGlobalLogosAgainstSource([
      component('footer', {
        logo: {
          alt: 'The National Archives',
          text: 'The National Archives',
          src: {
            mediaId: 'detected:tna-logo',
            mediaType: 'image',
            url: 'https://www.nationalarchives.gov.uk/static/assets/images/tna-logo.svg',
          },
        },
        columns: [],
      }),
    ], {
      pageUrl: 'https://www.nationalarchives.gov.uk/news/',
      domSnapshot: `
        <main><img src="/static/assets/images/tna-logo.svg" alt="Unrelated content image"></main>
        <footer><span class="tna-logo"><svg><title>The National Archives</title></svg></span></footer>
      `,
    })

    expect(result[0].content?.logo).toEqual({
      text: 'The National Archives',
      alt: 'The National Archives',
    })
    expect(result[0].metadata).toEqual(expect.objectContaining({
      sanitizedUnbackedFooterLogo: true,
      removedLogoUrl: 'https://www.nationalarchives.gov.uk/static/assets/images/tna-logo.svg',
    }))
  })

  it('recovers an empty navbar from source DOM navigation evidence', () => {
    const source = `
      <nav class="site-navigation primary-nav" aria-label="Primary">
        <a class="site-logo" href="/"><img src="/logo.svg" alt="Example Brand" width="120" height="32"></a>
        <a class="nav-link" href="/products/">Products</a>
        <a class="nav-link" href="/about/">About us</a>
        <a class="nav-link" href="/contact/">Contact</a>
      </nav>
    `
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
      component('hero-with-image', { heading: 'Hero' }),
    ], {
      domSnapshot: source,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].type).toBe('navbar')
    expect(result[0].metadata).toMatchObject({
      source: 'dom-navigation-recovery',
      recoveredFromEmptyNavbar: true,
    })
    expect(result[0].content).toMatchObject({
      logo: {
        alt: 'Example Brand',
        href: '/',
        src: { url: 'https://example.com/logo.svg' },
      },
      menuItems: [
        { label: 'Products', href: { type: 'internal', path: '/products/' } },
      ],
      utilityNav: [
        { label: 'About us', href: { type: 'internal', path: '/about/' } },
        { label: 'Contact', href: { type: 'internal', path: '/contact/' } },
      ],
    })
    expect(result[1].type).toBe('hero-with-image')
  })

  it('recovers a missing navbar from source DOM navigation evidence', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('hero-with-image', { heading: 'Hero' }),
    ], {
      domSnapshot: `
        <header>
          <nav class="global-nav" aria-label="Primary navigation">
            <a class="nav-link" href="/products/">Products</a>
            <a class="nav-link" href="/pricing/">Pricing</a>
          </nav>
        </header>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result.map(entry => entry.type)).toEqual(['navbar', 'hero-with-image'])
    expect(result[0].metadata).toMatchObject({
      source: 'dom-navigation-recovery',
      recoveredFromMissingNavbar: true,
    })
    expect(result[0].content).toMatchObject({
      menuItems: [
        { label: 'Products', href: { type: 'internal', path: '/products/' } },
        { label: 'Pricing', href: { type: 'internal', path: '/pricing/' } },
      ],
    })
  })

  it('replaces a linkless logo-only navbar when source DOM has navigation links', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { logo: { text: 'Example' }, menuItems: [] }),
      component('hero-with-image', { heading: 'Hero' }),
    ], {
      domSnapshot: `
        <nav class="primary-navigation">
          <a class="nav-link" href="/products/">Products</a>
          <a class="nav-link" href="/support/">Support</a>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result.map(entry => entry.type)).toEqual(['navbar', 'hero-with-image'])
    expect(result[0].metadata).toMatchObject({
      source: 'dom-navigation-recovery',
      recoveredFromIncompleteNavbar: true,
    })
    expect(result[0].content).toMatchObject({
      menuItems: [
        { label: 'Products', href: { type: 'internal', path: '/products/' } },
      ],
      utilityNav: [
        { label: 'Support', href: { type: 'internal', path: '/support/' } },
      ],
    })
  })

  it('recovers the brand logo instead of a menu item icon', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { logo: { text: 'Example' }, menuItems: [] }),
    ], {
      domSnapshot: `
        <nav class="primary-navigation">
          <a class="brand-logo" href="/"><img src="/brand-lockup.svg" alt="Example Brand"></a>
          <ul class="product-nav">
            <li><a class="nav-link" href="/products/">Products</a></li>
            <li><a class="nav-link" href="/products/browser/"><img src="/browser-icon.svg" alt="">Firefox browsers</a></li>
            <li><a class="nav-link" href="/products/vpn/"><img src="/vpn-icon.svg" alt="">VPN</a></li>
          </ul>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].content).toMatchObject({
      logo: {
        alt: 'Example Brand',
        src: { url: 'https://example.com/brand-lockup.svg' },
      },
      menuItems: [
        { label: 'Products' },
        { label: 'Firefox browsers' },
        { label: 'VPN' },
      ],
    })
  })

  it('recovers inline SVG brand anchors as text logos and excludes them from menu items', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
    ], {
      domSnapshot: `
        <a class="donate-link" href="https://foundation.example.org/donate">Donate</a>
        <header>
          <a href="/" class="rebrand-logo" aria-label="Nielsen Norman Group - Home">
            <svg><title>Nielsen Norman Group</title><use href="#rebrand-25-logo-black"></use></svg>
            <svg><title>Nielsen Norman Group</title><use href="#rebrand-25-logo-compact"></use></svg>
          </a>
          <nav class="primary-navigation">
            <a class="nav-link" href="/courses/">All Live Online Courses</a>
            <a class="nav-link" href="/articles/">Articles & Videos</a>
          </nav>
        </header>
      `,
      pageUrl: 'https://www.nngroup.com/',
    })

    expect(result[0].content).toMatchObject({
      logo: {
        text: 'Nielsen Norman Group',
        alt: 'Nielsen Norman Group',
        href: '/',
      },
      menuItems: [
        { label: 'All Live Online Courses' },
        { label: 'Articles & Videos' },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('Nielsen Norman Group Nielsen Norman Group')
    expect(JSON.stringify(result[0].content)).not.toContain('foundation.example.org')
  })

  it('ignores consent vendor anchors when recovering navigation logos and links', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
    ], {
      domSnapshot: `
        <header>
          <a href="https://www.cookieyes.com/" class="cky-powered-by">
            Powered by <img alt="Cookieyes logo" src="https://cdn-cookieyes.com/assets/images/poweredbtcky.svg">
          </a>
          <a href="/" class="brand-logo" aria-label="Example Brand - Home">
            <svg><title>Example Brand</title><use href="#brand"></use></svg>
          </a>
          <nav class="primary-navigation">
            <a class="nav-link" href="/products/">Products</a>
            <a class="nav-link" href="/support/">Support</a>
          </nav>
        </header>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].content).toMatchObject({
      logo: {
        text: 'Example Brand',
        alt: 'Example Brand',
        href: '/',
      },
      menuItems: [
        { label: 'Products' },
      ],
      utilityNav: [
        { label: 'Support' },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toMatch(/cookieyes|poweredbtcky|cky-powered-by/i)
  })

  it('does not treat brand-related hrefs as logo evidence', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
    ], {
      domSnapshot: `
        <nav class="primary-navigation">
          <a class="nav-link" href="/brand-strategy/">Brand Strategy</a>
          <a class="nav-link" href="/products/">Products</a>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].content).toMatchObject({
      menuItems: [
        { label: 'Brand Strategy', href: { type: 'internal', path: '/brand-strategy/' } },
        { label: 'Products', href: { type: 'internal', path: '/products/' } },
      ],
    })
    expect((result[0].content as Record<string, unknown>).logo).toBeUndefined()
  })

  it('keeps a real Home link when recovering source navigation', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
    ], {
      domSnapshot: `
        <nav class="primary-nav">
          <a href="/">Home</a>
          <a href="/about/">About</a>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('navbar')
    expect(result[0].content).toMatchObject({
      menuItems: [
        { label: 'Home', href: { type: 'internal', path: '/' } },
      ],
      utilityNav: [
        { label: 'About', href: { type: 'internal', path: '/about/' } },
      ],
    })
  })

  it('does not attach a previous unrelated anchor href to the recovered logo', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { logo: { text: 'Example' }, menuItems: [] }),
    ], {
      domSnapshot: `
        <a class="donate-link" href="https://foundation.example.org/donate">Donate</a>
        <nav class="primary-nav">
          <a class="navigation-logo-link" href="/"><img src="/brand-lockup.svg" alt="Example Brand"></a>
          <a class="nav-link" href="/products/">Products</a>
          <a class="nav-link" href="/about/">About</a>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].content).toMatchObject({
      logo: {
        alt: 'Example Brand',
        href: '/',
        src: { url: 'https://example.com/brand-lockup.svg' },
      },
      menuItems: [
        { label: 'Products' },
      ],
      utilityNav: [
        { label: 'About' },
      ],
    })
  })

  it('does not attach a previous unrelated anchor href when the logo is recovered from the full document', () => {
    const result = recoverOrRemoveEmptyGlobalNavigation([
      component('navbar', { menuItems: [] }),
    ], {
      domSnapshot: `
        <a class="donate-link" href="https://foundation.example.org/donate">Donate</a>
        <a class="navigation-logo-link" href="/"><img src="/brand-lockup.svg" alt="Example Brand"></a>
        <nav class="primary-nav">
          <a class="nav-link" href="/products/">Products</a>
          <a class="nav-link" href="/about/">About</a>
        </nav>
      `,
      pageUrl: 'https://example.com/',
    })

    expect(result[0].content).toMatchObject({
      logo: {
        alt: 'Example Brand',
        href: '/',
        src: { url: 'https://example.com/brand-lockup.svg' },
      },
      menuItems: [
        { label: 'Products' },
      ],
      utilityNav: [
        { label: 'About' },
      ],
    })
  })
})
