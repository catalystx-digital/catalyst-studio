import type { Meta, StoryObj } from '@storybook/react';
import FeatureComparison from './index';

const meta = {
  title: 'Studio/CMS/Features/FeatureComparison',
  component: FeatureComparison,
  parameters: { 
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio feature comparison component for comparing products or plans side by side.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Feature comparison content configuration',
      control: 'object'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeatureComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Compare Our Plans',
      subheading: 'Choose the perfect plan for your needs',
      products: [
        {
          name: 'Basic',
          price: '$9/month',
          cta: {
            text: 'Get Started',
            url: '/signup/basic'
          }
        },
        {
          name: 'Professional',
          price: '$29/month',
          recommended: true,
          cta: {
            text: 'Get Started',
            url: '/signup/pro'
          }
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          cta: {
            text: 'Contact Sales',
            url: '/contact'
          }
        }
      ],
      features: [
        {
          name: 'Users',
          description: 'Number of team members',
          values: ['5', '50', 'Unlimited']
        },
        {
          name: 'Storage',
          description: 'Cloud storage space',
          values: ['10 GB', '100 GB', '1 TB']
        },
        {
          name: 'Projects',
          description: 'Active projects',
          values: ['10', '100', 'Unlimited']
        },
        {
          name: 'API Access',
          values: [false, true, true]
        },
        {
          name: 'Custom Domain',
          values: [false, true, true]
        },
        {
          name: 'Priority Support',
          values: [false, true, true]
        },
        {
          name: 'SSO',
          values: [false, false, true]
        },
        {
          name: 'SLA',
          values: ['—', '99.9%', '99.99%']
        }
      ]
    }
  }
};

export const BooleanComparison: Story = {
  args: {
    content: {
      heading: 'Feature Availability',
      products: [
        { name: 'Free' },
        { name: 'Pro', recommended: true },
        { name: 'Business' }
      ],
      features: [
        {
          name: 'Basic Features',
          values: [true, true, true]
        },
        {
          name: 'Advanced Analytics',
          values: [false, true, true]
        },
        {
          name: 'Team Collaboration',
          values: [false, true, true]
        },
        {
          name: 'White Label',
          values: [false, false, true]
        },
        {
          name: 'Custom Integrations',
          values: [false, false, true]
        }
      ]
    }
  }
};