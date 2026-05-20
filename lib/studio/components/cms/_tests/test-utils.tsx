import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ComponentType, CMSComponentProps } from '../_core/types';
import { performanceMonitor } from '../_core/monitoring';

// ============================================================================
// Custom Render Function
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: 'light' | 'dark' | 'auto' | 'inverted';
  viewport?: { width: number; height: number };
  mockPerformance?: boolean;
}

export const renderCMSComponent = (
  ui: React.ReactElement,
  options?: CustomRenderOptions
): RenderResult & { performanceMetrics?: any } => {
  const {
    theme = 'auto',
    viewport,
    mockPerformance = true,
    ...renderOptions
  } = options || {};

  // Set viewport if specified
  if (viewport) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: viewport.width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: viewport.height,
    });
  }

  // Mock performance monitoring if needed
  let performanceMetrics: any = null;
  if (mockPerformance) {
    jest.spyOn(performanceMonitor, 'trackComponentRender').mockImplementation(
      (type, renderTime, additional) => {
        performanceMetrics = { type, renderTime, ...additional };
      }
    );
  }

  // Wrapper component with theme
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    React.useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, [theme]);

    const wrapperClass =
      theme === 'dark' || theme === 'light'
        ? `cms-test-wrapper theme-${theme}`
        : theme === 'inverted'
          ? 'cms-test-wrapper theme-inverted'
          : 'cms-test-wrapper';

    return <div className={wrapperClass}>{children}</div>;
  };

  const result = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  return {
    ...result,
    performanceMetrics,
  };
};

// ============================================================================
// Component Test Factory
// ============================================================================

export class ComponentTestFactory {
  private componentType: ComponentType;
  private defaultProps: CMSComponentProps;

  constructor(componentType: ComponentType, defaultProps: CMSComponentProps) {
    this.componentType = componentType;
    this.defaultProps = defaultProps;
  }

  /**
   * Test all component variants
   */
  testAllVariants(
    Component: React.ComponentType<CMSComponentProps>,
    variants: string[] = ['default', 'minimal', 'detailed', 'compact', 'expanded']
  ) {
    describe(`${this.componentType} variants`, () => {
      variants.forEach(variant => {
        it(`renders ${variant} variant correctly`, () => {
          const { container } = renderCMSComponent(
            <Component {...this.defaultProps} variant={variant as any} />
          );
          expect(container.querySelector(`.cms-${this.componentType}--${variant}`))
            .toBeInTheDocument();
        });
      });
    });
  }

  /**
   * Test component themes
   */
  testThemes(Component: React.ComponentType<CMSComponentProps>) {
    describe(`${this.componentType} themes`, () => {
      ['light', 'dark', 'auto', 'inverted'].forEach(theme => {
        it(`renders with ${theme} theme`, () => {
          const { container } = renderCMSComponent(
            <Component {...this.defaultProps} theme={theme as any} />,
            { theme: theme as any }
          );
          
          if (theme === 'dark') {
            expect(container.querySelector('.dark')).toBeInTheDocument();
          }
        });
      });
    });
  }

  /**
   * Test responsive behavior
   */
  testResponsiveness(Component: React.ComponentType<CMSComponentProps>) {
    describe(`${this.componentType} responsiveness`, () => {
      const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 },
      ];

      viewports.forEach(viewport => {
        it(`renders correctly on ${viewport.name}`, () => {
          const { container } = renderCMSComponent(
            <Component {...this.defaultProps} />,
            { viewport }
          );
          
          expect(container.querySelector(`.cms-${this.componentType}`))
            .toBeInTheDocument();
        });
      });
    });
  }

  /**
   * Test performance metrics
   */
  testPerformance(
    Component: React.ComponentType<CMSComponentProps>,
    maxRenderTime = 50
  ) {
    describe(`${this.componentType} performance`, () => {
      it(`renders within ${maxRenderTime}ms`, () => {
        const startTime = performance.now();
        
        renderCMSComponent(
          <Component {...this.defaultProps} />
        );
        
        const renderTime = performance.now() - startTime;
        expect(renderTime).toBeLessThan(maxRenderTime);
      });

      it('tracks performance metrics', () => {
        const { performanceMetrics } = renderCMSComponent(
          <Component {...this.defaultProps} />
        );
        
        expect(performanceMetrics).toBeDefined();
        expect(performanceMetrics?.type).toBe(this.componentType);
      });
    });
  }

  /**
   * Test accessibility
   */
  testAccessibility(Component: React.ComponentType<CMSComponentProps>) {
    describe(`${this.componentType} accessibility`, () => {
      it('has proper ARIA attributes', () => {
        const { container } = renderCMSComponent(
          <Component
            {...this.defaultProps}
            aiMetadata={{
              keywords: [],
              patterns: [],
              commonNames: [],
              pageLocation: ['main'],
              confidence: 0.9,
              accessibility: {
                role: 'region',
                ariaLabel: 'Test region',
                ariaDescribedBy: 'test-description',
              },
            }}
          />
        );
        
        const element = container.querySelector(`.cms-${this.componentType}`);
        expect(element).toHaveAttribute('role', 'region');
        expect(element).toHaveAttribute('aria-label', 'Test region');
        expect(element).toHaveAttribute('aria-describedby', 'test-description');
      });

      it('is keyboard navigable', () => {
        const { container } = renderCMSComponent(
          <Component {...this.defaultProps} interactive />
        );
        
        const element = container.querySelector(`.cms-${this.componentType}`);
        expect(element).toBeTruthy();
        // Additional keyboard navigation tests would go here
      });
    });
  }

  /**
   * Run all standard tests
   */
  runStandardTests(Component: React.ComponentType<CMSComponentProps>) {
    this.testAllVariants(Component);
    this.testThemes(Component);
    this.testResponsiveness(Component);
    this.testPerformance(Component);
    this.testAccessibility(Component);
  }
}

// ============================================================================
// Snapshot Testing Utilities
// ============================================================================

export const testComponentSnapshots = (
  Component: React.ComponentType<CMSComponentProps>,
  props: CMSComponentProps,
  scenarios: Array<{ name: string; props?: Partial<CMSComponentProps> }>
) => {
  describe('Snapshot tests', () => {
    scenarios.forEach(scenario => {
      it(`matches snapshot: ${scenario.name}`, () => {
        const { container } = renderCMSComponent(
          <Component {...props} {...(scenario.props || {})} />
        );
        expect(container.firstChild).toMatchSnapshot();
      });
    });
  });
};

// ============================================================================
// Integration Testing Utilities
// ============================================================================

export const testComponentIntegration = async (
  Component: React.ComponentType<CMSComponentProps>,
  props: CMSComponentProps,
  otherComponents: Array<{
    Component: React.ComponentType<CMSComponentProps>;
    props: CMSComponentProps;
  }>
) => {
  const { container } = renderCMSComponent(
    <div>
      <Component {...props} />
      {otherComponents.map((other, index) => (
        <other.Component key={index} {...other.props} />
      ))}
    </div>
  );

  // Test that all components rendered
  expect(container.querySelectorAll('[data-component-type]').length)
    .toBe(otherComponents.length + 1);

  // Additional integration tests would go here
  return container;
};

// ============================================================================
// Mock Data Generators
// ============================================================================

export const generateMockContent = (type: ComponentType): any => {
  const contentMap: Record<string, any> = {
    navbar: {
      heading: 'Main Navigation',
      links: [
        { label: 'Home', url: '/' },
        { label: 'About', url: '/about' },
        { label: 'Services', url: '/services' },
        { label: 'Contact', url: '/contact' },
      ],
    },
    'hero-simple': {
      heading: 'Welcome to Our Site',
      subheading: 'Discover amazing features',
      body: 'Start your journey with us today.',
      link: '/get-started',
    },
    'feature-grid': {
      heading: 'Our Features',
      features: [
        { title: 'Feature 1', description: 'Description 1' },
        { title: 'Feature 2', description: 'Description 2' },
        { title: 'Feature 3', description: 'Description 3' },
      ],
    },
    // Add more content types as needed
  };

  return contentMap[type] || {
    heading: 'Default Heading',
    subheading: 'Default Subheading',
    body: 'Default body content',
  };
};

// ============================================================================
// Export All Utilities
// ============================================================================

export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
