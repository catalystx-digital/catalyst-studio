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
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
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
                    url: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
                    originalUrl: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
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
      'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
    );
  });
});
