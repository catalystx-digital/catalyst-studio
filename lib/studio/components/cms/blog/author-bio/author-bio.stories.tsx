import type { Meta, StoryObj } from '@storybook/react';
import AuthorBio from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Blog/AuthorBio',
  component: AuthorBio,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthorBio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'authorbio-1',
    type: ComponentType.AuthorBio,
    category: ComponentCategory.Blog,
    content: {
      name: 'Jamie Rivera',
      title: 'Director of Product Design',
      bio: '<p>Jamie leads the Catalyst design systems team, partnering with engineering to ship inclusive experiences across the product suite.</p><p>Previously at <strong>Figma</strong> and <strong>Shopify</strong>.</p>',
      photo: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
      email: 'jamie.rivera@example.com',
      website: 'https://example.com',
      socialLinks: {
        twitter: 'https://twitter.com/example',
        linkedin: 'https://linkedin.com/in/example-designer'
      },
      stats: {
        articlesCount: 42,
        followersCount: 18500,
        yearsExperience: 12
      },
      expertise: ['Design systems', 'Accessibility', 'Design ops'],
      expandable: true,
      maxBioLength: 160
    }
  }
};
