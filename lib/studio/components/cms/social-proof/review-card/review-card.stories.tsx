import type { Meta, StoryObj } from '@storybook/react';
import ReviewCard from './index';

const meta = {
  title: 'Studio/CMS/SocialProof/ReviewCard',
  component: ReviewCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Studio review card component for showcasing customer feedback with rating, verification, and helpful interactions.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ReviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const BASE_CONTENT = {
  author: 'Priya Desai',
  rating: 4.7,
  reviewText:
    'Catalyst helped us consolidate regional landing pages in weeks instead of quarters. The reusable CMS components made approvals painless.',
  date: '2024-01-15T00:00:00.000Z',
  verified: true,
};

export const Default: Story = {
  args: {
    content: BASE_CONTENT,
    theme: 'auto',
  },
};

export const WithPlatformAndHelpful: Story = {
  args: {
    content: {
      ...BASE_CONTENT,
      platform: 'trustpilot',
      helpful: { yes: 58, no: 2 },
    },
    theme: 'auto',
  },
};

export const DarkTheme: Story = {
  args: {
    content: {
      ...BASE_CONTENT,
      platformName: 'Custom Platform',
      platformLogo: 'https://dummyimage.com/64x24/0f172a/ffffff.png&text=CP',
    },
    theme: 'dark',
  },
};
