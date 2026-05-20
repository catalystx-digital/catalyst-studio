import { randomUUID } from 'crypto'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { legacyToShadcnVariables } from '@/lib/studio/design-system/design-system-reader'
import type { DesignSystem, DesignSystemAliases } from '@/lib/studio/import/types/design-system.types'
import type { SnapshotDesignSystem } from '@/lib/studio/headless/site-snapshot/types'
import { resolveSharedComponentReference, type ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { HeadDataProvider, ProviderFactory } from '../core/provider'
import { canonicalSlugKey, parsePathSegments } from '@/lib/studio/utils/slug-canonicalizer'
import type {
  PagePayload,
  PageStructurePayload,
  ProviderRequestContext,
  SiteSnapshot,
  SnapshotPage,
  SnapshotRegionSummary,
  SnapshotSharedComponent,
  SnapshotStructureNode,
  SlugSegments
} from '../core/types'
import { applyTemplateOverrides } from '../core/templates'
import { stubDesignSystemTokens } from './stub-design-system'

// Shared navigation links keep global components in sync across every stub page.
const PRIMARY_NAV_MENU = [
  { label: 'Overview', href: '/home' },
  {
    label: 'Solutions',
    href: '/home/solutions',
    groups: [
      {
        title: 'By Team',
        description: 'Purpose-built flows for GTM and partner crews.',
        items: [
          {
            label: 'Marketing teams',
            href: '/home/solutions#marketing',
            description: 'Launch campaigns and track performance from one workspace.'
          },
          {
            label: 'Agency partners',
            href: '/home/solutions#agencies',
            description: 'Spin up client microsites with collaborative approvals.'
          }
        ]
      },
      {
        title: 'By Outcome',
        description: 'Pick the journey that aligns with your launch goals.',
        items: [
          {
            label: 'Product launches',
            href: '/home/solutions#launches',
            description: 'Coordinate GTM playbooks with schedule-aware content.'
          },
          {
            label: 'Lifecycle campaigns',
            href: '/home/solutions#lifecycle',
            description: 'Automate nurture hubs, gated assets, and follow-up journeys.'
          }
        ]
      }
    ]
  },
  {
    label: 'Resources',
    href: '/home/resources',
    groups: [
      {
        title: 'Guides & Tools',
        items: [
          {
            label: 'Component library',
            href: '/home/resources#components',
            description: 'Browse reusable blocks kept in sync with the design system.'
          },
          {
            label: 'Design system',
            href: '/home/resources#design-system',
            description: 'Download tokens, typography, and brand primitives.'
          }
        ]
      },
      {
        title: 'Customer proof',
        items: [
          {
            label: 'Customer stories',
            href: '/home/resources#customers',
            description: 'See how teams ship faster with Catalyst Studio.'
          },
          {
            label: 'Webinars & office hours',
            href: '/home/resources#webinars',
            description: 'Join live walkthroughs and implementation clinics.'
          }
        ]
      }
    ]
  },
  {
    label: 'Pricing',
    href: '/home/pricing',
    groups: [
      {
        title: 'Plans',
        items: [
          {
            label: 'Growth plan',
            href: '/home/pricing#plans',
            description: 'Core automation for lean, high-velocity teams.'
          },
          {
            label: 'Enterprise',
            href: '/home/pricing#enterprise',
            description: 'Advanced governance, SSO, and analytics connectors.'
          }
        ]
      },
      {
        title: 'Compare & Learn',
        items: [
          {
            label: 'Compare tiers',
            href: '/home/pricing#compare',
            description: 'Review limits, onboarding, and studio support options.'
          },
          {
            label: 'ROI calculator',
            href: '/home/pricing#roi',
            description: 'Model the savings versus traditional agency retainers.'
          }
        ]
      }
    ]
  },
  {
    label: 'About',
    href: '/home/about',
    groups: [
      {
        title: 'Company',
        items: [
          {
            label: 'Our story',
            href: '/home/about#story',
            description: 'Learn why we built Catalyst Studio for modern marketing teams.'
          },
          {
            label: 'Leadership',
            href: '/home/about#team',
            description: 'Meet the folks guiding our product and customer success.'
          }
        ]
      },
      {
        title: 'Careers & Press',
        items: [
          {
            label: 'Careers',
            href: '/home/about#careers',
            description: 'Help shape the future of automated headless experiences.'
          },
          {
            label: 'Press kit',
            href: '/home/about#press',
            description: 'Grab logos, bios, and fast facts for media coverage.'
          }
        ]
      }
    ]
  },
  { label: 'Contact', href: '/home/contact' }
]

function buildNavContent() {
  return {
    logo: {
      href: '/home',
      src: STUB_IMAGES.brandLogo,
      alt: 'Catalyst Studio logo',
      text: 'Catalyst Studio',
      width: 160,
      height: 44
    },
    menuItems: PRIMARY_NAV_MENU.map(item => ({ ...item })),
    cta: { text: 'Request demo', href: '/home/contact', variant: 'primary' },
    sticky: true
  }
}

function buildFooterContent() {
  return {
    logo: STUB_IMAGES.brandLogo,
    logoAlt: 'Catalyst Studio wordmark',
    description: 'Catalyst Studio is the AI website platform built for modern marketing, product, and growth teams.',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Overview', href: '/home' },
          { label: 'Solutions', href: '/home/solutions' },
          { label: 'Pricing', href: '/home/pricing' },
          { label: 'Contact', href: '/home/contact' }
        ]
      },
      {
        title: 'Resources',
        links: [
          { label: 'Blog', href: '/home/resources' },
          { label: 'Component library', href: '/home/resources#components' },
          { label: 'Manifest docs', href: '/home/resources#manifest' }
        ]
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/home/about' },
          { label: 'Careers', href: '/home/about#team' }
        ]
      }
    ],
    socialLinks: [
      { platform: 'linkedin', url: 'https://linkedin.com/company/catalyst-studio', label: 'LinkedIn' },
      { platform: 'github', url: 'https://github.com/catalyst-studio', label: 'GitHub' }
    ],
    newsletter: {
      heading: 'Subscribe to launch notes',
      description: 'Monthly digest covering new studio components and best practices.',
      placeholder: 'Email address',
      buttonText: 'Subscribe'
    },
    copyright: '© 2025 Catalyst Studio. All rights reserved.'
  }
}

const STUB_DESIGN_SYSTEM_COMPUTED_AT = '2025-01-15T00:00:00.000Z'

const STUB_DESIGN_SYSTEM: SnapshotDesignSystem = (() => {
  const tokens: DesignSystem = JSON.parse(JSON.stringify(stubDesignSystemTokens))

  // Use new simplified design system reader
  const cssVariables = legacyToShadcnVariables(tokens)
  const aliases: DesignSystemAliases = {
    cssVariables,
    computedAt: STUB_DESIGN_SYSTEM_COMPUTED_AT,
    diagnostics: [],
    fallbackSummary: {}
  }

  const mergedTokens: DesignSystem = {
    ...tokens,
    aliases
  }

  return {
    tokens: mergedTokens,
    aliases
  }
})()

const STUB_IMAGES = {
  brandLogo: '/images/logos/catalyst-studio.svg',
  heroBanner: '/images/stub/hero-banner.svg',
  analytics: 'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=1600',
  deployment: 'https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg?auto=compress&cs=tinysrgb&w=1600',
  cardLaunch: 'https://images.pexels.com/photos/1181354/pexels-photo-1181354.jpeg?auto=compress&cs=tinysrgb&w=1200',
  cardGrowth: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
  cardSales: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200',
  productDashboard: 'https://images.pexels.com/photos/6476584/pexels-photo-6476584.jpeg?auto=compress&cs=tinysrgb&w=1600',
  teamPlanning: 'https://images.pexels.com/photos/3184636/pexels-photo-3184636.jpeg?auto=compress&cs=tinysrgb&w=1600',
  journeyMapping: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1600',
  strategyWorkshop: 'https://images.pexels.com/photos/6476588/pexels-photo-6476588.jpeg?auto=compress&cs=tinysrgb&w=1600',
  customerPanel: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1600',
  logoZenith:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+CiAgPHRpdGxlPlplbml0aCBMYWJzPC90aXRsZT4KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9IiMwZWE1ZTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik0yMCAzOEwxMDAgMTJsODAgMjYiIG9wYWNpdHk9IjAuNiIgLz4KICAgIDxwYXRoIGQ9Ik0yMCA0Nmw4MC0yNCA4MCAyNCIgb3BhY2l0eT0iMC45IiAvPgogIDwvZz4KICA8dGV4dCB4PSIxMDAiIHk9IjQyIiBmb250LWZhbWlseT0iSW50ZXIsICdTZWdvZSBVSScsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMwZjE3MmEiPgogICAgWkVOSVRICiAgPC90ZXh0Pgo8L3N2Zz4K',
  logoNorthwind:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+CiAgPHRpdGxlPk5vcnRod2luZCBSZXRhaWw8L3RpdGxlPgogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik0yNCAzNGM0MC0yMCA2NC0yMCAxMTIgMCIgc3Ryb2tlPSIxZDRlZDgiIG9wYWNpdHk9IjAuNDUiIC8+CiAgICA8cGF0aCBkPSJNMjQgNDJjNDAtMjAgNjQtMjAgMTEyIDAiIHN0cm9rZT0iIzBlYTVlOSIgb3BhY2l0eT0iMC44IiAvPgogIDwvZz4KICA8Y2lyY2xlIGN4PSIzNiIgY3k9IjQwIiByPSI1IiBmaWxsPSIjMGVhNWU5IiAvPgogIDxjaXJjbGUgY3g9IjE2NCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjMWQ0ZWQ4IiAvPgogIDx0ZXh0IHg9IjEwMCIgeT0iNDQiIGZvbnQtZmFtaWx5PSJJbnRlciwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjYwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzFlMjkzYiI+CiAgICBOT1JUSFdJTkQKICA8L3RleHQ+Cjwvc3ZnPgo=',
  logoAurora:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+CiAgPHRpdGxlPkF1cm9yYSBIZWFsdGg8L3RpdGxlPgogIDxkZWZzPgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJhdXJvcmEtZ2xvdyIgY3g9IjUwJSIgY3k9IjUwJSIgcj0iNjUlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZhY2MxNSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI0NSUiIHN0b3AtY29sb3I9IiNmOTczMTYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2RiMjc3NyIgLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDM2IDEyKSIgb3BhY2l0eT0iMC45Ij4KICAgIDxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjE4IiBmaWxsPSJ1cmwoI2F1cm9yYS1nbG93KSIgb3BhY2l0eT0iMC44IiAvPgogICAgPGNpcmNsZSBjeD0iNjQiIGN5PSIxOCIgcj0iMTQiIGZpbGw9InVybCgjYXVyb3JhLWdsb3cpIiBvcGFjaXR5PSIwLjYiIC8+CiAgICA8Y2lyY2xlIGN4PSIxMDQiIGN5PSIzMCIgcj0iMTYiIGZpbGw9InVybCgjYXVyb3JhLWdsb3cpIiBvcGFjaXR5PSIwLjQiIC8+CiAgPC9nPgogIDx0ZXh0IHg9IjEyMCIgeT0iNDQiIGZvbnQtZmFtaWx5PSJJbnRlciwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjYwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2RiMjc3NyI+CiAgICBBVVJPUkEKICA8L3RleHQ+Cjwvc3ZnPgo=',
  logoStratus:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+PHRpdGxlPlN0cmF0dXMgU3lzdGVtczwvdGl0bGU+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik0yNCAzNGMzMi0yMiA1Ni0yMiA5NiAwIiBzdHJva2U9IiMwZjE3MmEiIG9wYWNpdHk9IjAuNSIvPjxwYXRoIGQ9Ik0yNCA0MGMzMi0xOCA1Ni0xOCA5NiAwIiBzdHJva2U9IiMzOGJkZjgiIG9wYWNpdHk9IjAuODUiLz48L2c+PHRleHQgeD0iMTAwIiB5PSI0MiIgZm9udC1mYW1pbHk9IkludGVyLCAnU2Vnb2UgVUknLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iNjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMGYxNzJhIj5TVFJBVFVTPC90ZXh0Pjwvc3ZnPg==',
  logoSolstice:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+PHRpdGxlPlNvbHN0aWNlIFZlbnR1cmVzPC90aXRsZT48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9InN1biIgY3g9IjUwJSIgY3k9IjUwJSIgcj0iNjAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjU5ZTBiIi8+PHN0b3Agb2Zmc2V0PSI2MCUiIHN0b3AtY29sb3I9IiNmOTczMTYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlZjQ0NDQiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSI0MCIgY3k9IjI4IiByPSIxNiIgZmlsbD0idXJsKCNzdW4pIiBvcGFjaXR5PSIwLjg1Ii8+PHBhdGggZD0iTTcwIDIwaDkwdjE2aC05MHoiIGZpbGw9IiMwZjE3MmEiIG9wYWNpdHk9IjAuODUiLz48dGV4dCB4PSIxMjAiIHk9IjM1IiBmb250LWZhbWlseT0iSW50ZXIsICdTZWdvZSBVSScsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI2MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZGU2OGEiPlNPTFNUSUNFPC90ZXh0Pjwvc3ZnPg==',
  logoLumen:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTYiIHJvbGU9ImltZyIgYXJpYS1sYWJlbGxlZGJ5PSJ0aXRsZSI+CiAgPHRpdGxlPkx1bWVuIEFuYWx5dGljczwvdGl0bGU+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzYgMTIpIiBmaWxsPSIjMzhiZGY4IiBvcGFjaXR5PSIwLjg1Ij4KICAgIDxyZWN0IHg9IjAiIHk9IjIyIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSI0IiBvcGFjaXR5PSIwLjUiIC8+CiAgICA8cmVjdCB4PSIyOCIgeT0iMTYiIHdpZHRoPSIxOCIgaGVpZ2h0PSIyNCIgcng9IjQiIG9wYWNpdHk9IjAuNyIgLz4KICAgIDxyZWN0IHg9IjU2IiB5PSIxMCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjMwIiByeD0iNCIgLz4KICAgIDxyZWN0IHg9Ijg0IiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMzYiIHJ4PSI0IiBvcGFjaXR5PSIwLjkiIC8+CiAgPC9nPgogIDxwYXRoIGQ9Ik0zNiA0NGM0MC0xMiA2NC0xMiAxMTIgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMGVhNWU5IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC42IiAvPgogIDx0ZXh0IHg9IjEzMiIgeT0iNDQiIGZvbnQtZmFtaWx5PSJJbnRlciwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzBmMTcyYSI+CiAgICBMVU1FTgogIDwvdGV4dD4KPC9zdmc+Cg=',
  blogAi: 'https://images.pexels.com/photos/3184460/pexels-photo-3184460.jpeg?auto=compress&cs=tinysrgb&w=1200',
  blogTesting: 'https://images.pexels.com/photos/3862617/pexels-photo-3862617.jpeg?auto=compress&cs=tinysrgb&w=1200',
  blogOps: 'https://images.pexels.com/photos/3182763/pexels-photo-3182763.jpeg?auto=compress&cs=tinysrgb&w=1200',
  authorTalia: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400',
  authorAlex: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400',
  authorMika: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400',
  heroStub: '/images/stub/hero-article.svg',
  authorDana: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400',
  authorLina: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=400',
  authorJared: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400',
  aboutHeroPoster: 'https://images.pexels.com/photos/3182759/pexels-photo-3182759.jpeg?auto=compress&cs=tinysrgb&w=1600',
  teamAria: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=500',
  teamEli: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=500',
  teamRina: 'https://images.pexels.com/photos/3184407/pexels-photo-3184407.jpeg?auto=compress&cs=tinysrgb&w=500',
  workshop: 'https://images.pexels.com/photos/3862380/pexels-photo-3862380.jpeg?auto=compress&cs=tinysrgb&w=1400',
  gallery1: 'https://images.pexels.com/photos/3184312/pexels-photo-3184312.jpeg?auto=compress&cs=tinysrgb&w=800',
  gallery2: 'https://images.pexels.com/photos/3861963/pexels-photo-3861963.jpeg?auto=compress&cs=tinysrgb&w=800',
  gallery3: 'https://images.pexels.com/photos/3184463/pexels-photo-3184463.jpeg?auto=compress&cs=tinysrgb&w=800',
  gallery4: 'https://images.pexels.com/photos/3184454/pexels-photo-3184454.jpeg?auto=compress&cs=tinysrgb&w=800',
  videoPoster: 'https://images.pexels.com/photos/3184330/pexels-photo-3184330.jpeg?auto=compress&cs=tinysrgb&w=1600',
  contactHero: '/images/stub/hero-contact.svg',
  mapFallback: 'https://images.pexels.com/photos/373912/pexels-photo-373912.jpeg?auto=compress&cs=tinysrgb&w=1400',
  pricingHero: '/images/stub/hero-pricing.svg',
  heroMinimalPattern: 'https://www.toptal.com/designers/subtlepatterns/patterns/double-bubble-outline.png'
}

const HOME_PARTNER_LOGOS = [
  {
    id: 'logo-zenith',
    src: STUB_IMAGES.logoZenith,
    alt: 'Zenith Labs',
    link: 'https://catalystlabs.example/clients/zenith'
  },
  {
    id: 'logo-northwind',
    src: STUB_IMAGES.logoNorthwind,
    alt: 'Northwind Retail',
    link: 'https://northwind.example'
  },
  {
    id: 'logo-aurora',
    src: STUB_IMAGES.logoAurora,
    alt: 'Aurora Health',
    link: 'https://aurorahealth.example'
  },
  {
    id: 'logo-lumen',
    src: STUB_IMAGES.logoLumen,
    alt: 'Lumen Analytics',
    link: 'https://lumenanalytics.example'
  },
  {
    id: 'logo-stratus',
    src: STUB_IMAGES.logoStratus,
    alt: 'Stratus Systems',
    link: 'https://stratussystems.example'
  },
  {
    id: 'logo-solstice',
    src: STUB_IMAGES.logoSolstice,
    alt: 'Solstice Ventures',
    link: 'https://solsticeventures.example'
  }
];

function buildHomePartnerLogos() {
  return [...HOME_PARTNER_LOGOS];
}


function createComponentInstance(overrides: Partial<ComponentInstance>): ComponentInstance {
  return {
    id: overrides.id ?? randomUUID(),
    type: overrides.type ?? ComponentType.TextBlock,
    parentId: overrides.parentId ?? null,
    position: overrides.position ?? 0,
    props: overrides.props ?? {},
    content: overrides.content ?? {},
    styles: overrides.styles ?? {},
    metadata: overrides.metadata ?? { visible: true },
    globalComponentId: overrides.globalComponentId
  }
}

interface BuildComponentOptions {
  id: string
  type: ComponentType
  region: string
  position: number
  props: Record<string, any>
  metadata?: ComponentInstance['metadata']
  globalComponentId?: string
}

function buildComponent(options: BuildComponentOptions): ComponentInstance {
  const { id, type, region, position, props, metadata, globalComponentId } = options
  return createComponentInstance({
    id,
    type,
    position,
    props: { ...props, region },
    metadata,
    globalComponentId
  })
}

function toRegionSummary(instances: ComponentInstance[]): SnapshotRegionSummary[] {
  const regionMap = new Map<string, Set<ComponentType>>()

  for (const instance of instances) {
    const region = instance.props?.region
    if (!region) continue
    const regionSet = regionMap.get(region) ?? new Set<ComponentType>()
    regionSet.add(instance.type as ComponentType)
    regionMap.set(region, regionSet)
  }

  return Array.from(regionMap.entries()).map(([region, types]) => ({
    region: region as any,
    componentTypes: Array.from(types)
  }))
}

/**
 * Stub content strategy:
 * - Each page focuses on a logical slice (marketing, solutions, resources, blog, about, contact, pricing)
 *   so template policies stay satisfied while covering every registered component.
 * - When new components land in the registry, place a representative instance in the page that best matches its intent
 *   and update PRIMARY_NAV_MENU / structure paths if new routes are introduced.
 */
function buildStubHomePage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-home-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-home-hero',
      type: ComponentType.HeroVideo,
      region: 'hero',
      position: 1,
      props: {
        content: {
          videoUrl: 'https://video-previews.elements.envatousercontent.com/a43989be-c1a5-481d-bd22-b828ac734e5f/watermarked_preview/watermarked_preview.mp4',
          posterImage: STUB_IMAGES.analytics,
          overlayContent: {
            heading: 'Launch production-grade heads in hours, not weeks',
            subheading: 'Catalyst Studio generates ready-to-ship marketing sites with accurate navigation, copy, and components.',
            body: 'Use the stub site as a realistic preview environment to secure approvals before wiring live data.',
            backgroundColor: 'rgba(15, 23, 42, 0.76)',
            textColor: '#F8FAFC',
            padding: 'spacious',
            ctaButtons: [
              { label: 'Request a demo', href: '/home/contact', variant: 'primary' },
              { label: 'Explore pricing', href: '/home/pricing', variant: 'secondary' }
            ]
          },
          videoSettings: { autoplay: true, loop: true, muted: true, controls: false, showOverlayToggle: false },
          alignment: 'left',
          height: 'large'
        },
        theme: 'dark',
        className: 'text-white'
      }
    }),
    buildComponent({
      id: 'stub-home-impact',
      type: ComponentType.FeatureGrid,
      region: 'main',
      position: 2,
      props: {
        content: {
          heading: 'Where teams see impact',
          subheading: 'Catalyst customers ship faster, collaborate better, and reuse more components.',
          columns: 4,
          features: [
            {
              title: '42% faster approvals',
              description: 'Stakeholders sign off quickly when they can tour a realistic preview.'
            },
            {
              title: '1,200+ pages launched',
              description: 'From product announcements to resource hubs across six continents.'
            },
            {
              title: '68 global teams',
              description: 'Growth-stage and enterprise groups collaborating inside Catalyst workspaces.'
            },
            {
              title: '64 NPS score',
              description: 'Customers credit type-safe manifests and accurate previews for smooth launches.'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-home-showcase',
      type: ComponentType.FeatureShowcase,
      region: 'main',
      position: 3,
      props: {
        content: {
          heading: 'Design, validate, and ship together',
          subheading: 'Reusable sections highlight how Catalyst mirrors realistic experiences from concept to launch.',
          sections: [
            {
              image: { src: STUB_IMAGES.teamPlanning, alt: 'Marketing and product teams reviewing a launch plan' },
              title: 'Marketing ready messaging',
              description: 'Pair narrative-driven heroes, social proof, and conversion CTAs to create persuasive journeys.',
              features: [
                { text: 'Curated hero variants for any campaign' },
                { text: 'Composable storytelling layouts' }
              ],
              cta: { text: 'See the solutions overview', url: '/home/solutions' },
              imagePosition: 'right'
            },
            {
              image: { src: STUB_IMAGES.journeyMapping, alt: 'Workflow mapping across teams' },
              title: 'Developer confident handoffs',
              description: 'Export manifests that describe layout, data contracts, and telemetry so engineering can plug in live sources effortlessly.',
              features: [
                { text: 'Region-aware manifest governance' },
                { text: 'Telemetry hooks and performance budgets' }
              ],
              cta: { text: 'Review the manifest guide', url: '/home/resources#from-stub-to-production' },
              imagePosition: 'left'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-home-two-column',
      type: ComponentType.TwoColumn,
      region: 'main',
      position: 4,
      props: {
        content: {
          columnRatio: '60-40',
          gap: 'large',
          verticalAlignment: 'center',
          leftColumn: {
            type: 'text',
            heading: 'Everything in one preview workspace',
            body: '<ul><li>Review navigation, shared components, and page templates from a single hub.</li><li>Swap between light and dark themes, validate responsiveness, and collect feedback without context switching.</li><li>Sync approved content straight into your CMS pipeline with one command.</li></ul>'
          },
          rightColumn: {
            type: 'image',
            imageUrl: STUB_IMAGES.productDashboard,
            imageAlt: 'Catalyst preview dashboard'
          }
        }
      }
    }),
    buildComponent({
      id: 'stub-home-logo-cloud',
      type: ComponentType.LogoCloud,
      region: 'main',
      position: 5,
      props: {
        content: {
          logos: buildHomePartnerLogos(),
          size: 'medium',
          animateScroll: false,
          grayscale: false,
          caption: 'Trusted by product-led organizations modernizing their marketing footprint.'
        }
      }
    }),
    buildComponent({
      id: 'stub-home-testimonials',
      type: ComponentType.Testimonials,
      region: 'main',
      position: 6,
      props: {
        content: {
          columns: { desktop: 2, tablet: 1, mobile: 1 },
          showRating: true,
          testimonials: [
            {
              id: 'testimonial-labs',
              quote:
                '“Catalyst gave us a credible story overnight. Stakeholders saw the exact experience we were planning to launch and signed off immediately.”',
              author: 'Priya Desai',
              role: 'Director of Web Experience',
              company: 'Velocity AI',
              rating: 5
            },
            {
              id: 'testimonial-commerce',
              quote:
                '“The manifest-first approach removed a month of engineering iteration. Our CMS integration simply followed the blueprint Catalyst generated.”',
              author: 'Marcus Holt',
              role: 'Head of Growth',
              company: 'Nimbus HR',
              rating: 5
            },
            {
              id: 'testimonial-agency',
              quote:
                '“We onboard clients faster because Catalyst shows them a living preview instead of wireframes. They feel the polish from day one.”',
              author: 'Chloe Martinez',
              role: 'Managing Partner',
              company: 'Studio Horizon',
              rating: 5
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-home-cta',
      type: ComponentType.CTASimple,
      region: 'main',
      position: 7,
      props: {
        content: {
          eyebrow: 'See Catalyst in action',
          heading: 'Generate your preview workspace today',
          body: 'Install the CLI, pick a template, and ship a production-quality reference head in under ten minutes.',
          primaryButton: { text: 'Generate a head', url: '/home/resources#generator' },
          secondaryButton: { text: 'Talk with product', url: '/home/contact' },
          alignment: 'center',
          backgroundVariant: 'accent'
        }
      }
    }),
    buildComponent({
      id: 'stub-home-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 8,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-home',
    title: 'Home',
    fullPath: '/home',
    templateKey: 'marketing/home-default',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Catalyst Studio | Preview your next launch',
      seoDescription: 'Explore a production-quality marketing site generated from Catalyst components, complete with realistic copy, media, and conversion paths.',
      seoKeywords: ['catalyst studio', 'marketing preview', 'head generation', 'stub site']
    }
  }
}

function buildStubResourcesPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-resources-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-resources-hero',
      type: ComponentType.HeroMinimal,
      region: 'hero',
      position: 1,
      props: {
        theme: 'dark',
        className: 'rounded-3xl shadow-2xl bg-gradient-to-br from-slate-950 via-indigo-900 to-slate-950 text-white',
        content: {
          heading: 'Catalyst launch library',
          subheading: 'Frameworks, playbooks, and component demos curated for product marketers and web teams.',
          backgroundColor: 'linear-gradient(135deg, rgba(9, 22, 43, 0.95), rgba(37, 99, 235, 0.88))',
          ctaButtons: [
          { label: 'Explore resources', href: '#resource-catalog', variant: 'primary' }
          ],
          alignment: 'center',
          backgroundPattern: STUB_IMAGES.heroMinimalPattern,
          padding: 'large',
          maxWidth: 'large'
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-search',
      type: ComponentType.SearchBar,
      region: 'main',
      position: 2,
      props: {
        content: {
          placeholder: 'Search articles, guides, and component demos…',
          showIcon: true,
          showSuggestions: true,
          recentSearches: ['pricing pages', 'blog layout', 'component defaults']
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-catalog',
      type: ComponentType.CardGrid,
      region: 'main',
      position: 3,
      props: {
        content: {
          heading: 'Resource collections',
          subheading: 'Pick a starting point tailored to your role.',
          columns: 3,
          cardStyle: 'minimal',
          cards: [
            {
              id: 'collection-marketing',
              title: 'Go-to-market launch kits',
              description: 'Hero templates, nurture flows, and social proof recipes aligned to product releases.',
              image: STUB_IMAGES.cardLaunch,
              link: '/home/solutions#marketing',
              linkText: 'View playbook'
            },
            {
              id: 'collection-product',
              title: 'Product operations',
              description: 'Manifest governance, template audits, and shared component policies.',
              image: STUB_IMAGES.cardGrowth,
              link: '/home/resources#from-stub-to-production',
              linkText: 'Read guide'
            },
            {
              id: 'collection-agency',
              title: 'Agency handoffs',
              description: 'Reusable contracts and review tooling for partner-led launches.',
              image: STUB_IMAGES.cardSales,
              link: '/home/solutions#agencies',
              linkText: 'See workflows'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-blog-list',
      type: ComponentType.BlogList,
      region: 'main',
      position: 4,
      props: {
        content: {
          title: 'Latest insights',
          description: 'Fresh perspectives from the Catalyst team and our customer community.',
          viewMode: 'grid',
          columns: 2,
          showPagination: true,
          postsPerPage: 6,
          currentPage: 1,
          totalPages: 3,
          posts: [
            {
              id: 'post-stub-production',
              title: 'From stub to production: shipping Catalyst heads with confidence',
              excerpt: 'Step-by-step safeguards for validating layouts, manifests, and component coverage before launch.',
              thumbnail: STUB_IMAGES.heroStub,
              author: { name: 'Dana Malik', avatar: STUB_IMAGES.authorDana },
              publishDate: '2025-04-18',
              categories: ['Best Practices'],
              tags: ['stub provider', 'quality'],
              readingTime: 11,
              slug: '/home/resources/from-stub-to-production'
            },
            {
              id: 'post-ai-components',
              title: 'Mapping AI generated layouts to Catalyst components',
              excerpt: 'Best practices for translating AI-detected structure into production-ready building blocks.',
              thumbnail: STUB_IMAGES.blogAi,
              author: { name: 'Talia Greene', avatar: STUB_IMAGES.authorTalia },
              publishDate: '2025-05-12',
              categories: ['Playbooks'],
              tags: ['ai-mapping', 'site-builder'],
              readingTime: 7,
              slug: 'ai-generated-layouts'
            },
            {
              id: 'post-testing',
              title: 'Testing generated heads before CMS integration',
              excerpt: 'How to validate manifest output, routes, and shared components using the stub provider.',
              thumbnail: STUB_IMAGES.blogTesting,
              author: { name: 'Alex Rivera', avatar: STUB_IMAGES.authorAlex },
              publishDate: '2025-04-28',
              categories: ['Engineering'],
              tags: ['testing', 'cli'],
              readingTime: 5,
              slug: 'testing-generated-heads'
            },
            {
              id: 'post-content-ops',
              title: 'Orchestrating content ops with Catalyst manifests',
              excerpt: 'Align marketing, design, and engineering workflows around a shared manifest contract.',
              thumbnail: STUB_IMAGES.blogOps,
              author: { name: 'Mika Chen', avatar: STUB_IMAGES.authorMika },
              publishDate: '2025-04-10',
              categories: ['Operations'],
              tags: ['workflow', 'manifest'],
              readingTime: 6,
              slug: 'content-ops-manifests'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-two-column',
      type: ComponentType.TwoColumn,
      region: 'main',
      position: 5,
      props: {
        content: {
          columnRatio: '50-50',
          gap: 'large',
          leftColumn: {
            type: 'text',
            heading: 'Always up-to-date component docs',
            body: '<p>Dive into implementation details, prop contracts, and design guidance for every Catalyst component. Each reference is synced with the studio library so you never ship outdated markup.</p><ul><li>Usage examples mapped to hero, content, and CTA patterns.</li><li>Theme and variant previews for dark mode, gradient, and minimal options.</li><li>Copywriting prompts that match real launch scenarios.</li></ul>'
          },
          rightColumn: {
            type: 'image',
            imageUrl: STUB_IMAGES.strategyWorkshop,
            imageAlt: 'Team reviewing Catalyst component documentation'
          }
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-cta',
      type: ComponentType.CTAWithForm,
      region: 'main',
      position: 6,
      props: {
        content: {
          heading: 'Never miss a component drop',
          subheading: 'Join the Catalyst digest for shipping checklists, release notes, and teardown videos.',
          placeholder: 'name@example.com',
          buttonText: 'Subscribe',
          successMessage: 'Thanks for subscribing! Check your inbox for the confirmation email.',
          successDescription: 'The Catalyst digest ships every Thursday at 9am PT with the latest playbooks and release notes.',
          successCta: { label: 'View release notes', href: '/home/resources#release-highlights' },
          validationErrorMessage: 'Add your work email so we know where to send the digest.',
          networkErrorMessage: "We could not save your subscription. Email support@catalyst.dev and we'll make sure you're added.",
          privacyText: 'We respect your inbox. Unsubscribe anytime.',
          privacyLink: '/privacy',
          layout: 'horizontal'
        }
      }
    }),
    buildComponent({
      id: 'stub-resources-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 7,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-resources',
    title: 'Resources',
    fullPath: '/home/resources',
    templateKey: 'blog/index-standard',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Catalyst Studio Resources',
      seoDescription: 'Explore Catalyst launch guides, component documentation, and playbooks for design, marketing, and engineering teams.',
      seoKeywords: ['catalyst resources', 'launch playbooks', 'component docs']
    }
  }
}

function buildStubSolutionsPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-solutions-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-solutions-hero',
      type: ComponentType.HeroSplit,
      region: 'hero',
      position: 1,
      props: {
        content: {
          heading: 'Solutions for every launch workflow',
          subheading: 'Catalyst brings marketing, product, and agency partners together inside a shared preview workspace.',
          body: 'Choose the package that mirrors your planning process and tailor each template with production-ready components.',
          media: {
            type: 'image',
            src: STUB_IMAGES.strategyWorkshop,
            alt: 'Marketing and product leaders collaborating on a launch'
          },
          mediaPosition: 'right',
          splitRatio: '55-45',
          ctaButtons: [
            { label: 'Request a demo', href: '/home/contact', variant: 'primary' },
            { label: 'Download the solution brief', href: '/home/resources#from-stub-to-production', variant: 'secondary' }
          ],
          verticalAlign: 'center'
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-feature-list',
      type: ComponentType.FeatureList,
      region: 'main',
      position: 2,
      props: {
        content: {
          heading: 'Built for cross-functional momentum',
          subheading: 'Flexible workflows let you meet teams where they are while keeping governance intact.',
          layout: 'horizontal',
          items: [
            {
              icon: '🎯',
              title: 'Marketing launches',
              description: 'Tell cohesive stories with conversion-ready heroes, social proof, and CTA flows.',
              link: { text: 'Explore marketing playbook', url: '#marketing' },
              highlighted: true,
              highlightLabel: 'Most popular'
            },
            {
              icon: '🧭',
              title: 'Product operations',
              description: 'Own manifest governance, component contracts, and rollout cadence from a single hub.',
              link: { text: 'See product workflows', url: '#product' }
            },
            {
              icon: '🤝',
              title: 'Agency partnerships',
              description: 'Collaborate with partners using living previews and automated QA checkpoints.',
              link: { text: 'View agency toolkit', url: '#agencies' }
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-tabs',
      type: ComponentType.Tabs,
      region: 'main',
      position: 3,
      props: {
        variant: 'segmented',
        content: {
          heading: 'Choose your Catalyst solution',
          defaultTab: 'marketing',
          orientation: 'horizontal',
          align: 'left',
          tabs: [
            {
              id: 'marketing',
              label: 'Marketing teams',
              eyebrow: 'Campaign velocity',
              description:
                'Give brand, growth, and lifecycle stakeholders an artifact they can review immediately — complete with localized hero variations, sequenced CTAs, and social proof.',
              highlights: [
                'Curated hero and testimonial blocks with audience-specific copy presets',
                'Campaign briefs and launch checklists synced from the Catalyst workspace',
                'Automated preview links with UTM-ready tracking and approval states'
              ],
              media: {
                type: 'image',
                src: STUB_IMAGES.analytics,
                alt: 'Marketing playbooks in Catalyst'
              },
              cta: {
                label: 'See marketing overview',
                href: '#marketing',
                variant: 'secondary'
              }
            },
            {
              id: 'product',
              label: 'Product & engineering',
              eyebrow: 'Manifest governance',
              description:
                'Keep design tokens, component contracts, and rollout policies in lockstep across product and engineering teams.',
              highlights: [
                'Type-safe manifest export with automated policy validation',
                'Bundle analyzer alerts when components drift from accessibility baselines',
                'Telemetry overlays surface slow renders before they impact production'
              ],
              media: {
                type: 'image',
                src: STUB_IMAGES.productDashboard,
                alt: 'Catalyst manifest governance workflows'
              },
              cta: {
                label: 'Review product workflow',
                href: '#product',
                variant: 'outline'
              }
            },
            {
              id: 'agencies',
              label: 'Agencies & partners',
              eyebrow: 'Client-ready previews',
              description:
                'Deliver immersive previews to clients without reinventing your tooling. Catalyst standardises approvals, feedback, and QA checkpoints.',
              highlights: [
                'Client-safe share links with branded themes and feedback capture',
                'Reusable section libraries mapped to your client’s CMS models',
                'Automated QA suites keep accessibility and performance in range'
              ],
              media: {
                type: 'image',
                src: STUB_IMAGES.strategyWorkshop,
                alt: 'Agency collaboration inside Catalyst'
              },
              cta: {
                label: 'Download partner playbook',
                href: '#agencies',
                variant: 'neutral'
              }
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-timeline',
      type: ComponentType.Timeline,
      region: 'main',
      position: 4,
      props: {
        content: {
          title: 'Your first 30 days with Catalyst',
          subtitle: 'From discovery to production launch.',
          layout: 'balanced',
          showConnectors: true,
          showIcons: true,
          animated: true,
          events: [
            {
              id: 'sol-discover',
              date: '2025-01-07',
              title: 'Discover & align',
              description: 'Audit current pages, import brand tokens, and select starter templates.',
              type: 'milestone',
              icon: 'Search'
            },
            {
              id: 'sol-prototype',
              date: '2025-01-14',
              title: 'Prototype & iterate',
              description: 'Customize copy, replace media, and share previews with stakeholders.',
              type: 'event',
              icon: 'Edit3'
            },
            {
              id: 'sol-handoff',
              date: '2025-01-21',
              title: 'Manifest handoff',
              description: 'Lock layout decisions, export manifests, and sync requirements across teams.',
              type: 'achievement',
              icon: 'GitBranch'
            },
            {
              id: 'sol-launch',
              date: '2025-02-01',
              title: 'Launch & measure',
              description: 'Connect live data, ship to production, and monitor performance benchmarks.',
              type: 'milestone',
              icon: 'Rocket'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-quote',
      type: ComponentType.QuoteBlock,
      region: 'main',
      position: 5,
      props: {
        theme: 'dark',
        content: {
          heading: 'Customer perspective',
          quote:
            '<p>“Catalyst gave our distributed teams a shared source of truth. We now preview launches with the exact copy, colors, and layout our customers will see in production.”</p>',
          attribution: {
            author: 'Jamie Lin',
            title: 'Director of Digital Experience',
            organization: 'Horizon B2B',
            image: STUB_IMAGES.customerPanel
          },
          highlight: true,
          align: 'left',
          style: 'testimonial'
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-gallery',
      type: ComponentType.ImageGallery,
      region: 'main',
      position: 6,
      props: {
        content: {
          heading: 'Snapshots from the Catalyst workspace',
          columns: 3,
          spacing: 'loose',
          maxWidth: 'large',
          images: [
            { url: STUB_IMAGES.gallery1, alt: 'Product marketing team reviewing campaign storyboard' },
            { url: STUB_IMAGES.productDashboard, alt: 'Catalyst dashboard with active projects' },
            { url: STUB_IMAGES.gallery2, alt: 'Design system review inside Catalyst' },
            { url: STUB_IMAGES.teamPlanning, alt: 'Cross-functional workshop focusing on messaging' },
            { url: STUB_IMAGES.gallery3, alt: 'Developers collaborating over component manifests' },
            { url: STUB_IMAGES.strategyWorkshop, alt: 'Strategic planning session with Catalyst previews' }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-cta',
      type: ComponentType.CTABanner,
      region: 'main',
      position: 7,
      props: {
        content: {
          heading: 'Find the right Catalyst solution for your team',
          subheading: 'Tell us about your launch goals and we will assemble a tailored workspace for you.',
          primaryButton: { text: 'Schedule strategy session', url: '/home/contact', variant: 'primary' },
          secondaryButton: { text: 'Compare pricing', url: '/home/pricing', variant: 'outline' },
          backgroundColor: '#111827',
          textColor: '#F8FAFC',
          fullWidth: true
        }
      }
    }),
    buildComponent({
      id: 'stub-solutions-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 8,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-solutions',
    title: 'Solutions',
    fullPath: '/home/solutions',
    templateKey: 'core/generic-default',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Catalyst Studio Solutions',
      seoDescription: 'Discover Catalyst solutions for marketing teams, product operations, and agency partners—all powered by realistic preview workspaces.',
      seoKeywords: ['catalyst solutions', 'marketing launches', 'product operations', 'agency collaboration']
    }
  }
}

function buildStubBlogPostPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-article-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-article-hero',
      type: ComponentType.ArticleHeader,
      region: 'hero',
      position: 1,
      props: {
        content: {
          title: 'From stub to production: shipping Catalyst heads with confidence',
          subtitle: 'A step-by-step guide to validating layouts, manifests, and component coverage before launch.',
          author: {
            name: 'Dana Malik',
            title: 'Lead Solutions Architect',
            avatar: STUB_IMAGES.authorDana
          },
          publishDate: '2025-04-18',
          updatedDate: '2025-05-03',
          readingTime: 11,
          categories: ['Best Practices'],
          tags: ['stub provider', 'quality'],
          featuredImage: {
            src: STUB_IMAGES.heroStub,
            alt: 'Catalyst generation pipeline',
            caption: 'Generated head output compared with production site'
          },
          breadcrumbs: [
            { label: 'Home', href: '/home' },
            { label: 'Resources', href: '/home/resources' },
            { label: 'Articles', href: '/home/resources#articles' }
          ],
          shareButtons: true
        },
        showBreadcrumbs: true
      }
    }),
    buildComponent({
      id: 'stub-article-body',
      type: ComponentType.BlogPost,
      region: 'main',
      position: 2,
      props: {
        content: {
          title: 'From stub to production: shipping Catalyst heads with confidence',
          excerpt: 'Before wiring up real CMS data, use the stub provider to stand up routes, manifests, and component variations.',
          bodyHtml:
            '<p>The stub provider ensures every component renders with realistic content so your stakeholders can review full experiences.</p><p>Use the generated manifest to verify routing, shared components, and SEO metadata long before content import finishes.</p><h2>Checklist to review</h2><ul><li>Verify each required template region is populated.</li><li>Confirm shared components match their global definitions.</li><li>Run the generator locally to review generated React code.</li></ul>',
          publishDate: '2025-04-18',
          readingTime: '11 min read',
          categories: ['Best Practices'],
          tags: ['stub provider', 'quality'],
          heroImage: {
            src: STUB_IMAGES.heroStub,
            alt: 'Catalyst generation pipeline'
          },
          author: {
            name: 'Dana Malik',
            title: 'Lead Solutions Architect',
            image: STUB_IMAGES.authorDana,
            bio: 'Dana helps enterprise teams operationalize Catalyst across marketing and product flows.'
          },
          relatedLinks: [
            { label: 'Generator CLI reference', url: '/docs/cli' },
            { label: 'Template policy overview', url: '/docs/templates' }
          ]
        },
        showAuthor: true,
        showShareActions: true,
        shareActions: [
          { label: 'Share on LinkedIn', url: 'https://linkedin.com/shareArticle?mini=true&url=https://example.com' }
        ]
      }
    }),
    buildComponent({
      id: 'stub-article-author',
      type: ComponentType.AuthorBio,
      region: 'main',
      position: 3,
      props: {
        content: {
          name: 'Dana Malik',
          title: 'Lead Solutions Architect',
          bio: 'Dana partners with growth teams to launch multi-market Catalyst experiences. Prior to Catalyst she led DX at Antares Cloud.',
          photo: STUB_IMAGES.authorDana,
          socialLinks: {
            linkedin: 'https://linkedin.com/in/danamalik',
            twitter: 'https://twitter.com/dana_m'
          },
          stats: {
            articlesCount: 42,
            yearsExperience: 12
          },
          expertise: ['Component architecture', 'Enterprise onboarding', 'Governance'],
          expandable: true,
          maxBioLength: 240
        },
        layout: 'horizontal',
        showStats: true,
        showExpertise: true
      }
    }),
    buildComponent({
      id: 'stub-article-related',
      type: ComponentType.RelatedPosts,
      region: 'main',
      position: 4,
      props: {
        content: {
          title: 'Continue learning',
          displayMode: 'grid',
          showExcerpt: true,
          showDate: true,
          posts: [
            {
              id: 'related-manifest',
              title: 'Manifest-driven development with Catalyst',
              slug: 'manifest-driven-development',
              excerpt: 'Use manifests to coordinate marketing and engineering deliverables.',
              author: { name: 'Lina Ross', avatar: STUB_IMAGES.authorLina },
              publishDate: '2025-03-02',
              href: '/home/resources/manifest-driven-development',
              ctaLabel: 'Read article'
            },
            {
              id: 'related-components',
              title: 'Component-level QA checklist',
              slug: 'component-qa-checklist',
              excerpt: 'Ensure every CMS component renders correctly in preview and production.',
              author: { name: 'Jared Lee', avatar: STUB_IMAGES.authorJared },
              publishDate: '2025-02-18',
              href: '/home/resources/component-qa-checklist',
              ctaLabel: 'View checklist'
            }
          ]
        },
        columns: 2
      }
    }),
    buildComponent({
      id: 'stub-article-cta',
      type: ComponentType.CTASimple,
      region: 'main',
      position: 5,
      props: {
        content: {
          eyebrow: 'Next step',
          heading: 'Generate your Catalyst head snapshot',
          body: 'Run the CLI with the stub provider to create fully routed pages and component manifests.',
          primaryButton: { text: 'Run generator', url: '/home/resources#generator', variant: 'primary' },
          secondaryButton: { text: 'Contact solutions team', url: '/home/contact', variant: 'outline' },
          alignment: 'center'
        }
      }
    }),
    buildComponent({
      id: 'stub-article-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 6,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-article',
    title: 'From Stub to Production',
    fullPath: '/home/resources/from-stub-to-production',
    templateKey: 'blog/post-standard',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Shipping Catalyst Heads with Confidence',
      seoDescription: 'Detailed article showing how to use stub data as a readiness checklist before CMS integration.',
      seoKeywords: ['catalyst stub', 'blog post', 'quality']
    }
  }
}

function buildStubAboutPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-about-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-about-breadcrumbs',
      type: ComponentType.Breadcrumbs,
      region: 'header',
      position: 1,
      props: {
        content: {
          items: [
            { label: 'Home', href: '/home' },
            { label: 'About', href: '/home/about' }
          ],
          showHome: false,
          separator: '>'
        }
      }
    }),
    buildComponent({
      id: 'stub-about-hero',
      type: ComponentType.HeroVideo,
      region: 'hero',
      position: 2,
      props: {
        theme: 'dark',
        className: 'text-white',
        content: {
          videoUrl: 'https://assets.mixkit.co/videos/41640/41640-720.mp4',
          posterImage: STUB_IMAGES.aboutHeroPoster,
          overlayContent: {
            heading: 'Crafting the next generation of experience tooling',
            subheading: 'Catalyst Studio empowers cross-functional teams to ship faster together.',
            body: 'Our mission is to give marketing, design, and engineering teams a shared canvas for experimentation and delivery.',
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            textColor: '#f8fafc',
            padding: 'spacious',
            ctaButtons: [
              { label: 'Meet the team', href: '#team', variant: 'primary' }
            ]
          },
          videoSettings: { autoplay: true, loop: true, muted: true, controls: false, showOverlayToggle: false },
          alignment: 'left',
          height: 'large'
        }
      }
    }),
    buildComponent({
      id: 'stub-about-story',
      type: ComponentType.AboutSection,
      region: 'main',
      position: 3,
      props: {
        content: {
          heading: 'Built for teams who design with evidence',
          subheading: 'We started Catalyst after watching launches stall because teams could not preview the final experience together.',
          story:
            'Catalyst Studio pairs a robust CMS component library with tooling that mirrors production behavior. The stub provider is our sandbox for aligning stakeholders before go-live.',
          mission:
            'Help every digital team iterate with confidence by showing production-quality previews from day one.',
          vision: 'A world where marketing, product, and engineering collaborate on a shared artifact.',
          values: [
            { title: 'Start with truth', description: 'Ground decisions in telemetry, manifests, and real content.' },
            { title: 'Design for collaboration', description: 'Everything we ship should help teams work together.' }
          ],
          milestones: [
            { year: '2022', title: 'Catalyst Studio founded', description: 'Launched with a focus on marketing workflows.' },
            { year: '2024', title: 'Studio component library', description: 'Introduced specialized layouts for enterprise teams.' }
          ],
          stats: [
            { value: '180+', label: 'enterprise launches' },
            { value: '45%', label: 'faster approvals', suffix: '' }
          ],
          layout: 'two-column',
          showMilestones: true,
          showValues: true,
          showStats: true
        }
      }
    }),
    buildComponent({
      id: 'stub-about-stats',
      type: ComponentType.Statistics,
      region: 'main',
      position: 4,
      props: {
        content: {
          title: 'Impact in numbers',
          stats: [
            { id: 'stat-sites', value: 380, label: 'Sites generated', suffix: '+' },
            { id: 'stat-teams', value: 92, label: 'Teams aligned globally' },
            { id: 'stat-satisfaction', value: 96, label: 'Customer satisfaction', suffix: '%' }
          ],
          layout: 'grid',
          columns: 3,
          animateOnScroll: true
        }
      }
    }),
    buildComponent({
      id: 'stub-about-team',
      type: ComponentType.TeamGrid,
      region: 'main',
      position: 5,
      props: {
        content: {
          heading: 'Leadership',
          subheading: 'A cross-disciplinary team spanning product, design, and engineering.',
          manualMembers: [
            {
              id: 'team-aria',
              name: 'Aria Singh',
              title: 'CEO & Co-founder',
              department: 'Executive',
              photo: STUB_IMAGES.teamAria,
              linkedin: 'https://linkedin.com/in/ariasingh'
            },
            {
              id: 'team-eli',
              name: 'Eli Navarro',
              title: 'VP Engineering',
              department: 'Engineering',
              photo: STUB_IMAGES.teamEli,
              linkedIn: 'https://linkedin.com/in/elinavarro'
            },
            {
              id: 'team-rina',
              name: 'Rina Patel',
              title: 'VP Product',
              department: 'Product',
              photo: STUB_IMAGES.teamRina,
              linkedIn: 'https://linkedin.com/in/rinapatel'
            }
          ],
          columns: { mobile: 1, tablet: 2, desktop: 3, large: 3 },
          enableHover: true,
          showDepartment: true
        }
      }
    }),
    buildComponent({
      id: 'stub-about-timeline',
      type: ComponentType.Timeline,
      region: 'main',
      position: 6,
      props: {
        content: {
          title: 'Catalyst milestones',
          layout: 'alternating',
          showConnectors: true,
          events: [
            {
              id: 'timeline-1',
              date: '2022-02-01',
              title: 'Seed funding closed',
              description: 'Backed by operators who led digital transformation at global brands.'
            },
            {
              id: 'timeline-2',
              date: '2023-06-15',
              title: 'Stub provider released',
              description: 'Enabled customers to mirror CMS experiences without live data.'
            },
            {
              id: 'timeline-3',
              date: '2024-11-30',
              title: 'Studio component pack v2',
              description: 'Expanded coverage for commerce, blog, and contact experiences.'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-about-quote',
      type: ComponentType.QuoteBlock,
      region: 'main',
      position: 7,
      props: {
        content: {
          quote:
            '“Catalyst brings every discipline together around a tangible preview. The stub provider lets us design with data from day zero.”',
          attribution: {
            author: 'Aria Singh',
            title: 'CEO & Co-founder',
            organization: 'Catalyst Studio'
          },
          style: 'highlighted',
          align: 'left'
        }
      }
    }),
    buildComponent({
      id: 'stub-about-two-column',
      type: ComponentType.TwoColumn,
      region: 'main',
      position: 8,
      props: {
        content: {
          columnRatio: '60-40',
          leftColumn: {
            type: 'text',
            heading: 'How we work',
            body: 'Catalyst squads embed with customers to co-design workflows, calibrate manifests, and evolve governance policies.'
          },
          rightColumn: {
            type: 'image',
            imageUrl: STUB_IMAGES.workshop,
            imageAlt: 'Team collaborating in a workshop'
          },
          gap: 'medium',
          verticalAlignment: 'center'
        }
      }
    }),
    buildComponent({
      id: 'stub-about-gallery',
      type: ComponentType.ImageGallery,
      region: 'main',
      position: 9,
      props: {
        content: {
          images: [
            { url: STUB_IMAGES.gallery1, alt: 'Collaboration session' },
            { url: STUB_IMAGES.gallery2, alt: 'Design critique' },
            { url: STUB_IMAGES.gallery3, alt: 'Team retro' },
            { url: STUB_IMAGES.gallery4, alt: 'Customer interview' }
          ],
          displayMode: 'grid',
          columns: 4,
          showCaptions: false
        }
      }
    }),
    buildComponent({
      id: 'stub-about-video-player',
      type: ComponentType.VideoPlayer,
      region: 'main',
      position: 10,
      props: {
        content: {
          sources: [
            { url: 'https://assets.mixkit.co/videos/4809/4809-720.mp4', type: 'mp4', quality: '1080p' }
          ],
          posterImage: STUB_IMAGES.videoPoster,
          title: 'Inside the Catalyst component library',
          description: 'Go behind the scenes with the engineers maintaining our studio components.',
          controls: true,
          aspectRatio: '16:9'
        }
      }
    }),
    buildComponent({
      id: 'stub-about-text',
      type: ComponentType.TextBlock,
      region: 'main',
      position: 11,
      props: {
        content: {
          heading: 'Our promise to customers',
          body: 'We will always back decisions with data, build tooling that empowers cross-functional teams, and deliver previews that mirror production as closely as possible.',
          alignment: 'left',
          columns: 1
        }
      }
    }),
    buildComponent({
      id: 'stub-about-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 12,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-about',
    title: 'About Catalyst Studio',
    fullPath: '/home/about',
    templateKey: 'core/generic-default',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'About Catalyst Studio',
      seoDescription: 'Learn about the team, mission, and milestones behind Catalyst Studio.',
      seoKeywords: ['about catalyst', 'team', 'mission']
    }
  }
}

function buildStubContactPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-contact-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-contact-hero',
      type: ComponentType.HeroSplit,
      region: 'hero',
      position: 1,
      props: {
        content: {
          heading: 'Partner with the Catalyst team',
          subheading: 'We’ll help you tailor manifests, components, and governance models to your organization.',
          body: 'Reach out for enterprise onboarding, migration support, or custom component development.',
          media: {
            type: 'image',
            src: STUB_IMAGES.contactHero,
            alt: 'Catalyst customer success team'
          },
          mediaPosition: 'right',
          splitRatio: '60-40',
          ctaButtons: [
            { label: 'Contact sales', href: '#contact-form', variant: 'primary' }
          ],
          verticalAlign: 'center'
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-form',
      type: ComponentType.ContactForm,
      region: 'main',
      position: 2,
      props: {
        content: {
          title: 'Tell us about your project',
          description: 'Share a few details and our solutions team will follow up within one business day.',
          fields: [
            { name: 'name', type: 'text', label: 'Full name', placeholder: 'Jordan Carter', required: true, width: 'half' },
            { name: 'email', type: 'email', label: 'Work email', placeholder: 'jordan@company.com', required: true, width: 'half' },
            {
              name: 'teamSize',
              type: 'select',
              label: 'Team size',
              options: [
                { value: '1-5', label: '1-5' },
                { value: '6-15', label: '6-15' },
                { value: '16-50', label: '16-50' },
                { value: '50+', label: '50+' }
              ],
              width: 'half'
            },
            { name: 'message', type: 'textarea', label: 'Project goals', placeholder: 'Share what you are looking to build.' }
          ],
          submitButton: { text: 'Send message', loadingText: 'Sending…' },
          successMessage: 'Thanks for the note! Our team will reach out shortly.',
          successDescription: 'Expect a reply from our solutions team within one business day.',
          successCta: { label: 'Download the onboarding guide', href: '/home/resources#playbooks' },
          errorMessage: 'We could not send your message. Please try again.',
          validationErrorMessage: 'Complete the required fields highlighted above before sending your message.',
          networkErrorMessage: "We could not reach our inbox. Email support@catalyst.dev and we'll follow up right away.",
          honeypot: true,
          resetOnSuccess: true,
          consent: {
            label: 'I agree to receive updates about Catalyst.',
            link: {
              label: 'Review the privacy policy',
              href: '/home/privacy',
            },
            helperText: 'You can opt out at any time from your account settings.',
          }
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-info',
      type: ComponentType.ContactInfo,
      region: 'main',
      position: 3,
      props: {
        content: {
          businessName: 'Catalyst Studio',
          address: {
            street: '501 Market Street',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA'
          },
          phoneNumbers: [
            { label: 'Main', number: '+1 (415) 555-0135' },
            { label: 'Support', number: '+1 (415) 555-0144' }
          ],
          emailAddresses: [
            { label: 'Sales', email: 'sales@catalyst.dev' },
            { label: 'Support', email: 'support@catalyst.dev' }
          ],
          businessHours: {
            monday: '9am – 6pm PT',
            tuesday: '9am – 6pm PT',
            wednesday: '9am – 6pm PT',
            thursday: '9am – 6pm PT',
            friday: '9am – 5pm PT'
          },
          socialLinks: [
            { platform: 'linkedin', url: 'https://linkedin.com/company/catalyst-studio', label: 'LinkedIn' },
            { platform: 'github', url: 'https://github.com/catalyst-studio', label: 'GitHub' }
          ],
          showCopyButtons: true,
          cardStyle: 'bordered'
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-two-column',
      type: ComponentType.TwoColumn,
      region: 'main',
      position: 4,
      props: {
        content: {
          columnRatio: '50-50',
          verticalAlignment: 'center',
          gap: 'large',
          leftColumn: {
            type: 'text',
            heading: 'How we partner with your team',
            body: '<p>Every Catalyst engagement starts with understanding where you are today. From there we co-create a preview workspace that reflects your templates, governance, and success metrics.</p><ul><li>Enterprise onboarding with migration planning.</li><li>Hands-on component QA and accessibility reviews.</li><li>Workshops for cross-functional teams and agency partners.</li></ul>'
          },
          rightColumn: {
            type: 'image',
            imageUrl: STUB_IMAGES.teamPlanning,
            imageAlt: 'Catalyst solutions team collaborating with customers',
            imageHeight: 'compact',
            imageAspectRatio: '4 / 3'
          }
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-map',
      type: ComponentType.LocationMap,
      region: 'main',
      position: 5,
      props: {
        content: {
          address: '501 Market Street, San Francisco, CA 94105',
          coordinates: { lat: 37.7894, lng: -122.3949 },
          zoom: 15,
          mapType: 'roadmap',
          markerTitle: 'Catalyst Studio HQ',
          infoWindow: {
            title: 'Catalyst Studio HQ',
            description: 'Level 12 – check in with reception.',
            showDirections: true
          },
          height: 420,
          enableControls: true,
          fallbackImage: STUB_IMAGES.mapFallback
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-cta',
      type: ComponentType.CTASimple,
      region: 'main',
      position: 6,
      props: {
        content: {
          eyebrow: 'Looking for a dedicated workspace?',
          heading: 'Book time with our solutions architects',
          body: 'We will walk through your launch goals, share relevant templates, and outline the manifest handoff process.',
          primaryButton: { text: 'Schedule a consultation', url: '/home/contact#contact-form' },
          secondaryButton: { text: 'Download solutions overview', url: '/home/solutions' },
          alignment: 'center',
          backgroundVariant: 'muted'
        }
      }
    }),
    buildComponent({
      id: 'stub-contact-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 7,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-contact',
    title: 'Contact',
    fullPath: '/home/contact',
    templateKey: 'core/generic-default',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Contact Catalyst Studio',
      seoDescription: 'Get in touch with the Catalyst team for onboarding, support, or partnership inquiries.',
      seoKeywords: ['contact catalyst', 'support', 'partnership']
    }
  }
}

function buildStubPricingPage(): SnapshotPage {
  const instances: ComponentInstance[] = [
    buildComponent({
      id: 'stub-pricing-nav',
      type: ComponentType.NavBar,
      region: 'header',
      position: 0,
      globalComponentId: 'shared-main-nav',
      props: { content: buildNavContent() }
    }),
    buildComponent({
      id: 'stub-pricing-hero',
      type: ComponentType.HeroWithImage,
      region: 'hero',
      position: 1,
      props: {
        content: {
          eyebrow: 'Pricing',
          heading: 'Pricing built for every launch stage',
          subheading: 'Start with curated previews, grow with governance, and scale with enterprise support.',
          body: 'Each plan includes studio components, manifest validation, and realistic stub workspaces so your teams can plan launches with confidence.',
          layout: 'image-right',
          image: {
            src: STUB_IMAGES.pricingHero,
            alt: 'Catalyst pricing overview dashboard',
            objectFit: 'cover',
            overlayColor: 'rgba(15, 23, 42, 0.6)'
          },
          ctaButtons: [
            { label: 'Start a trial', href: '/home/contact#contact-form', variant: 'primary' },
            { label: 'Download the pricing guide', href: '/home/resources#from-stub-to-production', variant: 'secondary' }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-features',
      type: ComponentType.FeatureList,
      region: 'main',
      position: 2,
      props: {
        content: {
          heading: 'Every plan includes',
          subheading: 'The essentials you need to design, validate, and launch with confidence.',
          layout: 'horizontal',
          items: [
            {
              icon: '🧩',
              title: 'Studio component library',
              description: 'Access Catalyst hero, layout, and CTA patterns with theme-aware defaults.'
            },
            {
              icon: '🧪',
              title: 'Manifest validation',
              description: 'Enforce region policies, telemetry hooks, and accessibility guidance automatically.'
            },
            {
              icon: '🤝',
              title: 'Collaboration & feedback',
              description: 'Collect stakeholder comments, save iterations, and hand off manifests to engineering.'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-table',
      type: ComponentType.PricingTable,
      region: 'main',
      position: 3,
      props: {
        content: {
          title: 'Compare plans',
          subtitle: 'Choose the package that matches your velocity.',
          plans: [
            {
              id: 'plan-studio',
              name: 'Studio',
              description: 'For emerging teams running campaign launches and microsites.',
              price: 59,
              currency: 'USD',
              period: 'monthly',
              features: ['Studio component library', 'Stub workspace access', 'Unlimited preview links'],
              ctaText: 'Start free trial',
              ctaUrl: '/home/contact#contact-form'
            },
            {
              id: 'plan-growth',
              name: 'Growth',
              description: 'Adds governance tooling and analytics for scaling teams.',
              price: 149,
              currency: 'USD',
              period: 'monthly',
              highlighted: true,
              features: ['Everything in Studio', 'Role-based approvals', 'Content schedule analytics'],
              ctaText: 'Request demo',
              ctaUrl: '/signup/growth'
            },
            {
              id: 'plan-enterprise',
              name: 'Enterprise',
              description: 'Tailored onboarding, SSO, and dedicated success team.',
              price: 249,
              currency: 'USD',
              period: 'monthly',
              features: ['Everything in Growth', 'SSO & audit logs', 'Dedicated solutions architect'],
              ctaText: 'Contact sales',
              ctaUrl: '/home/contact'
            }
          ],
          showComparison: true,
          highlightDifferences: true
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-outcomes',
      type: ComponentType.FeatureGrid,
      region: 'main',
      position: 4,
      props: {
        content: {
          heading: 'Results our customers report',
          columns: 3,
          features: [
            {
              title: '38% faster approvals',
              description: 'Stakeholders sign off quickly when they can tour a realistic preview.'
            },
            {
              title: '64% component reuse',
              description: 'Shared layouts and manifests reduce duplicate builds across teams.'
            },
            {
              title: '3-week go-live average',
              description: 'From stub prototype to production launch with Catalyst guidance.'
            }
          ]
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-accordion',
      type: ComponentType.Accordion,
      region: 'main',
      position: 5,
      props: {
        content: {
          heading: 'Frequently asked questions',
          items: [
            {
              id: 'faq-implementation',
              title: 'How long does implementation take?',
              content: 'Most teams deploy their first Catalyst head within four weeks using the stub provider as a north star.'
            },
            {
              id: 'faq-security',
              title: 'Do you support enterprise security requirements?',
              content: 'Yes. Enterprise plans include SSO, audit logs, and custom data retention controls.'
            },
            {
              id: 'faq-billing',
              title: 'Can we switch plans later?',
              content: 'Plans can be upgraded or downgraded at any time. Annual pricing and procurement support are available.'
            }
          ],
          allowMultiple: true
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-cta',
      type: ComponentType.CTASimple,
      region: 'main',
      position: 6,
      props: {
        content: {
          eyebrow: 'Need a tailored package?',
          heading: 'Let’s build the right plan together',
          body: 'Share your launch goals and we will recommend a Catalyst configuration that fits your workflows.',
          primaryButton: { text: 'Talk to sales', url: '/home/contact' },
          secondaryButton: { text: 'Explore solutions', url: '/home/solutions' },
          alignment: 'center',
          backgroundVariant: 'muted'
        }
      }
    }),
    buildComponent({
      id: 'stub-pricing-footer',
      type: ComponentType.Footer,
      region: 'footer',
      position: 7,
      globalComponentId: 'shared-footer',
      props: { content: buildFooterContent() }
    })
  ]

  return {
    id: 'stub-page-pricing',
    title: 'Pricing',
    fullPath: '/home/pricing',
    templateKey: 'commerce/product-detail',
    templateProps: {},
    regions: toRegionSummary(instances),
    components: instances,
    metadata: {
      seoTitle: 'Catalyst Studio Pricing',
      seoDescription: 'Compare Catalyst Studio plans, including component access, manifest governance, and enterprise onboarding support.',
      seoKeywords: ['catalyst pricing', 'plans', 'manifest governance']
    }
  }
}

function buildStructure(): SnapshotStructureNode[] {
  return [
    {
      id: 'struct-home',
      websitePageId: 'stub-page-home',
      parentId: null,
      slug: 'home',
      fullPath: '/home',
      position: 0,
      isFolder: false,
      title: 'Home'
    },
    {
      id: 'struct-solutions',
      websitePageId: 'stub-page-solutions',
      parentId: 'struct-home',
      slug: 'solutions',
      fullPath: '/home/solutions',
      position: 0,
      isFolder: false,
      title: 'Solutions'
    },
    {
      id: 'struct-resources',
      websitePageId: 'stub-page-resources',
      parentId: 'struct-home',
      slug: 'resources',
      fullPath: '/home/resources',
      position: 1,
      isFolder: false,
      title: 'Resources'
    },
    {
      id: 'struct-article',
      websitePageId: 'stub-page-article',
      parentId: 'struct-resources',
      slug: 'from-stub-to-production',
      fullPath: '/home/resources/from-stub-to-production',
      position: 0,
      isFolder: false,
      title: 'From Stub to Production'
    },
    {
      id: 'struct-about',
      websitePageId: 'stub-page-about',
      parentId: 'struct-home',
      slug: 'about',
      fullPath: '/home/about',
      position: 2,
      isFolder: false,
      title: 'About'
    },
    {
      id: 'struct-contact',
      websitePageId: 'stub-page-contact',
      parentId: 'struct-home',
      slug: 'contact',
      fullPath: '/home/contact',
      position: 3,
      isFolder: false,
      title: 'Contact'
    },
    {
      id: 'struct-pricing',
      websitePageId: 'stub-page-pricing',
      parentId: 'struct-home',
      slug: 'pricing',
      fullPath: '/home/pricing',
      position: 4,
      isFolder: false,
      title: 'Pricing'
    }
  ]
}

function buildSharedComponents(): SnapshotSharedComponent[] {
  return [
    {
      id: 'shared-main-nav',
      name: 'Main Navigation',
      componentType: ComponentType.NavBar,
      content: {
        content: buildNavContent()
      },
      config: {}
    },
    {
      id: 'shared-footer',
      name: 'Footer',
      componentType: ComponentType.Footer,
      content: {
        content: buildFooterContent()
      },
      config: {}
    }
  ]
}

function buildSnapshot(): SiteSnapshot {
  const homePage = buildStubHomePage()
  const solutionsPage = buildStubSolutionsPage()
  const resourcesPage = buildStubResourcesPage()
  const articlePage = buildStubBlogPostPage()
  const aboutPage = buildStubAboutPage()
  const contactPage = buildStubContactPage()
  const pricingPage = buildStubPricingPage()
  const structure = buildStructure()
  const sharedComponents = buildSharedComponents()

  return {
    site: {
      id: 'stub-site',
      name: 'Catalyst CLI Demo Site',
      description: 'Stub snapshot used for CLI scaffolding when no live data is supplied.'
    },
    pages: [homePage, solutionsPage, resourcesPage, articlePage, aboutPage, contactPage, pricingPage],
    structure,
    sharedComponents,
    capturedAt: new Date().toISOString(),
    designSystem: STUB_DESIGN_SYSTEM
  }
}


type SlugIndexEntry = {
  page: SnapshotPage
  structure: SnapshotStructureNode | null
  sharedComponents: SnapshotSharedComponent[]
}

function normalizeSlugKey(slug: SlugSegments): string {
  return canonicalSlugKey(slug)
}

function toSegments(fullPath: string): SlugSegments {
  return parsePathSegments(fullPath)
}

function buildStructureMaps(
  structure: SnapshotStructureNode[]
): {
  byId: Map<string, SnapshotStructureNode>
  byPageId: Map<string, SnapshotStructureNode>
  childrenByParent: Map<string | null, SnapshotStructureNode[]>
} {
  const byId = new Map<string, SnapshotStructureNode>()
  const byPageId = new Map<string, SnapshotStructureNode>()
  const childrenByParent = new Map<string | null, SnapshotStructureNode[]>()

  structure.forEach(node => {
    byId.set(node.id, node)
    if (node.websitePageId) {
      byPageId.set(node.websitePageId, node)
    }
    const bucket = childrenByParent.get(node.parentId ?? null) ?? []
    bucket.push(node)
    bucket.sort((a, b) => a.position - b.position)
    childrenByParent.set(node.parentId ?? null, bucket)
  })

  return { byId, byPageId, childrenByParent }
}

function buildPageStructurePayload(
  node: SnapshotStructureNode | null,
  maps: ReturnType<typeof buildStructureMaps>
): PageStructurePayload {
  if (!node) {
    return { current: null, ancestors: [], children: [] }
  }

  const ancestors: SnapshotStructureNode[] = []
  let cursor: SnapshotStructureNode | undefined = node
  while (cursor && cursor.parentId) {
    const parent = maps.byId.get(cursor.parentId)
    if (!parent) {
      break
    }
    ancestors.push(parent)
    cursor = parent
  }
  ancestors.sort((a, b) => a.position - b.position)

  const children = maps.childrenByParent.get(node.id) ?? []

  return {
    current: node,
    ancestors,
    children
  }
}

class StubHeadDataProvider implements HeadDataProvider {
  readonly name = 'stub'
  readonly supportsLiveData = false
  private cachedSnapshot: SiteSnapshot | null = null
  private slugIndex: Map<string, SlugIndexEntry> = new Map()

  constructor(private readonly templateOverrideKey?: string) {}

  async loadSnapshot(): Promise<SiteSnapshot> {
    const snapshot = applyTemplateOverrides(buildSnapshot(), this.templateOverrideKey)
    this.cachedSnapshot = snapshot
    this.rebuildSlugIndex(snapshot)
    return snapshot
  }

  private ensureSnapshot(): SiteSnapshot {
    if (!this.cachedSnapshot) {
      const snapshot = applyTemplateOverrides(buildSnapshot(), this.templateOverrideKey)
      this.cachedSnapshot = snapshot
      this.rebuildSlugIndex(snapshot)
    }
    return this.cachedSnapshot
  }

  private rebuildSlugIndex(snapshot: SiteSnapshot): void {
    const maps = buildStructureMaps(snapshot.structure)
    const sharedById = new Map<string, SnapshotSharedComponent>(
      snapshot.sharedComponents.map(entry => [entry.id, entry])
    )

    const index = new Map<string, SlugIndexEntry>()

    snapshot.pages.forEach(page => {
      const structureNode = maps.byPageId.get(page.id) ?? null
      const slugSegments = structureNode
        ? toSegments(structureNode.fullPath)
        : toSegments(page.fullPath)
      const key = normalizeSlugKey(slugSegments)

      const sharedComponents: SnapshotSharedComponent[] = []
      page.components.forEach(component => {
        const sharedId = resolveSharedComponentReference(component)
        if (sharedId) {
          const shared = sharedById.get(sharedId)
          if (shared) {
            sharedComponents.push(shared)
          }
        }
      })

      index.set(key, {
        page,
        structure: structureNode,
        sharedComponents
      })
    })

    // Provide explicit root fallback to first page when available.
    if (snapshot.pages.length > 0) {
      const firstPage = snapshot.pages[0]
      const structureNode = maps.byPageId.get(firstPage.id) ?? null
      const sharedComponents: SnapshotSharedComponent[] = []
      firstPage.components.forEach(component => {
        const sharedId = resolveSharedComponentReference(component)
        if (sharedId) {
          const shared = sharedById.get(sharedId)
          if (shared) {
            sharedComponents.push(shared)
          }
        }
      })

      index.set('__root__', {
        page: firstPage,
        structure: structureNode,
        sharedComponents
      })
    }

    this.slugIndex = index
  }

  async resolvePageBySlug(slug: SlugSegments, _context: ProviderRequestContext): Promise<PagePayload | null> {
    const snapshot = this.ensureSnapshot()
    if (this.slugIndex.size === 0) {
      this.rebuildSlugIndex(snapshot)
    }

    const key = normalizeSlugKey(slug)
    const entry = this.slugIndex.get(key)

    if (!entry) {
      return null
    }

    const maps = buildStructureMaps(snapshot.structure)
    const structure = buildPageStructurePayload(entry.structure, maps)

    return {
      page: entry.page,
      structure,
      sharedComponents: entry.sharedComponents,
      diagnostics: []
    }
  }
}

export const createStubProvider: ProviderFactory = context => new StubHeadDataProvider(context.templateOverrideKey)
