import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { synthesizeFooter, synthesizeNavBar } from './common-synthesis'
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
        src: 'https://cdn.example.com/brand/logo-light.svg',
        alt: 'Catalyst Studio',
        href: '/'
      },
      menuItems: [
        { label: 'Solutions', href: '/solutions' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Resources', href: '/resources' },
        { label: 'Company', href: '/company' }
      ],
      cta: {
        text: 'Get Started',
        href: '/contact',
        variant: 'default'
      },
      sticky: true
    },
    synthesizer: synthesizeNavBar
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
            { label: 'About', href: '/company' },
            { label: 'Careers', href: '/careers' },
            { label: 'Press', href: '/press' }
          ]
        },
        {
          title: 'Resources',
          links: [
            { label: 'Blog', href: '/resources/blog' },
            { label: 'Docs', href: '/docs' },
            { label: 'Support', href: '/support' }
          ]
        }
      ],
      socialLinks: [
        { platform: 'linkedin', url: 'https://www.linkedin.com/company/catalyst-studio/' },
        { platform: 'twitter', url: 'https://twitter.com/catalyststudio' }
      ],
      copyright: 'Copyright 2024 Catalyst Studio. All rights reserved.',
      legalLinks: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Terms of Service', href: '/legal/terms' }
      ]
    },
    synthesizer: synthesizeFooter
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
