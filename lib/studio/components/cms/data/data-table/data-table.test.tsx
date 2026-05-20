import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataTable from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('DataTable Component', () => {
  const defaultProps = {
    id: 'data-table-test',
    type: ComponentType.DataTable,
    category: ComponentCategory.Data,
    content: {
      title: 'Sales Report',
      subtitle: 'Q4 2024 Performance',
      columns: [
        { key: 'name', label: 'Product Name', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'sales', label: 'Sales', sortable: true, align: 'right' as const },
        { key: 'revenue', label: 'Revenue', sortable: true, align: 'right' as const },
        { key: 'status', label: 'Status', sortable: false, align: 'center' as const }
      ],
      rows: [
        { id: '1', name: 'Product A', category: 'Electronics', sales: 150, revenue: 15000, status: 'Active' },
        { id: '2', name: 'Product B', category: 'Clothing', sales: 230, revenue: 11500, status: 'Active' },
        { id: '3', name: 'Product C', category: 'Electronics', sales: 85, revenue: 8500, status: 'Inactive' },
        { id: '4', name: 'Product D', category: 'Home', sales: 420, revenue: 42000, status: 'Active' },
        { id: '5', name: 'Product E', category: 'Clothing', sales: 190, revenue: 9500, status: 'Active' }
      ],
      pagination: {
        enabled: true,
        pageSize: 3,
        pageSizeOptions: [3, 5, 10]
      },
      sorting: {
        enabled: true,
        defaultSort: { key: 'sales', order: 'desc' as const }
      },
      filtering: {
        enabled: true,
        placeholder: 'Search products...'
      },
      striped: true,
      bordered: true,
      hoverable: true,
      responsive: true
    }
  };

  it('renders without crashing', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Sales Report')).toBeInTheDocument();
  });

  it('displays title and subtitle', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Sales Report')).toBeInTheDocument();
    expect(screen.getByText('Q4 2024 Performance')).toBeInTheDocument();
  });

  it('renders all column headers', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Product Name')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('applies default sorting', () => {
    render(<DataTable {...defaultProps} />);
    const rows = screen.getAllByRole('row');
    // First data row should be Product D (highest sales: 420)
    expect(within(rows[1]).getByText('Product D')).toBeInTheDocument();
  });

  it('sorts data when column header is clicked', () => {
    render(<DataTable {...defaultProps} />);
    const nameHeader = screen.getByText('Product Name');
    fireEvent.click(nameHeader);
    
    const rows = screen.getAllByRole('row');
    // Should be sorted alphabetically by name
    expect(within(rows[1]).getByText('Product A')).toBeInTheDocument();
  });

  it('toggles sort order on repeated clicks', () => {
    render(<DataTable {...defaultProps} />);
    const salesHeader = screen.getByText('Sales');
    
    // Click once (already desc by default, should toggle to asc)
    fireEvent.click(salesHeader);
    let rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Product C')).toBeInTheDocument(); // Lowest sales
    
    // Click again (should toggle back to desc)
    fireEvent.click(salesHeader);
    rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Product D')).toBeInTheDocument(); // Highest sales
  });

  it('filters data based on search input', () => {
    render(<DataTable {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search products...');
    
    fireEvent.change(searchInput, { target: { value: 'Electronics' } });
    
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product C')).toBeInTheDocument();
    expect(screen.queryByText('Product B')).not.toBeInTheDocument();
    expect(screen.queryByText('Product D')).not.toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    render(<DataTable {...defaultProps} />);
    
    // Should show first 3 items
    expect(screen.getByText('Product D')).toBeInTheDocument();
    expect(screen.queryByText('Product C')).not.toBeInTheDocument();
    
    // Click next page
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    
    // Should show remaining items
    expect(screen.getByText('Product C')).toBeInTheDocument();
    expect(screen.queryByText('Product D')).not.toBeInTheDocument();
  });

  it('displays pagination info correctly', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText(/Showing 1 to 3 of 5 results/)).toBeInTheDocument();
  });

  it('handles page size change', () => {
    render(<DataTable {...defaultProps} />);
    const pageSizeTrigger = screen.getByRole('combobox', { name: 'Select page size' });
    fireEvent.click(pageSizeTrigger);

    const option5 = screen.getByText('5 / page');
    fireEvent.click(option5);
    
    // Should now show all 5 items
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product E')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<DataTable {...defaultProps} />);
    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<DataTable {...defaultProps} />);
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton); // Go to page 2 (last page with pageSize=3)
    expect(nextButton).toBeDisabled();
  });

  it('applies striped rows', () => {
    const { container } = render(<DataTable {...defaultProps} />);
    const rows = container.querySelectorAll('tr');
    // Check if alternating rows have striped styling
    expect(rows[2]).toHaveClass('bg-background-secondary/60'); // Second data row (index 2)
  });

  it('shows empty state when no data', () => {
    const emptyProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        rows: []
      }
    };
    render(<DataTable {...emptyProps} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('handles missing optional features', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        pagination: { enabled: false },
        filtering: { enabled: false },
        sorting: { enabled: false }
      }
    };
    render(<DataTable {...minimalProps} />);
    
    // No search input
    expect(screen.queryByPlaceholderText('Search products...')).not.toBeInTheDocument();
    // No pagination
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    // All data shown
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product E')).toBeInTheDocument();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<DataTable {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content', () => {
    const propsWithXSS = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Table',
        rows: [{
          ...defaultProps.content.rows[0],
          name: '<img src=x onerror=alert("XSS")>Product'
        }]
      }
    };
    render(<DataTable {...propsWithXSS} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Table/)).toBeInTheDocument();
  });

  it('renders within performance threshold', () => {
    const startTime = performance.now();
    render(<DataTable {...defaultProps} />);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // 50ms threshold
  });
});
