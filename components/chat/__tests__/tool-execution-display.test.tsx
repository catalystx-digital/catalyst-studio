import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolExecutionDisplay, MultiStepToolExecution, ToolInvocation } from '../tool-execution-display';

describe('ToolExecutionDisplay', () => {
  const mockInvocation: ToolInvocation = {
    toolCallId: 'test-123',
    toolName: 'createContentType',
    args: {
      name: 'Blog Post',
      fields: ['title', 'content']
    },
    state: 'pending',
    startTime: new Date('2025-01-14T10:00:00Z'),
  };

  describe('Rendering States', () => {
    it('renders pending state correctly', () => {
      render(<ToolExecutionDisplay invocation={{ ...mockInvocation, state: 'pending' }} />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Tool execution: Creating Content Type - pending')).toBeInTheDocument();
      expect(screen.getByText('Creating Content Type')).toBeInTheDocument();
    });

    it('renders executing state with animation', () => {
      render(<ToolExecutionDisplay invocation={{ ...mockInvocation, state: 'executing' }} />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveClass('bg-blue-50', 'dark:bg-blue-900/20', 'animate-pulse');
      expect(screen.getByText('Executing tool with provided parameters...')).toBeInTheDocument();
    });

    it('renders success state with result', () => {
      const successInvocation = {
        ...mockInvocation,
        state: 'success' as const,
        result: { message: 'Content type created successfully', id: 'type-456' },
        endTime: new Date('2025-01-14T10:00:02Z'),
      };
      
      render(<ToolExecutionDisplay invocation={successInvocation} />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveClass('bg-green-50', 'dark:bg-green-900/20');
      expect(screen.getByText(/Success:/)).toBeInTheDocument();
      expect(screen.getByText(/Content type created successfully/)).toBeInTheDocument();
    });

    it('renders error state with error message', () => {
      const errorInvocation = {
        ...mockInvocation,
        state: 'error' as const,
        error: 'Field validation failed',
        endTime: new Date('2025-01-14T10:00:01Z'),
      };
      
      render(<ToolExecutionDisplay invocation={errorInvocation} />);
      
      const container = screen.getByRole('status');
      expect(container).toHaveClass('bg-red-50', 'dark:bg-red-900/20');
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Field validation failed')).toBeInTheDocument();
    });
  });

  describe('Tool Display Names and Icons', () => {
    it('displays correct name for known tools', () => {
      render(<ToolExecutionDisplay invocation={{ ...mockInvocation, toolName: 'getWebsiteContext' }} />);
      expect(screen.getByText('Getting Website Context')).toBeInTheDocument();
    });

    it('displays fallback for unknown tools', () => {
      render(<ToolExecutionDisplay invocation={{ ...mockInvocation, toolName: 'unknownTool' }} />);
      expect(screen.getByText('unknownTool')).toBeInTheDocument();
    });

    it('displays correct icon for known tools', () => {
      render(<ToolExecutionDisplay invocation={{ ...mockInvocation, toolName: 'validateContent' }} />);
      expect(screen.getByRole('img', { name: 'Validating Content' })).toHaveTextContent('✅');
    });
  });

  describe('Expandable Details', () => {
    it('expands and collapses details on button click', () => {
      render(<ToolExecutionDisplay invocation={mockInvocation} />);
      
      const expandButton = screen.getByLabelText('Expand details');
      expect(screen.queryByText('Parameters:')).not.toBeInTheDocument();
      
      fireEvent.click(expandButton);
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
      expect(screen.getByLabelText('Collapse details')).toBeInTheDocument();
      
      fireEvent.click(screen.getByLabelText('Collapse details'));
      expect(screen.queryByText('Parameters:')).not.toBeInTheDocument();
    });

    it('displays parameters in expanded view', () => {
      render(<ToolExecutionDisplay invocation={mockInvocation} />);
      
      fireEvent.click(screen.getByLabelText('Expand details'));
      
      const paramsText = screen.getByText((content, element) => {
        return element?.tagName === 'PRE' && content.includes('Blog Post');
      });
      expect(paramsText).toBeInTheDocument();
    });

    it('displays result in expanded view when available', () => {
      const invocationWithResult = {
        ...mockInvocation,
        state: 'success' as const,
        result: { success: true, data: { id: '123', name: 'Test' } }
      };
      
      render(<ToolExecutionDisplay invocation={invocationWithResult} />);
      fireEvent.click(screen.getByLabelText('Expand details'));
      
      expect(screen.getByText('Result:')).toBeInTheDocument();
      const resultText = screen.getAllByText((content, element) => {
        return element?.tagName === 'PRE' && content.includes('"success": true');
      });
      expect(resultText.length).toBeGreaterThan(0);
    });

    it('handles null result values correctly', () => {
      const invocationWithNullResult = {
        ...mockInvocation,
        state: 'success' as const,
        result: null
      };
      
      render(<ToolExecutionDisplay invocation={invocationWithNullResult} />);
      
      // The component shows success message even when result is null
      expect(screen.getByText(/Success:/)).toBeInTheDocument();
      
      // Expand to see details
      fireEvent.click(screen.getByLabelText('Expand details'));
      
      // Check that parameters are shown
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
    });
  });

  describe('Duration Display', () => {
    it('shows duration for completed executions', () => {
      const completedInvocation = {
        ...mockInvocation,
        state: 'success' as const,
        startTime: new Date('2025-01-14T10:00:00Z'),
        endTime: new Date('2025-01-14T10:00:03.5Z'),
      };
      
      render(<ToolExecutionDisplay invocation={completedInvocation} />);
      fireEvent.click(screen.getByLabelText('Expand details'));
      
      expect(screen.getByText('Completed in 3.50s')).toBeInTheDocument();
    });

    it('shows estimated duration during execution', () => {
      const executingInvocation = {
        ...mockInvocation,
        state: 'executing' as const,
        estimatedDuration: 5,
      };
      
      render(<ToolExecutionDisplay invocation={executingInvocation} />);
      expect(screen.getByText('(~5s)')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows cancel button during execution', () => {
      const onCancel = jest.fn();
      const executingInvocation = {
        ...mockInvocation,
        state: 'executing' as const,
      };
      
      render(
        <ToolExecutionDisplay 
          invocation={executingInvocation} 
          onCancel={onCancel}
        />
      );
      
      const cancelButton = screen.getByLabelText('Cancel execution');
      expect(cancelButton).toBeInTheDocument();
      
      fireEvent.click(cancelButton);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows retry button on error', () => {
      const onRetry = jest.fn();
      const errorInvocation = {
        ...mockInvocation,
        state: 'error' as const,
        error: 'Something went wrong',
      };
      
      render(
        <ToolExecutionDisplay 
          invocation={errorInvocation} 
          onRetry={onRetry}
        />
      );
      
      const retryButton = screen.getByLabelText('Retry execution');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show action buttons when callbacks are not provided', () => {
      const errorInvocation = {
        ...mockInvocation,
        state: 'error' as const,
      };
      
      render(<ToolExecutionDisplay invocation={errorInvocation} />);
      
      expect(screen.queryByLabelText('Retry execution')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ToolExecutionDisplay invocation={mockInvocation} />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-label', expect.stringContaining('Tool execution:'));
    });

    it('has proper ARIA expanded state for details', () => {
      render(<ToolExecutionDisplay invocation={mockInvocation} />);
      
      const expandButton = screen.getByLabelText('Expand details');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(expandButton);
      expect(screen.getByLabelText('Collapse details')).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <ToolExecutionDisplay 
          invocation={mockInvocation} 
          className="custom-class"
        />
      );
      
      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });
});

describe('MultiStepToolExecution', () => {
  const mockSteps: ToolInvocation[] = [
    {
      toolCallId: 'step-1',
      toolName: 'validateContent',
      args: { content: 'test' },
      state: 'success',
      startTime: new Date(),
      endTime: new Date(),
    },
    {
      toolCallId: 'step-2',
      toolName: 'createPage',
      args: { title: 'Test Item' },
      state: 'executing',
      startTime: new Date(),
    },
    {
      toolCallId: 'step-3',
      toolName: 'updateContentItem',
      args: { id: '123' },
      state: 'pending',
    },
  ];

  it('renders all steps', () => {
    render(
      <MultiStepToolExecution
        steps={mockSteps}
        currentStep={2}
        totalSteps={3}
      />
    );
    
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Validating Content')).toBeInTheDocument();
    expect(screen.getByText('Creating Page')).toBeInTheDocument();
    expect(screen.getByText('Updating Content Item')).toBeInTheDocument();
  });

  it('highlights current step', () => {
    const { container } = render(
      <MultiStepToolExecution
        steps={mockSteps}
        currentStep={2}
        totalSteps={3}
      />
    );
    
    const toolDisplays = container.querySelectorAll('[role="status"]');
    expect(toolDisplays[1]).toHaveClass('ring-2', 'ring-blue-400');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MultiStepToolExecution
        steps={mockSteps}
        currentStep={1}
        totalSteps={3}
        className="custom-multi-step"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-multi-step');
  });
});