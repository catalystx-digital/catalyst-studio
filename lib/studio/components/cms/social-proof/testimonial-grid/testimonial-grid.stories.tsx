import type { Meta, StoryObj } from '@storybook/react';
import TestimonialGrid from './index';

const meta = {
  title: 'Studio/CMS/SocialProof/TestimonialGrid',
  component: TestimonialGrid,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof TestimonialGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      items: []
    }
  }
};
