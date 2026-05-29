import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { enrichNavbarRowStylesFromEvidence } from '../navbar-row-style-enrichment'
import type { DetectedComponent } from '../types'

function navbar(content: Record<string, unknown>): DetectedComponent {
  return {
    type: ComponentType.NavBar,
    component: ComponentType.NavBar,
    confidence: 0.9,
    content
  }
}

describe('navbar row style enrichment', () => {
  it('sets root row background color for single-row navbar source evidence', () => {
    const components = [
      navbar({
        menuItems: [
          { label: 'Insights' },
          { label: 'About' },
          { label: 'Careers' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      {
        tag: 'header',
        bgColor: '#ffffff',
        text: 'Insights About Careers Contact Us'
      }
    ])

    expect(components[0].content.styles).toEqual({
      rootRow: {
        backgroundColor: '#ffffff'
      }
    })
  })

  it('sets primary row background color when source evidence matches multiple primary labels', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        utilityNav: [{ label: 'Home' }, { label: 'About' }],
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' },
          { label: 'Departments and Services' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      {
        tag: 'header',
        bgColor: '#ffffff',
        text: 'Home About Contact Health Professionals Patients and Families'
      },
      {
        tag: 'nav',
        bgColor: '#6f8434',
        text: 'Health Professionals Patients and Families Departments and Services'
      }
    ])

    expect(components[0].content.styles).toEqual({
      utilityRow: {
        backgroundColor: '#ffffff'
      },
      primaryRow: {
        backgroundColor: '#6f8434'
      }
    })
  })

  it('uses inherited row color for nested source packets', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      {
        tag: 'nav',
        bgColor: '#6f8434',
        children: [
          { tag: 'a', text: 'Health Professionals' },
          { tag: 'a', text: 'Patients and Families' }
        ]
      }
    ])

    expect(components[0].content.styles?.primaryRow?.backgroundColor).toBe('#6f8434')
  })

  it('captures per-primary-item colors from flat desktop nav evidence', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' },
          { label: 'Departments and Services' },
          { label: 'Research' }
        ],
        styles: {
          primaryRow: { backgroundColor: '#eeeeee' }
        }
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      { tag: 'ul', class: 'nav nav-justified hidden-xs', bgColor: '#eeeeee' },
      { tag: 'li', class: 'main-nav-4', bgColor: '#DA1A32' },
      { tag: 'a', text: 'Health Professionals' },
      { tag: 'li', class: 'main-nav-1', bgColor: '#F68D39' },
      { tag: 'a', text: 'Patients and Families' },
      { tag: 'li', class: 'main-nav-3', bgColor: '#56C7DA' },
      { tag: 'a', text: 'Departments and Services' },
      { tag: 'li', class: 'main-nav-5', bgColor: '#FDB913' },
      { tag: 'a', text: 'Research' },
      { tag: 'ul', class: 'nav visible-xs', bgColor: '#eeeeee' },
      { tag: 'li', class: 'main-nav-1', bgColor: '#000000' },
      { tag: 'a', text: 'Health Professionals' }
    ])

    expect(components[0].content.styles?.primaryItems).toEqual([
      { label: 'health professionals', backgroundColor: '#DA1A32' },
      { label: 'patients and families', backgroundColor: '#F68D39' },
      { label: 'departments and services', backgroundColor: '#56C7DA' },
      { label: 'research', backgroundColor: '#FDB913' }
    ])
  })

  it('captures per-primary-item colors from nested desktop nav evidence', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      {
        tag: 'ul',
        class: 'nav nav-justified hidden-xs',
        children: [
          {
            tag: 'li',
            bgColor: '#DA1A32',
            children: [{ tag: 'a', text: 'Health Professionals' }]
          },
          {
            tag: 'li',
            bgColor: '#F68D39',
            children: [{ tag: 'a', text: 'Patients and Families' }]
          }
        ]
      },
      {
        tag: 'ul',
        class: 'nav visible-xs',
        children: [
          {
            tag: 'li',
            bgColor: '#000000',
            children: [{ tag: 'a', text: 'Health Professionals' }]
          }
        ]
      }
    ])

    expect(components[0].content.styles?.primaryItems).toEqual([
      { label: 'health professionals', backgroundColor: '#DA1A32' },
      { label: 'patients and families', backgroundColor: '#F68D39' }
    ])
  })

  it('preserves model-provided primary item styles for labels without source evidence', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' }
        ],
        styles: {
          primaryItems: [
            { label: 'Patients and Families', backgroundColor: '#111111' },
            { label: 'Research', backgroundColor: '#FDB913' }
          ]
        }
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      { tag: 'ul', class: 'nav nav-justified hidden-xs', bgColor: '#eeeeee' },
      { tag: 'li', class: 'main-nav-4', bgColor: '#DA1A32' },
      { tag: 'a', text: 'Health Professionals' }
    ])

    expect(components[0].content.styles?.primaryItems).toEqual([
      { label: 'Patients and Families', backgroundColor: '#111111' },
      { label: 'Research', backgroundColor: '#FDB913' },
      { label: 'health professionals', backgroundColor: '#DA1A32' }
    ])
  })

  it('overrides conflicting model-provided row colors with deterministic source evidence', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        styles: {
          utilityRow: {
            backgroundColor: '#6f8434'
          },
          primaryRow: {
            backgroundColor: '#eeeeee'
          }
        },
        utilityNav: [
          { label: 'Home' },
          { label: 'About' }
        ],
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      {
        tag: 'nav',
        bgColor: '#6f8434',
        text: 'Health Professionals Patients and Families'
      },
      {
        tag: 'div',
        bgColor: '#ffffff',
        text: 'Home About'
      }
    ])

    expect(components[0].content.styles).toEqual({
      utilityRow: {
        backgroundColor: '#ffffff'
      },
      primaryRow: {
        backgroundColor: '#6f8434'
      }
    })
  })

  it('does nothing when color evidence is ambiguous', () => {
    const components = [
      navbar({
        layout: 'multi-row',
        menuItems: [
          { label: 'Health Professionals' },
          { label: 'Patients and Families' }
        ]
      })
    ]

    enrichNavbarRowStylesFromEvidence(components, [
      { tag: 'a', bgColor: '#6f8434', text: 'Health Professionals Patients and Families' },
      { tag: 'a', bgColor: '#123456', text: 'Health Professionals Patients and Families' }
    ])

    expect(components[0].content.styles).toBeUndefined()
  })
})
