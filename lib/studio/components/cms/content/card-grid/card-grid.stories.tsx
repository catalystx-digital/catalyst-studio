import type { Meta, StoryObj } from '@storybook/react';
import { CardGrid } from './index';

const meta = {
  title: 'Studio/CMS/Content/CardGrid',
  component: CardGrid,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio card grid component for displaying content in a flexible grid layout with various card styles and configurations.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Card grid content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    },
    variant: {
      description: 'Card style variant',
      control: 'select',
      options: ['default', 'bordered', 'elevated', 'flat']
    },
    hover: {
      description: 'Enable hover effects',
      control: 'boolean'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

// Using data URL for placeholder image to prevent loading issues
const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgdmlld0JveD0iMCAwIDQwMCAyMjUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMjUiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBQbGFjZWhvbGRlcjwvdGV4dD48L3N2Zz4=';

const sampleCards = [
  {
    id: 'card-1',
    title: 'Getting Started Guide',
    description: 'Learn the basics of our platform with this comprehensive guide.',
    image: placeholderImage,
    tags: ['Tutorial', 'Beginner'],
    author: 'John Doe',
    date: '2024-01-15',
    link: '#'
  },
  {
    id: 'card-2',
    title: 'Advanced Features',
    description: 'Explore advanced features and unlock the full potential of our tools.',
    image: placeholderImage,
    tags: ['Advanced', 'Features'],
    author: 'Jane Smith',
    date: '2024-01-20',
    link: '#'
  },
  {
    id: 'card-3',
    title: 'Best Practices',
    description: 'Follow these best practices to optimize your workflow and productivity.',
    image: placeholderImage,
    tags: ['Tips', 'Productivity'],
    author: 'Mike Johnson',
    date: '2024-01-25',
    link: '#'
  },
  {
    id: 'card-4',
    title: 'Case Studies',
    description: 'Real-world examples of successful implementations and solutions.',
    image: placeholderImage,
    tags: ['Case Study', 'Examples'],
    author: 'Sarah Wilson',
    date: '2024-02-01',
    link: '#'
  },
  {
    id: 'card-5',
    title: 'API Documentation',
    description: 'Complete API reference with examples and integration guides.',
    image: placeholderImage,
    tags: ['API', 'Documentation'],
    author: 'Tom Brown',
    date: '2024-02-05',
    link: '#'
  },
  {
    id: 'card-6',
    title: 'Community Resources',
    description: 'Connect with our community and access shared resources.',
    image: placeholderImage,
    tags: ['Community', 'Resources'],
    author: 'Emily Davis',
    date: '2024-02-10',
    link: '#'
  }
];

// Default 3-column grid
export const Default: Story = {
  args: {
    content: {
      heading: 'Featured Content',
      subheading: 'Explore our latest articles and resources',
      cards: sampleCards,
      columns: 3,
      gap: 'medium',
      imageAspectRatio: '16:9'
    }
  }
};

// 2-column grid
export const TwoColumns: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 4),
      columns: 2,
      gap: 'large',
      imageAspectRatio: '16:9',
    }
  }
};

// 4-column grid
export const FourColumns: Story = {
  args: {
    content: {
      cards: sampleCards,
      columns: 4,
      gap: 'small',
      imageAspectRatio: '1:1',
    }
  }
};

// Without images
export const WithoutImages: Story = {
  args: {
    content: {
      heading: 'Text Only Cards',
      cards: sampleCards,
      columns: 3,
      gap: 'medium',
    }
  }
};

// Minimal cards
export const Minimal: Story = {
  args: {
    content: {
      cards: sampleCards,
      columns: 3,
      gap: 'medium',
    }
  }
};

// Different aspect ratios
export const SquareImages: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
      imageAspectRatio: '1:1',
    }
  }
};

export const PortraitImages: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
      imageAspectRatio: '4:3',
    }
  }
};

// Different variants
export const DefaultVariant: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
    },
    variant: 'default'
  }
};

export const MinimalVariant: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
    },
    variant: 'minimal'
  }
};

export const CompactVariant: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
    },
    variant: 'compact'
  }
};

// Without hover effects
export const NoHover: Story = {
  args: {
    content: {
      cards: sampleCards.slice(0, 3),
      columns: 3,
      gap: 'medium',
    },
    hover: false
  }
};

// Single card
export const SingleCard: Story = {
  args: {
    content: {
      cards: [sampleCards[0]],
      columns: 1,
      gap: 'medium',
    }
  }
};

// Large gap
export const LargeGap: Story = {
  args: {
    content: {
      cards: sampleCards,
      columns: 3,
      gap: 'large',
    }
  }
};

// Small gap
export const SmallGap: Story = {
  args: {
    content: {
      cards: sampleCards,
      columns: 3,
      gap: 'small',
    }
  }
};