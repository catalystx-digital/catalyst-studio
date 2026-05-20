import type { Meta, StoryObj } from '@storybook/react';
import { ContentFeed } from './index';

const meta = {
  title: 'Studio/CMS/Content/ContentFeed',
  component: ContentFeed,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dynamic content feed that queries providers by type/tag/path and supports pinned items, sorting, and list or grid layouts.',
      },
    },
  },
  argTypes: {
    'content.layout': {
      control: 'select',
      options: ['card-grid', 'list'],
      description: 'Layout for rendering the feed items.',
    },
    'content.sorting.field': {
      control: 'select',
      options: ['publishDate', 'updatedAt', 'createdAt'],
      description: 'Sort field applied after pinned items.',
    },
    'content.sorting.direction': {
      control: 'select',
      options: ['asc', 'desc'],
      description: 'Sort direction.',
    },
    theme: {
      control: 'select',
      options: ['auto', 'light', 'dark'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ContentFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleItems = [
  {
    id: 'launch',
    title: 'Product launch hits inboxes',
    summary: 'Highlights from the most recent release with customer stories.',
    href: '/news/product-launch',
    publishDate: '2024-05-12',
    tags: ['Pinned'],
    categories: ['News'],
    image: {
      src: 'https://placehold.co/640x360/png',
      alt: 'Launch placeholder',
    },
  },
  {
    id: 'webinar',
    title: 'Upcoming webinar for editors',
    summary: 'See how automated listings keep resource hubs fresh.',
    href: '/news/webinar',
    publishDate: '2024-05-08',
    categories: ['Events'],
    image: {
      src: 'https://placehold.co/640x360/png',
    },
  },
  {
    id: 'release-notes',
    title: 'Release notes April',
    summary: 'Quality-of-life improvements across the visual editor.',
    href: '/news/release-notes-april',
    publishDate: '2024-04-20',
    categories: ['Product'],
  },
];

export const CardGrid: Story = {
  args: {
    content: {
      heading: 'Latest updates',
      subheading: 'Auto-updating feed powered by your CMS',
      layout: 'card-grid',
      limit: 6,
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['article'], pathPrefix: '/news' },
      pinned: sampleItems,
    },
  },
};

export const List: Story = {
  args: {
    content: {
      heading: 'Auto feed (list)',
      layout: 'list',
      limit: 5,
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['article'], pathPrefix: '/resources' },
      pinned: sampleItems.slice(0, 2),
    },
  },
};

export const Empty: Story = {
  args: {
    content: {
      heading: 'Empty feed',
      layout: 'card-grid',
      limit: 6,
      emptyCopy: 'No items available',
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['article'], pathPrefix: '/news' },
      pinned: [],
    },
  },
};
