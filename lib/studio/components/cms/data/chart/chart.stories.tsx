import type { Meta, StoryObj } from '@storybook/react';

import Chart from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Data/Chart',
  component: Chart,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  type: ComponentType.Chart,
  category: ComponentCategory.Data,
  content: {
    title: 'Quarterly pipeline growth',
    description:
      'Comparison of pipeline volume captured by sales and marketing teams.',
    type: 'bar' as const,
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    unitLabel: 'M',
    series: [
      {
        id: 'marketing',
        name: 'Marketing',
        values: [1.2, 1.6, 1.9, 2.4],
        tone: 'accent',
      },
      {
        id: 'sales',
        name: 'Sales',
        values: [1.0, 1.3, 1.7, 2.2],
        tone: 'positive',
      },
    ],
    footnote: 'Values rounded to nearest million. Placeholder visualization only.',
  },
};

export const Bar: Story = {
  args: {
    id: 'chart-bar',
    ...baseArgs,
  },
};

export const DonutPlaceholder: Story = {
  args: {
    id: 'chart-donut',
    ...baseArgs,
    content: {
      ...baseArgs.content,
      type: 'donut' as const,
    },
  },
};

export const SimpleData: Story = {
  args: {
    id: 'chart-simple',
    ...baseArgs,
    content: {
      title: 'Channel mix',
      description: 'Share of traffic by acquisition channel.',
      type: 'bar' as const,
      unitLabel: '%',
      data: [
        { label: 'Organic', value: 45 },
        { label: 'Paid', value: 32 },
        { label: 'Referral', value: 18 },
        { label: 'Other', value: 5 },
      ],
    },
  },
};
