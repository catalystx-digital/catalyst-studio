import type { Meta, StoryObj } from '@storybook/react';
import ArticleHeader from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Blog/ArticleHeader',
  component: ArticleHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ArticleHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'articleheader-1',
    type: ComponentType.ArticleHeader,
    category: ComponentCategory.Blog,
    content: {
      title: 'Designing for the Modern Web',
      subtitle: 'Building resilient design systems with Tailwind and shadcn/ui',
      author: {
        name: 'Jamie Rivera',
        title: 'Director of Product Design',
        avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=200&q=80'
      },
      publishDate: '2024-02-10',
      updatedDate: '2024-03-04',
      readingTime: 8,
      categories: ['Design Systems', 'Accessibility'],
      tags: ['design', 'tokens', 'components'],
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/blog' },
        { label: 'Design', href: '/blog/design' }
      ],
      featuredImage: {
        src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
        alt: 'Designers collaborating at a table',
        caption: 'Collaboration is essential when iterating on complex systems.',
        credit: 'Photo by UX Designers Collective'
      }
    }
  }
};
