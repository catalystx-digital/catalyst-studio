
import type { Meta, StoryObj } from '@storybook/react';
import CTABanner from './index';

const meta = {
  title: 'Studio/CMS/CTA/CTABanner',
  component: CTABanner,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio call-to-action banner component with configurable headline, buttons, and background styling.'
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CTABanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Ready to get started?',
      subheading: 'Join thousands of teams building faster with Catalyst Studio.',
      primaryButton: {
        text: 'Start Free Trial',
        url: '/signup',
        variant: 'primary'
      },
      secondaryButton: {
        text: 'Talk to Sales',
        url: '/contact',
        variant: 'secondary'
      },
      backgroundColor: 'bg-blue-600'
    }
  }
};

export const LeftAligned: Story = {
  args: {
    content: {
      heading: 'Launch your next campaign',
      subheading: 'Pair world-class visuals with automated workflows and insight-rich reporting.',
      primaryButton: {
        text: 'View Plans',
        url: '/pricing',
        variant: 'primary'
      },
      secondaryButton: {
        text: 'See a Demo',
        url: '/demo',
        variant: 'outline'
      },
      backgroundColor: 'bg-slate-900',
      textColor: 'text-white',
      alignment: 'left'
    }
  }
};

export const Minimal: Story = {
  args: {
    content: {
      heading: 'Build with Catalyst Studio',
      primaryButton: {
        text: 'Get Started',
        url: '/start',
        variant: 'primary'
      },
      backgroundColor: 'bg-neutral-100',
      textColor: 'text-slate-900',
      alignment: 'center'
    }
  }
};
