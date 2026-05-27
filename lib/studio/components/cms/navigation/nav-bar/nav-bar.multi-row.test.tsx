import React from 'react'
import { render, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import NavBar from './index'
import { usePathname } from 'next/navigation'
import { ComponentCategory, ComponentType } from '../../_core/types'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

const mockUsePathname = usePathname as jest.Mock

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === 'undefined') {
  // @ts-expect-error - test environment polyfill
  global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

describe('NavBar imported multi-row layout', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
  })

  it('renders logo and utility links in the top band, then primary links in a segmented band', () => {
    const { container } = render(
      <NavBar
        id="imported-navbar"
        type={ComponentType.NavBar}
        category={ComponentCategory.Navigation}
        content={{
          layout: 'multi-row',
          sticky: false,
          transparent: false,
          logo: {
            text: 'MyApp',
            href: { type: 'internal', path: '/' },
          },
          utilityNav: [
            { label: 'Home', href: { type: 'internal', path: '/' } },
            { label: 'About', href: { type: 'internal', path: '/about' } },
          ],
          menuItems: [
            { label: 'Health Professionals', href: { type: 'internal', path: '/health-professionals' } },
            { label: 'Patients and Families', href: { type: 'internal', path: '/patients-families' } },
          ],
          search: {
            enabled: true,
            placeholder: 'Search',
          },
          styles: {
            primaryRow: {
              backgroundColor: '#6f8434',
              textColor: '#ffffff',
              borderColor: '#ffffff',
            },
            primaryItems: [
              {
                label: 'health professionals',
                backgroundColor: '#DA1A32',
                textColor: '#ffffff',
              },
              {
                label: 'patients and families',
                backgroundColor: '#F68D39',
              },
            ],
          },
          cta: {
            label: 'Donate',
            href: { type: 'external', url: 'https://example.com/donate' },
            external: true,
            variant: 'primary',
          },
        }}
      />
    )

    const desktopNav = container.querySelector('.nav-bar-server')
    expect(desktopNav).toBeInTheDocument()
    expect(desktopNav).toHaveClass('relative')

    const topBand = desktopNav?.querySelector('.border-b.border-border.bg-background')
    const primaryBand = desktopNav?.querySelector('[data-imported-primary-nav]')
    expect(topBand).toBeInTheDocument()
    expect(primaryBand).toBeInTheDocument()
    expect(primaryBand).toHaveStyle({ backgroundColor: '#6f8434' })

    expect(within(topBand as HTMLElement).getByRole('link', { name: 'MyApp' })).toBeInTheDocument()
    expect(within(topBand as HTMLElement).getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(within(topBand as HTMLElement).getByRole('link', { name: 'About' })).toBeInTheDocument()
    expect(within(topBand as HTMLElement).getByRole('link', { name: 'Donate' })).toBeInTheDocument()

    expect(within(primaryBand as HTMLElement).getByRole('link', { name: 'Health Professionals' })).toBeInTheDocument()
    expect(within(primaryBand as HTMLElement).getByRole('link', { name: 'Patients and Families' })).toBeInTheDocument()
    expect(within(primaryBand as HTMLElement).getByRole('button', { name: /open search/i })).toBeInTheDocument()

    const healthLink = within(primaryBand as HTMLElement).getByRole('link', { name: 'Health Professionals' })
    const patientLink = within(primaryBand as HTMLElement).getByRole('link', { name: 'Patients and Families' })
    expect(healthLink.parentElement).toHaveStyle({ backgroundColor: '#DA1A32' })
    expect(healthLink.parentElement).toHaveStyle({ color: '#ffffff' })
    expect(healthLink).toHaveClass('text-current')
    expect(patientLink.parentElement).toHaveStyle({ backgroundColor: '#F68D39' })
    expect(healthLink).toHaveClass('hover:brightness-95')
    expect(healthLink).not.toHaveClass('hover:bg-primary/90')
  })
})
