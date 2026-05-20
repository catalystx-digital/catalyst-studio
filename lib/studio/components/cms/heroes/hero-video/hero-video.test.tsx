import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroVideo } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

// Mock HTML5 Video API
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockImplementation(() => Promise.resolve()),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: jest.fn(),
});

// Mock video properties
Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
  writable: true,
  value: 120, // 2 minutes
});

Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
  writable: true,
  value: 0,
});

Object.defineProperty(HTMLMediaElement.prototype, 'buffered', {
  writable: true,
  value: {
    length: 1,
    end: () => 30,
  },
});

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

// Mock performance monitoring
const mockOnLoad = jest.fn();
const mockOnInteraction = jest.fn();

describe('HeroVideo Component', () => {
  const defaultProps = {
    id: 'hero-video-test',
    type: ComponentType.HeroVideo,
    category: ComponentCategory.Heroes,
    content: {
      videoUrl: '/hero-video.mp4',
      posterImage: '/poster.jpg',
      overlayContent: {
        heading: 'Video Hero Section',
        subheading: 'Engaging video background',
        body: 'Perfect for showcasing your product or brand with dynamic video content',
        ctaButtons: [
          {
            label: 'Watch Demo',
            href: '/demo',
            variant: 'primary' as const
          },
          {
            label: 'Learn More',
            href: '/learn',
            variant: 'outline' as const
          }
        ]
      },
      videoSettings: {
        autoplay: true,
        muted: true,
        loop: true,
        controls: true,
        showOverlayToggle: true,
      },
      height: 'medium' as const,
      alignment: 'center' as const
    },
    onLoad: mockOnLoad,
    onInteraction: mockOnInteraction
  };

  beforeEach(() => {
    mockOnLoad.mockClear();
    mockOnInteraction.mockClear();
    // Reset video mocks
    HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders without crashing', () => {
    render(<HeroVideo {...defaultProps} />);
    expect(screen.getByText('Video Hero Section')).toBeInTheDocument();
  });

  it('renders heading correctly', () => {
    render(<HeroVideo {...defaultProps} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Video Hero Section');
  });

  it('renders video element with correct attributes', () => {
    const { container } = render(<HeroVideo {...defaultProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    
    // Video uses <source> element, not direct src attribute
    const source = video?.querySelector('source');
    expect(source).toHaveAttribute('src', '/hero-video.mp4');
    expect(video).toHaveAttribute('poster', '/poster.jpg');
    
    // Check video properties (React sets these as properties, not attributes)
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
  });

  it('renders optional subheading', () => {
    render(<HeroVideo {...defaultProps} />);
    expect(screen.getByText('Engaging video background')).toBeInTheDocument();
  });

  it('renders optional body text', () => {
    render(<HeroVideo {...defaultProps} />);
    expect(screen.getByText('Perfect for showcasing your product or brand with dynamic video content')).toBeInTheDocument();
  });

  it('renders CTA buttons with correct attributes', () => {
    render(<HeroVideo {...defaultProps} />);
    const primaryButton = screen.getByRole('link', { name: 'Watch Demo' });
    const secondaryButton = screen.getByRole('link', { name: 'Learn More' });

    expect(primaryButton).toHaveAttribute('href', '/demo');
    expect(secondaryButton).toHaveAttribute('href', '/learn');
  });

  it('shows a skeleton overlay while the video is loading', () => {
    const { container } = render(<HeroVideo {...defaultProps} />);
    const skeletonLayer = container.querySelector('.animate-pulse');
    expect(skeletonLayer).toBeInTheDocument();
    expect(screen.queryByText(/Loading video/i)).not.toBeInTheDocument();
  });

  it('renders video controls when enabled', () => {
    const propsWithControls = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoSettings: {
          ...defaultProps.content.videoSettings,
          controls: true
        }
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithControls} />);
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('controls');
  });

  it('renders overlay content when provided', () => {
    render(<HeroVideo {...defaultProps} />);
    expect(screen.getByText('Video Hero Section')).toBeInTheDocument();
    expect(screen.getByText('Engaging video background')).toBeInTheDocument();
  });

  it('handles missing overlay content', () => {
    const propsWithoutOverlay = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        overlayContent: undefined
      }
    };
    
    render(<HeroVideo {...propsWithoutOverlay} />);
    // No heading should be rendered when overlayContent is missing
    expect(screen.queryByText('Video Hero Section')).not.toBeInTheDocument();
  });

  it('handles different video height', () => {
    const propsWithHeight = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        height: 'full' as const
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithHeight} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('min-h-screen');
  });

  it('applies left alignment classes', () => {
    const propsWithAlignment = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        alignment: 'left' as const
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithAlignment} />);
    const contentDiv = container.querySelector('.cms-container > div') as HTMLElement | null;
    expect(contentDiv).not.toBeNull();
    expect(contentDiv).toHaveClass('items-start');
  });

  it('applies right alignment classes', () => {
    const propsWithAlignment = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        alignment: 'right' as const
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithAlignment} />);
    const contentDiv = container.querySelector('.cms-container > div') as HTMLElement | null;
    expect(contentDiv).not.toBeNull();
    expect(contentDiv).toHaveClass('items-end');
  });

  it('handles missing video URL gracefully', () => {
    const propsWithoutVideo = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoUrl: ''
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithoutVideo} />);
    const video = container.querySelector('video');
    expect(video).toBeNull();
    const fallbackContainer = container.querySelector('.absolute.inset-0');
    expect(fallbackContainer).not.toBeNull();
  });

  it('hides overlay toggle when disabled', () => {
    const propsWithoutOverlayToggle = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoSettings: {
          ...defaultProps.content.videoSettings,
          controls: false,
          showOverlayToggle: false,
        },
      },
    };

    const { container } = render(<HeroVideo {...propsWithoutOverlayToggle} />);
    const toggleButton = container.querySelector(
      'button[aria-label="Pause video"], button[aria-label="Play video"]'
    );
    expect(toggleButton).toBeNull();
  });

  it('renders without poster image', () => {
    const propsWithoutPoster = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        posterImage: undefined
      }
    };
    
    const { container } = render(<HeroVideo {...propsWithoutPoster} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('poster') || '').toBe('');
  });

  it('handles autoplay disabled', () => {
    const propsNoAutoplay = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoSettings: {
          ...defaultProps.content.videoSettings,
          autoplay: false
        }
      }
    };
    
    const { container } = render(<HeroVideo {...propsNoAutoplay} />);
    const video = container.querySelector('video');
    expect(video).not.toHaveAttribute('autoplay');
  });

  it('handles muted disabled', () => {
    const propsNotMuted = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoSettings: {
          ...defaultProps.content.videoSettings,
          muted: false
        }
      }
    };
    
    const { container } = render(<HeroVideo {...propsNotMuted} />);
    const video = container.querySelector('video');
    expect(video).not.toHaveAttribute('muted');
  });

  it('handles loop disabled', () => {
    const propsNoLoop = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        videoSettings: {
          ...defaultProps.content.videoSettings,
          loop: false
        }
      }
    };
    
    const { container } = render(<HeroVideo {...propsNoLoop} />);
    const video = container.querySelector('video');
    expect(video).not.toHaveAttribute('loop');
  });

  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-video-hero'
    };
    
    const { container } = render(<HeroVideo {...propsWithClass} />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-video-hero');
  });

  it('applies custom styles', () => {
    const propsWithStyle = {
      ...defaultProps,
      style: { marginTop: '40px' }
    };
    
    const { container } = render(<HeroVideo {...propsWithStyle} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('style');
    expect(section?.getAttribute('style')).toContain('margin-top: 40px');
  });

  it('sets correct data attributes', () => {
    const { container } = render(<HeroVideo {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('data-component-type', ComponentType.HeroVideo);
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
  });

  it('applies default overlay background for readability', () => {
    const { container } = render(<HeroVideo {...defaultProps} />);
    const overlayContainer = container.querySelector('.cms-container > div');
    expect(overlayContainer).toHaveClass('backdrop-blur-xl');
    expect(overlayContainer?.className ?? '').toContain('ring-background/45');
  });

  it('respects custom overlay appearance overrides', () => {
    const propsWithCustomOverlay = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        overlayContent: {
          ...defaultProps.content.overlayContent,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          textColor: '#f8fafc',
          padding: 'compact' as const,
          disableDefaultBackground: true,
        },
      },
    };

    const { container } = render(<HeroVideo {...propsWithCustomOverlay} />);
    const overlayContainer = container.querySelector('.cms-container > div') as HTMLElement | null;
    expect(overlayContainer).not.toBeNull();
    // For non-hex colors, background is set directly with CSS opacity applied
    expect(overlayContainer?.style.background).toContain('rgba(15, 23, 42, 0.8)');
    expect(overlayContainer).toHaveClass('bg-transparent');
    const heading = container.querySelector('h1');
    expect(heading).toHaveStyle({ color: '#f8fafc' });
  });

  it('handles missing optional content', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        videoUrl: '/video.mp4'
      }
    };
    
    const { container } = render(<HeroVideo {...minimalProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('includes video source fallback message', () => {
    render(<HeroVideo {...defaultProps} />);
    expect(screen.getByText('Your browser does not support the video tag.')).toBeInTheDocument();
  });
});
