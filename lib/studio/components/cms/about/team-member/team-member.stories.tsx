import type { Meta, StoryObj } from '@storybook/react';
import TeamMember from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';

const meta = {
  title: 'Studio/CMS/About/TeamMember',
  component: TeamMember,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof TeamMember>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  type: ComponentType.TeamMember,
  category: ComponentCategory.About,
  content: {
    name: 'Jane Smith',
    title: 'Chief Technology Officer',
    department: 'Product & Engineering',
    photo:
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400',
    photoAlt: 'Jane Smith smiling in the office',
    bio: '<p>Jane is a technology leader with over 15 years of experience building high-performing product teams and scaling modern platforms.</p>',
    email: 'jane.smith@example.com',
    phone: '+1-800-555-0101',
    linkedin: 'https://linkedin.com/in/janesmith',
    twitter: 'https://twitter.com/janesmith',
    github: 'https://github.com/janesmith',
    skills: ['Leadership', 'Cloud Architecture', 'AI Strategy', 'DevOps'],
    experience: [
      {
        position: 'Chief Technology Officer',
        company: 'Northwind Digital',
        duration: '2020 – Present',
        description: 'Leading product and engineering org across three regions.',
      },
      {
        position: 'VP of Engineering',
        company: 'Contoso Labs',
        duration: '2016 – 2020',
      },
    ],
    displayMode: 'full' as const,
  },
};

export const Default: Story = {
  args: {
    id: 'teammember-1',
    ...baseArgs,
  },
};

export const DarkTheme: Story = {
  args: {
    id: 'teammember-2',
    theme: 'dark',
    variant: 'expanded',
    ...baseArgs,
  },
};

export const CompactCard: Story = {
  args: {
    id: 'teammember-compact',
    theme: 'auto',
    variant: 'compact',
    content: {
      ...baseArgs.content,
      displayMode: 'compact' as const,
      bio: '<p>Focused on building resilient teams and inclusive tech cultures.</p>',
      skills: ['Leadership', 'Mentorship', 'Strategy'],
    },
  },
};
