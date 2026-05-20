import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

describe('DashboardLayout', () => {
  it('should render layout with title', () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Catalyst Studio')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <DashboardLayout>
        <div>Test Child Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Test Child Content')).toBeInTheDocument();
  });

  it('should have proper layout structure', () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('min-h-screen', 'bg-dark-primary');

    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('border-b', 'border-gray-700', 'bg-gray-900');

    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('should have navigation bar with proper height', () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const navContent = container.querySelector('.h-16');
    expect(navContent).toBeInTheDocument();
    expect(navContent).toHaveClass('flex', 'items-center', 'justify-between');
  });

  it('should render title as h1', () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Catalyst Studio');
    expect(title).toHaveClass('text-2xl', 'font-bold');
  });
});