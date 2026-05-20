import type { Meta, StoryObj } from '@storybook/react';
import ImageGallery from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Content/ImageGallery',
  component: ImageGallery,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Responsive image gallery supporting grid, masonry, and carousel displays with lightbox support and captions.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ImageGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  id: 'image-gallery-story',
  type: ComponentType.ImageGallery,
  category: ComponentCategory.Content,
} as const;

const placeholder = (label: string) =>
  `https://dummyimage.com/1200x800/0f172a/ffffff&text=${encodeURIComponent(label)}`;

const gridImages = [
  {
    url: placeholder('Studio Lobby'),
    alt: 'Lobby view with collaborative workspace',
    caption: 'Collaborative workspace with natural light',
    width: 1200,
    height: 800,
  },
  {
    url: placeholder('Research Lab'),
    alt: 'Research lab with designers planning',
    caption: 'Product research lab at Catalyst',
    width: 1000,
    height: 1400,
  },
  {
    url: placeholder('Workshop'),
    alt: 'Workshop session with sketches',
    caption: 'Sketching concepts during a workshop',
    width: 1200,
    height: 800,
  },
  {
    url: placeholder('Launch'),
    alt: 'Launch event with large screen',
    caption: 'Campaign launch event in the theatre',
    width: 1600,
    height: 900,
  },
  {
    url: placeholder('Brand Wall'),
    alt: 'Brand wall with client logos',
    caption: 'Brands we collaborate with globally',
    width: 1000,
    height: 1400,
  },
  {
    url: placeholder('Studio Lounge'),
    alt: 'Studio lounge with teams collaborating',
    caption: 'Creative lounge room for breakout sessions',
    width: 1200,
    height: 800,
  },
];

const carouselImages = [
  {
    url: placeholder('Preview 01'),
    alt: 'Campaign preview number one',
    caption: 'Campaign preview highlighting hero experience',
    width: 1920,
    height: 1080,
  },
  {
    url: placeholder('Preview 02'),
    alt: 'Campaign preview number two',
    caption: 'In-app editor workflow with comments',
    width: 1920,
    height: 1080,
  },
  {
    url: placeholder('Preview 03'),
    alt: 'Campaign preview number three',
    caption: 'Analytics dashboard comparing performance',
    width: 1920,
    height: 1080,
  },
];

export const Grid: Story = {
  args: {
    ...baseArgs,
    content: {
      heading: 'Inside the Catalyst Studio',
      subheading: 'Snapshots from client workshops and product launches.',
      images: gridImages,
      displayMode: 'grid',
      columns: 3,
      spacing: 'normal',
      showCaptions: true,
      enableLightbox: true,
    },
  },
};

export const Masonry: Story = {
  args: {
    ...baseArgs,
    content: {
      heading: 'Masonry Inspiration',
      images: gridImages,
      displayMode: 'masonry',
      columns: 3,
      spacing: 'tight',
      showCaptions: true,
      enableLightbox: true,
    },
  },
};

export const Carousel: Story = {
  args: {
    ...baseArgs,
    content: {
      heading: 'Campaign Preview Carousel',
      subheading: 'Swipe through the latest omni-channel experience concepts.',
      images: carouselImages,
      displayMode: 'carousel',
      showCaptions: true,
      autoPlay: true,
      autoPlayInterval: 4000,
      enableLightbox: false,
    },
  },
};

export const CompactGridNoCaptions: Story = {
  args: {
    ...baseArgs,
    content: {
      images: gridImages.slice(0, 4),
      displayMode: 'grid',
      columns: 2,
      spacing: 'tight',
      showCaptions: false,
      enableLightbox: false,
    },
  },
};

export const DarkTheme: Story = {
  args: {
    ...baseArgs,
    theme: 'dark',
    content: {
      heading: 'Studio Moments',
      subheading: 'Captured in low light and late-night standups.',
      images: gridImages,
      displayMode: 'grid',
      columns: 3,
      spacing: 'normal',
      showCaptions: true,
      enableLightbox: true,
    },
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};
