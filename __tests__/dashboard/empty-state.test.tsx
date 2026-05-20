import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmptyState } from '@/components/dashboard/empty-state';

describe('EmptyState', () => {
  it('should render empty state message', () => {
    render(<EmptyState />);

    expect(screen.getByText('No websites yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Get started by creating your first website/)
    ).toBeInTheDocument();
  });

  it('should render placeholder illustration', () => {
    render(<EmptyState />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-32', 'h-32', 'text-muted-foreground');
  });

  it('should have proper layout structure', () => {
    const { container } = render(<EmptyState />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
  });

  it('should center the text content', () => {
    render(<EmptyState />);

    const description = screen.getByText(/Get started by creating your first website/);
    expect(description).toHaveClass('text-center', 'max-w-md');
  });
});