import type { Meta, StoryObj } from '@storybook/react';
import { VideoPlayer } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Content/VideoPlayer',
  component: VideoPlayer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VideoPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = {
  id: 'storybook-video-player',
  type: ComponentType.VideoPlayer,
  category: ComponentCategory.Content,
} as const;

export const NativeSources: Story = {
  args: {
    ...baseProps,
    content: {
      title: 'Product Walkthrough',
      description:
        'See how Catalyst Studio helps marketing teams launch campaigns faster.',
      sources: [
        { url: 'https://storage.googleapis.com/example/library/overview.mp4', type: 'mp4' as const },
        { url: 'https://storage.googleapis.com/example/library/overview.webm', type: 'webm' as const },
      ],
      posterImage:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
      aspectRatio: '16:9',
      showPlayButton: true,
    },
  },
};

export const YouTubeEmbed: Story = {
  args: {
    ...baseProps,
    content: {
      title: 'Keynote Session',
      description: 'Highlights from our annual customer summit.',
      sources: [
        {
          url: 'https://www.youtube.com/watch?v=sBws8MSXN7A',
          type: 'youtube' as const,
        },
      ],
      autoPlay: false,
      controls: true,
      aspectRatio: '21:9',
    },
  },
};

export const WithFallback: Story = {
  args: {
    ...baseProps,
    content: {
      title: 'Behind the Scenes',
      sources: [],
      fallbackImage:
        'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80',
      fallbackMessage: 'Video is currently unavailable. Check back soon.',
      aspectRatio: '4:3',
    },
  },
};
