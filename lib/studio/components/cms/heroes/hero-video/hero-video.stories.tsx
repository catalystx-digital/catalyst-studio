import type { Meta, StoryObj } from '@storybook/react';
import HeroVideo from './index';

const meta = {
  title: 'Studio/CMS/Heroes/HeroVideo',
  component: HeroVideo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio hero component with video background and overlay content.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Hero video content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeroVideo>;

export default meta;
type Story = StoryObj<typeof meta>;

// Using data URLs for placeholders to prevent loading issues
const posterPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzFhMjAyYztzdG9wLW9wYWNpdHk6MSIgLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzNzQxNTE7c3RvcC1vcGFjaXR5OjEiIC8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjE5MjAiIGhlaWdodD0iMTA4MCIgZmlsbD0idXJsKCNncmFkKSIvPjxwb2x5Z29uIHBvaW50cz0iOTYwLDQ0MCAxMDgwLDUwMCAxMDgwLDM4MCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC42Ii8+PC9zdmc+';
const fallbackPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IiMyNjMyM2MiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjNjM2ZjgzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5WaWRlbyBVbmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';

// Default video hero
export const Default: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Experience the Future',
        subheading: 'Innovation at your fingertips',
        body: 'Discover cutting-edge technology that transforms the way you work.',
        ctaButtons: [
          {
            label: 'Get Started',
            href: '#',
            variant: 'primary'
          },
          {
            label: 'Watch Demo',
            href: '#',
            variant: 'secondary'
          }
        ]
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'large'
    }
  }
};

// With controls
export const WithControls: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Watch Our Story',
        subheading: 'Control the experience'
      },
      videoSettings: {
        autoplay: false,
        loop: false,
        muted: false,
        controls: true
      },
      height: 'medium'
    }
  }
};

// Minimal overlay
export const MinimalOverlay: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Simple. Beautiful. Powerful.'
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'full'
    }
  }
};

// No overlay content
export const NoOverlay: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'large'
    }
  }
};

// With fallback
export const WithFallback: Story = {
  args: {
    content: {
      videoUrl: 'invalid-video-url.mp4',
      posterImage: posterPlaceholder,
      fallbackImage: fallbackPlaceholder,
      overlayContent: {
        heading: 'Fallback Mode',
        subheading: 'Video unavailable',
        body: 'This demonstrates the fallback behavior when video fails to load.'
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'large'
    }
  }
};

// Small height
export const SmallHeight: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Compact Video Hero',
        body: 'Perfect for section headers'
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'small'
    }
  }
};

// Medium height
export const MediumHeight: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Balanced Layout',
        subheading: 'Not too big, not too small'
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'medium'
    }
  }
};

// Full height
export const FullHeight: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Immersive Experience',
        subheading: 'Full viewport height',
        body: 'Create a dramatic first impression with full-screen video backgrounds.',
        ctaButtons: [
          {
            label: 'Explore',
            href: '#',
            variant: 'primary'
          }
        ]
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'full'
    }
  }
};

// Multiple CTAs
export const MultipleCTAs: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Take Action',
        subheading: 'Choose your next step',
        ctaButtons: [
          {
            label: 'Start Free Trial',
            href: '#',
            variant: 'primary',
            icon: '🚀'
          },
          {
            label: 'Schedule Demo',
            href: '#',
            variant: 'secondary',
            icon: '📅'
          },
          {
            label: 'Learn More',
            href: '#',
            variant: 'outline',
            icon: '📖'
          }
        ]
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'large'
    }
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      posterImage: posterPlaceholder,
      overlayContent: {
        heading: 'Dark Mode Video Hero',
        subheading: 'Optimized for dark themes',
        body: 'Video backgrounds work beautifully in dark mode.',
        ctaButtons: [
          {
            label: 'Get Started',
            href: '#',
            variant: 'primary'
          }
        ]
      },
      videoSettings: {
        autoplay: true,
        loop: true,
        muted: true,
        controls: false
      },
      height: 'large'
    },
    theme: 'dark'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
};