/**
 * Integration tests for Category Field Workflow (Story 7.4a)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategorySelectorModal } from '@/components/content-builder/category-selector-modal';
import ContentTypeBuilder from '@/components/content-builder/content-type-builder';
import { ContentTypeProvider } from '@/lib/context/content-type-context';
import { WebsiteProvider } from '@/lib/context/website-context';

// Mock the API hooks
jest.mock('@/lib/api/hooks/use-content-types', () => ({
  useContentTypesQuery: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateContentType: jest.fn(() => ({
    mutate: jest.fn(),
  })),
  useUpdateContentType: jest.fn(() => ({
    mutate: jest.fn(),
  })),
  useDeleteContentType: jest.fn(() => ({
    mutate: jest.fn(),
  })),
}));

// Mock the content store
jest.mock('@/lib/stores/content-store', () => ({
  useContentStore: {
    getState: jest.fn(() => ({
      getContentByType: jest.fn(() => []),
      deleteContent: jest.fn(),
    })),
  },
}));

describe('Category Selection Workflow', () => {
  describe('CategorySelectorModal', () => {
    it('should render category options', () => {
      const mockOnClose = jest.fn();
      const mockOnSelect = jest.fn();

      render(
        <CategorySelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('Select Content Type Category')).toBeInTheDocument();
      expect(screen.getByText('Page')).toBeInTheDocument();
      expect(screen.getByText('Component')).toBeInTheDocument();
    });

    it('should select page category by default', () => {
      render(
        <CategorySelectorModal
          isOpen={true}
          onClose={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      const pageRadio = screen.getByRole('radio', { name: /Page/i });
      expect(pageRadio).toBeChecked();
    });

    it('should allow switching to component category', () => {
      render(
        <CategorySelectorModal
          isOpen={true}
          onClose={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      const componentRadio = screen.getByRole('radio', { name: /Component/i });
      fireEvent.click(componentRadio);
      expect(componentRadio).toBeChecked();
    });

    it('should call onSelect with selected category', () => {
      const mockOnSelect = jest.fn();
      
      render(
        <CategorySelectorModal
          isOpen={true}
          onClose={jest.fn()}
          onSelect={mockOnSelect}
        />
      );

      const componentRadio = screen.getByRole('radio', { name: /Component/i });
      fireEvent.click(componentRadio);
      
      const createButton = screen.getByText(/Create Component Type/i);
      fireEvent.click(createButton);

      expect(mockOnSelect).toHaveBeenCalledWith('component');
    });

    it('should display helpful descriptions for each category', () => {
      render(
        <CategorySelectorModal
          isOpen={true}
          onClose={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      expect(screen.getByText(/Routable content with its own URL/i)).toBeInTheDocument();
      expect(screen.getByText(/Reusable content blocks that can be embedded/i)).toBeInTheDocument();
    });
  });

  describe('ContentTypeBuilder Integration', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <WebsiteProvider>
        <ContentTypeProvider>
          {children}
        </ContentTypeProvider>
      </WebsiteProvider>
    );

    it('should show category selector when creating new content type', async () => {
      render(
        <TestWrapper>
          <ContentTypeBuilder />
        </TestWrapper>
      );

      await waitFor(() => {
        const createButton = screen.getByText(/Create New Content Type/i);
        expect(createButton).toBeInTheDocument();
      });

      const createButton = screen.getByText(/Create New Content Type/i);
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Select Content Type Category')).toBeInTheDocument();
      });
    });

    it('should display category badge on content type', async () => {
      // Mock existing content type
      const mockContentTypes = [{
        id: 'test-1',
        name: 'BlogPost',
        pluralName: 'BlogPosts',
        icon: '📄',
        category: 'page' as const,
        fields: [],
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }];

      jest.spyOn(require('@/lib/api/hooks/use-content-types'), 'useContentTypesQuery').mockReturnValue({
        data: mockContentTypes,
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <ContentTypeBuilder contentTypeId="test-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('📄 Page')).toBeInTheDocument();
      });
    });

    it('should show different badge for component types', async () => {
      const mockContentTypes = [{
        id: 'test-2',
        name: 'HeroSection',
        pluralName: 'HeroSections',
        icon: '🧩',
        category: 'component' as const,
        fields: [],
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }];

      jest.spyOn(require('@/lib/api/hooks/use-content-types'), 'useContentTypesQuery').mockReturnValue({
        data: mockContentTypes,
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <ContentTypeBuilder contentTypeId="test-2" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('🧩 Component')).toBeInTheDocument();
      });
    });
  });

  describe('Category Persistence', () => {
    it('should persist category when saving content type', async () => {
      const mockCreateMutation = jest.fn();
      
      jest.spyOn(require('@/lib/api/hooks/use-content-types'), 'useCreateContentType').mockReturnValue({
        mutate: mockCreateMutation,
      });

      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <WebsiteProvider>
          <ContentTypeProvider>
            {children}
          </ContentTypeProvider>
        </WebsiteProvider>
      );

      render(
        <TestWrapper>
          <ContentTypeBuilder />
        </TestWrapper>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/Create New Content Type/i)).toBeInTheDocument();
      });

      // Click create button
      fireEvent.click(screen.getByText(/Create New Content Type/i));

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText('Select Content Type Category')).toBeInTheDocument();
      });

      // Select component category
      const componentRadio = screen.getByRole('radio', { name: /Component/i });
      fireEvent.click(componentRadio);

      // Create the content type
      const createButton = screen.getByText(/Create Component Type/i);
      fireEvent.click(createButton);

      // Verify the mutation was called with correct category
      await waitFor(() => {
        expect(mockCreateMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'component',
          }),
          expect.any(Object)
        );
      });
    });
  });
});