import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroBanner } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('HeroBanner Component', () => {
  const defaultProps = {
    id: 'hero-banner-test',
    type: ComponentType.HeroBanner,
    category: ComponentCategory.Heroes,
    content: {
      heading: 'Welcome to Our Platform',
      subheading: 'Build amazing experiences',
      body: 'Start your journey with us today',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '/signup',
          variant: 'primary' as const
        },
        {
          label: 'Learn More',
          href: '/features',
          variant: 'secondary' as const
        }
      ]
    }
  };
  
  it('renders without crashing', () => {
    render(<HeroBanner {...defaultProps} />);
    expect(screen.getByText('Welcome to Our Platform')).toBeInTheDocument();
  });
  
  it('renders heading correctly', () => {
    render(<HeroBanner {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Welcome to Our Platform');
  });
  
  it('renders optional subheading', () => {
    render(<HeroBanner {...defaultProps} />);
    expect(screen.getByText('Build amazing experiences')).toBeInTheDocument();
  });
  
  it('renders optional body text', () => {
    render(<HeroBanner {...defaultProps} />);
    expect(screen.getByText('Start your journey with us today')).toBeInTheDocument();
  });
  
  it('renders primary button with correct link', () => {
    render(<HeroBanner {...defaultProps} />);
    const primaryButton = screen.getByText('Get Started');
    expect(primaryButton.closest('a')).toHaveAttribute('href', '/signup');
  });
  
  it('renders secondary button with correct link', () => {
    render(<HeroBanner {...defaultProps} />);
    const secondaryButton = screen.getByText('Learn More');
    expect(secondaryButton.closest('a')).toHaveAttribute('href', '/features');
  });
  
  it('handles missing optional content', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        heading: 'Simple Hero'
      }
    };
    
    render(<HeroBanner {...minimalProps} />);
    expect(screen.getByText('Simple Hero')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  
  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-hero-class'
    };
    
    const { container } = render(<HeroBanner {...propsWithClass} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-hero-class');
  });
  
  it('applies custom styles', () => {
    const propsWithStyle = {
      ...defaultProps,
      style: { marginTop: '20px' }
    };
    
    const { container } = render(<HeroBanner {...propsWithStyle} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('style');
    expect(section?.getAttribute('style')).toContain('margin-top: 20px');
  });
  
  it('sets correct data attributes', () => {
    const { container } = render(<HeroBanner {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-component-type', defaultProps.type);
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
  });
  
  it('renders with background image', () => {
    const propsWithBg = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        backgroundImage: '/hero-bg.jpg',
        overlay: {
          enabled: true,
          opacity: 0.6
        }
      }
    };
    
    const { container } = render(<HeroBanner {...propsWithBg} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src');
    expect(img?.getAttribute('src')).toContain('hero-bg.jpg');
  });
  
  it('applies correct alignment classes', () => {
    const propsWithAlignment = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        alignment: 'left' as const
      }
    };
    
    const { container } = render(<HeroBanner {...propsWithAlignment} />);
    const contentDiv = container.querySelector('.text-left');
    expect(contentDiv).toBeInTheDocument();
  });
  
  it('applies correct height classes', () => {
    const propsWithHeight = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        height: 'full' as const
      }
    };
    
    const { container } = render(<HeroBanner {...propsWithHeight} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('min-h-screen');
  });
  
  it('calls onInteraction when buttons are clicked', () => {
    const onInteraction = jest.fn();
    const propsWithHandler = {
      ...defaultProps,
      onInteraction
    };
    
    render(<HeroBanner {...propsWithHandler} />);
    
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    fireEvent.click(primaryButton);
    
    expect(onInteraction).toHaveBeenCalledWith('cta-click', {
      label: 'Get Started',
      href: '/signup',
      index: 0
    });
  });
  
  it('renders correctly with different button variants', () => {
    const propsWithVariants = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        ctaButtons: [
          {
            label: 'Primary',
            href: '/',
            variant: 'outline' as const
          }
        ]
      }
    };
    
    render(<HeroBanner {...propsWithVariants} />);
    const button = screen.getByRole('link', { name: 'Primary' });
    expect(button).toHaveClass('border', 'border-input');
  });
});
