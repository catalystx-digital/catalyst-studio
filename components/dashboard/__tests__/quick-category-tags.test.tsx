import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickCategoryTags } from '../quick-category-tags';

describe('QuickCategoryTags', () => {
  const mockOnTagClick = jest.fn();

  beforeEach(() => {
    mockOnTagClick.mockClear();
  });

  it('should render all category tags', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    expect(screen.getByText('Import website')).toBeInTheDocument();
    expect(screen.getByText('CMS Migration')).toBeInTheDocument();
    expect(screen.getByText('Course Catalog')).toBeInTheDocument();
    expect(screen.getByText('Customer Portal')).toBeInTheDocument();
    expect(screen.getByText('HR Platform')).toBeInTheDocument();
    expect(screen.getByText('Vendor Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
  });

  it('should call onTagClick with import prompt when import website tag is clicked', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const importTag = screen.getByText('Import website');
    fireEvent.click(importTag);

    expect(mockOnTagClick).toHaveBeenCalledWith(
      'Import an existing website into Catalyst Studio, recreating its structure, navigation, SEO metadata, and primary CTAs. URL: '
    );
  });

  it('should call onTagClick with correct prompt when CMS Migration tag is clicked', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const cmsTag = screen.getByText('CMS Migration');
    fireEvent.click(cmsTag);

    expect(mockOnTagClick).toHaveBeenCalledWith(
      'Migrate my Sitecore website to Optimizely SaaS CMS with content modeling, personalization rules, and SEO preservation'
    );
  });

  it('should call onTagClick with correct prompt when Customer Portal tag is clicked', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const portalTag = screen.getByText('Customer Portal');
    fireEvent.click(portalTag);

    expect(mockOnTagClick).toHaveBeenCalledWith(
      'Build a B2B customer portal with order tracking, invoice management, support tickets, and document library'
    );
  });

  it('should have proper accessibility labels', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const importButton = screen.getByLabelText('Use Import website template');
    expect(importButton).toBeInTheDocument();
    const cmsButton = screen.getByLabelText('Use CMS Migration template');
    expect(cmsButton).toBeInTheDocument();
  });

  it('should render icons for each tag', () => {
    const { container } = render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(7);
  });

  it('should apply correct color classes to tags', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const importTag = screen.getByText('Import website').closest('button');
    expect(importTag?.className).toContain('text-amber-400');

    const cmsTag = screen.getByText('CMS Migration').closest('button');
    expect(cmsTag?.className).toContain('text-blue-400');

    const courseTag = screen.getByText('Course Catalog').closest('button');
    expect(courseTag?.className).toContain('text-purple-400');
  });

  it('should handle rapid clicks correctly', () => {
    render(<QuickCategoryTags onTagClick={mockOnTagClick} />);

    const importTag = screen.getByText('Import website');

    fireEvent.click(importTag);
    fireEvent.click(importTag);
    fireEvent.click(importTag);

    expect(mockOnTagClick).toHaveBeenCalledTimes(3);
  });
});
