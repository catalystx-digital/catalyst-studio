/**
 * HTMLBlock Component Tests
 * Story 10: Code Quality - Task 4.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import HTMLBlock from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('HTMLBlock', () => {
  const mockProps = {
    id: 'html-1',
    type: ComponentType.HTMLBlock,
    category: ComponentCategory.Content,
    content: { html: '<p>Safe content</p>' }
  };

  it('should render HTML content', () => {
    render(<HTMLBlock {...mockProps} />);
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('should sanitize XSS attempts', () => {
    const xss = { ...mockProps, content: { html: '<script>alert("XSS")</script><p>Safe</p>' } };
    render(<HTMLBlock {...xss} />);
    expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
  });

  it('should handle empty HTML', () => {
    const empty = { ...mockProps, content: { html: '' } };
    const { container } = render(<HTMLBlock {...empty} />);
    expect(container).toBeInTheDocument();
  });

  it('should pass accessibility', async () => {
    const { container } = render(<HTMLBlock {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
