import type { Meta, StoryObj } from '@storybook/react';
import Statistics from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Data/Statistics',
  component: Statistics,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Statistics>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'statistics-1',
    type: ComponentType.Statistics,
    category: ComponentCategory.Data,
    theme: 'auto',
    variant: 'default',
    content: {
      title: 'By the Numbers',
      subtitle: 'Snapshot of how our teams are performing this quarter.',
      stats: [
        {
          id: 'stat-1',
          value: 12500,
          label: 'Active Members',
          prefix: '+',
          icon: 'Users',
          description: 'Across 42 global regions',
          delta: { value: 8.4 }
        },
        {
          id: 'stat-2',
          value: 97.6,
          label: 'Satisfaction Rate',
          suffix: '%',
          decimalPlaces: 1,
          icon: 'Sparkles',
          delta: { value: 2.1, label: '+2.1% vs last quarter' }
        },
        {
          id: 'stat-3',
          value: 48,
          label: 'Launches',
          suffix: ' / mo',
          icon: 'Rocket'
        },
        {
          id: 'stat-4',
          value: 3.4,
          label: 'Churn Rate',
          suffix: '%',
          decimalPlaces: 1,
          icon: 'Activity',
          delta: { value: -1.2 }
        }
      ],
      animateOnScroll: false,
      layout: 'grid',
      columns: 4
    }
  }
};
