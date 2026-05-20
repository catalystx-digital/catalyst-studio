import type { Meta, StoryObj } from '@storybook/react';
import RelatedPosts from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Blog/RelatedPosts',
  component: RelatedPosts,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof RelatedPosts>;

export default meta;
type Story = StoryObj<typeof meta>;

const BASE_ARGS = {
  type: ComponentType.RelatedPosts,
  category: ComponentCategory.Blog,
  id: 'related-posts-default',
  theme: 'auto' as const,
  variant: 'default' as const,
};

const SAMPLE_POSTS = [
  {
    id: '1',
    title: 'How to structure CMS-driven blog posts',
    excerpt:
      'Adopt a modular layout that reuses hero, body, and related content blocks for faster iteration.',
    slug: '/blog/cms-driven-posts',
    href: '/blog/cms-driven-posts',
    publishDate: '2024-05-17',
    readingTime: 6,
    categories: ['Content', 'Guides'],
    ctaLabel: 'Read article',
    author: { name: 'Jamie Lee', avatar: '/images/authors/jamie.jpg' },
    thumbnail: '/images/blog/modular-layouts.jpg',
  },
  {
    id: '2',
    title: 'Optimizing related content signals',
    excerpt:
      'Pair editorial curation with automated signals to keep recommendations on brand.',
    slug: '/blog/related-content',
    href: '/blog/related-content',
    publishDate: '2024-04-22',
    readingTime: 4,
    categories: ['Strategy'],
    author: { name: 'Morgan Patel', avatar: '/images/authors/morgan.jpg' },
    thumbnail: '/images/blog/related-content.jpg',
  },
  {
    id: '3',
    title: 'Improve blog monetization with intelligent CTAs',
    excerpt:
      'Use audience signals to dynamically promote the next best action.',
    slug: '/blog/cta-optimization',
    href: '/blog/cta-optimization',
    publishDate: '2024-03-10',
    readingTime: 5,
    categories: ['Growth'],
    author: { name: 'Alex Murphy' },
    thumbnail: '/images/blog/cta-optimization.jpg',
  },
] as const;

export const Grid: Story = {
  args: {
    ...BASE_ARGS,
    columns: 3,
    content: {
      title: 'Keep reading',
      posts: SAMPLE_POSTS,
      displayMode: 'grid',
      showExcerpt: true,
      showCategories: true,
      showAuthor: true,
      showDate: true,
      showReadingTime: true,
    },
  },
};

export const List: Story = {
  args: {
    ...BASE_ARGS,
    columns: 2,
    content: {
      title: 'Editors recommend',
      posts: SAMPLE_POSTS,
      displayMode: 'list',
      showExcerpt: true,
      showCategories: true,
      showAuthor: true,
      showDate: true,
      selectionMode: 'manual',
    },
  },
};

export const Carousel: Story = {
  args: {
    ...BASE_ARGS,
    content: {
      title: 'More like this',
      posts: SAMPLE_POSTS,
      displayMode: 'carousel',
      showCategories: false,
      showAuthor: false,
      showDate: true,
      relatedBy: 'categories',
    },
  },
};
