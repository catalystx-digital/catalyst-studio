import type { Meta, StoryObj } from '@storybook/react';
import Timeline from './index';

const meta = {
  title: 'Studio/CMS/Data/Timeline',
  component: Timeline,
  parameters: { 
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio timeline component for displaying chronological events and milestones.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Timeline content configuration',
      control: 'object'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      title: 'Lifecycle Milestones',
      subtitle: 'Key phases in our product delivery',
      layout: 'vertical',
      showConnectors: true,
      showIcons: true,
      events: [
        {
          id: 'start',
          date: '2024-01',
          title: 'Project Started',
          description: 'Initial planning and setup phase began',
          type: 'milestone',
          icon: 'Flag'
        },
        {
          id: 'build',
          date: '2024-02',
          title: 'Development Phase',
          description: 'Core features implementation',
          type: 'event',
          icon: 'Hammer'
        },
        {
          id: 'beta',
          date: '2024-03',
          title: 'Beta Release',
          description: 'First beta version released to testers',
          type: 'achievement',
          icon: 'Sparkles',
          link: {
            text: 'View release notes',
            url: 'https://example.com/releases/beta',
          },
          actions: [
            { text: 'Read the process', url: 'https://example.com/process', variant: 'link' },
          ],
        },
        {
          id: 'launch',
          date: '2024-04',
          title: 'Official Launch',
          description: 'Product officially launched to the public',
          type: 'milestone',
          icon: 'PlaneTakeoff',
          image: {
            src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d',
            alt: 'Launch celebration',
          },
        }
      ],
      animated: true,
      footerCta: {
        text: 'Learn more about our process',
        url: 'https://example.com/process',
        variant: 'accent',
      },
    }
  }
};

export const WithIcons: Story = {
  args: {
    content: {
      layout: 'horizontal',
      showConnectors: true,
      animated: false,
      events: [
        {
          id: 'plan',
          date: '2024-Q1',
          title: 'Planning',
          description: 'Strategic planning and research',
          icon: 'ClipboardList',
          type: 'milestone'
        },
        {
          id: 'dev',
          date: '2024-Q2',
          title: 'Development',
          description: 'Building the product',
          icon: 'Rocket',
          type: 'event'
        },
        {
          id: 'qa',
          date: '2024-Q3',
          title: 'Testing',
          description: 'Quality assurance and testing',
          icon: 'Beaker',
          type: 'event'
        },
        {
          id: 'ship',
          date: '2024-Q4',
          title: 'Launch',
          description: 'Market release',
          icon: 'PartyPopper',
          type: 'achievement'
        }
      ],
    }
  }
};

export const Alternating: Story = {
  args: {
    content: {
      layout: 'alternating',
      showConnectors: true,
      animated: true,
      events: [
        {
          id: 'founding',
          date: '2018-01-15',
          title: 'Company Founded',
          description: 'A small team sets out to reinvent digital engagement.',
          type: 'milestone',
          icon: 'BriefcaseBusiness',
        },
        {
          id: 'growth',
          date: '2019-08-01',
          title: 'First Expansion',
          description: 'Opened our second studio to support growing demand.',
          type: 'event',
          icon: 'TrendingUp',
        },
        {
          id: 'award',
          date: '2020-11-22',
          title: 'Industry Recognition',
          description: 'Won agency of the year for mobile excellence.',
          type: 'achievement',
          icon: 'Award',
        },
        {
          id: 'global',
          date: '2022-04-12',
          title: 'Global Presence',
          description: 'Launched teams across three continents.',
          type: 'milestone',
          icon: 'Globe',
        },
      ],
    },
  },
};

export const Progress: Story = {
  args: {
    variant: 'progress',
    content: {
      title: 'Complaint process',
      subtitle: 'Four clear steps from lodgement to resolution',
      events: [
        {
          id: 'lodgement',
          date: 'Step 1',
          title: 'Tell us what happened',
          description: 'Share the details of your complaint and provide any documents that support your case.',
          type: 'milestone'
        },
        {
          id: 'assessment',
          date: 'Step 2',
          title: 'We assess the issue',
          description: 'Our specialists review the facts and contact your provider for their response.',
          type: 'event'
        },
        {
          id: 'resolution',
          date: 'Step 3',
          title: 'We propose a fair outcome',
          description: 'Both parties receive a recommended solution and time to consider it.',
          type: 'achievement'
        },
        {
          id: 'closure',
          date: 'Step 4',
          title: 'Finalise and close',
          description: 'We confirm the agreed actions and close the complaint once they are complete.',
          type: 'milestone'
        }
      ],
      footerCta: {
        text: 'Learn how it works',
        url: 'https://example.com/complaints/process',
        variant: 'accent'
      }
    }
  }
};
