import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebsiteCard } from '@/components/dashboard/website-card';
import { Website } from '@/types/api';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 days'),
}));

describe('WebsiteCard', () => {
  const mockWebsite: Website = {
    id: 'test-site-1',
    name: 'My Test Website',
    icon: '🎨',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    category: 'Portfolio',
    description: 'This is a test website description that should be displayed',
    isActive: true,
    settings: {},
    metadata: {}
  };

  it('should render website card with all information', () => {
    render(<WebsiteCard website={mockWebsite} />);

    expect(screen.getByText('My Test Website')).toBeInTheDocument();
    expect(screen.getByText('🎨')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Last modified 2 days ago')).toBeInTheDocument();
    expect(screen.getByText('This is a test website description that should be displayed')).toBeInTheDocument();
  });

  it('should render without icon when not provided', () => {
    const websiteWithoutIcon = { ...mockWebsite, icon: undefined };
    render(<WebsiteCard website={websiteWithoutIcon} />);

    expect(screen.getByText('My Test Website')).toBeInTheDocument();
    // Check that the placeholder div exists
    const placeholderDiv = document.querySelector('.bg-gradient-to-br');
    expect(placeholderDiv).toBeInTheDocument();
  });

  it('should render without category when not provided', () => {
    const websiteWithoutCategory = { ...mockWebsite, category: undefined };
    render(<WebsiteCard website={websiteWithoutCategory} />);

    expect(screen.getByText('My Test Website')).toBeInTheDocument();
    expect(screen.queryByText('Portfolio')).not.toBeInTheDocument();
  });

  it('should render without description when not provided', () => {
    const websiteWithoutDescription = { ...mockWebsite, description: undefined };
    render(<WebsiteCard website={websiteWithoutDescription} />);

    expect(screen.getByText('My Test Website')).toBeInTheDocument();
    expect(screen.queryByText('This is a test website description')).not.toBeInTheDocument();
  });

  it('should create correct link to studio site builder', () => {
    render(<WebsiteCard website={mockWebsite} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/studio/site-builder?websiteId=test-site-1');
  });

  it('should apply hover styles', () => {
    render(<WebsiteCard website={mockWebsite} />);

    const card = document.querySelector('.hover\\:shadow-lg');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('transition-shadow', 'cursor-pointer');
  });

  it('should truncate long website names', () => {
    const longNameWebsite = {
      ...mockWebsite,
      name: 'This is a very long website name that should be truncated with ellipsis when displayed in the card',
    };
    render(<WebsiteCard website={longNameWebsite} />);

    const nameElement = screen.getByText(longNameWebsite.name);
    expect(nameElement).toHaveClass('line-clamp-1');
  });

  it('should truncate long descriptions to 2 lines', () => {
    const longDescriptionWebsite = {
      ...mockWebsite,
      description: 'This is a very long description that goes on and on and should be truncated to only show two lines in the card component to maintain consistent card heights across the grid layout and ensure a clean visual appearance',
    };
    render(<WebsiteCard website={longDescriptionWebsite} />);

    const descElement = screen.getByText(longDescriptionWebsite.description);
    expect(descElement).toHaveClass('line-clamp-2');
  });
});