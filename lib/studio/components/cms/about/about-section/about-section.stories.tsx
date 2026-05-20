import type { Meta, StoryObj } from '@storybook/react';
import AboutSection from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/About/AboutSection',
  component: AboutSection,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    id: { control: 'text', defaultValue: 'about-section-1' },
    type: { control: 'select', options: Object.values(ComponentType) },
    category: { control: 'select', options: Object.values(ComponentCategory) },
    theme: { control: 'select', options: ['auto', 'light', 'dark'] },
  },
} satisfies Meta<typeof AboutSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const sharedContent = {
  story: `<p>We were founded in 2020 with a mission to build inclusive digital experiences. Since then our distributed team has shipped more than 200 customer launches spanning civic engagement, fintech, healthcare, and education.</p>
          <p>Everything we build is guided by accessibility-first principles, sustainable code, and a commitment to measurable outcomes.</p>`,
  mission: `<p>Deliver thoughtful technology that empowers organizations to serve their communities.</p>`,
  vision: `<p>A future where digital services are intuitive, trusted, and available to everyone.</p>`,
  values: [
    {
      title: 'Innovation',
      description: 'We explore new ideas and rigorously test them against real-world use.',
      icon: 'Lightbulb',
    },
    {
      title: 'Integrity',
      description: 'We lead with transparency and do what we say we will do.',
      icon: 'ShieldCheck',
    },
    {
      title: 'Empathy',
      description: 'We listen first and design with the needs of people in mind.',
      icon: 'Heart',
    },
  ],
  milestones: [
    {
      year: '2020',
      title: 'Studio founded',
      description: 'Three friends open a shared workspace and take on their first civic project.',
    },
    {
      year: '2022',
      title: 'Global team',
      description: 'We expand into five countries and introduce 24/7 support.',
    },
    {
      year: '2024',
      title: 'Impact milestone',
      description: '1M+ citizens served through experiences powered by our platform.',
    },
  ],
  stats: [
    { value: '40', label: 'Team members', suffix: '+' },
    { value: '18', label: 'Countries represented' },
    { value: '200', label: 'Projects shipped', suffix: '+' },
    { value: '95', label: 'NPS', suffix: '%' },
  ],
  imageList: [
    {
      src: 'https://images.pexels.com/photos/3184302/pexels-photo-3184302.jpeg',
      alt: 'Team collaboration',
      caption: 'Collaboration session with design and engineering.',
    },
    {
      src: 'https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg',
      alt: 'Remote team',
      caption: 'Remote teams connecting from across the globe.',
    },
  ],
};

export const Default: Story = {
  args: {
    id: 'about-section-default',
    type: ComponentType.AboutSection,
    category: ComponentCategory.About,
    content: {
      heading: 'We build digital products for human outcomes',
      subheading: 'Catalyst Studio is a distributed team of designers, engineers, and strategists.',
      ...sharedContent,
    },
  },
};

export const DenseStats: Story = {
  args: {
    ...Default.args,
    id: 'about-section-dense-stats',
    content: {
      ...(Default.args?.content ?? {}),
      layout: 'two-column',
      stats: [
        { value: '60', label: 'Team members', suffix: '+' },
        { value: '12', label: 'Active initiatives' },
        { value: '320', label: 'Workshops delivered', suffix: '+' },
        { value: '4.9', label: 'CSAT score', suffix: '/5' },
      ],
    },
  },
};

export const DarkTheme: Story = {
  args: {
    ...Default.args,
    id: 'about-section-dark',
    theme: 'dark',
  },
};

export const Minimal: Story = {
  args: {
    id: 'about-section-minimal',
    type: ComponentType.AboutSection,
    category: ComponentCategory.About,
    content: {
      heading: 'About Catalyst Studio',
      subheading: 'A quick overview of who we are and what drives our work.',
    },
  },
};
