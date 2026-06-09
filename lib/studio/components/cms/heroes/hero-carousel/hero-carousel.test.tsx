import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroCarousel } from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';

const slides = [
  {
    id: 'slide-1',
    content: {
      heading: 'Coffee With a Cop',
      body: 'Join us for coffee and conversation with local officers.',
      image: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
      ctaButtons: [{ href: '#coffee', label: 'Read More', variant: 'primary' as const }],
    },
  },
  {
    id: 'slide-2',
    content: {
      heading: 'Go Big This Halloween',
      body: 'Creative costumes and spooky treats for everyone.',
      image: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
      ctaButtons: [{ href: '#halloween', label: 'Explore Ideas', variant: 'secondary' as const }],
    },
  },
  {
    id: 'slide-3',
    content: {
      heading: 'Halloween Recipes',
      body: 'Easy recipes the whole family will love.',
      image: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
      ctaButtons: [{ href: '#recipes', label: 'See Recipes', variant: 'outline' as const }],
    },
  },
];

const slidesWithRootFields = [
  {
    id: 'slide-root-1',
    heading: 'Fall Festival Weekend',
    body: 'Celebrate the season with live music, crafts, and local food trucks.',
    image: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    ctaButtons: [{ href: '#fall', label: 'Discover Fall', variant: 'primary' as const }],
  },
  {
    id: 'slide-root-2',
    content: {
      heading: 'Community Cleanup',
      body: 'Join neighbors to keep our parks beautiful.',
      image: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
      ctaButtons: [{ href: '#cleanup', label: 'Volunteer', variant: 'secondary' as const }],
    },
  },
];

const defaultProps = {
  id: 'hero-carousel-test',
  type: ComponentType.HeroCarousel,
  category: ComponentCategory.Heroes,
  theme: 'dark' as const,
  content: {
    slides,
    autoPlay: false,
    showControls: true,
    showIndicators: true,
  },
};

describe('HeroCarousel component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the first slide by default', () => {
    const { container } = render(<HeroCarousel {...defaultProps} />);
    expect(
      screen.getByRole('heading', { name: 'Coffee With a Cop' }),
    ).toBeVisible();

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')).toHaveTextContent('Coffee With a Cop');

    const slides = screen.getAllByRole('group', { hidden: true });
    expect(slides[0]).toHaveAttribute('data-active', 'true');
    expect(slides[0]).toHaveClass('visible', 'z-10');
    expect(slides[0]).not.toHaveAttribute('inert');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('inert');
    expect(slides[1]).toHaveClass('invisible', 'z-0', 'pointer-events-none');
  });

  it('keeps inactive slide content visually isolated from the active hero panel', () => {
    const { container } = render(<HeroCarousel {...defaultProps} />);

    const slidePanels = container.querySelectorAll('.cms-hero-carousel-slide');
    expect(slidePanels).toHaveLength(3);
    expect(slidePanels[0]).toHaveClass('visible', 'z-10', 'opacity-100');
    expect(slidePanels[1]).toHaveClass('invisible', 'z-0', 'opacity-0', 'pointer-events-none');
    expect(slidePanels[2]).toHaveClass('invisible', 'z-0', 'opacity-0', 'pointer-events-none');
    expect(slidePanels[1]).toHaveAttribute('inert');
    expect(slidePanels[2]).toHaveAttribute('inert');
  });

  it('positions carousel controls below the mobile content panel and restores side controls on larger screens', () => {
    const { container } = render(<HeroCarousel {...defaultProps} />);

    const controls = container.querySelector('.cms-hero-carousel [class*="bottom-10"]');
    expect(controls).toHaveClass('bottom-10', 'sm:inset-x-0', 'sm:inset-y-0', 'sm:bottom-auto');
    expect(screen.getByRole('button', { name: 'Previous slide' })).toHaveClass('h-10', 'w-10', 'sm:h-12', 'sm:w-12');
    expect(screen.getByRole('button', { name: 'Next slide' })).toHaveClass('h-10', 'w-10', 'sm:h-12', 'sm:w-12');
  });

  it('advances to the next slide when the next control is clicked', () => {
    const { container } = render(<HeroCarousel {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: 'Next slide' });
    fireEvent.click(nextButton);

    expect(
      screen.getByRole('heading', { name: 'Go Big This Halloween' }),
    ).toBeVisible();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')).toHaveTextContent('Go Big This Halloween');

    const slides = screen.getAllByRole('group', { hidden: true });
    expect(slides[1]).toHaveAttribute('data-active', 'true');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('navigates directly to a slide when an indicator is clicked', () => {
    render(<HeroCarousel {...defaultProps} />);

    const indicators = screen.getAllByRole('button', { name: /Go to slide/i });
    fireEvent.click(indicators[2]);

    expect(
      screen.getByRole('heading', { name: 'Halloween Recipes' }),
    ).toBeVisible();
  });

  it('supports autoplay when enabled', () => {
    render(
      <HeroCarousel
        {...defaultProps}
        content={{ ...defaultProps.content, autoPlay: true, autoPlayInterval: 4000 }}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    const slides = screen.getAllByRole('group', { hidden: true });
    expect(slides[1]).toHaveAttribute('data-active', 'true');
  });

  it('pauses autoplay while hovering and resumes afterwards', () => {
    const { container } = render(
      <HeroCarousel
        {...defaultProps}
        content={{ ...defaultProps.content, autoPlay: true, autoPlayInterval: 3000 }}
      />,
    );

    const carousel = container.querySelector(
      '[data-component-type="hero-carousel"]',
    ) as HTMLElement;

    act(() => {
      fireEvent.mouseEnter(carousel);
    });

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    let slides = screen.getAllByRole('group', { hidden: true });
    expect(slides[0]).toHaveAttribute('data-active', 'true');

    act(() => {
      fireEvent.mouseLeave(carousel);
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    slides = screen.getAllByRole('group', { hidden: true });
    expect(slides[1]).toHaveAttribute('data-active', 'true');
  });

  it('normalizes slides with root-level fields when content is missing', () => {
    render(
      <HeroCarousel
        {...defaultProps}
        content={{ ...defaultProps.content, slides: slidesWithRootFields, autoPlay: false }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Fall Festival Weekend' }),
    ).toBeVisible();

    expect(
      screen.getByRole('link', { name: 'Discover Fall' }),
    ).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next slide' });
    fireEvent.click(nextButton);

    expect(
      screen.getByRole('heading', { name: 'Community Cleanup' }),
    ).toBeVisible();
  });

  it('uses resolved nested media URLs before relative original URLs', () => {
    render(
      <HeroCarousel
        {...defaultProps}
        content={{
          ...defaultProps.content,
          slides: [
            {
              id: 'resolved-media',
              content: {
                heading: 'Resolved media',
                image: {
                  src: {
                    mediaId: 'detected:hero',
                    mediaType: 'image',
                    url: 'https://health.example.org/uploadedImages/Main/hero.jpg',
                    originalUrl: 'https://health.example.org/uploadedImages/Main/hero.jpg',
                  },
                  alt: 'Resolved hero',
                  originalUrl: '/uploadedImages/Main/hero.jpg',
                },
              },
            },
          ],
          autoPlay: false,
        }}
      />,
    );

    expect(screen.getByAltText('Resolved hero')).toHaveAttribute(
      'src',
      'https://health.example.org/uploadedImages/Main/hero.jpg',
    );
  });
});
