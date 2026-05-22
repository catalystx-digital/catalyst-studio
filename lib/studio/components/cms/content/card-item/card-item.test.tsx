/**
 * CardItem Component Tests
 * Story 10: Code Quality - Task 4.3
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardItem } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('CardItem', () => {
  const mockProps = {
    id: 'card-1',
    type: ComponentType.CardItem,
    category: ComponentCategory.Content,
    content: { title: 'Test Card', description: 'Description' }
  };

  it('should render with title and description', () => {
    render(<CardItem {...mockProps} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should handle missing description', () => {
    const noDesc = { ...mockProps, content: { title: 'Test' } };
    render(<CardItem {...noDesc} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle XSS in title', () => {
    const xss = { ...mockProps, content: { title: '<script>alert("XSS")</script>Safe' } };
    const { container } = render(<CardItem {...xss} />);
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText('<script>alert("XSS")</script>Safe')).toBeInTheDocument();
  });

  it('resolves structured top-level hrefs to renderable links', () => {
    render(
      <CardItem
        {...mockProps}
        content={{
          title: 'Guide',
          href: { type: 'internal', pageId: 'guide', path: '/guides/getting-started' },
          linkText: 'Read Guide',
        }}
      />,
    );

    expect(screen.getByRole('link', { name: /read guide/i })).toHaveAttribute('href', '/guides/getting-started');
  });

  it('uses structured action hrefs for button navigation', () => {
    window.location.hash = '';

    render(
      <CardItem
        {...mockProps}
        content={{
          title: 'Guide',
          actions: [
            {
              label: 'Jump',
              href: { type: 'anchor', href: '#guide' },
              variant: 'primary',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jump' }));

    expect(window.location.hash).toBe('#guide');
  });
});
