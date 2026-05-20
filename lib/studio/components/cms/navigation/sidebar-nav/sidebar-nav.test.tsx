/**
 * SidebarNav Component Tests  
 * Story 10: Code Quality - Task 4.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarNav from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('SidebarNav', () => {
  const mockProps = {
    id: 'sidebar-1',
    type: ComponentType.SidebarNav,
    category: ComponentCategory.Navigation,
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' }
      ]
    }
  };

  it('should render navigation items', () => {
    render(<SidebarNav {...mockProps} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('should handle empty items array', () => {
    const empty = { ...mockProps, content: { items: [] } };
    const { container } = render(<SidebarNav {...empty} />);
    expect(container).toBeInTheDocument();
  });

  it('should have proper ARIA navigation role', () => {
    render(<SidebarNav {...mockProps} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
