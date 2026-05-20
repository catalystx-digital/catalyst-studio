import type { Meta, StoryObj } from '@storybook/react';
import FeatureList from './index';

const meta = {
  title: 'Studio/CMS/Features/FeatureList',
  component: FeatureList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof FeatureList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Key Benefits',
      subheading: 'Why teams choose our platform',
      items: [
        {
          icon: '1',
          title: 'Fast to Launch',
          description: 'Spin up new sites and landing pages in minutes.',
          link: { url: '/benefits/launch' },
          highlighted: true,
          highlightLabel: 'Popular',
        },
        { icon: '2', title: 'Enterprise Ready', description: 'Security, compliance, and governance out of the box.' },
        { icon: '3', title: 'Built for Teams', description: 'Real-time collaboration for designers, marketers, and developers.' }
      ]
    }
  }
};

export const Horizontal: Story = {
  args: {
    content: {
      heading: 'Flexible Plans',
      layout: 'horizontal',
      items: [
        {
          icon: 'S',
          title: 'Starter',
          description: 'Perfect for individuals getting started.',
          link: { text: 'View plan', url: '/pricing/starter' }
        },
        {
          icon: 'G',
          title: 'Growth',
          description: 'Scale campaigns with automation and analytics.',
          link: { text: 'View plan', url: '/pricing/growth' },
          highlighted: true,
          highlightLabel: 'Most popular',
        },
        {
          icon: 'E',
          title: 'Enterprise',
          description: 'Advanced security, SSO, and dedicated support.',
          link: { text: 'Contact sales', url: '/pricing/enterprise' }
        }
      ]
    }
  }
};
