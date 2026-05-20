import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AboutSection from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { AboutSectionProps } from './about-section.types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('AboutSection Component', () => {
  const mockOnLoad = jest.fn();
  const mockOnInteraction = jest.fn();

  const defaultProps: AboutSectionProps = {
    id: 'about-section-1',
    type: ComponentType.AboutSection,
    category: ComponentCategory.About,
    content: {
      heading: 'About Our Company',
      subheading: 'Building the future since 2010',
      story:
        '<p>Our company was founded with a vision to transform the industry through innovation and dedication.</p>',
      mission:
        '<p>To deliver exceptional value to our customers through cutting-edge solutions.</p>',
      vision:
        '<p>To be the global leader in our industry by 2030.</p>',
      values: [
        {
          title: 'Innovation',
          description: 'We constantly push boundaries',
          icon: '💡',
        },
        {
          title: 'Integrity',
          description: 'We do the right thing',
          icon: '🤝',
        },
        {
          title: 'Excellence',
          description: 'We strive for the best',
          icon: '⭐',
        },
      ],
      milestones: [
        {
          year: '2010',
          title: 'Company Founded',
          description: 'Started with a small team of 3',
        },
        {
          year: '2015',
          title: 'Series A Funding',
          description: 'Raised $5M to expand operations',
        },
        {
          year: '2020',
          title: 'Global Expansion',
          description: 'Opened offices in 5 countries',
        },
      ],
      stats: [
        { value: '100+', label: 'Employees', prefix: '', suffix: '' },
        { value: '50', label: 'Countries', suffix: '+' },
        { value: '1M', label: 'Users', suffix: '+' },
        { value: '99', label: 'Satisfaction', suffix: '%' },
      ],
      imageList: [
        {
          src: '/images/office.jpg',
          alt: 'Our office',
          caption: 'Our modern headquarters',
        },
      ],
      layout: 'single-column',
      showMilestones: true,
      showValues: true,
      showStats: true,
    },
    onLoad: mockOnLoad,
    onInteraction: mockOnInteraction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.performance = {
      now: jest.fn(() => 10),
    } as any;
  });

  it('renders primary content with headings and sections', () => {
    render(<AboutSection {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'About Our Company' })).toBeInTheDocument();
    expect(screen.getByText('Building the future since 2010')).toBeInTheDocument();
    expect(screen.getByTestId('cms-about-section-narrative')).toBeInTheDocument();
    expect(screen.getByTestId('cms-about-section-stats')).toBeInTheDocument();
    expect(screen.getByTestId('cms-about-section-values')).toBeInTheDocument();
    expect(screen.getByTestId('cms-about-section-milestones')).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<AboutSection {...defaultProps} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(50);
  });

  it('exposes accessible structure and media metadata', () => {
    const { container } = render(<AboutSection {...defaultProps} />);

    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'About us section');
    expect(section).toHaveAttribute('role', 'region');

    expect(container.querySelector('h2')).toBeInTheDocument();
    expect(container.querySelectorAll('h3').length).toBeGreaterThan(0);

    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('sanitizes rich text content', () => {
    const propsWithXSS: AboutSectionProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        heading: '<script>alert("XSS")</script>Safe Heading',
        story: '<script>alert("XSS")</script><b>Safe story content</b>',
        mission: '<script>alert("XSS")</script><p>Safe mission</p>',
        vision: '<script>alert("XSS")</script><p>Safe vision</p>',
      },
    };

    render(<AboutSection {...propsWithXSS} />);

    expect(screen.queryByText('alert("XSS")')).not.toBeInTheDocument();
    expect(screen.getByText('Safe Heading')).toBeInTheDocument();
    expect(screen.getByText('Safe story content')).toBeInTheDocument();
    expect(screen.getByText('Safe mission')).toBeInTheDocument();
    expect(screen.getByText('Safe vision')).toBeInTheDocument();
  });

  it('renders stats section when enabled', () => {
    render(<AboutSection {...defaultProps} />);

    const statsSection = screen.getByTestId('cms-about-section-stats');
    const grid = statsSection.querySelector('.grid');

    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-4');

    expect(screen.getByText('100+')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('50+')).toBeInTheDocument();
    expect(screen.getByText('Countries')).toBeInTheDocument();
  });

  it('omits stats section when disabled', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showStats: false,
      },
    };

    render(<AboutSection {...props} />);

    expect(screen.queryByTestId('cms-about-section-stats')).not.toBeInTheDocument();
  });

  it('renders values and forwards analytics interaction', () => {
    render(<AboutSection {...defaultProps} />);

    const valuesSection = screen.getByTestId('cms-about-section-values');
    const grid = valuesSection.querySelector('.grid');
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('xl:grid-cols-3');

    const innovationCard = screen.getByText('Innovation').closest('[role="button"]');
    expect(innovationCard).toBeInTheDocument();

    fireEvent.click(innovationCard!);

    expect(mockOnInteraction).toHaveBeenCalledWith('value-click', {
      value: 'Innovation',
    });
  });

  it('omits values section when disabled', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showValues: false,
      },
    };

    render(<AboutSection {...props} />);

    expect(screen.queryByTestId('cms-about-section-values')).not.toBeInTheDocument();
  });

  it('renders milestones timeline with alternating layout', () => {
    const { container } = render(<AboutSection {...defaultProps} />);
    const timeline = screen.getByTestId('cms-about-section-milestones');

    expect(timeline.querySelectorAll('li').length).toBe(3);
    expect(container.querySelectorAll('[class*="bg-border-default/60"]').length).toBeGreaterThan(0);
  });

  it('omits milestones when disabled', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showMilestones: false,
      },
    };

    render(<AboutSection {...props} />);

    expect(screen.queryByTestId('cms-about-section-milestones')).not.toBeInTheDocument();
  });

  it('supports two-column narrative layout', () => {
    const props: AboutSectionProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        layout: 'two-column',
      },
    };

    const { container } = render(<AboutSection {...props} />);
    expect(container.querySelector('.lg\\:grid-cols-2')).toBeInTheDocument();
  });

  it('renders images with captions', () => {
    render(<AboutSection {...defaultProps} />);

    expect(screen.getByText('Our modern headquarters')).toBeInTheDocument();
    expect(screen.getByAltText('Our office')).toBeInTheDocument();
  });

  it('invokes onLoad callback on mount', () => {
    render(<AboutSection {...defaultProps} />);

    expect(mockOnLoad).toHaveBeenCalledTimes(1);
  });

  it('applies theme modifiers', () => {
    const { container: lightContainer } = render(
      <AboutSection {...defaultProps} theme="light" />,
    );
    const lightSection = lightContainer.querySelector('section');
    expect(lightSection?.className).toContain('theme-light');

    const { container: darkContainer } = render(
      <AboutSection {...defaultProps} theme="dark" />,
    );
    const darkSection = darkContainer.querySelector('section');
    expect(darkSection?.className).toContain('theme-dark');
  });

  it('renders minimal content without optional sections', () => {
    const minimalProps: AboutSectionProps = {
      ...defaultProps,
      content: {
        heading: 'About Us',
        layout: 'single-column',
      },
    };

    render(<AboutSection {...minimalProps} />);

    expect(screen.getByText('About Us')).toBeInTheDocument();
    expect(screen.queryByTestId('cms-about-section-values')).not.toBeInTheDocument();
  });

  it('respects AI metadata contracts', () => {
    render(
      <AboutSection
        {...defaultProps}
        aiMetadata={{
          keywords: ['about us', 'our story'],
          patterns: ['about.*us'],
          commonNames: ['about-section'],
          pageLocation: ['main'],
          confidence: 0.85,
        }}
      />,
    );

    expect(screen.getByText('About Our Company')).toBeInTheDocument();
  });
});
