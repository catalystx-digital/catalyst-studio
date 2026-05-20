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