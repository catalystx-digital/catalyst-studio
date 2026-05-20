import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from './index';

const meta = {
  title: 'Studio/CMS/Content/Accordion',
  component: Accordion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio accordion component for collapsible content sections. Features smooth animations, multiple expansion modes, and full accessibility support.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Accordion content configuration',
      control: 'object'
    }
  }
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample FAQ items
const faqItems = [
  {
    id: '1',
    title: 'What is your return policy?',
    content: 'We offer a 30-day money-back guarantee on all products. If you are not satisfied with your purchase, you can return it for a full refund within 30 days of delivery.'
  },
  {
    id: '2',
    title: 'How long does shipping take?',
    content: 'Standard shipping typically takes 5-7 business days. Express shipping is available for 2-3 business day delivery. International shipping times vary by location.'
  },
  {
    id: '3',
    title: 'Do you offer international shipping?',
    content: 'Yes, we ship to over 100 countries worldwide. Shipping costs and delivery times vary based on your location. You can see the exact costs at checkout.'
  },
  {
    id: '4',
    title: 'How can I track my order?',
    content: 'Once your order ships, you will receive an email with tracking information. You can also track your order by logging into your account on our website.'
  },
  {
    id: '5',
    title: 'What payment methods do you accept?',
    content: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, Apple Pay, and Google Pay. All transactions are secure and encrypted.'
  }
];

// Default story
export const Default: Story = {
  args: {
    content: {
      items: faqItems
    }
  }
};

// With multiple items open
export const AllowMultiple: Story = {
  args: {
    content: {
      items: faqItems,
      allowMultiple: true
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Allows multiple accordion items to be expanded simultaneously.'
      }
    }
  }
};

// Product features accordion
export const ProductFeatures: Story = {
  args: {
    content: {
      items: [
        {
          id: 'perf-1',
          title: 'Performance Optimizations',
          content: 'Our platform is built with performance in mind. We use advanced caching strategies, lazy loading, and code splitting to ensure lightning-fast load times. Content delivered from 200+ edge locations worldwide.'
        },
        {
          id: 'sec-1',
          title: 'Security Features',
          content: 'Enterprise-grade security with end-to-end encryption, SOC2 compliance, and regular security audits. Your data is protected with industry-leading security standards.'
        },
        {
          id: 'analytics-1',
          title: 'Analytics Dashboard',
          content: 'Comprehensive analytics to track user engagement, conversion rates, and content performance. Real-time insights help you make data-driven decisions.'
        },
        {
          id: 'integration-1',
          title: 'Integration Options',
          content: 'Seamlessly integrate with your existing tools. We support REST APIs, webhooks, and native integrations with popular platforms like Slack, Salesforce, and Microsoft Teams.'
        }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Accordion showcasing product features with detailed descriptions.'
      }
    }
  }
};

// Documentation/Help section
export const Documentation: Story = {
  args: {
    content: {
      items: [
        {
          id: 'doc-1',
          title: 'Getting Started',
          content: `
            <h4>Quick Start Guide</h4>
            <ol>
              <li>Install the package using npm or yarn</li>
              <li>Import the components you need</li>
              <li>Configure your environment variables</li>
              <li>Start building!</li>
            </ol>
            <p>For detailed instructions, check our documentation.</p>
          `
        },
        {
          id: 'doc-2',
          title: 'API Reference',
          content: `
            <h4>Available Endpoints</h4>
            <ul>
              <li><code>GET /api/users</code> - List all users</li>
              <li><code>POST /api/users</code> - Create new user</li>
              <li><code>PUT /api/users/:id</code> - Update user</li>
              <li><code>DELETE /api/users/:id</code> - Delete user</li>
            </ul>
          `
        },
        {
          id: 'doc-3',
          title: 'Troubleshooting',
          content: `
            <h4>Common Issues</h4>
            <p><strong>Build fails:</strong> Clear your cache and reinstall dependencies.</p>
            <p><strong>Styles not loading:</strong> Ensure CSS imports are correct.</p>
            <p><strong>API errors:</strong> Check your environment variables.</p>
          `
        }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Accordion used for documentation with HTML content and code examples.'
      }
    }
  }
};

// Disabled items
export const WithDisabledItems: Story = {
  args: {
    content: {
      items: [
        {
          id: 'feat-1',
          title: 'Available Feature',
          content: 'This feature is currently available and can be expanded.'
        },
        {
          id: 'feat-2',
          title: 'Coming Soon',
          content: 'This feature will be available in the next release.'
        },
        {
          id: 'feat-3',
          title: 'Studio Feature',
          content: 'Upgrade to studio to access this feature.'
        },
        {
          id: 'feat-4',
          title: 'Another Available Feature',
          content: 'This is another feature that is currently available.'
        }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Some accordion items can be disabled to prevent user interaction.'
      }
    }
  }
};

// Loading state
export const LoadingState: Story = {
  args: {
    content: {
      items: [],
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows skeleton loading state while content is being fetched.'
      }
    }
  }
};

// Mixed loading state - some items loading
export const PartialLoadingState: Story = {
  args: {
    content: {
      items: [
        {
          id: 'partial-1',
          title: 'Loaded Feature',
          content: 'This content has been successfully loaded and is ready for viewing.'
        },
        {
          id: 'partial-2',
          title: 'Loading...',
          content: 'Loading content...',
            },
        {
          id: 'partial-3',
          title: 'Another Loaded Feature',
          content: 'This feature is also loaded and available for interaction.'
        },
        {
          id: 'partial-4',
          title: 'Loading...',
          content: 'Loading content...',
            },
        {
          id: 'partial-5',
          title: 'Final Loaded Feature',
          content: 'All features are loading progressively. This one is ready!'
        }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows mixed state where some accordion items are loading while others are ready.'
      }
    }
  }
};

// Empty state
export const EmptyState: Story = {
  args: {
    content: {
      items: []
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Displays a custom message when there are no accordion items.'
      }
    }
  }
};

// Error state
export const ErrorState: Story = {
  args: {
    content: {
      items: []
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows an error message when content fails to load.'
      }
    }
  }
};

// Skeleton loading animation
export const SkeletonLoading: Story = {
  args: {
    content: {
      items: [
        {
          id: 'skeleton-1',
          title: '████████████████',
          content: '████████████████████████████████████████████████',
            },
        {
          id: 'skeleton-2',
          title: '██████████████████████',
          content: '██████████████████████████████████████████████████████████',
            },
        {
          id: 'skeleton-3',
          title: '████████████',
          content: '████████████████████████████████████████',
            }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows skeleton placeholders with loading animation for better user experience during data fetching.'
      }
    }
  }
};