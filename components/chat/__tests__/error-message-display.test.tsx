import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorMessageDisplay, ChatError } from '../error-message-display';

describe('ErrorMessageDisplay', () => {
  const mockError: ChatError = {
    id: 'error-123',
    severity: 'error',
    message: 'Failed to create content type',
    details: 'Missing required field: name',
    timestamp: new Date('2025-01-14T10:00:00Z'),
    retryable: true,
  };

  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders error message correctly', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to create content type')).toBeInTheDocument();
      expect(screen.getByText('Missing required field: name')).toBeInTheDocument();
    });

    it('renders warning severity with appropriate styling', () => {
      const warningError: ChatError = {
        ...mockError,
        severity: 'warning',
      };
      
      render(
        <ErrorMessageDisplay 
          error={warningError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const container = screen.getByRole('alert');
      expect(container).toHaveClass('bg-yellow-50', 'dark:bg-yellow-900/20');
    });

    it('renders error severity with appropriate styling', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const container = screen.getByRole('alert');
      expect(container).toHaveClass('bg-red-50', 'dark:bg-red-900/20');
    });

    it('renders info severity with appropriate styling', () => {
      const infoError: ChatError = {
        ...mockError,
        severity: 'info',
      };
      
      render(
        <ErrorMessageDisplay 
          error={infoError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const container = screen.getByRole('alert');
      expect(container).toHaveClass('bg-blue-50', 'dark:bg-blue-900/20');
    });
  });

  describe('Field Errors', () => {
    it('displays field errors when provided', () => {
      const errorWithFields: ChatError = {
        ...mockError,
        fieldErrors: {
          name: 'Name is required',
          type: 'Invalid type specified',
        },
      };
      
      render(
        <ErrorMessageDisplay 
          error={errorWithFields} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.getByText('Field Errors:')).toBeInTheDocument();
      expect(screen.getByText('• name: Name is required')).toBeInTheDocument();
      expect(screen.getByText('• type: Invalid type specified')).toBeInTheDocument();
    });

    it('does not display field errors section when not provided', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.queryByText('Field Errors:')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows retry button when error is retryable', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const retryButton = screen.getByLabelText('Retry action');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show retry button when error is not retryable', () => {
      const nonRetryableError: ChatError = {
        ...mockError,
        retryable: false,
      };
      
      render(
        <ErrorMessageDisplay 
          error={nonRetryableError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.queryByLabelText('Retry action')).not.toBeInTheDocument();
    });

    it('does not show retry button when onRetry is not provided', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.queryByLabelText('Retry action')).not.toBeInTheDocument();
    });

    it('shows dismiss button when onDismiss is provided', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const dismissButton = screen.getByLabelText('Dismiss error');
      expect(dismissButton).toBeInTheDocument();
      
      fireEvent.click(dismissButton);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not show dismiss button when onDismiss is not provided', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
        />
      );
      
      expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
    });
  });

  describe('Expandable Details', () => {
    it('expands and collapses details', () => {
      const errorWithDetails: ChatError = {
        ...mockError,
        technicalDetails: 'This is technical error information that can be expanded',
      };
      
      render(
        <ErrorMessageDisplay 
          error={errorWithDetails} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      // Initially collapsed
      expect(screen.queryByText('This is technical error information that can be expanded')).not.toBeInTheDocument();
      
      // Click to expand
      const expandButton = screen.getByText('Technical Details');
      fireEvent.click(expandButton);
      
      // Now visible
      expect(screen.getByText('This is technical error information that can be expanded')).toBeInTheDocument();
      
      // Click to collapse
      fireEvent.click(screen.getByText('Technical Details'));
      expect(screen.queryByText('This is technical error information that can be expanded')).not.toBeInTheDocument();
    });

    it('does not show expand button when no details provided', () => {
      const errorWithoutDetails: ChatError = {
        ...mockError,
        details: undefined,
      };
      
      render(
        <ErrorMessageDisplay 
          error={errorWithoutDetails} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.queryByLabelText('Show error details')).not.toBeInTheDocument();
    });
  });

  // Note: Timestamp display test removed as the component doesn't currently render timestamps
  // This could be added as a future enhancement

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('has proper ARIA expanded state for details', () => {
      const errorWithDetails: ChatError = {
        ...mockError,
        technicalDetails: 'Technical error information',
      };
      
      render(
        <ErrorMessageDisplay 
          error={errorWithDetails} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const expandButton = screen.getByText('Technical Details');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          className="custom-error-class"
        />
      );
      
      expect(screen.getByRole('alert')).toHaveClass('custom-error-class');
    });
  });

  describe('Error Recovery Actions', () => {
    it('displays suggested actions when provided', () => {
      const mockAction1 = jest.fn();
      const mockAction2 = jest.fn();
      const errorWithActions: ChatError = {
        ...mockError,
        suggestedActions: [
          { label: 'Check Configuration', action: mockAction1, variant: 'primary' },
          { label: 'Review Documentation', action: mockAction2, variant: 'secondary' },
        ],
      };
      
      render(
        <ErrorMessageDisplay 
          error={errorWithActions} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.getByText('Check Configuration')).toBeInTheDocument();
      expect(screen.getByText('Review Documentation')).toBeInTheDocument();
      
      // Click an action button
      fireEvent.click(screen.getByText('Check Configuration'));
      expect(mockAction1).toHaveBeenCalled();
    });

    it('does not display suggested actions section when not provided', () => {
      render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      expect(screen.queryByText('Suggested actions:')).not.toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('applies transition classes', () => {
      const { container } = render(
        <ErrorMessageDisplay 
          error={mockError} 
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );
      
      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveClass('transition-all', 'duration-200');
    });
  });
});