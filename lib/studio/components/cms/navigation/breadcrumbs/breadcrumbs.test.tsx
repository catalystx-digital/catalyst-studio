import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Breadcrumbs } from './index';
import { BreadcrumbsProps } from './breadcrumbs.types';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('Breadcrumbs Component', () => {
  const defaultProps: BreadcrumbsProps = {
    id: 'test-breadcrumbs',
    type: ComponentType.Breadcrumbs,
    category: ComponentCategory.Navigation,
    content: {
      items: [
        { label: 'Products', href: { type: 'internal', pageId: 'products', path: '/products' } },
        { label: 'Electronics', href: { type: 'internal', pageId: 'products-electronics', path: '/products/electronics' } },
        { label: 'Laptops', href: { type: 'internal', pageId: 'products-electronics-laptops', path: '/products/electronics/laptops' } },
      ],
    },
  };

  it('renders without crashing', () => {
    render(<Breadcrumbs {...defaultProps} />);
    const navs = screen.getAllByRole('navigation', { name: 'Breadcrumb' });
    expect(navs.length).toBeGreaterThan(0);
  });

  it('renders breadcrumb items', () => {
    render(<Breadcrumbs {...defaultProps} />);

    expect(screen.getAllByText('Products').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Laptops').length).toBeGreaterThan(0);
  });

  it('renders home link when showHome is true', () => {
    const propsWithHome = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showHome: true,
      },
    };

    render(<Breadcrumbs {...propsWithHome} />);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
  });

  it('does not duplicate a provided home item across server and mobile breadcrumbs', () => {
    render(
      <Breadcrumbs
        {...defaultProps}
        content={{
          items: [
            { label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } },
            { label: 'Products', href: { type: 'internal', pageId: 'products', path: '/products' } },
          ],
          showHome: true,
        }}
      />,
    );

    const serverHomeLinks = screen.getAllByRole('link', { name: 'Home' });
    expect(serverHomeLinks).toHaveLength(2);
    serverHomeLinks.forEach(link => expect(link).toHaveAttribute('href', '/'));
  });

  it('uses custom separator', () => {
    const propsWithSeparator = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        separator: '>' as const,
      },
    };

    render(<Breadcrumbs {...propsWithSeparator} />);
    const separators = screen.getAllByText('>');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('applies aria-label for accessibility', () => {
    render(<Breadcrumbs {...defaultProps} />);

    const navs = screen.getAllByRole('navigation', { name: 'Breadcrumb' });
    navs.forEach(nav => {
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });
  });

  it('includes schema.org structured data', () => {
    const { container } = render(<Breadcrumbs {...defaultProps} />);

    const breadcrumbList = container.querySelector(
      '[itemType="https://schema.org/BreadcrumbList"]',
    );
    expect(breadcrumbList).toBeInTheDocument();

    const listItems = container.querySelectorAll(
      '[itemType="https://schema.org/ListItem"]',
    );
    expect(listItems.length).toBeGreaterThanOrEqual(4);
  });

  it('makes last item non-clickable', () => {
    render(<Breadcrumbs {...defaultProps} />);

    const laptops = screen.getAllByText('Laptops');
    laptops.forEach(node => {
      expect(node.closest('a')).not.toBeInTheDocument();
    });
  });

  it('drops invalid non-current ancestors instead of rendering fake links', () => {
    render(
      <Breadcrumbs
        {...defaultProps}
        content={{
          items: [
            { label: 'Broken' },
            { label: 'Current' },
          ],
          showHome: false,
        }}
      />,
    );

    expect(screen.queryByText('Broken')).not.toBeInTheDocument();
    expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Broken' })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-breadcrumbs',
    };

    const { container } = render(<Breadcrumbs {...propsWithClass} />);
    const serverNav = container.querySelector(
      `[data-component-id="${propsWithClass.id}"]`,
    );
    expect(serverNav?.parentElement).toHaveClass('custom-breadcrumbs');
  });

  it('renders mobile collapse toggle for long trails', () => {
    render(<Breadcrumbs {...defaultProps} />);

    const toggle = screen.getByRole('button', {
      name: /expand breadcrumbs/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles collapse state and emits analytics events', async () => {
    const user = userEvent.setup();
    const onInteraction = jest.fn();

    render(<Breadcrumbs {...defaultProps} onInteraction={onInteraction} />);

    const toggle = screen.getByRole('button', {
      name: /expand breadcrumbs/i,
    });

    await user.click(toggle);

    expect(toggle).toHaveTextContent('Collapse');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse breadcrumbs');
    expect(onInteraction).toHaveBeenCalledWith(
      'breadcrumbs-expand',
      expect.objectContaining({
        collapsed: false,
        itemCount: 4,
        surface: 'mobile',
      }),
    );

    await user.click(toggle);

    expect(toggle).toHaveTextContent('Show full path');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Expand breadcrumbs');
    expect(onInteraction).toHaveBeenCalledWith(
      'breadcrumbs-collapse',
      expect.objectContaining({
        collapsed: true,
        itemCount: 4,
        surface: 'mobile',
      }),
    );
  });

  it('does not render toggle for short trails', () => {
    const shortTrailProps: BreadcrumbsProps = {
      ...defaultProps,
      content: {
        items: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }],
        showHome: false,
      },
    };

    render(<Breadcrumbs {...shortTrailProps} />);
    expect(
      screen.queryByRole('button', { name: /breadcrumbs/i }),
    ).not.toBeInTheDocument();
  });
});
