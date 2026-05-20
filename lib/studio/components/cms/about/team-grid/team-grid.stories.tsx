import type { Meta, StoryObj } from '@storybook/react';

import TeamGrid from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/About/TeamGrid',
  component: TeamGrid,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'select', options: ['auto', 'light', 'dark'] },
  },
} satisfies Meta<typeof TeamGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const members = [
  {
    id: '1',
    name: 'Amelia Torres',
    title: 'Chief Executive Officer',
    department: 'Executive Leadership',
    photo:
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg',
    bio: '<p>Amelia aligns teams around measurable outcomes and removes barriers for innovation.</p>',
    linkedin: 'https://linkedin.com/in/example',
  },
  {
    id: '2',
    name: 'Kai Johnson',
    title: 'Director of Engineering',
    department: 'Technology',
    photo:
      'https://images.pexels.com/photos/3153198/pexels-photo-3153198.jpeg',
    bio: '<p>Kai leads the platform foundations team championing accessibility and performance.</p>',
    twitter: 'https://twitter.com/example',
  },
  {
    id: '3',
    name: 'Priya Desai',
    title: 'Head of Product',
    department: 'Product',
    photo:
      'https://images.pexels.com/photos/1181414/pexels-photo-1181414.jpeg',
    bio: '<p>Priya partners with customers to translate outcomes into roadmap priorities.</p>',
  },
  {
    id: '4',
    name: 'Logan Chen',
    title: 'Design Manager',
    department: 'Design',
    photo:
      'https://images.pexels.com/photos/3184315/pexels-photo-3184315.jpeg',
    bio: '<p>Logan stewards the design system and coaches teams on inclusive practices.</p>',
  },
];

export const Default: Story = {
  args: {
    id: 'team-grid-default',
    type: ComponentType.TeamGrid,
    category: ComponentCategory.About,
    content: {
      heading: 'Meet the Catalyst leadership team',
      subheading:
        'A multidisciplinary group of strategists, engineers, and designers guiding the product vision.',
      members,
      showDepartment: true,
      enableHover: true,
    },
  },
};

export const MinimalHover: Story = {
  args: {
    ...Default.args,
    id: 'team-grid-minimal',
    variant: 'minimal',
    content: {
      ...Default.args?.content,
      enableHover: false,
      showDepartment: false,
    },
  },
};

export const LinkedProfiles: Story = {
  args: {
    ...Default.args,
    id: 'team-grid-linked',
    content: {
      ...Default.args?.content,
      linkToProfile: true,
      members: members.map((member, index) => ({
        ...member,
        profileUrl: `https://example.com/team/${index + 1}`,
      })),
    },
  },
};
