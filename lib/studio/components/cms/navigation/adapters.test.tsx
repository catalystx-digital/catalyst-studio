import React from 'react';
import { render } from '@testing-library/react';
import { ComponentCategory, ComponentType } from '../_core/types';
import {
  BreadcrumbsAdapter,
  FooterAdapter,
  MobileMenuAdapter,
  NavBarAdapter,
  SidebarNavAdapter
} from './adapters';

const mockNavBar = jest.fn(() => <div data-testid="navbar" />);
const mockFooter = jest.fn(() => <div data-testid="footer" />);
const mockMobileMenu = jest.fn(() => <div data-testid="mobile-menu" />);
const mockBreadcrumbs = jest.fn(() => <div data-testid="breadcrumbs" />);
const mockSidebarNav = jest.fn(() => <div data-testid="sidebar-nav" />);

jest.mock('./nav-bar', () => ({
  NavBar: (props: unknown) => mockNavBar(props)
}));

jest.mock('./footer', () => ({
  Footer: (props: unknown) => mockFooter(props)
}));

jest.mock('./mobile-menu', () => ({
  MobileMenu: (props: unknown) => mockMobileMenu(props)
}));

jest.mock('./breadcrumbs', () => ({
  Breadcrumbs: (props: unknown) => mockBreadcrumbs(props)
}));

jest.mock('./sidebar-nav', () => ({
  SidebarNavServer: (props: unknown) => mockSidebarNav(props)
}));

const baseProps = {
  id: 'component-test',
  category: ComponentCategory.Navigation
};

const link = (path: string) => ({ type: 'internal' as const, pageId: path.replace(/[^a-z0-9]+/gi, '-') || 'home', path });

describe('navigation adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps navbar content to canonical fields only', () => {
    render(
      <NavBarAdapter
        {...baseProps}
        type={ComponentType.NavBar}
        content={{
          links: [{ label: 'Legacy link source', href: '/legacy' }],
          menuItems: [
            { label: 'Canonical', href: link('/canonical') },
            { label: 'String href', href: '/string-href' },
            { label: 'URL only', url: '/url-only' },
            { type: ComponentType.NavMenuItem, content: { label: 'Wrapped', href: '/wrapped' } }
          ]
        }}
      />
    );

    const content = mockNavBar.mock.calls[0][0].content;

    expect(content).not.toHaveProperty('logo');
    expect(content.menuItems).toEqual([
      { label: 'Canonical', href: link('/canonical') },
      { label: 'String href' },
      { label: 'URL only' }
    ]);
  });

  it('keeps footer columns, legal links, and social links canonical', () => {
    render(
      <FooterAdapter
        {...baseProps}
        type={ComponentType.Footer}
        content={{
          columns: [
            {
              heading: 'Legacy Heading',
              items: [{ label: 'Legacy Item', href: '/legacy-item' }]
            },
            {
              title: 'Canonical Column',
              links: [
                { label: 'Canonical Link', href: link('/canonical-link') },
                { label: 'String Link', href: '/string-link' },
                { label: 'URL Link', url: '/url-link' }
              ]
            }
          ],
          legal: [{ label: 'Legacy Legal', href: '/legacy-legal' }],
          socialLinks: [
            { platform: 'Twitter', url: 'https://example.com/twitter' },
            { platform: 'github', url: 'https://example.com/github', label: 'GitHub' }
          ]
        }}
      />
    );

    const content = mockFooter.mock.calls[0][0].content;

    expect(content).not.toHaveProperty('copyright');
    expect(content).not.toHaveProperty('legalLinks');
    expect(content.columns).toEqual([
          {
            title: 'Canonical Column',
            links: [
              { label: 'Canonical Link', href: link('/canonical-link') },
              { label: 'String Link' },
              { label: 'URL Link' }
            ]
          }
    ]);
    expect(content.socialLinks).toEqual([
      { platform: 'github', url: 'https://example.com/github', label: 'GitHub' }
    ]);
  });

  it('ignores mobile menu source aliases and option defaults', () => {
    render(
      <MobileMenuAdapter
        {...baseProps}
        type={ComponentType.MobileMenu}
        content={{
          items: [{ label: 'Legacy Item', href: '/legacy-item' }],
          links: [{ label: 'Legacy Link', href: '/legacy-link' }],
          position: 'center',
          animation: 'zoom'
        }}
      />
    );

    const content = mockMobileMenu.mock.calls[0][0].content;

    expect(content).toEqual({ menuItems: [] });
  });

  it('does not map sidebar text/url aliases or default back links', () => {
    render(
      <SidebarNavAdapter
        {...baseProps}
        type={ComponentType.SidebarNav}
        content={{
          items: [
            { text: 'Legacy Text', url: '/legacy-url' },
            { label: 'Canonical', href: '/canonical' },
            { label: 'No Href', url: '/no-href' }
          ],
          links: [{ label: 'Legacy Source', href: '/legacy-source' }],
          backLink: {}
        }}
      />
    );

    const content = mockSidebarNav.mock.calls[0][0].content;

    expect(content.items).toEqual([
      { label: 'Canonical', href: '/canonical' }
    ]);
    expect(content.backLink).toBeUndefined();
    expect(content.showBackLink).toBeUndefined();
  });

  it('passes canonical breadcrumbs content through', () => {
    const breadcrumbsContent = {
      items: [{ label: 'Home', href: '/' }],
      separator: '>',
      showHome: false
    };

    render(
      <BreadcrumbsAdapter
        {...baseProps}
        type={ComponentType.Breadcrumbs}
        content={breadcrumbsContent}
      />
    );

    expect(mockBreadcrumbs.mock.calls[0][0].content).toBe(breadcrumbsContent);
  });
});
