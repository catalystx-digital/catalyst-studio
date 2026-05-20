import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalComponentManager } from '../GlobalComponentManager';
import { toast } from 'sonner';

// Mock fetch
global.fetch = jest.fn();

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Zustand store
jest.mock('@/lib/studio/stores/site-builder-store', () => ({
  useSiteBuilderStore: jest.fn(() => new Map())
}));

describe('GlobalComponentManager', () => {
  const defaultProps = {
    componentId: 'comp-123',
    componentName: 'Hero Section',
    componentType: 'hero',
    websiteId: 'website-456',
    isGlobal: false,
    onGlobalStateChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with correct initial state', () => {
    render(<GlobalComponentManager {...defaultProps} />);
    
    expect(screen.getByText('Hero Section')).toBeInTheDocument();
    expect(screen.getByText('Type: hero')).toBeInTheDocument();
    expect(screen.getByText('Local Component')).toBeInTheDocument();
  });

  it('should render as global when isGlobal is true', () => {
    render(<GlobalComponentManager {...defaultProps} isGlobal={true} />);
    
    expect(screen.getByText('Global Component')).toBeInTheDocument();
    expect(screen.getByText(/Changes to this component will be propagated/)).toBeInTheDocument();
  });

  it('should show conversion dialog when toggling global state', () => {
    render(<GlobalComponentManager {...defaultProps} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(screen.getByText('Convert to Global Component')).toBeInTheDocument();
    expect(screen.getByText('Global components are centrally managed')).toBeInTheDocument();
  });

  it('should handle successful conversion to global', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'comp-123',
        componentId: 'comp-123',
        name: 'Hero Section',
        usageCount: 5,
        affectedPages: 3
      })
    });

    render(<GlobalComponentManager {...defaultProps} />);
    
    // Click toggle
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    // Confirm conversion
    const confirmButton = screen.getByText('Make Global');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/studio/site-builder/global-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: 'comp-123',
          websiteId: 'website-456',
          name: 'Hero Section',
          type: 'hero',
          properties: {},
          makeGlobal: true,
          createdBy: 'current-user'
        })
      });
      
      expect(defaultProps.onGlobalStateChange).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalledWith('Component "Hero Section" is now global');
    });
  });

  it('should handle conversion failure', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    });

    render(<GlobalComponentManager {...defaultProps} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    const confirmButton = screen.getByText('Make Global');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update component. Please try again.');
      expect(defaultProps.onGlobalStateChange).not.toHaveBeenCalled();
    });
  });

  it('should fetch and display usage count for global components', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        usageCount: 10
      })
    });

    render(<GlobalComponentManager {...defaultProps} isGlobal={true} />);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/studio/site-builder/global-components/comp-123/usage');
      expect(screen.getByText('10 uses')).toBeInTheDocument();
    });
  });

  it('should cancel conversion when cancel button is clicked', () => {
    render(<GlobalComponentManager {...defaultProps} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByText('Convert to Global Component')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});