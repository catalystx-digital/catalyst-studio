import type { Meta, StoryObj } from '@storybook/react';
import HeroMinimal from './index';

const meta = {
  title: 'Studio/CMS/Heroes/HeroMinimal',
  component: HeroMinimal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio minimal hero component for clean, focused messaging.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Hero minimal content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeroMinimal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default minimal hero
export const Default: Story = {
  args: {
    content: {
      heading: 'Simple. Powerful. Yours.',
      subheading: 'The future of web development',
      alignment: 'center',
      height: 'medium'
    }
  }
};

// With CTA
export const WithCTA: Story = {
  args: {
    content: {
      heading: 'Start Your Journey',
      subheading: 'Join thousands of satisfied users',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '#',
          variant: 'primary'
        }
      ],
      alignment: 'center',
      height: 'medium'
    }
  }
};

// Multiple CTAs
export const MultipleCTAs: Story = {
  args: {
    content: {
      heading: 'Choose Your Path',
      subheading: 'Multiple ways to begin',
      ctaButtons: [
        {
          label: 'Start Free',
          href: '#',
          variant: 'primary'
        },
        {
          label: 'Learn More',
          href: '#',
          variant: 'outline'
        }
      ],
      alignment: 'center',
      height: 'medium'
    }
  }
};

// Left aligned
export const LeftAligned: Story = {
  args: {
    content: {
      heading: 'Left-Aligned Hero',
      subheading: 'Perfect for asymmetric layouts',
      ctaButtons: [
        {
          label: 'Explore',
          href: '#',
          variant: 'primary'
        }
      ],
      alignment: 'left',
      height: 'medium'
    }
  }
};

// Right aligned
export const RightAligned: Story = {
  args: {
    content: {
      heading: 'Right-Aligned Content',
      subheading: 'Create visual balance',
      alignment: 'right',
      height: 'medium'
    }
  }
};

// Small height
export const SmallHeight: Story = {
  args: {
    content: {
      heading: 'Compact Hero',
      subheading: 'Less is more',
      alignment: 'center',
      height: 'small'
    }
  }
};

// Large height
export const LargeHeight: Story = {
  args: {
    content: {
      heading: 'Breathe',
      subheading: 'Space to think',
      alignment: 'center',
      height: 'large'
    }
  }
};

// Full height
export const FullHeight: Story = {
  args: {
    content: {
      heading: 'Full Screen Impact',
      subheading: 'Make a statement',
      ctaButtons: [
        {
          label: 'Dive In',
          href: '#',
          variant: 'primary'
        }
      ],
      alignment: 'center',
      height: 'full'
    }
  }
};

// Heading only
export const HeadingOnly: Story = {
  args: {
    content: {
      heading: 'Minimalism at Its Finest',
      alignment: 'center',
      height: 'large'
    }
  }
};

// With badge
export const WithBadge: Story = {
  args: {
    content: {
      badge: '🎉 New',
      heading: 'Fresh Release',
      subheading: 'Just launched today',
      ctaButtons: [
        {
          label: 'Try Now',
          href: '#',
          variant: 'primary'
        }
      ],
      alignment: 'center',
      height: 'medium'
    }
  }
};

// With background pattern
export const WithPattern: Story = {
  args: {
    content: {
      heading: 'Textured Background',
      subheading: 'Subtle patterns add depth',
      backgroundPattern: 'dots',
      alignment: 'center',
      height: 'large'
    }
  }
};

// Gradient background
export const GradientBackground: Story = {
  args: {
    content: {
      heading: 'Gradient Magic',
      subheading: 'Colors that inspire',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      alignment: 'center',
      height: 'large',
      ctaButtons: [
        {
          label: 'Explore',
          href: '#',
          variant: 'outline'
        }
      ]
    },
    className: 'text-white'
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      heading: 'Dark Mode Ready',
      subheading: 'Beautiful in any theme',
      ctaButtons: [
        {
          label: 'Get Started',
          href: '#',
          variant: 'primary'
        }
      ],
      alignment: 'center',
      height: 'medium'
    },
    theme: 'dark'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
};

// Typography showcase
export const TypographyShowcase: Story = {
  args: {
    content: {
      heading: 'Typography Is Everything',
      subheading: 'The right font makes all the difference in creating impactful minimal designs',
      alignment: 'center',
      height: 'large',
      fontSize: 'large'
    }
  }
};