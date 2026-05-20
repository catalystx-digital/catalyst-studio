/**
 * CardItem Component Tests
 * Story 10: Code Quality - Task 4.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CardItem from './index';
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
    render(<CardItem {...xss} />);
    expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
  });
});
