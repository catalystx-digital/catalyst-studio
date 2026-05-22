import type { Meta, StoryObj } from '@storybook/react';
import TwoColumn from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Content/TwoColumn',
  component: TwoColumn,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio two-column layout component for side-by-side content presentation.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Two column content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TwoColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZyI+PHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNlMGU3ZmYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjM2NmY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBQbGFjZWhvbGRlcjwvdGV4dD48L3N2Zz4=';

function textBlock(id: string, heading: string, body: string) {
  return {
    id,
    type: ComponentType.TextBlock,
    category: ComponentCategory.Content,
    content: { heading, body },
  };
}

function imageBlock(id: string, alt: string) {
  return {
    id,
    type: ComponentType.ImageGallery,
    category: ComponentCategory.Content,
    content: {
      images: [{ src: placeholderImage, alt }],
    },
  };
}

export const Default: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('left-column', 'Left Column', 'This is the content for the left column. It can contain text, images, or other components.'),
      ],
      rightColumn: [
        textBlock('right-column', 'Right Column', 'The two-column layout is perfect for comparing information or presenting related content side by side.'),
      ],
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'top'
    }
  }
};

export const TextAndImage: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('mission-text', 'Our Mission', 'We strive to deliver exceptional value through innovative solutions.'),
      ],
      rightColumn: [
        imageBlock('mission-image', 'Mission illustration'),
      ],
      columnRatio: '50-50',
      gap: 'large',
      verticalAlignment: 'center'
    }
  }
};

export const ImageAndText: Story = {
  args: {
    content: {
      leftColumn: [
        imageBlock('feature-image', 'Feature illustration'),
      ],
      rightColumn: [
        textBlock('feature-text', 'Feature Spotlight', 'Discover powerful features designed to enhance your workflow.'),
      ],
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'center'
    }
  }
};

export const Ratio60_40: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('main-content', 'Main Content Area', 'This column takes up 60% of the available width, giving more emphasis to the primary content.'),
      ],
      rightColumn: [
        textBlock('sidebar', 'Sidebar', 'The narrower column is perfect for related links, quick facts, or calls to action.'),
      ],
      columnRatio: '60-40',
      gap: 'large',
      verticalAlignment: 'top'
    }
  }
};

export const Ratio40_60: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('quick-info', 'Quick Info', 'A narrower left column for brief information.'),
      ],
      rightColumn: [
        textBlock('detailed-content', 'Detailed Content', 'The wider right column provides more space for detailed explanations, longer text, or larger images.'),
      ],
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'top'
    }
  }
};

export const Ratio70_30: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('primary-content', 'Primary Content', 'With 70% of the width, this column dominates the layout.'),
      ],
      rightColumn: [
        textBlock('notes', 'Notes', 'Small sidebar for additional notes.'),
      ],
      columnRatio: '70-30',
      gap: 'small',
      verticalAlignment: 'top'
    }
  }
};

export const VerticalCenter: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('centered-text', 'Vertically Centered', 'This content is centered vertically within its column.'),
      ],
      rightColumn: [
        imageBlock('centered-image', 'Centered image'),
      ],
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'center'
    }
  }
};

export const VerticalBottom: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('bottom-left', 'Bottom Aligned', 'Content aligned to the bottom of the column.'),
      ],
      rightColumn: [
        textBlock('bottom-right', 'Also Bottom', 'Both columns align their content to the bottom, useful for creating baseline alignment.'),
      ],
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'bottom'
    }
  }
};

export const SmallGap: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('tight-spacing', 'Tight Spacing', 'Columns with minimal gap between them.'),
      ],
      rightColumn: [
        textBlock('close-together', 'Close Together', 'Small gaps work well for related content that should feel connected.'),
      ],
      columnRatio: '50-50',
      gap: 'small',
      verticalAlignment: 'top'
    }
  }
};

export const LargeGap: Story = {
  args: {
    content: {
      leftColumn: [
        textBlock('spacious-layout', 'Spacious Layout', 'Wide gap between columns creates breathing room.'),
      ],
      rightColumn: [
        textBlock('well-separated', 'Well Separated', 'Large gaps help distinguish between different content areas.'),
      ],
      columnRatio: '50-50',
      gap: 'large',
      verticalAlignment: 'top'
    }
  }
};

export const ReverseOnMobile: Story = {
  args: {
    content: {
      leftColumn: [
        imageBlock('mobile-image', 'Mobile first image'),
      ],
      rightColumn: [
        textBlock('mobile-text', 'Mobile Optimized', 'On mobile devices, these columns can be reversed to prioritize text content.'),
      ],
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'center',
      reverseOnMobile: true
    }
  }
};
