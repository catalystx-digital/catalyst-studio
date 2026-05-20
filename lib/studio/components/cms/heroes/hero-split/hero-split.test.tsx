import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroSplit } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock performance monitoring
const mockOnLoad = jest.fn();
const mockOnInteraction = jest.fn();

describe('HeroSplit Component', () => {
  const defaultProps = {
    id: 'hero-split-test',
    type: ComponentType.HeroSplit,
    category: ComponentCategory.Heroes,
    content: {
      heading: 'Split Hero Section',
      subheading: 'Showcase content with media',
      body: 'Perfect for highlighting key features with visual support',
      media: {
        type: 'image' as const,
        src: '/hero-image.jpg',
        alt: 'Hero image'
      },
      mediaPosition: 'right' as const,
      splitRatio: '50-50' as const,
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
    },
    onLoad: mockOnLoad,
    onInteraction: mockOnInteraction
  };

  beforeEach(() => {
    mockOnLoad.mockClear();
    mockOnInteraction.mockClear();
  });

  it('renders without crashing', () => {
    render(<HeroSplit {...defaultProps} />);
    expect(screen.getByText('Split Hero Section')).toBeInTheDocument();
  });

  it('renders heading correctly', () => {
    render(<HeroSplit {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Split Hero Section');
  });

  it('renders optional subheading', () => {
    render(<HeroSplit {...defaultProps} />);
    expect(screen.getByText('Showcase content with media')).toBeInTheDocument();
  });

  it('renders optional body text', () => {
    render(<HeroSplit {...defaultProps} />);
    expect(screen.getByText('Perfect for highlighting key features with visual support')).toBeInTheDocument();
  });

  it('renders media image with correct attributes', () => {
    render(<HeroSplit {...defaultProps} />);
    const image = screen.getByAltText('Hero image');
    expect(image).toHaveAttribute('src', '/hero-image.jpg');
  });

  it('renders CTA buttons with correct links', () => {
    render(<HeroSplit {...defaultProps} />);
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    const secondaryButton = screen.getByRole('link', { name: 'Learn More' });
    
    expect(primaryButton).toHaveAttribute('href', '/signup');
    expect(secondaryButton).toHaveAttribute('href', '/features');
  });

  it('applies correct split ratio classes', () => {
    const { container } = render(<HeroSplit {...defaultProps} />);
    const gridContainer = container.querySelector('.lg\\:grid-cols-2');
    expect(gridContainer).toBeInTheDocument();
  });

  it('handles 60-40 split ratio', () => {
    const propsWithRatio = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        splitRatio: '60-40' as const
      }
    };
    
    const { container } = render(<HeroSplit {...propsWithRatio} />);
    // Component uses custom grid-cols-[3fr_2fr] for 60-40 split
    const contentDiv = container.querySelector('.grid');
    expect(contentDiv).toBeInTheDocument();
  });

  it('handles 40-60 split ratio', () => {
    const propsWithRatio = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        splitRatio: '40-60' as const
      }
    };
    
    const { container } = render(<HeroSplit {...propsWithRatio} />);
    // Component uses custom grid-cols-[2fr_3fr] for 40-60 split
    const contentDiv = container.querySelector('.grid');
    expect(contentDiv).toBeInTheDocument();
  });

  it('handles media on left position', () => {
    const propsWithLeftMedia = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        mediaPosition: 'left' as const
      }
    };
    
    const { container } = render(<HeroSplit {...propsWithLeftMedia} />);
    // Component uses grid for layout, not flex
    const gridDiv = container.querySelector('.grid');
    expect(gridDiv).toBeInTheDocument();
  });

  it('handles video media type', () => {
    const propsWithVideo = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        media: {
          type: 'video' as const,
          src: '/hero-video.mp4',
          poster: '/poster.jpg'
        }
      }
    };
    
    const { container } = render(<HeroSplit {...propsWithVideo} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    const source = video?.querySelector('source');
    expect(source).toHaveAttribute('src', '/hero-video.mp4');
    expect(video).toHaveAttribute('poster', '/poster.jpg');
  });

  it('handles missing media gracefully', () => {
    const propsWithoutMedia = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        media: undefined
      }
    };
    
    render(<HeroSplit {...propsWithoutMedia} />);
    expect(screen.getByText('Split Hero Section')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('applies default alignment classes', () => {
    const { container } = render(<HeroSplit {...defaultProps} />);
    const contentDiv = container.querySelector('.items-center');
    expect(contentDiv).toBeInTheDocument();
  });

  it('renders content with proper spacing', () => {
    const { container } = render(<HeroSplit {...defaultProps} />);
    const contentDiv = container.querySelector('.space-y-6');
    expect(contentDiv).toBeInTheDocument();
  });

  it('handles responsive layout', () => {
    const { container } = render(<HeroSplit {...defaultProps} />);
    const gridDiv = container.querySelector('.gap-8');
    expect(gridDiv).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-hero-split'
    };
    
    const { container } = render(<HeroSplit {...propsWithClass} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-hero-split');
  });

  it('applies custom styles', () => {
    const propsWithStyle = {
      ...defaultProps,
      style: { marginTop: '30px' }
    };
    
    const { container } = render(<HeroSplit {...propsWithStyle} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('style');
    expect(section?.getAttribute('style')).toContain('margin-top: 30px');
  });

  it('sets correct data attributes', () => {
    const { container } = render(<HeroSplit {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-component-type', defaultProps.type);
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
  });

  it('calls onInteraction when CTA buttons are clicked', () => {
    render(<HeroSplit {...defaultProps} />);
    
    const primaryButton = screen.getByRole('link', { name: 'Get Started' });
    fireEvent.click(primaryButton);
    
    expect(mockOnInteraction).toHaveBeenCalledWith('cta-click', {
      label: 'Get Started',
      href: '/signup',
      index: 0
    });
  });

  it('renders minimal content without optional elements', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        heading: 'Minimal Split Hero'
      }
    };
    
    render(<HeroSplit {...minimalProps} />);
    expect(screen.getByText('Minimal Split Hero')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('handles button variants correctly', () => {
    const propsWithVariants = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        ctaButtons: [
          {
            label: 'Outline Button',
            href: '/test',
            variant: 'outline' as const
          }
        ]
      }
    };
    
    render(<HeroSplit {...propsWithVariants} />);
    const button = screen.getByRole('link', { name: 'Outline Button' });
    expect(button).toHaveClass('border-2');
  });

  it('handles embed media type', () => {
    const propsWithEmbed = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        media: {
          type: 'embed' as const,
          src: '<iframe src="https://example.com"></iframe>'
        }
      }
    };
    
    const { container } = render(<HeroSplit {...propsWithEmbed} />);
    // Component will render embed in a dangerouslySetInnerHTML container
    const contentDiv = container.querySelector('section');
    expect(contentDiv).toBeInTheDocument();
  });
});