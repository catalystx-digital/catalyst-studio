import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { WebsiteContextProvider, useWebsiteContext } from '../website-context';
import { useWebsite, useUpdateWebsite, useDeleteWebsite } from '@/lib/api/hooks/use-websites';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock the API hooks
jest.mock('@/lib/api/hooks/use-websites');

describe('WebsiteContext', () => {
  const mockWebsite = {
    id: 'test-website',
    name: 'Test Website',
    description: 'Test Description',
    category: 'Business',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUpdateMutate = jest.fn();
  const mockDeleteMutate = jest.fn();
  const mockDeleteReset = jest.fn();
  const mockRefetch = jest.fn();
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementations
    (useWebsite as jest.Mock).mockReturnValue({
      data: mockWebsite,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    (useUpdateWebsite as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateMutate,
    });

    (useDeleteWebsite as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteMutate,
      isPending: false,
      error: null,
      reset: mockDeleteReset,
    });
  });

  describe('WebsiteContextProvider', () => {
    it('should load website data on mount', async () => {
      const TestComponent = () => {
        const { website, isLoading } = useWebsiteContext();
        return (
          <div>
            <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>
            <div data-testid="website">{website ? 'has-website' : 'no-website'}</div>
          </div>
        );
      };

      render(
        <WebsiteContextProvider websiteId="test-website">
          <TestComponent />
        </WebsiteContextProvider>
      );
      
      // Should have loaded website data
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      expect(screen.getByTestId('website')).toHaveTextContent('has-website');
      expect(useWebsite).toHaveBeenCalledWith('test-website', { enabled: true });
    });

    it('should handle loading state', async () => {
      (useWebsite as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });
      
      const TestComponent = () => {
        const { isLoading } = useWebsiteContext();
        return <div data-testid="loading">{isLoading ? 'loading' : 'loaded'}</div>;
      };

      render(
        <WebsiteContextProvider websiteId="test-website">
          <TestComponent />
        </WebsiteContextProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    it('should handle errors gracefully', async () => {
      const testError = new Error('Failed to load');
      (useWebsite as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: testError,
        refetch: mockRefetch,
      });
      
      const TestComponent = () => {
        const { error } = useWebsiteContext();
        return <div data-testid="error">{error?.message || 'no-error'}</div>;
      };

      render(
        <WebsiteContextProvider websiteId="test-website">
          <TestComponent />
        </WebsiteContextProvider>
      );

      expect(screen.getByTestId('error')).toHaveTextContent('Failed to load');
    });

    it('should update website data', async () => {
      mockUpdateMutate.mockResolvedValue({});
      
      const TestComponent = () => {
        const { updateWebsite } = useWebsiteContext();
        React.useEffect(() => {
          updateWebsite({ name: 'Updated Name' });
        }, [updateWebsite]);
        return <div>Test</div>;
      };

      render(
        <WebsiteContextProvider websiteId="test-website">
          <TestComponent />
        </WebsiteContextProvider>
      );

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith({ name: 'Updated Name' });
      });
    });

    it('should delete website data', async () => {
      mockDeleteMutate.mockResolvedValue({ id: 'test-website', message: 'Deleted' });
      
      const TestComponent = () => {
        const { deleteWebsite } = useWebsiteContext();
        React.useEffect(() => {
          deleteWebsite();
        }, [deleteWebsite]);
        return <div>Test</div>;
      };

      render(
        <WebsiteContextProvider websiteId="test-website">
          <TestComponent />
        </WebsiteContextProvider>
      );

      await waitFor(() => {
        expect(mockDeleteMutate).toHaveBeenCalledWith('test-website');
      });
    });
  });

  describe('useWebsiteContext', () => {
    it('should throw error when used outside provider', () => {
      const TestComponent = () => {
        useWebsiteContext();
        return <div>Test</div>;
      };

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useWebsiteContext must be used within WebsiteContextProvider');

      console.error = originalError;
    });
  });
});
