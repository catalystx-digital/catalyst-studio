import type { Meta, StoryObj } from '@storybook/react';
import { QuoteBlock } from './index';

const meta = {
  title: 'Studio/CMS/Content/QuoteBlock',
  component: QuoteBlock,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio quote block component for displaying testimonials, quotes, and citations with various styles.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Quote block content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof QuoteBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

// Using data URL for avatar placeholder
const avatarPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI0MCIgZmlsbD0iI2U1ZTdlYiIvPjxwYXRoIGQ9Ik00MCAzNWMtNS41IDAtMTAtNC41LTEwLTEwczQuNS0xMCAxMC0xMCAxMCA0LjUgMTAgMTAtNC41IDEwLTEwIDEwem0wIDVjMTEgMCAyMCA0LjUgMjAgMjB2NUgyMHYtNWMwLTE1LjUgOS0yMCAyMC0yMHoiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4=';

// Default quote
export const Default: Story = {
  args: {
    content: {
      quote: 'The best way to predict the future is to invent it.',
      attribution: {
        author: 'Alan Kay',
        title: 'Computer Scientist'
      }
    },
    variant: 'default'
  }
};

// With citation
export const WithCitation: Story = {
  args: {
    content: {
      quote: 'Innovation distinguishes between a leader and a follower.',
      attribution: {
        author: 'Steve Jobs',
        title: 'Co-founder',
        organization: 'Apple Inc.',
        date: 'Stanford Commencement Speech, 2005'
      }
    },
    variant: 'default'
  }
};

// Featured quote
export const Featured: Story = {
  args: {
    content: {
      quote: 'The only way to do great work is to love what you do.',
      attribution: {
        author: 'Steve Jobs',
        title: 'CEO',
        organization: 'Apple Inc.'
      },
      highlight: true,
      style: 'highlighted'
    },
    variant: 'default'
  }
};

// With heading
export const WithHeading: Story = {
  args: {
    content: {
      heading: 'Quote of the Day',
      quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
      attribution: {
        author: 'Winston Churchill',
        title: 'Prime Minister of the United Kingdom'
      }
    },
    variant: 'default'
  }
};

// Testimonial style
export const Testimonial: Story = {
  args: {
    content: {
      quote: 'This product has completely transformed how we handle our workflow. The efficiency gains have been remarkable.',
      attribution: {
        author: 'Sarah Johnson',
        title: 'CTO',
        organization: 'Tech Innovators Inc.',
        image: avatarPlaceholder
      },
      style: 'testimonial'
    },
    variant: 'default'
  }
};

// With organization logo
export const WithLogo: Story = {
  args: {
    content: {
      quote: 'Partnership with this team has been instrumental in our digital transformation journey.',
      attribution: {
        author: 'Michael Chen',
        title: 'Director of Innovation',
        organization: 'Global Solutions Ltd.',
        image: avatarPlaceholder
      }
    },
    variant: 'default'
  }
};

// Pullquote style
export const Pullquote: Story = {
  args: {
    content: {
      quote: 'Design is not just what it looks like and feels like. Design is how it works.',
      attribution: {
        author: 'Steve Jobs'
      },
      style: 'pullquote',
      size: 'large'
    },
    variant: 'default'
  }
};

// Bordered style
export const Bordered: Story = {
  args: {
    content: {
      quote: 'The future belongs to those who believe in the beauty of their dreams.',
      attribution: {
        author: 'Eleanor Roosevelt',
        title: 'Former First Lady of the United States'
      },
      style: 'bordered'
    },
    variant: 'default'
  }
};

// Multiple paragraphs
export const LongQuote: Story = {
  args: {
    content: {
      quote: 'Stay hungry. Stay foolish. And I have always wished that for myself. And now, as you graduate to begin anew, I wish that for you.',
      attribution: {
        author: 'Steve Jobs',
        date: 'June 12, 2005',
        organization: 'Stanford University'
      }
    },
    variant: 'default'
  }
};

// With custom icon
export const CustomIcon: Story = {
  args: {
    content: {
      quote: 'Imagination is more important than knowledge.',
      attribution: {
        author: 'Albert Einstein',
        title: 'Theoretical Physicist'
      },
      icon: 'custom',
      customIcon: '✨'
    },
    variant: 'default'
  }
};

// Without icon
export const NoIcon: Story = {
  args: {
    content: {
      quote: 'The best time to plant a tree was 20 years ago. The second best time is now.',
      attribution: {
        author: 'Chinese Proverb'
      },
      icon: 'none'
    },
    variant: 'default'
  }
};

// Different alignments
export const CenterAligned: Story = {
  args: {
    content: {
      quote: 'Be yourself; everyone else is already taken.',
      attribution: {
        author: 'Oscar Wilde'
      },
      align: 'center'
    },
    variant: 'default'
  }
};

export const RightAligned: Story = {
  args: {
    content: {
      quote: 'In the middle of difficulty lies opportunity.',
      attribution: {
        author: 'Albert Einstein'
      },
      align: 'right'
    },
    variant: 'default'
  }
};

// Different sizes
export const SmallSize: Story = {
  args: {
    content: {
      quote: 'Less is more.',
      attribution: {
        author: 'Ludwig Mies van der Rohe',
        title: 'Architect'
      },
      size: 'small'
    },
    variant: 'default'
  }
};

export const LargeSize: Story = {
  args: {
    content: {
      quote: 'Think different.',
      attribution: {
        author: 'Apple Inc.'
      },
      size: 'large'
    },
    variant: 'default'
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      quote: 'The night is darkest just before the dawn.',
      attribution: {
        author: 'Harvey Dent',
        organization: 'The Dark Knight'
      }
    },
    theme: 'dark',
    variant: 'default'
  },
  parameters: {
    backgrounds: { default: 'dark' }
  }
};

// Animated variant
export const Animated: Story = {
  args: {
    content: {
      quote: 'Movement is life.',
      attribution: {
        author: 'Moshe Feldenkrais',
        title: 'Physicist and Engineer'
      }
    },
    animated: true,
    variant: 'default'
  }
};