import type { Meta, StoryObj } from '@storybook/react';
import { ComponentCategory, ComponentType } from '../../_core/types';
import { VideoEmbed } from '.';

const meta: Meta<typeof VideoEmbed> = {
  title: 'CMS/Content/VideoEmbed',
  component: VideoEmbed,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof VideoEmbed>;

const baseArgs = {
  id: 'video-embed-story',
  type: ComponentType.VideoEmbed,
  category: ComponentCategory.Content,
  content: {
    provider: 'youtube' as const,
    url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    title: 'Product demo',
    description:
      'Quick walkthrough highlighting how Catalyst Studio accelerates omnichannel publishing.',
    caption: 'Catalyst Studio overview • 2 min watch',
    allowFullScreen: true,
  },
};

export const Default: Story = {
  args: baseArgs,
};

export const Vimeo: Story = {
  args: {
    ...baseArgs,
    id: 'video-embed-vimeo',
    content: {
      ...baseArgs.content,
      provider: 'vimeo',
      url: 'https://vimeo.com/76979871',
      title: 'Lifecycle marketing campaign rollout',
      aspectRatio: '4:3',
    },
  },
};

export const PortraitEmbed: Story = {
  args: {
    ...baseArgs,
    id: 'video-embed-portrait',
    content: {
      ...baseArgs.content,
      provider: 'loom',
      url: 'https://www.loom.com/share/1234567890abcdef',
      title: 'Support handoff walkthrough',
      aspectRatio: '9:16',
    },
  },
};
