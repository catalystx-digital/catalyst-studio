/**
 * Component Tests
 * Tests layout components with all features permanently enabled
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LayoutContainer, ChatPanel, NavigationPanel, MainContentPanel } from '@/components/layout/layout-container';
import { CatalystBranding } from '@/components/catalyst-branding';
import { ErrorBoundary, IsolatedErrorBoundary } from '@/components/error-boundary';

// Mock Framer Motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('Layout Components', () => {
  describe('LayoutContainer', () => {
    it('should render children with grid layout (feature permanently enabled)', () => {
      render(
        <LayoutContainer>
          <div data-testid="child">Test Content</div>
        </LayoutContainer>
      );
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
      const container = screen.getByTestId('child').parentElement;
      expect(container?.className).toContain('grid');
      expect(container?.className).toContain('grid-cols-[360px_260px_1fr]');
    });
  });

  describe('ChatPanel', () => {
    it('should render children with styling (all features permanently enabled)', () => {
      render(
        <ChatPanel>
          <div data-testid="chat">Chat Content</div>
        </ChatPanel>
      );
      
      expect(screen.getByTestId('chat')).toBeInTheDocument();
      const panel = screen.getByTestId('chat').parentElement;
      expect(panel?.className).toContain('border-r');
      expect(panel?.className).toContain('backdrop-blur-md');
    });
  });

  describe('NavigationPanel', () => {
    it('should render with children (feature permanently enabled)', () => {
      render(
        <NavigationPanel>
          <div data-testid="nav">Navigation</div>
        </NavigationPanel>
      );
      
      expect(screen.getByTestId('nav')).toBeInTheDocument();
    });

    it('should render with placeholder when no children provided', () => {
      render(
        <NavigationPanel />
      );
      
      expect(screen.getByText('Navigation (Coming Soon)')).toBeInTheDocument();
    });
  });

  describe('MainContentPanel', () => {
    it('should render with glass morphism (all features permanently enabled)', () => {
      render(
        <MainContentPanel>
          <div data-testid="main">Main Content</div>
        </MainContentPanel>
      );
      
      expect(screen.getByTestId('main')).toBeInTheDocument();
      const panel = screen.getByTestId('main').parentElement;
      expect(panel?.className).toContain('backdrop-blur-sm');
      expect(panel?.className).toContain('bg-gray-950/80');
    });
  });
});

describe('CatalystBranding', () => {
  it('should apply classes to body (feature permanently enabled)', () => {
    render(
      <CatalystBranding />
    );
    
    expect(document.body.classList.contains('catalyst-branding')).toBe(true);
    expect(document.body.classList.contains('catalyst-dark')).toBe(true);
  });

  it('should cleanup classes on unmount', () => {
    const { unmount } = render(
      <CatalystBranding />
    );
    
    expect(document.body.classList.contains('catalyst-branding')).toBe(true);
    expect(document.body.classList.contains('catalyst-dark')).toBe(true);
    
    unmount();
    
    expect(document.body.classList.contains('catalyst-branding')).toBe(false);
    expect(document.body.classList.contains('catalyst-dark')).toBe(false);
  });
});

describe('ErrorBoundary', () => {
  // Component that throws an error
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>No error</div>;
  };

  it('should catch errors and display fallback', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Temporary Error/)).toBeInTheDocument();
    expect(screen.getByText(/Attempting to recover/)).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should use custom fallback when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <ErrorBoundary fallback={<div>Custom Error Message</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should reset when reset button is clicked', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    let shouldThrow = true;
    
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Temporary Error/)).toBeInTheDocument();
    
    // Fix the error
    shouldThrow = false;
    
    // Click reset
    screen.getByText('Reset Now').click();
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should allow recovery through reset button', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Track how many times we've attempted
    let attemptCount = 0;
    
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        attemptCount++;
        throw new Error(`Test error ${attemptCount}`);
      }
      return <div>Working</div>;
    };
    
    // Initial render with error
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // First error - should show temporary error
    expect(screen.getByText(/Temporary Error/)).toBeInTheDocument();
    
    // Reset and fail again
    screen.getByText(/Reset Now/).click();
    attemptCount = 0;
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Second failure after reset - still temporary (errorCount was reset)
    expect(screen.getByText(/Temporary Error/)).toBeInTheDocument();
    
    // Reset and succeed this time
    screen.getByText(/Reset Now/).click();
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    // Should successfully render the child component
    expect(screen.getByText('Working')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  describe('IsolatedErrorBoundary', () => {
    it('should isolate errors to specific components', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <div>
          <IsolatedErrorBoundary componentName="TestComponent">
            <ThrowError shouldThrow={true} />
          </IsolatedErrorBoundary>
          <div data-testid="sibling">Sibling Component</div>
        </div>
      );
      
      expect(screen.getByText(/Temporary Error in TestComponent/)).toBeInTheDocument();
      expect(screen.getByTestId('sibling')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});