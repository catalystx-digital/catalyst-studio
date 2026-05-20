import type { Meta, StoryObj } from '@storybook/react';
import TestimonialSlider from './index';

const meta = {
  title: 'Studio/CMS/SocialProof/TestimonialSlider',
  component: TestimonialSlider,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Carousel-style testimonial slider that uses shadcn CMS wrappers for typography, avatars, and navigation controls.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TestimonialSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

const BASE_TESTIMONIALS = [
  {
    id: 't-1',
    quote:
      'Catalyst gave us a component library that our marketing team can actually ship with. The analytics events drop straight into our warehouse.',
    author: 'Priya Desai',
    role: 'Head of Growth',
    company: 'Northwind Labs',
    avatar: 'https://i.pravatar.cc/128?img=32',
    rating: 4.8,
  },
  {
    id: 't-2',
    quote:
      'We replaced three bespoke landing page builders with Catalyst CMS and cut launch time by 60%. The editing experience is excellent.',
    author: 'Luis Romero',
    role: 'Director of Product Marketing',
    company: 'Acme Soft',
    avatar: 'https://i.pravatar.cc/128?img=36',
    rating: 5,
  },
  {
    id: 't-3',
    quote:
      'Our regional teams finally have guardrails with flexibility. The testimonial slider, hero blocks, and pricing tables cover most launch scenarios.',
    author: 'Hannah Lee',
    role: 'VP, Digital Programs',
    company: 'Globex',
  },
];

export const Default: Story = {
  args: {
    analyticsId: 'story-testimonial-slider',
    content: {
      testimonials: BASE_TESTIMONIALS,
      autoPlayInterval: 6000,
      showNavigation: true,
      showDots: true,
      pauseOnHover: true,
    },
    theme: 'auto',
  },
};

export const MinimalDots: Story = {
  args: {
    content: {
      testimonials: BASE_TESTIMONIALS.slice(0, 2),
      showDots: true,
      showNavigation: false,
    },
    theme: 'light',
    variant: 'minimal',
  },
};

export const DarkTheme: Story = {
  args: {
    content: {
      testimonials: BASE_TESTIMONIALS,
      autoPlayInterval: 4500,
      pauseOnHover: false,
    },
    theme: 'dark',
  },
};
