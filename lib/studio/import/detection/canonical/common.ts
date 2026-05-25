import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const commonCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.NavBar,
    componentType: ComponentType.NavBar,
    summary: 'Primary site navigation with logo, menu items, and optional call-to-action.',
    fragments: ['logo', 'menu', 'cta-button'],
    cues: ['navigation', 'menu', 'site header', 'global nav'],
    sampleContent: {
      logo: {
        src: {
          mediaId: 'detected:brand-logo',
          mediaType: 'image',
          url: 'https://cdn.example.com/brand/logo-light.svg'
        },
        alt: 'Catalyst Studio',
        href: '/'
      },
      menuItems: [
        { label: 'Solutions', href: { type: 'internal', pageId: 'solutions', path: '/solutions' } },
        { label: 'Pricing', href: { type: 'internal', pageId: 'pricing', path: '/pricing' } },
        { label: 'Resources', href: { type: 'internal', pageId: 'resources', path: '/resources' } },
        { label: 'Company', href: { type: 'internal', pageId: 'company', path: '/company' } }
      ],
      cta: {
        label: 'Get Started',
        href: { type: 'internal', pageId: 'contact', path: '/contact' },
        variant: 'primary'
      },
      sticky: true
    }
  },
  {
    canonicalType: ComponentType.Footer,
    componentType: ComponentType.Footer,
    summary: 'Site footer with navigation columns, social links, and compliance details.',
    fragments: ['footer-column', 'social-links', 'legal-links'],
    cues: ['footer', 'copyright', 'contact information', 'bottom navigation'],
    sampleContent: {
      columns: [
        {
          title: 'Company',
          links: [
            { label: 'About', href: { type: 'internal', pageId: 'company', path: '/company' } },
            { label: 'Careers', href: { type: 'internal', pageId: 'careers', path: '/careers' } },
            { label: 'Press', href: { type: 'internal', pageId: 'press', path: '/press' } }
          ]
        },
        {
          title: 'Resources',
          links: [
            { label: 'Blog', href: { type: 'internal', pageId: 'resources-blog', path: '/resources/blog' } },
            { label: 'Docs', href: { type: 'internal', pageId: 'docs', path: '/docs' } },
            { label: 'Support', href: { type: 'internal', pageId: 'support', path: '/support' } }
          ]
        }
      ],
      socialLinks: [
        { platform: 'linkedin', url: 'https://www.linkedin.com/company/catalyst-studio/' },
        { platform: 'twitter', url: 'https://twitter.com/catalyststudio' }
      ],
      copyright: 'Copyright 2024 Catalyst Studio. All rights reserved.',
      legalLinks: [
        { label: 'Privacy Policy', href: { type: 'internal', pageId: 'legal-privacy', path: '/legal/privacy' } },
        { label: 'Terms of Service', href: { type: 'internal', pageId: 'legal-terms', path: '/legal/terms' } }
      ]
    }
  }
]

export function registerCommonCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of commonCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
