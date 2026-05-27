/**
 * HeroWithImage Component Tests
 * Story 10: Code Quality - Task 4.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeroWithImage from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />
}));

describe('HeroWithImage', () => {
  const mockProps = {
    id: 'hero-1',
    type: ComponentType.HeroWithImage,
    category: ComponentCategory.Hero,
    content: {
      heading: 'Hero Title',
      subheading: 'Hero Subtitle',
      image: {
        src: '/hero.jpg',
        alt: 'Hero image',
      },
    }
  };

  it('should render title and subtitle', () => {
    render(<HeroWithImage {...mockProps} />);
    expect(screen.getByText('Hero Title')).toBeInTheDocument();
    expect(screen.getByText('Hero Subtitle')).toBeInTheDocument();
  });

  it('should render image when provided', () => {
    render(<HeroWithImage {...mockProps} />);
    const img = screen.getByAltText('Hero image');
    expect(img).toBeInTheDocument();
  });

  it('should handle missing image', () => {
    const noImg = { ...mockProps, content: { ...mockProps.content, image: undefined } };
    render(<HeroWithImage {...noImg} />);
    expect(screen.getByText('Hero Title')).toBeInTheDocument();
  });

  it('should sanitize content', () => {
    const xss = {
      ...mockProps,
      content: { ...mockProps.content, heading: '<script>alert("XSS")</script>Safe Title' }
    };
    render(<HeroWithImage {...xss} />);
    expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
  });

  it('renders as a split image and copy hero instead of a full-screen overlay', () => {
    const { container } = render(<HeroWithImage {...mockProps} />);

    expect(container.innerHTML).toContain('md:grid-cols-[2fr_1fr]');
    expect(container.innerHTML).not.toContain('min-h-screen');
  });
});
