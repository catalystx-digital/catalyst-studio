import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from './index';

const meta = {
  title: 'Studio/CMS/Content/Tabs',
  component: Tabs,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio tabs component for organizing content into switchable panels.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Tabs content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleTabs = [
  {
    id: 'overview',
    label: 'Overview',
    content: 'This is the overview tab content. It provides a general introduction to the topic at hand.',
    icon: '📋'
  },
  {
    id: 'features',
    label: 'Features',
    content: 'Key features include: Advanced functionality, User-friendly interface, High performance, and Scalability.',
    icon: '⭐'
  },
  {
    id: 'pricing',
    label: 'Pricing',
    content: 'Our pricing plans are designed to fit businesses of all sizes. Contact us for custom enterprise solutions.',
    icon: '💰'
  },
  {
    id: 'support',
    label: 'Support',
    content: '24/7 customer support available via email, phone, and live chat. Comprehensive documentation included.',
    icon: '🛟'
  }
];

// Default tabs
export const Default: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: sampleTabs,
      defaultTab: 'overview',
    },
  },
};

export const VerticalTabs: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: sampleTabs,
      defaultTab: 'overview',
      orientation: 'vertical',
      align: 'left',
    },
  },
};

export const MinimalVariant: Story = {
  args: {
    variant: 'minimal',
    content: {
      tabs: sampleTabs,
      defaultTab: 'features',
    },
  },
};

export const DetailedVariant: Story = {
  args: {
    variant: 'detailed',
    content: {
      tabs: sampleTabs,
      defaultTab: 'pricing',
    },
  },
};

export const CompactVariant: Story = {
  args: {
    variant: 'compact',
    content: {
      tabs: sampleTabs,
      defaultTab: 'overview',
      align: 'center',
    },
  },
};

export const ExpandedVariant: Story = {
  args: {
    variant: 'expanded',
    content: {
      tabs: sampleTabs,
      defaultTab: 'overview',
      align: 'justified',
    },
  },
};

export const WithoutIcons: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: sampleTabs.map(tab => ({ ...tab, icon: undefined })),
      defaultTab: 'overview',
    },
  },
};

export const TwoTabs: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: sampleTabs.slice(0, 2),
      defaultTab: 'overview',
    },
  },
};

export const ManyTabs: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: [
        ...sampleTabs,
        {
          id: 'docs',
          label: 'Documentation',
          content: 'Comprehensive documentation with examples and API references.',
          icon: '📚',
        },
        {
          id: 'changelog',
          label: 'Changelog',
          content: 'Track all updates, improvements, and bug fixes in our changelog.',
          icon: '📝',
        },
        {
          id: 'community',
          label: 'Community',
          content: 'Join our vibrant community of developers and users.',
          icon: '👥',
        },
      ],
      defaultTab: 'overview',
    },
  },
};

export const LongContent: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: [
        {
          id: 'long',
          label: 'Long Content',
          content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`,
        },
        {
          id: 'short',
          label: 'Short Content',
          content: 'This is a short content tab.',
        },
      ],
      defaultTab: 'long',
    },
  },
};

export const WithDisabledTabs: Story = {
  args: {
    variant: 'default',
    content: {
      tabs: [
        sampleTabs[0],
        { ...sampleTabs[1], disabled: true },
        sampleTabs[2],
        { ...sampleTabs[3], disabled: true },
      ],
      defaultTab: 'overview',
    },
  },
};
