import type { Meta, StoryObj } from '@storybook/react';
import BlogCard from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Blog/BlogCard',
  component: BlogCard,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof BlogCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'blogcard-1',
    type: ComponentType.BlogCard,
    category: ComponentCategory.Blog,
    content: {
      title: 'How to build a beautiful marketing site',
      excerpt: 'Learn how Catalyst Studio helps teams ship blazing-fast headless marketing sites powered by shadcn/ui components.',
      slug: '/blog/build-a-beautiful-site',
      author: {
        name: 'Jane Smith',
        avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=80&q=80',
      },
      publishDate: '2024-01-20',
      categories: ['Product', 'Design'],
      tags: ['marketing', 'design systems'],
      thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1280&q=80',
      featured: true,
      readingTime: 6,
      views: 320,
      likes: 24,
      comments: 12,
    },
    showStats: true,
  }
};

export const ListLayout: Story = {
  args: {
    ...Default.args,
    id: 'blogcard-list-view',
    layout: 'list',
  },
};
