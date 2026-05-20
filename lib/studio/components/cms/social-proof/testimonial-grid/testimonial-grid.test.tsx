import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TestimonialGrid } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { TestimonialGridContent } from './testimonial-grid.types';

describe('TestimonialGrid', () => {
  const mockContent: TestimonialGridContent = {
    testimonials: [
      {
        id: '1',
        quote: 'Outstanding service and quality.',
        author: 'Alice Johnson',
        role: 'Product Manager',
        company: 'Tech Solutions',
        rating: 5
      },
      {
        id: '2',
        quote: 'Highly recommended for professionals.',
        author: 'Bob Smith',
        role: 'Developer',
        company: 'StartupX',
        rating: 4
      },
      {
        id: '3',
        quote: 'Game-changing platform.',
        author: 'Carol White',
        company: 'Enterprise Corp'
      }
    ],
    columns: {
      desktop: 3,
      tablet: 2,
      mobile: 1
    },
    showRating: true
  };

  const defaultProps = {
    id: 'testimonial-grid-1',
    type: ComponentType.Testimonials,
    category: ComponentCategory.SocialProof,
    content: mockContent
  };

  it('renders with required props', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
  });

  it('handles missing optional props gracefully', () => {
    const minimalContent = {
      testimonials: [
        {
          id: '1',
          quote: 'Test quote',
          author: 'Test Author'
        }
      ]
    };
    
    render(
      <TestimonialGrid 
        {...defaultProps} 
        content={minimalContent}
      />
    );
    
    expect(screen.getByText('Test quote')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('renders all testimonial cards in grid', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
  });

  it('displays rating stars when showRating is true', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    const ratingElements = screen.getAllByLabelText(/out of 5 stars/);
    expect(ratingElements.length).toBeGreaterThan(0);
  });

  it('does not display rating when showRating is false', () => {
    const contentWithoutRating = {
      ...mockContent,
      showRating: false
    };
    
    render(
      <TestimonialGrid 
        {...defaultProps} 
        content={contentWithoutRating}
      />
    );
    
    const ratingElements = screen.queryAllByLabelText(/out of 5 stars/);
    expect(ratingElements).toHaveLength(0);
  });

  it('displays author role and company when provided', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    // Check that role and company are displayed together
    const roleAndCompany = screen.getByText((content, element) => {
      return element?.textContent === 'Product Manager, Tech Solutions';
    });
    expect(roleAndCompany).toBeInTheDocument();
  });

  it('sanitizes HTML content in quotes', () => {
    const contentWithHTML = {
      testimonials: [
        {
          id: '1',
          quote: 'Great <strong>product</strong>! <script>alert("XSS")</script>',
          author: 'Test Author'
        }
      ]
    };
    
    render(
      <TestimonialGrid 
        {...defaultProps} 
        content={contentWithHTML}
      />
    );
    
    // Check that strong tag is preserved
    const container = screen.getByRole('list');
    const blockquote = container.querySelector('blockquote p');
    expect(blockquote?.innerHTML).toContain('<strong>product</strong>');
    expect(blockquote?.innerHTML).not.toContain('script');
    expect(blockquote?.innerHTML).not.toContain('alert');
  });

  it('returns null when no testimonials are provided', () => {
    const { container } = render(
      <TestimonialGrid 
        {...defaultProps} 
        content={{ testimonials: [] }}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('applies theme classes correctly', () => {
    const { rerender } = render(
      <TestimonialGrid {...defaultProps} theme="dark" />
    );

    let section = screen.getByLabelText('Customer testimonials').closest('.cms-testimonial-grid');
    expect(section?.className).toContain('theme-dark');

    rerender(<TestimonialGrid {...defaultProps} theme="light" />);
    section = screen.getByLabelText('Customer testimonials').closest('.cms-testimonial-grid');
    expect(section?.className).toContain('theme-light');
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    const container = screen.getByRole('list');
    expect(container).toHaveAttribute('aria-label', 'Customer testimonials');
    
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('has correct data attributes', () => {
    render(<TestimonialGrid {...defaultProps} />);
    
    const container = screen.getByLabelText('Customer testimonials').closest('.cms-testimonial-grid');
    expect(container).toHaveAttribute('data-component-type', ComponentType.Testimonials);
    expect(container).toHaveAttribute('data-category', ComponentCategory.SocialProof);
  });

  it('applies CmsCard styling to testimonial cards', () => {
    render(<TestimonialGrid {...defaultProps} />);

    const firstCard = screen.getByTestId('testimonial-card-1');
    expect(firstCard.className).toContain('cms-card');
    expect(firstCard.className).toContain('rounded-xl');
  });
});
