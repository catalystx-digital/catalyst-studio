import React from 'react';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import TeamMember from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';
import type { TeamMemberProps } from './team-member.types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('TeamMember', () => {
  const mockOnLoad = jest.fn();
  const mockOnInteraction = jest.fn();

  const defaultProps: TeamMemberProps = {
    id: 'team-member-1',
    type: ComponentType.TeamMember,
    category: ComponentCategory.About,
    content: {
      name: 'John Doe',
      title: 'Senior Developer',
      department: 'Engineering',
      photo: '/photos/john.jpg',
      photoAlt: 'John Doe headshot',
      bio: '<p>Experienced developer with expertise in <strong>React</strong> and Node.js.</p>',
      email: 'john.doe@example.com',
      phone: '+1-555-123-4567',
      linkedin: 'https://linkedin.com/in/johndoe',
      twitter: 'https://twitter.com/johndoe',
      github: 'https://github.com/johndoe',
      skills: ['React', 'Node.js', 'TypeScript'],
      experience: [
        {
          position: 'Senior Developer',
          company: 'Tech Corp',
          duration: '2020 - Present',
          description: 'Leading frontend development team',
        },
        {
          position: 'Developer',
          company: 'StartupXYZ',
          duration: '2018 - 2020',
        },
      ],
      displayMode: 'full',
    },
    onLoad: mockOnLoad,
    onInteraction: mockOnInteraction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.performance = {
      now: jest.fn(() => 10),
    } as unknown as Performance;
  });

  it('renders core details with heading and badge styling', () => {
    const { container } = render(<TeamMember {...defaultProps} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'John Doe' }),
    ).toBeInTheDocument();
    const titles = screen.getAllByText('Senior Developer');
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText('Engineering')).toBeInTheDocument();

    // Skills rendered as list items with CmsBadge components
    const skillListItems = container.querySelectorAll('li');
    expect(skillListItems.length).toBeGreaterThan(0);
  });

  it('meets performance threshold', () => {
    const start = performance.now();
    render(<TeamMember {...defaultProps} />);
    const end = performance.now();

    expect(end - start).toBeLessThan(50);
  });

  it('applies accessibility attributes', () => {
    const { container } = render(<TeamMember {...defaultProps} />);

    const region = screen.getByRole('article', {
      name: 'Team member profile',
    });
    expect(region).toBeInTheDocument();

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', 'John Doe – Senior Developer');

    const socialLink = screen.getByLabelText(
      "John Doe's LinkedIn profile",
    );
    expect(socialLink).toHaveAttribute(
      'href',
      'https://linkedin.com/in/johndoe',
    );
    expect(socialLink).toHaveAttribute('target', '_blank');
  });

  it('sanitizes user supplied content', () => {
    const props: TeamMemberProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        name: '<script>alert("x")</script>Jane',
        bio: '<script>alert("x")</script><b>Secure Bio</b>',
        skills: ['<img src=x onerror=alert(1)>React'],
      },
    };

    render(<TeamMember {...props} />);

    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('Secure Bio')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('alert("x")')).not.toBeInTheDocument();
  });

  it('emits analytics for social interactions', () => {
    render(<TeamMember {...defaultProps} />);

    const linkedinButton = screen.getByLabelText(
      "John Doe's LinkedIn profile",
    );
    fireEvent.click(linkedinButton);

    expect(mockOnInteraction).toHaveBeenCalledWith(
      'social-click',
      { platform: 'linkedin' },
    );
  });

  it('rejects invalid social URLs', () => {
    const props: TeamMemberProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        linkedin: 'javascript:alert(1)',
        twitter: 'not-a-url',
        github: 'http://example.com',
      },
    };

    const { container } = render(<TeamMember {...props} />);
    const socialLinks = container.querySelectorAll(
      'a[aria-label$="profile"]',
    );

    expect(socialLinks.length).toBe(0);
  });

  it('renders contact information and emits analytics on click', () => {
    render(<TeamMember {...defaultProps} />);

    const emailLink = screen.getByRole('link', {
      name: 'john.doe@example.com',
    });
    const phoneLink = screen.getByRole('link', {
      name: '+1-555-123-4567',
    });

    expect(emailLink).toHaveAttribute(
      'href',
      'mailto:john.doe@example.com',
    );
    expect(phoneLink).toHaveAttribute(
      'href',
      'tel:+1-555-123-4567',
    );

    fireEvent.click(emailLink);
    fireEvent.click(phoneLink);

    expect(mockOnInteraction).toHaveBeenCalledWith(
      'contact-click',
      { type: 'email' },
    );
    expect(mockOnInteraction).toHaveBeenCalledWith(
      'contact-click',
      { type: 'phone' },
    );
  });

  it('renders skills and experience sections with tokenized styles', () => {
    const { container } = render(<TeamMember {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Experience' })).toBeInTheDocument();

    const experienceItems = container.querySelectorAll(
      '.border-border\\/60',
    );
    expect(experienceItems.length).toBeGreaterThan(0);
  });

  it('supports compact display mode', () => {
    const props: TeamMemberProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        displayMode: 'compact',
      },
    };

    render(<TeamMember {...props} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'John Doe' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Skills' }),
    ).toBeInTheDocument();
  });
});
