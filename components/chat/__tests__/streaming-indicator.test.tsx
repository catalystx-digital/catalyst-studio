import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StreamingIndicator, MultiStepStreamingIndicator } from '../streaming-indicator';

describe('StreamingIndicator', () => {
  describe('Basic Rendering', () => {
    it('renders typing state by default', () => {
      render(<StreamingIndicator />);
      
      expect(screen.getByText('Typing')).toBeInTheDocument();
    });

    it('renders custom message', () => {
      render(<StreamingIndicator message="Processing your request..." />);
      
      expect(screen.getByText('Processing your request...')).toBeInTheDocument();
    });

    it('renders typing state', () => {
      render(<StreamingIndicator type="typing" />);
      
      expect(screen.getByText('Typing')).toBeInTheDocument();
    });

    it('renders tool execution state', () => {
      render(<StreamingIndicator type="tool" />);
      
      expect(screen.getByText('Executing tool')).toBeInTheDocument();
    });

    it('renders processing state', () => {
      render(<StreamingIndicator type="processing" />);
      
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('renders animated dots', () => {
      const { container } = render(<StreamingIndicator type="typing" />);
      
      const dots = container.querySelectorAll('.animate-bounce');
      expect(dots.length).toBe(3);
    });

    it('applies animation delays to dots', () => {
      const { container } = render(<StreamingIndicator />);
      
      const dots = container.querySelectorAll('[style*="animation-delay"]');
      expect(dots.length).toBe(3);
      
      // Check that each dot has a different delay
      const delays = Array.from(dots).map(dot => 
        dot.getAttribute('style')?.match(/animation-delay:\s*(\d+)ms/)?.[1]
      );
      expect(delays).toEqual(['0', '150', '300']);
    });
  });

  describe('Icon Display', () => {
    it('shows thinking icon for thinking type', () => {
      const { container } = render(<StreamingIndicator type="thinking" />);
      
      // Check for Activity icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('shows tool icon for tool type', () => {
      const { container } = render(<StreamingIndicator type="tool" />);
      
      // Check for Loader2 icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('shows processing icon for processing type', () => {
      const { container } = render(<StreamingIndicator type="processing" />);
      
      // Check for Loader2 icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(<StreamingIndicator className="custom-streaming" />);
      
      const element = container.querySelector('.custom-streaming');
      expect(element).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders text content for screen readers', () => {
      render(<StreamingIndicator />);
      
      expect(screen.getByText('Typing')).toBeInTheDocument();
    });
  });
});

describe('MultiStepStreamingIndicator', () => {
  describe('Basic Rendering', () => {
    it('renders step counter', () => {
      render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
        />
      );
      
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    it('displays current step name when provided', () => {
      render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
          currentStepName="Processing data"
        />
      );
      
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
      expect(screen.getByText('Processing data')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
        />
      );
      
      // Look for the progress bar div
      const progressBar = container.querySelector('.bg-gradient-to-r');
      expect(progressBar).toBeInTheDocument();
    });

    it('calculates progress correctly', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
        />
      );
      
      const progressBar = container.querySelector('.bg-gradient-to-r');
      expect(progressBar).toHaveStyle({ width: '50%' }); // 2 of 4 = 50%
    });

    it('shows 100% progress when all steps complete', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={4}
          totalSteps={4}
        />
      );
      
      const progressBar = container.querySelector('.bg-gradient-to-r');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Step Indicators', () => {
    it('shows completed steps', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={3}
          totalSteps={4}
        />
      );
      
      // First two steps should be completed (blue)
      const indicators = container.querySelectorAll('.bg-blue-500');
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows current step with animation', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
        />
      );
      
      // Get only the step indicators, not the progress bar
      const stepIndicatorContainer = container.querySelector('[data-testid="step-indicators"]');
      const indicators = stepIndicatorContainer?.querySelectorAll('.rounded-full');
      
      // The second indicator (index 1 for step 2) should be the current one with animation
      expect(indicators).toBeDefined();
      expect(indicators?.length).toBe(4);
      expect(indicators?.[1]).toHaveClass('animate-pulse');
    });

    it('shows pending steps', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
        />
      );
      
      // Pending steps should be gray
      const pending = container.querySelectorAll('.bg-gray-300, .bg-gray-600');
      expect(pending.length).toBeGreaterThan(0);
    });
  });



  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={2}
          totalSteps={4}
          className="custom-multi-step"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-multi-step');
    });
  });


  describe('Edge Cases', () => {
    it('handles zero total steps', () => {
      const { container } = render(
        <MultiStepStreamingIndicator 
          currentStep={0}
          totalSteps={0}
        />
      );
      
      // Should not crash and still render
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles out of bounds current step', () => {
      render(
        <MultiStepStreamingIndicator 
          currentStep={10}
          totalSteps={4}
        />
      );
      
      // Should not crash and still render
      expect(screen.getByText('Step 10 of 4')).toBeInTheDocument();
    });
  });
});