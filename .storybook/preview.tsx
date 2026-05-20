import type { Preview } from '@storybook/nextjs'
import React from 'react'
import { performanceMonitor } from '../lib/studio/components/cms/_core/monitoring'
import '../app/globals.css'

// Decorator for studio components
const withPerformanceMonitoring = (Story: any) => {
  React.useEffect(() => {
    // Setup performance monitoring for Storybook
    performanceMonitor.setThresholds({
      renderTime: 50,
      mountTime: 100,
      bundleSize: 10240,
      memoryUsage: 5242880
    });

    // Log performance alerts in development
    if (process.env.NODE_ENV === 'development') {
      performanceMonitor.onAlert((alert) => {
        console.warn('Storybook Performance Alert:', alert);
      });
    }
  }, []);

  return <Story />;
};

// Decorator for theme support
const withTheme = (Story: any, context: any) => {
  const theme = context.globals.theme || 'light';
  
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    // Studio component categorization
    options: {
      storySort: {
        order: [
          'Studio',
          ['CMS', [
            'Navigation',
            'Heroes',
            'Content',
            'Features',
            'CTA',
            'Social Proof',
            'Contact',
            'About',
            'Blog',
            'Pricing',
            'Data'
          ]],
          'Documentation',
          'Examples'
        ],
      },
    },
    // Viewport addon configuration
    viewport: {
      options: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        laptop: {
          name: 'Laptop',
          styles: {
            width: '1366px',
            height: '768px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
    // A11y addon configuration
    a11y: {
      context: '#storybook-root',
      config: {},
      options: {},
      manual: false,
    },
  },
  decorators: [withPerformanceMonitoring, withTheme],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Component theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: ['light', 'dark', 'auto'],
        showName: true,
      },
    },
  },
};

export default preview;