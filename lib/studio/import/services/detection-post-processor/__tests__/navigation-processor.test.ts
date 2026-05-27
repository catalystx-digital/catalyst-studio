import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { collapseDuplicateGlobalNavigation } from '../navigation-processor'

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
      logo: { alt: 'RCH logo' },
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
      logo: { alt: "The Royal Children's Hospital Melbourne" },
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
