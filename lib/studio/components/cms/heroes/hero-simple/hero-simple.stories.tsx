import type { Meta, StoryObj } from '@storybook/react';
import { ComponentCategory, ComponentType } from '../../_core/types';
import { HeroSimple } from '.';
import type { HeroSimpleProps } from './hero-simple.types';

const meta: Meta<typeof HeroSimple> = {
  title: 'CMS/Heroes/HeroSimple',
  component: HeroSimple,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof HeroSimple>;

const baseArgs: HeroSimpleProps = {
  id: 'hero-simple-story',
  type: ComponentType.HeroSimple,
  category: ComponentCategory.Heroes,
  theme: 'light',
  content: {
    eyebrow: 'Customer Success',
    heading: 'Ship high-impact experiences faster',
    subheading:
      'Unify design, content, and AI-assisted workflows to deliver pages in minutes instead of weeks.',
    body: 'Catalyst Studio keeps every team in sync with guardrails, reusable components, and instant publishing.',
    alignment: 'center',
    ctaButtons: [
      {
        label: 'Start Free Trial',
        href: '/signup',
        variant: 'primary',
      },
      {
        label: 'View Live Demo',
        href: '/demo',
        variant: 'outline',
      },
    ],
    supportingLinks: [
      { label: 'Talk to sales', href: '/contact' },
      { label: 'See pricing', href: '/pricing' },
    ],
  },
};

export const Default: Story = {
  args: baseArgs,
};

export const WithBackground: Story = {
  args: {
    ...baseArgs,
    id: 'hero-simple-with-background',
    content: {
      ...baseArgs.content,
      background: {
        color: '#0f172a',
        image: {
          src: 'https://images.unsplash.com/photo-1536766820876-632d35eb8113?auto=format&fit=crop&w=1600&q=80',
          focalPoint: 'center',
        },
        overlayColor: 'rgba(15, 23, 42, 0.78)',
      },
    },
    theme: 'dark',
  },
};

export const LeftAligned: Story = {
  args: {
    ...baseArgs,
    id: 'hero-simple-left',
    content: {
      ...baseArgs.content,
      alignment: 'left',
      eyebrow: 'Industry insights',
      heading: 'Digitise complex services',
      supportingLinks: [{ label: 'Download brief', href: '/resources/brief' }],
    },
  },
};
