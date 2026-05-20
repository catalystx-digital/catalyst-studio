import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroMinimal } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock performance monitoring
const mockOnLoad = jest.fn();
const mockOnInteraction = jest.fn();

describe('HeroMinimal Component', () => {
  const defaultProps = {
    id: 'hero-minimal-test',
    type: ComponentType.HeroMinimal,
    category: ComponentCategory.Heroes,
    content: {
      heading: 'Simple Hero Title',
      subheading: 'Clean and focused messaging',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '/start',
          variant: 'primary' as const
        },
        {
          label: 'Learn More',
          href: '/learn',
          variant: 'outline' as const
        }
      ]
    },
    onLoad: mockOnLoad,
    onInteraction: mockOnInteraction
  };

  beforeEach(() => {
    mockOnLoad.mockClear();
    mockOnInteraction.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders without crashing', () => {
    render(<HeroMinimal {...defaultProps} />);
    expect(screen.getByText('Simple Hero Title')).toBeInTheDocument();
  });

  it('renders heading correctly', () => {
    render(<HeroMinimal {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Simple Hero Title');
  });

  it('renders optional subheading', () => {
    render(<HeroMinimal {...defaultProps} />);
    expect(screen.getByText('Clean and focused messaging')).toBeInTheDocument();
  });

  it('renders without optional body text', () => {
    // HeroMinimal doesn't have a body field in its content type
    render(<HeroMinimal {...defaultProps} />);
    expect(screen.getByText('Simple Hero Title')).toBeInTheDocument();
  });

  it('renders primary button with correct attributes', () => {
    render(<HeroMinimal {...defaultProps} />);
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    expect(primaryButton).toHaveAttribute('href', '/start');
    expect(primaryButton).toHaveClass(
      'cms-button',
      'bg-gradient-to-br',
      'from-primary',
      'text-primary-foreground',
    );
    expect(primaryButton).toHaveClass('theme-light');
  });

  it('renders secondary button with correct attributes', () => {
    render(<HeroMinimal {...defaultProps} />);
    const secondaryButton = screen.getByRole('link', { name: 'Learn More' });
    expect(secondaryButton).toHaveAttribute('href', '/learn');
    expect(secondaryButton).toHaveClass('cms-button', 'border', 'border-input');
    expect(secondaryButton).toHaveClass('theme-light');
  });

  it('handles missing optional content gracefully', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        heading: 'Just a Title',
        ctaButtons: []
      }
    };
    
    render(<HeroMinimal {...minimalProps} />);
    expect(screen.getByText('Just a Title')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('applies custom background through style prop', () => {
    const propsWithBg = {
      ...defaultProps,
      style: { backgroundColor: '#ff0000' }
    };
    
    const { container } = render(<HeroMinimal {...propsWithBg} />);
    const section = container.querySelector('section');
    expect(section).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('applies custom text color through style prop', () => {
    const propsWithColor = {
      ...defaultProps,
      style: { color: '#00ff00' }
    };
    
    const { container } = render(<HeroMinimal {...propsWithColor} />);
    const section = container.querySelector('section');
    expect(section).toHaveStyle({ color: '#00ff00' });
  });

  it('applies default max width constraint', () => {
    // Component defaults to the large width token
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const contentDiv = container.querySelector('.max-w-4xl');
    expect(contentDiv).toBeInTheDocument();
  });

  it('renders content within proper container', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const contentDiv = container.querySelector('.cms-container');
    expect(contentDiv).toBeInTheDocument();
  });

  it('applies proper spacing', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const contentDiv = container.querySelector('.ds-gap-lg');
    expect(contentDiv).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-minimal-hero'
    };
    
    const { container } = render(<HeroMinimal {...propsWithClass} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-minimal-hero');
  });

  it('applies custom styles', () => {
    const propsWithStyle = {
      ...defaultProps,
      style: { marginTop: '20px' }
    };
    
    const { container } = render(<HeroMinimal {...propsWithStyle} />);
    const section = container.querySelector('section');
    expect(section).toHaveStyle({ marginTop: '20px' });
  });

  it('sets correct data attributes', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-component-type', ComponentType.HeroMinimal);
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
  });

  it('handles dark theme correctly', () => {
    const propsWithTheme = {
      ...defaultProps,
      theme: 'dark' as const
    };
    
    const { container } = render(<HeroMinimal {...propsWithTheme} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('theme-dark');
    expect(section).toHaveClass('text-text-primary');
  });

  it('handles button variants correctly', () => {
    const propsWithVariants = {
      ...defaultProps,
      content: {
        heading: 'Simple Hero Title',
        subheading: 'Clean and focused messaging',
        ctaButtons: [
          { label: 'Secondary Style', href: '/test', variant: 'secondary' as const }
        ]
      }
    };
    
    render(<HeroMinimal {...propsWithVariants} />);
    const button = screen.getByRole('link', { name: 'Secondary Style' });
    expect(button).toHaveClass('cms-button', 'bg-secondary', 'text-secondary-foreground');
  });

  it('renders with single button only', () => {
    const propsWithOneButton = {
      ...defaultProps,
      content: {
        heading: 'Simple Hero Title',
        subheading: 'Clean and focused messaging',
        ctaButtons: [
          { label: 'Get Started', href: '/start', variant: 'primary' as const }
        ]
      }
    };
    
    render(<HeroMinimal {...propsWithOneButton} />);
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Learn More' })).not.toBeInTheDocument();
  });

  it('centers content properly', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const contentDiv = container.querySelector('.text-center');
    expect(contentDiv).toBeInTheDocument();
    
    const buttonContainer = container.querySelector('.justify-center');
    expect(buttonContainer).toBeInTheDocument();
  });

  it('applies hover states on buttons', () => {
    render(<HeroMinimal {...defaultProps} />);
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    
    expect(primaryButton).toHaveClass(
      'hover:brightness-110',
    );
  });

  it('has proper responsive text sizing', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const heading = container.querySelector('h1');
    const subheading = screen.getByText('Clean and focused messaging');
    
    expect(heading).toHaveClass('ds-heading-1', 'theme-light');
    expect(subheading).toHaveClass('ds-body-xl', 'theme-light');
  });

  it('has proper button responsive sizing', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const buttonContainer = container.querySelector('.flex');
    expect(buttonContainer).toBeInTheDocument();
  });

  it('maintains proper vertical spacing', () => {
    const { container } = render(<HeroMinimal {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('py-16', 'md:py-20');
  });

  it('calls onInteraction when buttons are clicked', () => {
    render(<HeroMinimal {...defaultProps} />);
    
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    fireEvent.click(primaryButton);
    
    expect(mockOnInteraction).toHaveBeenCalledWith('cta-click', {
      label: 'Get Started',
      href: '/start',
      index: 0
    });
  });

  it('handles missing buttons gracefully', () => {
    const propsWithoutButtons = {
      ...defaultProps,
      content: {
        heading: 'No Buttons Hero',
        subheading: 'Just text content',
        ctaButtons: []
      }
    };
    
    render(<HeroMinimal {...propsWithoutButtons} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('No Buttons Hero')).toBeInTheDocument();
  });
});
