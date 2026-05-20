import type { Meta, StoryObj } from '@storybook/react';
import HeroSplit from './index';

const meta = {
  title: 'Studio/CMS/Heroes/HeroSplit',
  component: HeroSplit,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio hero split component with side-by-side content and media layout.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Hero split content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeroSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

// Using data URL for placeholder image to prevent loading issues
const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojNjY3ZWVhO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6Izc2NGJhMDtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0idXJsKCNncmFkKSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzIiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkhlcm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

// Default split hero
export const Default: Story = {
  args: {
    content: {
      heading: 'Welcome to Our Platform',
      subheading: 'Build something amazing today',
      body: 'Our platform provides all the tools you need to create, deploy, and scale your applications with confidence.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Platform illustration'
      },
      mediaPosition: 'right',
      splitRatio: '50-50',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '#',
          variant: 'primary'
        },
        {
          label: 'Learn More',
          href: '#',
          variant: 'secondary'
        }
      ]
    }
  }
};

// Media on left
export const MediaLeft: Story = {
  args: {
    content: {
      heading: 'Innovative Solutions',
      subheading: 'For modern businesses',
      body: 'Transform your workflow with our cutting-edge technology and intuitive design.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Innovation illustration'
      },
      mediaPosition: 'left',
      splitRatio: '50-50',
      ctaButtons: [
        {
          label: 'Start Free Trial',
          href: '#',
          variant: 'primary'
        }
      ]
    }
  }
};

// 60-40 split ratio
export const Ratio60_40: Story = {
  args: {
    content: {
      heading: 'More Content Space',
      subheading: 'Perfect for detailed descriptions',
      body: 'When you need more room for text content, the 60-40 split gives you extra space while maintaining visual balance with your media.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Content illustration'
      },
      mediaPosition: 'right',
      splitRatio: '60-40',
      ctaButtons: [
        {
          label: 'Explore Features',
          href: '#',
          variant: 'primary'
        }
      ]
    }
  }
};

// 40-60 split ratio
export const Ratio40_60: Story = {
  args: {
    content: {
      heading: 'Visual Focus',
      subheading: 'Let images tell the story',
      body: 'Sometimes the visual speaks louder than words.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Visual focus'
      },
      mediaPosition: 'right',
      splitRatio: '40-60'
    }
  }
};

// With video
export const WithVideo: Story = {
  args: {
    content: {
      heading: 'See It In Action',
      subheading: 'Watch our demo video',
      body: 'Get a quick overview of our platform capabilities in this short demonstration.',
      media: {
        type: 'video',
        src: 'https://www.w3schools.com/html/mov_bbb.mp4',
        poster: placeholderImage
      },
      mediaPosition: 'right',
      splitRatio: '50-50',
      ctaButtons: [
        {
          label: 'Try It Now',
          href: '#',
          variant: 'primary',
          icon: '▶'
        }
      ]
    }
  }
};

// Without CTA buttons
export const NoCTA: Story = {
  args: {
    content: {
      heading: 'Simple and Clean',
      subheading: 'Focus on the message',
      body: 'Sometimes you want to present information without pushing for immediate action. This clean layout puts the focus on your content.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Clean design'
      },
      mediaPosition: 'right',
      splitRatio: '50-50'
    }
  }
};

// Multiple CTA buttons with icons
export const MultipleCTAs: Story = {
  args: {
    content: {
      heading: 'Choose Your Path',
      subheading: 'Multiple ways to get started',
      body: 'We offer different options to suit your needs.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Options illustration'
      },
      mediaPosition: 'left',
      splitRatio: '50-50',
      ctaButtons: [
        {
          label: 'Start Free',
          href: '#',
          variant: 'primary',
          icon: '🚀'
        },
        {
          label: 'Book Demo',
          href: '#',
          variant: 'secondary',
          icon: '📅'
        },
        {
          label: 'View Pricing',
          href: '#',
          variant: 'outline',
          icon: '💰'
        }
      ]
    }
  }
};

// Minimal content
export const Minimal: Story = {
  args: {
    content: {
      heading: 'Less Is More',
      body: 'A minimalist approach to hero sections.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Minimal design'
      },
      mediaPosition: 'right',
      splitRatio: '50-50'
    }
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      heading: 'Dark Mode Ready',
      subheading: 'Beautiful in any theme',
      body: 'Our components adapt seamlessly to dark themes, ensuring a consistent experience across all viewing preferences.',
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Dark theme illustration'
      },
      mediaPosition: 'right',
      splitRatio: '50-50',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '#',
          variant: 'primary'
        }
      ]
    },
    theme: 'dark'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
};

// With features list
export const WithFeatures: Story = {
  args: {
    content: {
      heading: 'Everything You Need',
      subheading: 'All features included',
      body: 'Get access to our complete feature set:',
      features: [
        '✓ Unlimited projects',
        '✓ Team collaboration',
        '✓ Advanced analytics',
        '✓ 24/7 support'
      ],
      media: {
        type: 'image',
        src: placeholderImage,
        alt: 'Features illustration'
      },
      mediaPosition: 'right',
      splitRatio: '60-40',
      ctaButtons: [
        {
          label: 'Start Today',
          href: '#',
          variant: 'primary'
        }
      ]
    }
  }
};