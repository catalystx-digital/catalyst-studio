import type { Meta, StoryObj } from '@storybook/react';
import { ComponentCategory, ComponentType } from '../../_core/types';
import HeroCarousel from './index';

const heroImages = [
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSI5NjAiIHZpZXdCb3g9IjAgMCAxOTIwIDk2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50MSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2Y2Njc4ZjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2QwZTJlYTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9Ijk2MCIgZmlsbD0idXJsKCNncmFkaWVudDEpIi8+PHRleHQgeD0iNTAlIiB5PSI0OCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBdmVuaXIiIGZvbnQtc2l6ZT0iNzIiIGZpbGw9IiNmZmYiPkltYWdlIDE8L3RleHQ+PC9zdmc+',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSI5NjAiIHZpZXdCb3g9IjAgMCAxOTIwIDk2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50MiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJlODFmZDI7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM0OGI5ZjYyO3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjE5MjAiIGhlaWdodD0iOTYwIiBmaWxsPSJ1cmwoI2dyYWRpZW50MikiLz48dGV4dCB4PSI1MCUiIHk9IjQ4JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkF2ZW5pciIgZm9udC1zaXplPSI3MiIgZmlsbD0iI2ZmZiI+SW1hZ2UgMjwvdGV4dD48L3N2Zz4=',
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSI5NjAiIHZpZXdCb3g9IjAgMCAxOTIwIDk2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50MyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzlmYWYzNTc7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM0Njg0ZWQ1O3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjE5MjAiIGhlaWdodD0iOTYwIiBmaWxsPSJ1cmwoI2dyYWRpZW50MykiLz48dGV4dCB4PSI1MCUiIHk9IjQ4JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkF2ZW5pciIgZm9udC1zaXplPSI3MiIgZmlsbD0iI2ZmZiI+SW1hZ2UgMzwvdGV4dD48L3N2Zz4=',
];

const meta = {
  title: 'Studio/CMS/Heroes/HeroCarousel',
  component: HeroCarousel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Studio hero carousel that rotates featured stories or promotions with imagery and call-to-action buttons.',
      },
    },
  },
  argTypes: {
    content: {
      description: 'Hero carousel content configuration.',
      control: 'object',
    },
    theme: {
      control: 'radio',
      options: ['dark', 'light', 'auto'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeroCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultSlides = [
  {
    id: 'hero-carousel-slide-1',
    content: {
      eyebrow: 'Community',
      heading: 'Coffee With a Cop',
      body: 'Join local officers for coffee and conversation at your neighbourhood centre this weekend.',
      image: { src: heroImages[0], alt: 'Coffee event promotional artwork' },
      ctaButtons: [
        { href: '#events', label: 'View Event', variant: 'primary' as const },
        { href: '#register', label: 'Register', variant: 'outline' as const },
      ],
    },
  },
  {
    id: 'hero-carousel-slide-2',
    content: {
      eyebrow: 'Inspiration',
      heading: 'Go Big This Halloween',
      body: 'Get inspired by bold colours, creative costumes, and spooky treats for the whole family.',
      image: { src: heroImages[1], alt: 'Halloween themed design' },
      ctaButtons: [
        { href: '#ideas', label: 'See Ideas', variant: 'primary' as const },
      ],
    },
  },
  {
    id: 'hero-carousel-slide-3',
    content: {
      eyebrow: 'Food',
      heading: 'Halloween Recipes',
      body: 'Try easy, eerie recipes guaranteed to delight your guests and bring the fun to every table.',
      image: { src: heroImages[2], alt: 'Decorated Halloween treats' },
      ctaButtons: [
        { href: '#recipes', label: 'Browse Recipes', variant: 'primary' as const },
      ],
    },
  },
];

export const Default: Story = {
  args: {
    id: 'hero-carousel-story',
    type: ComponentType.HeroCarousel,
    category: ComponentCategory.Heroes,
    theme: 'dark',
    content: {
      slides: defaultSlides,
      autoPlay: true,
      autoPlayInterval: 6000,
      showIndicators: true,
      showControls: true,
      pauseOnHover: true,
    },
  },
};

export const LightTheme: Story = {
  args: {
    ...Default.args,
    theme: 'light',
    content: {
      ...Default.args?.content,
      theme: 'light',
    },
  },
};

export const ManualNavigation: Story = {
  args: {
    ...Default.args,
    content: {
      ...Default.args?.content,
      autoPlay: false,
      showIndicators: true,
      showControls: true,
    },
  },
};

