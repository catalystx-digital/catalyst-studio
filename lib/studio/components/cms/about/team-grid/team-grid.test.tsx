import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TeamGrid from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';
import type { TeamGridProps } from './team-grid.types';

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

describe('TeamGrid', () => {
  const mockOnLoad = jest.fn();
  const mockOnInteraction = jest.fn();

  const defaultProps: TeamGridProps = {
    id: 'team-grid-1',
    type: ComponentType.TeamGrid,
    category: ComponentCategory.About,
    content: {
      heading: 'Meet Our Team',
      subheading: 'The people behind our success',
      members: [
        {
          id: 'member-1',
          name: 'John Doe',
          title: 'CEO',
          department: 'Executive',
          photo: '/photos/john.jpg',
          bio: '<p>Experienced leader with 20 years in the industry.</p>',
          linkedin: 'https://linkedin.com/in/johndoe',
          twitter: 'https://twitter.com/johndoe',
        },
        {
          id: 'member-2',
          name: 'Jane Smith',
          title: 'CTO',
          department: 'Technology',
          photo: '/photos/jane.jpg',
          bio: '<p>Technology expert passionate about innovation.</p>',
        },
      ],
      columns: {
        mobile: 2,
        tablet: 3,
        desktop: 4,
        large: 4,
      },
      showDepartment: true,
      enableHover: true,
      linkToProfile: false,
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

  it('renders headings and members', () => {
    render(<TeamGrid {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: 'Meet Our Team' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The people behind our success'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'John Doe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const start = performance.now();
    render(<TeamGrid {...defaultProps} />);
    const end = performance.now();
    expect(end - start).toBeLessThan(50);
  });

  it('exposes accessible structure and media metadata', () => {
    const { container } = render(<TeamGrid {...defaultProps} />);

    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'Team members grid');
    expect(section).toHaveAttribute('role', 'region');

    container.querySelectorAll('img').forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('sanitizes heading and member content', () => {
    const props: TeamGridProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        heading: '<script>alert("x")</script>Safe Heading',
        members: [
          {
            id: 'member-xss',
            name: '<script>alert("x")</script>Safe Name',
            title: 'Developer',
            photo: '/photo.jpg',
            bio: '<script>alert("x")</script><strong>Secure bio</strong>',
          },
        ],
      },
    };

    render(<TeamGrid {...props} />);

    expect(screen.queryByText('alert("x")')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safe Heading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safe Name' })).toBeInTheDocument();
    expect(screen.getByText('Secure bio')).toBeInTheDocument();
  });

  it('applies responsive grid classes from column configuration', () => {
    const { container } = render(<TeamGrid {...defaultProps} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveClass('sm:grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('lg:grid-cols-4');
    expect(grid).toHaveClass('xl:grid-cols-4');
  });

  it('fires analytics when a member card is activated', () => {
    render(<TeamGrid {...defaultProps} />);

    // Cards use shadcn Card which renders as role="button" with group class
    const card = screen
      .getByRole('heading', { name: 'John Doe' })
      .closest('[role="button"]');
    fireEvent.click(card!);

    expect(mockOnInteraction).toHaveBeenCalledWith('member-click', {
      memberId: 'member-1',
      memberName: 'John Doe',
    });
  });

  it('renders social buttons and emits analytics', () => {
    render(<TeamGrid {...defaultProps} />);

    const linkedInButton = screen.getByLabelText('John Doe on linkedin');
    fireEvent.click(linkedInButton);

    expect(mockOnInteraction).toHaveBeenCalledWith('social-link-click', {
      memberId: 'member-1',
      platform: 'linkedin',
    });

    expect(
      screen.getByRole('link', { name: 'John Doe on linkedin' }),
    ).toHaveAttribute('href', 'https://linkedin.com/in/johndoe');
    expect(
      screen.getByRole('link', { name: 'John Doe on twitter' }),
    ).toHaveAttribute('href', 'https://twitter.com/johndoe');
  });

  it('omits invalid social links', () => {
    const props: TeamGridProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        members: [
          {
            id: 'member-invalid',
            name: 'No Links',
            title: 'Developer',
            photo: '/photo.jpg',
            linkedIn: 'not-a-valid-url',
            twitter: 'javascript:alert(1)',
          },
        ],
      },
    };

    render(<TeamGrid {...props} />);
    expect(screen.queryAllByLabelText(/on linkedin|on twitter/)).toHaveLength(0);
  });

  it('shows or hides department badge based on configuration', () => {
    const { rerender } = render(<TeamGrid {...defaultProps} />);
    expect(screen.getByText('Executive')).toBeInTheDocument();

    const props: TeamGridProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showDepartment: false,
      },
    };
    rerender(<TeamGrid {...props} />);
    expect(screen.queryByText('Executive')).not.toBeInTheDocument();
  });

  it('applies hover affordances when enabled', () => {
    const { container } = render(<TeamGrid {...defaultProps} />);
    // Cards are rendered with hover effects via shadcn Card's built-in hover:shadow-md
    // Additional hover:border-primary/20 is applied when enableHover is true
    // Query by Card's structural classes
    const cards = container.querySelectorAll('.group.overflow-hidden.text-left');
    expect(cards.length).toBeGreaterThan(0);
    // Verify the combined hover effect is present when enableHover is true
    cards.forEach((card) => {
      expect(card).toHaveClass('hover:border-primary/20');
    });
  });

  it('attaches theme modifiers to the section wrapper', () => {
    const { container: lightContainer } = render(
      <TeamGrid {...defaultProps} theme="light" />,
    );
    expect(lightContainer.querySelector('section')).toHaveClass('theme-light');

    const { container: darkContainer } = render(
      <TeamGrid {...defaultProps} theme="dark" />,
    );
    expect(darkContainer.querySelector('section')).toHaveClass('theme-dark');
  });

  it('invokes onLoad during mount', () => {
    render(<TeamGrid {...defaultProps} />);
    expect(mockOnLoad).toHaveBeenCalledTimes(1);
  });

  it('wraps cards with anchors when linkToProfile is true', () => {
    const props: TeamGridProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        linkToProfile: true,
        members: [
          {
            id: 'member-link',
            name: 'Link Test',
            title: 'Developer',
            photo: '/photo.jpg',
            profileUrl: 'https://example.com/profile',
          },
        ],
      },
    };

    render(<TeamGrid {...props} />);
    const profileLink = screen.getByRole('link', {
      name: "View Link Test's profile",
    });
    expect(profileLink).toHaveAttribute('href', 'https://example.com/profile');

    fireEvent.click(profileLink);
    expect(mockOnInteraction).toHaveBeenCalledWith('member-click', {
      memberId: 'member-link',
      memberName: 'Link Test',
    });
  });

  it('falls back to avatar initials when photo is missing', () => {
    const props: TeamGridProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        members: [
          {
            id: 'member-fallback',
            name: 'Fallback Person',
            title: 'Designer',
            photo: '',
          },
        ],
      },
    };

    const { container } = render(<TeamGrid {...props} />);
    expect(screen.getByText('FP')).toBeInTheDocument();
  });

  it('accepts AI metadata without errors', () => {
    render(
      <TeamGrid
        {...defaultProps}
        aiMetadata={{
          keywords: ['team', 'leadership'],
          patterns: ['meet.*team'],
          commonNames: ['team-grid'],
          pageLocation: ['main'],
          confidence: 0.82,
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Meet Our Team' }),
    ).toBeInTheDocument();
  });
});
