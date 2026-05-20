import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Timeline from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockUnobserve = jest.fn();
const mockDisconnect = jest.fn();

const mockIntersectionObserver = jest.fn().mockImplementation((callback: any) => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));

global.IntersectionObserver = mockIntersectionObserver as any;

describe('Timeline Component', () => {
  const defaultProps = {
    id: 'timeline-test',
    type: ComponentType.Timeline,
    category: ComponentCategory.Data,
    content: {
      title: 'Company History',
      subtitle: 'Our journey through the years',
      events: [
        {
          id: 'event-1',
          date: '2020-01-15',
          title: 'Company Founded',
          description: 'Started with a small team of 3 people',
          type: 'milestone' as const,
          icon: 'Flag'
        },
        {
          id: 'event-2',
          date: '2021-06-20',
          title: 'Series A Funding',
          description: 'Raised $5M to expand operations',
          type: 'achievement' as const,
          icon: 'Trophy',
          link: {
            text: 'Read more',
            url: 'https://example.com/blog/series-a'
          }
        },
        {
          id: 'event-3',
          date: '2022-03-10',
          title: 'Product Launch',
          description: 'Released our flagship product',
          type: 'event' as const,
          icon: 'Rocket'
        },
        {
          id: 'event-4',
          date: '2023-11-01',
          title: 'Global Expansion',
          description: 'Opened offices in 5 countries',
          type: 'milestone' as const,
          image: {
            src: '/images/expansion.jpg',
            alt: 'Global offices'
          }
        }
      ],
      layout: 'vertical',
      showConnectors: true,
      showIcons: true,
      animated: true
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
    mockIntersectionObserver.mockClear();
  });

  it('renders without crashing', () => {
    render(<Timeline {...defaultProps} />);
    expect(screen.getByText('Company History')).toBeInTheDocument();
  });

  it('displays title and subtitle', () => {
    render(<Timeline {...defaultProps} />);
    expect(screen.getByText('Company History')).toBeInTheDocument();
    expect(screen.getByText('Our journey through the years')).toBeInTheDocument();
  });

  it('renders all timeline events', () => {
    render(<Timeline {...defaultProps} />);
    expect(screen.getByText('Company Founded')).toBeInTheDocument();
    expect(screen.getByText('Series A Funding')).toBeInTheDocument();
    expect(screen.getByText('Product Launch')).toBeInTheDocument();
    expect(screen.getByText('Global Expansion')).toBeInTheDocument();
  });

  it('displays event descriptions', () => {
    render(<Timeline {...defaultProps} />);
    expect(screen.getByText('Started with a small team of 3 people')).toBeInTheDocument();
    expect(screen.getByText('Raised $5M to expand operations')).toBeInTheDocument();
    expect(screen.getByText('Released our flagship product')).toBeInTheDocument();
    expect(screen.getByText('Opened offices in 5 countries')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(<Timeline {...defaultProps} />);
    expect(screen.getByText('Jan 15, 2020')).toBeInTheDocument();
    expect(screen.getByText('Jun 20, 2021')).toBeInTheDocument();
    expect(screen.getByText('Mar 10, 2022')).toBeInTheDocument();
    expect(screen.getByText('Nov 1, 2023')).toBeInTheDocument();
  });

  it('renders event links when provided', () => {
    const openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);

    render(<Timeline {...defaultProps} />);
    const link = screen.getByText('Read more');
    expect(link).toBeInTheDocument();
    fireEvent.click(link);
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/blog/series-a',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('renders vertical layout correctly', () => {
    render(<Timeline {...defaultProps} />);
    // Should have vertical connector line
    expect(
      screen.getByTestId('cms-timeline-vertical-connector'),
    ).toBeInTheDocument();
  });

  it('renders alternating layout correctly', () => {
    const alternatingProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        layout: 'alternating' as const
      }
    };
    render(<Timeline {...alternatingProps} />);
    expect(
      screen.getByTestId('cms-timeline-alternating-connector'),
    ).toBeInTheDocument();
  });

  it('renders horizontal layout correctly', () => {
    const horizontalProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        layout: 'horizontal' as const
      }
    };
    render(<Timeline {...horizontalProps} />);
    expect(
      screen.getByTestId('cms-timeline-horizontal-connector'),
    ).toBeInTheDocument();
  });

  it('applies event type styling correctly', () => {
    render(<Timeline {...defaultProps} />);
    const milestoneBadges = screen.getAllByText('Milestone');
    expect(milestoneBadges.length).toBeGreaterThan(0);
    milestoneBadges.forEach((badge) =>
      expect(badge.className).toContain('cms-badge'),
    );

    const achievementBadge = screen.getByText('Achievement');
    expect(achievementBadge.className).toContain('cms-badge');

    const eventBadge = screen.getByText('Event');
    expect(eventBadge.className).toContain('cms-badge');
  });

  it('hides connectors when disabled', () => {
    const noConnectorsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showConnectors: false
      }
    };
    render(<Timeline {...noConnectorsProps} />);
    expect(
      screen.queryByTestId('cms-timeline-vertical-connector'),
    ).not.toBeInTheDocument();
  });

  it('hides icons when disabled', () => {
    const noIconsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showIcons: false
      }
    };
    render(<Timeline {...noIconsProps} />);
    // Icons should not be rendered
    const iconContainers = document.querySelectorAll('.h-5.w-5');
    expect(iconContainers.length).toBe(0);
  });

  it('sets up IntersectionObserver for animation', () => {
    render(<Timeline {...defaultProps} />);
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it('renders without animation when disabled', () => {
    const noAnimationProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        animated: false
      }
    };
    const { container } = render(<Timeline {...noAnimationProps} />);
    // All events should be visible immediately
    const events = container.querySelectorAll('[data-event-id]');
    events.forEach(event => {
      expect(event).not.toHaveClass('opacity-0');
    });
  });

  it('renders different variants correctly', () => {
    const detailedProps = {
      ...defaultProps,
      variant: 'detailed' as const
    };
    render(<Timeline {...detailedProps} />);
    // Detailed variant should use cards
    const cards = document.querySelectorAll('.cms-timeline-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders the progress variant with numbered steps and CTA', () => {
    const progressProps = {
      ...defaultProps,
      variant: 'progress' as const,
      content: {
        ...defaultProps.content,
        footerCta: {
          text: 'Learn the process',
          url: 'https://example.com/process'
        }
      }
    };
    render(<Timeline {...progressProps} />);
    const steps = screen.getAllByTestId('cms-timeline-progress-step');
    expect(steps).toHaveLength(defaultProps.content.events.length);
    expect(screen.getByRole('button', { name: 'Learn the process' })).toBeInTheDocument();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<Timeline {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles images in events', () => {
    render(<Timeline {...defaultProps} />);
    const image = screen.getByAltText('Global offices');
    expect(image).toHaveAttribute('src', '/images/expansion.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('sanitizes user content', () => {
    const propsWithXSS = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Timeline',
        events: [{
          ...defaultProps.content.events[0],
          title: '<img src=x onerror=alert("XSS")>Event'
        }]
      }
    };
    render(<Timeline {...propsWithXSS} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Timeline/)).toBeInTheDocument();
  });

  it('validates URLs in links', () => {
    const invalidLinkProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        events: [{
          ...defaultProps.content.events[0],
          link: {
            text: 'Bad Link',
            url: 'javascript:alert("XSS")'
          }
        }]
      }
    };
    render(<Timeline {...invalidLinkProps} />);
    // Invalid URL should not render link
    expect(screen.queryByText('Bad Link')).not.toBeInTheDocument();
  });

  it('renders within performance threshold', () => {
    const startTime = performance.now();
    render(<Timeline {...defaultProps} />);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // 50ms threshold
  });

  it('cleans up observers on unmount', () => {
    const { unmount } = render(<Timeline {...defaultProps} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
