import type { Meta, StoryObj } from '@storybook/react';
import LogoStrip from './index';

const meta = {
  title: 'Studio/CMS/SocialProof/LogoStrip',
  component: LogoStrip,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof LogoStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_LOGOS = [
  {
    id: 'figma',
    src: 'https://dummyimage.com/160x48/111827/ffffff.png&text=Figma',
    alt: 'Figma',
    caption: 'Product design partner',
  },
  {
    id: 'notion',
    src: 'https://dummyimage.com/160x48/1f2937/ffffff.png&text=Notion',
    alt: 'Notion',
    caption: 'Workspace collaboration',
  },
  {
    id: 'vercel',
    src: 'https://dummyimage.com/160x48/0f172a/ffffff.png&text=Vercel',
    alt: 'Vercel',
  },
  {
    id: 'stripe',
    src: 'https://dummyimage.com/160x48/0b1120/ffffff.png&text=Stripe',
    alt: 'Stripe',
    link: 'https://stripe.com',
    caption: 'Payments infrastructure',
  },
] as const;

export const Default: Story = {
  args: {
    content: {
      logos: SAMPLE_LOGOS,
      caption: 'Trusted by <strong>leading</strong> platform partners',
      grayscale: true,
      animateScroll: false,
      size: 'medium',
    },
  },
};

export const Scrolling: Story = {
  args: {
    content: {
      logos: [...SAMPLE_LOGOS, ...SAMPLE_LOGOS],
      animateScroll: true,
      grayscale: false,
      size: 'small',
    },
  },
};
