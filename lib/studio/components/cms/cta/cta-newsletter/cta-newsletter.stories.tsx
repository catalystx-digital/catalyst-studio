import type { Meta, StoryObj } from '@storybook/react';
import CTANewsletter from './index';

const meta = {
  title: 'Studio/CMS/CTA/CTANewsletter',
  component: CTANewsletter,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio newsletter signup component with various layouts and form configurations.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Newsletter CTA content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CTANewsletter>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default newsletter
export const Default: Story = {
  args: {
    content: {
      heading: 'Subscribe to Our Newsletter',
      description: 'Get the latest updates delivered directly to your inbox.',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
      successMessage: 'Thank you for subscribing!',
      errorMessage: 'Please enter a valid email address.'
    }
  }
};

// With name field
export const WithNameField: Story = {
  args: {
    content: {
      heading: 'Join Our Community',
      description: 'Stay informed about our latest news and exclusive offers.',
      fields: [
        {
          type: 'text',
          name: 'name',
          placeholder: 'Your name',
          required: true
        },
        {
          type: 'email',
          name: 'email',
          placeholder: 'Your email',
          required: true
        }
      ],
      buttonText: 'Join Now',
      successMessage: 'Welcome to our community!'
    }
  }
};

// With preferences
export const WithPreferences: Story = {
  args: {
    content: {
      heading: 'Customize Your Newsletter',
      description: 'Choose what content you\'d like to receive.',
      placeholder: 'Enter your email',
      preferences: [
        { label: 'Product Updates', value: 'products', defaultChecked: true },
        { label: 'Blog Posts', value: 'blog', defaultChecked: true },
        { label: 'Special Offers', value: 'offers', defaultChecked: false },
        { label: 'Event Invitations', value: 'events', defaultChecked: false }
      ],
      buttonText: 'Subscribe',
      successMessage: 'Your preferences have been saved!'
    }
  }
};

// Inline layout
export const InlineLayout: Story = {
  args: {
    content: {
      heading: 'Stay Updated',
      placeholder: 'Your email address',
      buttonText: 'Subscribe',
      layout: 'inline',
      successMessage: 'Subscribed successfully!'
    }
  }
};

// Centered layout
export const CenteredLayout: Story = {
  args: {
    content: {
      heading: 'Don\'t Miss Out',
      description: 'Join 50,000+ subscribers getting exclusive content weekly.',
      placeholder: 'Enter your email',
      buttonText: 'Get Access',
      layout: 'centered',
      successMessage: 'Check your email to confirm subscription!'
    }
  }
};

// With social proof
export const WithSocialProof: Story = {
  args: {
    content: {
      heading: 'Join 100,000+ Subscribers',
      description: 'Get weekly insights from industry experts.',
      placeholder: 'Your email',
      buttonText: 'Subscribe',
      socialProof: {
        avatars: [
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI2ZmNjM2MyIvPjwvc3ZnPg==',
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzYzZmY5MCIvPjwvc3ZnPg==',
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzYzOTBmZiIvPjwvc3ZnPg=='
        ],
        text: 'Join thousands of happy subscribers'
      },
      successMessage: 'Welcome aboard!'
    }
  }
};

// With benefits
export const WithBenefits: Story = {
  args: {
    content: {
      heading: 'Get Exclusive Content',
      description: 'Subscribe for studio insights and resources.',
      benefits: [
        '✓ Weekly industry reports',
        '✓ Exclusive discounts',
        '✓ Early access to features',
        '✓ Free resources'
      ],
      placeholder: 'Your email',
      buttonText: 'Get Started',
      successMessage: 'You\'re all set!'
    }
  }
};

// With privacy notice
export const WithPrivacyNotice: Story = {
  args: {
    content: {
      heading: 'Newsletter Signup',
      description: 'Get updates about our products and services.',
      placeholder: 'Email address',
      buttonText: 'Subscribe',
      privacyNotice: 'We respect your privacy. Unsubscribe at any time.',
      privacyLink: '/privacy',
      successMessage: 'Subscription confirmed!'
    }
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      heading: 'Stay in the Loop',
      description: 'Never miss an update from our team.',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
      theme: 'dark',
      successMessage: 'Thanks for subscribing!'
    },
    className: 'bg-gray-900 text-white p-8 rounded-lg'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
};

// With frequency options
export const WithFrequencyOptions: Story = {
  args: {
    content: {
      heading: 'Choose Your Email Frequency',
      description: 'How often would you like to hear from us?',
      placeholder: 'Your email',
      frequencyOptions: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' }
      ],
      defaultFrequency: 'weekly',
      buttonText: 'Subscribe',
      successMessage: 'Preferences saved!'
    }
  }
};

// Minimal style
export const Minimal: Story = {
  args: {
    content: {
      placeholder: 'Your email',
      buttonText: '→',
      variant: 'minimal',
      successMessage: 'Subscribed!'
    }
  }
};