import type { Meta, StoryObj } from '@storybook/react';

import MissionStatement from './mission-statement';
import { ComponentCategory, ComponentType } from '../_core/types';

const meta = {
  title: 'Studio/CMS/About/MissionStatement',
  component: MissionStatement,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    theme: { control: 'select', options: ['auto', 'light', 'dark'] },
  },
} satisfies Meta<typeof MissionStatement>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseContent = {
  title: 'We exist to enable outcomes that matter',
  mission:
    'We partner with mission-driven organisations to design, build, and scale digital experiences that deliver measurable impact.',
  vision:
    'Every community has access to intuitive, inclusive technology that helps people thrive.',
  values: ['Integrity', 'Inclusion', 'Learning', 'Courage'],
};

export const Default: Story = {
  args: {
    id: 'mission-statement-default',
    type: ComponentType.Mission,
    category: ComponentCategory.About,
    content: baseContent,
  },
};

export const WithExtendedValues: Story = {
  args: {
    ...Default.args,
    id: 'mission-statement-extended',
    content: {
      ...baseContent,
      values: [
        'Integrity',
        { label: 'Resilience' },
        { title: 'Empathy' },
        { value: 'Curiosity' },
        { text: 'Accountability' },
      ],
    },
  },
};

export const DarkTheme: Story = {
  args: {
    ...Default.args,
    id: 'mission-statement-dark',
    theme: 'dark',
  },
};
