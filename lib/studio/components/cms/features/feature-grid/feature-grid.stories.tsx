import type { Meta, StoryObj } from '@storybook/react';
import FeatureGrid from './index';

const meta = {
  title: 'Studio/CMS/Features/FeatureGrid',
  component: FeatureGrid,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio feature grid component for displaying features in a grid layout.'
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeatureGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Our Features',
      subheading: 'Highlight the strongest parts of your product with rich cards and built-in analytics hooks.',
      features: [
        { 
          icon: '🚀', 
          title: 'Fast Performance', 
          description: 'Lightning fast load times that scale with your audience.', 
          link: { text: 'Explore metrics', url: '/features/performance' },
          highlighted: true,
          highlightLabel: 'Popular'
        },
        { 
          icon: '🔒', 
          title: 'Secure', 
          description: 'Enterprise-grade security backed by zero-trust defaults.',
          link: { text: 'See security playbook', url: '/features/security' }
        },
        { 
          icon: '📱', 
          title: 'Mobile Ready',
          description: 'Works on every device with responsive tokens applied.',
          link: { url: '/features/mobile' }
        },
        { 
          icon: '🎨',
          title: 'Customizable', 
          description: 'Fully customizable design system alignment.',
          media: { src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80', alt: 'Design collaboration' }
        }
      ],
      columns: 2
    }
  }
};

export const ThreeColumns: Story = {
  args: {
    content: {
      heading: 'Why teams trust Catalyst',
      features: [
        { icon: '⚡', title: 'Speed', description: 'Ultra-fast processing' },
        { icon: '🛡️', title: 'Security', description: 'Bank-level encryption' },
        { icon: '🌍', title: 'Global', description: 'Available worldwide' },
        { icon: '📊', title: 'Analytics', description: 'Detailed insights' },
        { icon: '🤝', title: 'Support', description: '24/7 customer service' },
        { icon: '🔄', title: 'Updates', description: 'Regular improvements' }
      ],
      columns: 3
    }
  }
};
