import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileMenu } from './index';
import { MobileMenuProps } from './mobile-menu.types';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('MobileMenu Component', () => {
  const defaultProps: MobileMenuProps = {
    id: 'test-mobile-menu',
    type: ComponentType.MobileMenu,
    category: ComponentCategory.Navigation,
    content: {
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        {
          label: 'Services',
          href: '/services',
          children: [
            { label: 'Service 1', href: '/services/1' },
            { label: 'Service 2', href: '/services/2' }
          ]
        }
      ]
    }
  };

  it('renders without crashing', () => {
    render(<MobileMenu {...defaultProps} />);
    expect(screen.getByLabelText('Open mobile menu')).toBeInTheDocument();
  });

  it('opens mobile menu when hamburger is clicked', () => {
    render(<MobileMenu {...defaultProps} />);
    
    const menuButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(menuButton);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile menu')).toBeInTheDocument();
  });

  it('closes mobile menu when close button is clicked', () => {
    render(<MobileMenu {...defaultProps} />);
    
    const openButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(openButton);
    
    const closeButton = screen.getByLabelText('Close mobile menu');
    fireEvent.click(closeButton);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders menu items correctly', () => {
    render(<MobileMenu {...defaultProps} />);
    
    const openButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(openButton);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
  });

  it('preserves valid plain string href menu items', () => {
    render(<MobileMenu {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Open mobile menu'));

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  });

  it('resolves structured LinkSchema href menu items', () => {
    const props = {
      ...defaultProps,
      content: {
        menuItems: [
          {
            label: 'Careers',
            href: {
              href: { type: 'internal', pageId: 'careers', path: '/careers' },
              label: 'Careers'
            }
          }
        ]
      }
    } as MobileMenuProps;

    render(<MobileMenu {...props} />);

    fireEvent.click(screen.getByLabelText('Open mobile menu'));

    expect(screen.getByRole('link', { name: 'Careers' })).toHaveAttribute('href', '/careers');
  });

  it('does not render hardcoded fallback items when menu items are empty', () => {
    const props = {
      ...defaultProps,
      content: {
        menuItems: []
      }
    };

    render(<MobileMenu {...props} />);

    fireEvent.click(screen.getByLabelText('Open mobile menu'));

    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument();
  });

  it('renders nested menu items', () => {
    render(<MobileMenu {...defaultProps} />);
    
    const openButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(openButton);
    
    expect(screen.getByText('Service 1')).toBeInTheDocument();
    expect(screen.getByText('Service 2')).toBeInTheDocument();
  });

  it('applies focus trap when open', () => {
    render(<MobileMenu {...defaultProps} />);
    
    const openButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(openButton);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
