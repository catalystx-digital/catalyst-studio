import type { Meta, StoryObj } from '@storybook/react';
import HeroBanner from './index';

const meta = {
  title: 'Studio/CMS/Heroes/HeroBanner',
  component: HeroBanner,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio hero banner component with background media support, overlays, and customizable CTAs. Perfect for landing pages and marketing sites.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Hero banner content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HeroBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    content: {
      heading: 'Welcome to Our Platform',
      subheading: 'Build something amazing',
      description: 'Start your journey with our powerful tools and features designed to help you succeed.',
      cta: {
        primary: {
          text: 'Get Started',
          href: '/signup'
        },
        secondary: {
          text: 'Learn More',
          href: '/features'
        }
      }
    }
  }
};

// With background image
export const WithBackgroundImage: Story = {
  args: {
    content: {
      heading: 'Transform Your Business',
      subheading: 'Enterprise solutions that scale',
      description: 'Powerful tools and integrations to accelerate your growth.',
      // backgroundImage removed to prevent loading issues
      overlay: true,
      overlayOpacity: 0.5,
      cta: {
        primary: {
          text: 'Start Free Trial',
          href: '/trial'
        },
        secondary: {
          text: 'Watch Demo',
          href: '/demo'
        }
      }
    }
  }
};

// Centered alignment
export const CenteredAlignment: Story = {
  args: {
    content: {
      heading: 'Build Your Dream Project',
      subheading: 'Everything you need in one place',
      description: 'Join thousands of developers who are already building amazing applications.',
      alignment: 'center',
      cta: {
        primary: {
          text: 'Get Started Free',
          href: '/signup'
        }
      }
    }
  }
};

// Minimal style
export const Minimal: Story = {
  args: {
    content: {
      heading: 'Simple. Powerful. Yours.',
      subheading: 'The future of web development',
      alignment: 'center',
      minHeight: '60vh'
    }
  }
};

// With video background
export const WithVideoBackground: Story = {
  args: {
    content: {
      heading: 'Experience the Future',
      subheading: 'Innovation at your fingertips',
      description: 'Discover cutting-edge technology that transforms the way you work.',
      backgroundVideo: '/hero-video.mp4',
      overlay: true,
      overlayOpacity: 0.6,
      cta: {
        primary: {
          text: 'Explore Now',
          href: '/explore'
        }
      }
    }
  }
};

// Left aligned
export const LeftAligned: Story = {
  args: {
    content: {
      heading: 'Powerful Analytics Platform',
      subheading: 'Data-driven insights for your business',
      description: 'Make informed decisions with real-time analytics and comprehensive reporting tools.',
      alignment: 'left',
      cta: {
        primary: {
          text: 'Request Demo',
          href: '/demo'
        },
        secondary: {
          text: 'View Pricing',
          href: '/pricing'
        }
      }
    }
  }
};

// Right aligned
export const RightAligned: Story = {
  args: {
    content: {
      heading: 'Creative Design Studio',
      subheading: 'Where ideas come to life',
      description: 'Professional design services for brands that want to stand out.',
      alignment: 'right',
      // backgroundImage removed to prevent loading issues
      overlay: true,
      cta: {
        primary: {
          text: 'View Portfolio',
          href: '/portfolio'
        }
      }
    }
  }
};

// Full height
export const FullHeight: Story = {
  args: {
    content: {
      heading: 'Welcome to the Revolution',
      subheading: 'Change starts here',
      description: 'Be part of something bigger. Join our community of innovators.',
      minHeight: '100vh',
      alignment: 'center',
      // backgroundImage removed to prevent loading issues
      overlay: true,
      overlayOpacity: 0.7,
      cta: {
        primary: {
          text: 'Join Us',
          href: '/join'
        }
      }
    }
  }
};

// With badge
export const WithBadge: Story = {
  args: {
    content: {
      badge: '🎉 New Release',
      heading: 'Version 2.0 is Here',
      subheading: 'Faster, smarter, better',
      description: 'Experience the most powerful update yet with new features and improvements.',
      cta: {
        primary: {
          text: 'Upgrade Now',
          href: '/upgrade'
        },
        secondary: {
          text: 'Release Notes',
          href: '/changelog'
        }
      }
    }
  }
};

// E-commerce focused
export const ECommerce: Story = {
  args: {
    content: {
      badge: 'Limited Time Offer',
      heading: 'Summer Sale - Up to 50% Off',
      subheading: 'Shop the latest trends',
      description: 'Discover amazing deals on our entire collection. Free shipping on orders over $50.',
      // backgroundImage removed to prevent loading issues
      overlay: true,
      cta: {
        primary: {
          text: 'Shop Now',
          href: '/shop'
        },
        secondary: {
          text: 'View Collection',
          href: '/collection'
        }
      }
    }
  }
};

// SaaS focused
export const SaaS: Story = {
  args: {
    content: {
      heading: 'All-in-One Business Platform',
      subheading: 'Streamline your workflow',
      description: 'Manage projects, communicate with teams, and track progress - all in one place.',
      features: [
        '✓ Unlimited Projects',
        '✓ Team Collaboration',
        '✓ Advanced Analytics',
        '✓ 24/7 Support'
      ],
      cta: {
        primary: {
          text: 'Start 14-Day Trial',
          href: '/trial'
        },
        secondary: {
          text: 'See How It Works',
          href: '/demo'
        }
      }
    }
  }
};

// Mobile app promotion
export const MobileApp: Story = {
  args: {
    content: {
      heading: 'Your Life, Organized',
      subheading: 'Available on iOS and Android',
      description: 'Download our app and take control of your daily tasks with ease.',
      appStoreLinks: {
        apple: 'https://apps.apple.com/...',
        google: 'https://play.google.com/...'
      },
      // backgroundImage removed to prevent loading issues
      overlay: true
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Hero banner optimized for mobile app promotion with app store download links.'
      }
    }
  }
};