
import type { Meta, StoryObj } from '@storybook/react';
import CTAButtonGroup from './index';

const meta = {
  title: 'Studio/CMS/CTA/CTAButtonGroup',
  component: CTAButtonGroup,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Studio button group component for rendering multiple call-to-action buttons with flexible alignment and orientation.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CTAButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Experience the full platform',
      subheading: 'Choose the action that best fits your workflow.',
      buttons: [
        { text: 'Start Free Trial', url: '/start', variant: 'primary' },
        { text: 'Talk to Sales', url: '/contact', variant: 'secondary' },
      ],
      alignment: 'center',
      spacing: 'normal',
    },
  },
};

export const VerticalStack: Story = {
  args: {
    content: {
      heading: 'Download resources',
      subheading: 'Access guides, briefs, and detailed documentation.',
      buttons: [
        { text: 'Product Overview', url: '/resources/overview', variant: 'primary' },
        { text: 'Implementation Guide', url: '/resources/guide', variant: 'neutral' },
        { text: 'Security Brief', url: '/resources/security', variant: 'outline' },
      ],
      orientation: 'vertical',
      fullWidthOnMobile: true,
      alignment: 'left',
      spacing: 'loose',
    },
  },
};

export const WithIcons: Story = {
  args: {
    content: {
      heading: 'Stay in the loop',
      subheading: 'Track releases or request early access.',
      buttons: [
        { text: 'Request Access', url: '/request', variant: 'accent', icon: '[lock]' },
        {
          text: 'View Changelog',
          url: '/changelog',
          variant: 'ghost',
          icon: '[note]',
          iconPosition: 'right',
        },
      ],
      alignment: 'center',
      spacing: 'tight',
    },
  },
};
