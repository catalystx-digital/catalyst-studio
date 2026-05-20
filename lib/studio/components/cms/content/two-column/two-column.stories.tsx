import type { Meta, StoryObj } from '@storybook/react';
import TwoColumn from './index';

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

// Using data URL for placeholder image
const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNlMGU3ZmYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjM2NmY3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZSBQbGFjZWhvbGRlcjwvdGV4dD48L3N2Zz4=';

// Default two column
export const Default: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Left Column',
        body: 'This is the content for the left column. It can contain text, images, or other components.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Right Column',
        body: 'This is the content for the right column. The two-column layout is perfect for comparing information or presenting related content side by side.',
        alignment: 'left'
      },
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'top'
    }
  }
};

// Text and image
export const TextAndImage: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Our Mission',
        body: 'We strive to deliver exceptional value through innovative solutions. Our team is dedicated to pushing boundaries and creating meaningful impact in everything we do.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'image',
        imageUrl: placeholderImage,
        imageAlt: 'Mission illustration',
        imageCaption: 'Innovation in action'
      },
      columnRatio: '50-50',
      gap: 'large',
      verticalAlignment: 'center'
    }
  }
};

// Image and text (reversed)
export const ImageAndText: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'image',
        imageUrl: placeholderImage,
        imageAlt: 'Feature illustration'
      },
      rightColumn: {
        type: 'text',
        heading: 'Feature Spotlight',
        body: 'Discover powerful features designed to enhance your workflow. From automation to analytics, we have everything you need to succeed.',
        alignment: 'left'
      },
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'center'
    }
  }
};

// 60-40 ratio
export const Ratio60_40: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Main Content Area',
        body: 'This column takes up 60% of the available width, giving more emphasis to the primary content. This layout works well when you have a main article with supplementary information.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Sidebar',
        body: 'The narrower column is perfect for related links, quick facts, or calls to action.',
        alignment: 'left'
      },
      columnRatio: '60-40',
      gap: 'large',
      verticalAlignment: 'top'
    }
  }
};

// 40-60 ratio
export const Ratio40_60: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Quick Info',
        body: 'A narrower left column for brief information.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Detailed Content',
        body: 'The wider right column provides more space for detailed explanations, longer text, or larger images. This reversed ratio can create visual interest.',
        alignment: 'left'
      },
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'top'
    }
  }
};

// 70-30 ratio
export const Ratio70_30: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Primary Content',
        body: 'With 70% of the width, this column dominates the layout. Perfect for blog posts with a small sidebar or main content with supplementary notes.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Notes',
        body: 'Small sidebar for additional notes.',
        alignment: 'left'
      },
      columnRatio: '70-30',
      gap: 'small',
      verticalAlignment: 'top'
    }
  }
};

// Center aligned vertically
export const VerticalCenter: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Vertically Centered',
        body: 'This content is centered vertically within its column.',
        alignment: 'center'
      },
      rightColumn: {
        type: 'image',
        imageUrl: placeholderImage,
        imageAlt: 'Centered image'
      },
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'center'
    }
  }
};

// Bottom aligned
export const VerticalBottom: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Bottom Aligned',
        body: 'Content aligned to the bottom of the column.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Also Bottom',
        body: 'Both columns align their content to the bottom, useful for creating baseline alignment.',
        alignment: 'left'
      },
      columnRatio: '50-50',
      gap: 'medium',
      verticalAlignment: 'bottom'
    }
  }
};

// Small gap
export const SmallGap: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Tight Spacing',
        body: 'Columns with minimal gap between them.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Close Together',
        body: 'Small gaps work well for related content that should feel connected.',
        alignment: 'left'
      },
      columnRatio: '50-50',
      gap: 'small',
      verticalAlignment: 'top'
    }
  }
};

// Large gap
export const LargeGap: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'text',
        heading: 'Spacious Layout',
        body: 'Wide gap between columns creates breathing room.',
        alignment: 'left'
      },
      rightColumn: {
        type: 'text',
        heading: 'Well Separated',
        body: 'Large gaps help distinguish between different content areas.',
        alignment: 'left'
      },
      columnRatio: '50-50',
      gap: 'large',
      verticalAlignment: 'top'
    }
  }
};

// Reverse on mobile
export const ReverseOnMobile: Story = {
  args: {
    content: {
      leftColumn: {
        type: 'image',
        imageUrl: placeholderImage,
        imageAlt: 'Mobile first image'
      },
      rightColumn: {
        type: 'text',
        heading: 'Mobile Optimized',
        body: 'On mobile devices, these columns can be reversed to prioritize text content.',
        alignment: 'left'
      },
      columnRatio: '40-60',
      gap: 'medium',
      verticalAlignment: 'center',
      reverseOnMobile: true
    }
  }
};