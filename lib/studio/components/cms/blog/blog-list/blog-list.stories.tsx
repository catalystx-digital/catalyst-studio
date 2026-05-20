import type { Meta, StoryObj } from '@storybook/react';
import BlogList from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Blog/BlogList',
  component: BlogList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof BlogList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: ComponentType.BlogList,
    category: ComponentCategory.Blog,
    id: 'blog-list-default',
    content: {
      title: 'Latest content from the Catalyst team',
      description: 'Fresh tutorials, release notes, and customer success stories covering Catalyst Studio and the studio component library.',
      showFilters: true,
      viewMode: 'grid',
      columns: 3,
      postsPerPage: 6,
      posts: [
        {
          id: '1',
          slug: '/blog/building-aheadless-studio',
          title: 'Building a headless experience editor with Catalyst Studio',
          excerpt: 'A behind-the-scenes look at how we combined Prisma, shadcn/ui, and Catalyst tokens to deliver a best-in-class authoring flow.',
          author: { name: 'Alex Johnson' },
          publishDate: '2024-01-01',
          readingTime: 8,
          categories: ['Engineering', 'Product'],
          tags: ['cms', 'headless'],
          thumbnail: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=1280&q=80',
          views: 420,
          likes: 38,
        },
        {
          id: '2',
          slug: '/blog/design-tokens-in-production',
          title: 'Design tokens in production: lessons from Catalyst Studio',
          excerpt: 'Learn how our Tailwind plugin keeps marketing sites, exports, and in-app UI perfectly in sync.',
          author: { name: 'Priya Desai' },
          publishDate: '2024-02-14',
          readingTime: 6,
          categories: ['Design'],
          tags: ['design systems', 'tokens'],
          thumbnail: 'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=1280&q=80',
          views: 280,
          likes: 19,
        },
        {
          id: '3',
          slug: '/blog/performance-checklist',
          title: 'The Catalyst performance checklist for lightning-fast exports',
          excerpt: 'A zero-fluff checklist you can run on every export build to certify Core Web Vitals and accessibility.',
          author: { name: 'Taylor Lee' },
          publishDate: '2024-03-10',
          readingTime: 5,
          categories: ['Performance'],
          tags: ['nextjs', 'best practices'],
          thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
          views: 190,
          likes: 12,
        },
      ],
    }
  }
};

export const ListView: Story = {
  args: {
    ...Default.args,
    id: 'blog-list-list-view',
    content: {
      ...(Default.args?.content ?? {}),
      viewMode: 'list',
      columns: 2,
    },
  },
};
