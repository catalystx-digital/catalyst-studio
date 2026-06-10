import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import {
  collapseDuplicateGlobalNavigation,
  hasMeaningfulNavbarContent,
  recoverOrRemoveEmptyGlobalNavigation,
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
})
