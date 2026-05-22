import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const navigationCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.MobileMenu,
    componentType: ComponentType.MobileMenu,
    summary: 'Mobile navigation menu with links, drawer state, and optional call-to-action.',
    fragments: ['mobile-nav', 'menu-links', 'cta-button'],
    cues: ['mobile navigation', 'hamburger menu', 'drawer navigation'],
    sampleContent: {
      isOpen: false,
      links: [
        { label: 'Home', url: '/' },
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' }
      ],
      cta: { label: 'Book a Demo', url: '/contact', variant: 'default' }
    }
  },
  {
    canonicalType: ComponentType.Breadcrumbs,
    componentType: ComponentType.Breadcrumbs,
    summary: 'Breadcrumb navigation trail showing page hierarchy and parent links.',
    fragments: ['breadcrumb-trail', 'breadcrumb-item'],
    cues: ['breadcrumbs', 'navigation trail', 'page hierarchy'],
    sampleContent: {
      items: [
        { label: 'Home', url: '/' },
        { label: 'Blog', url: '/blog' },
        { label: 'Article', url: '/blog/article' }
      ]
    }
  },
  {
    canonicalType: 'breadcrumb',
    componentType: ComponentType.Breadcrumbs,
    summary: 'Single breadcrumb-style navigation trail for hierarchical page context.',
    fragments: ['breadcrumb-trail', 'breadcrumb-item'],
    cues: ['breadcrumb', 'navigation trail'],
    sampleContent: {
      items: [
        { label: 'Home', url: '/' },
        { label: 'Section', url: '/section' },
        { label: 'Current Page', url: '/section/current' }
      ]
    }
  },
  {
    canonicalType: ComponentType.SideMenu,
    componentType: ComponentType.SideMenu,
    summary: 'Vertical navigation menu for secondary pages or dashboard layouts.',
    fragments: ['menu-section', 'menu-link'],
    cues: ['side navigation', 'sidebar menu', 'secondary navigation'],
    sampleContent: {
      title: 'Resources',
      sections: [
        {
          heading: 'Documentation',
          links: [
            { label: 'Overview', url: '/docs' },
            { label: 'API Reference', url: '/docs/api' }
          ]
        },
        {
          heading: 'Support',
          links: [
            { label: 'Contact', url: '/support/contact' },
            { label: 'Status', url: '/status' }
          ]
        }
      ]
    }
  },
  {
    canonicalType: ComponentType.MegaMenu,
    componentType: ComponentType.MegaMenu,
    summary: 'Expanded navigation menu with multi-column layout and featured content.',
    fragments: ['menu-panel', 'menu-column', 'featured-link'],
    cues: ['mega menu', 'multi-column menu', 'flyout navigation'],
    sampleContent: {
      triggerLabel: 'Products',
      columns: [
        {
          title: 'Platform',
          links: [
            { label: 'Overview', url: '/platform' },
            { label: 'Automation', url: '/platform/automation' }
          ]
        },
        {
          title: 'Solutions',
          links: [
            { label: 'Marketing Teams', url: '/solutions/marketing' },
            { label: 'IT Leaders', url: '/solutions/it' }
          ]
        }
      ],
      featured: {
        heading: 'See Catalyst Studio in action',
        description: 'Watch a two-minute overview of our composable platform.',
        cta: { label: 'Play video', url: '/demo' }
      }
    }
  }
]

export function registerNavigationCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of navigationCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
