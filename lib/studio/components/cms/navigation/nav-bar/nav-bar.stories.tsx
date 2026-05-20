import type { Meta, StoryObj } from '@storybook/react';
import NavBar from './index';

const meta = {
  title: 'Studio/CMS/Navigation/NavBar',
  component: NavBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio navigation bar component with mobile responsiveness and AI detection support. Features sticky positioning, transparent mode, and customizable CTA buttons.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Navigation bar content configuration',
      control: 'object'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NavBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base navigation items for reuse
const baseMenuItems = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' }
];

const menuWithDropdowns = [
  { label: 'Home', href: '/' },
  { 
    label: 'Products', 
    href: '/products',
    children: [
      { label: 'All Products', href: '/products' },
      { label: 'Featured', href: '/products/featured' },
      { label: 'New Arrivals', href: '/products/new' },
      { label: 'Sale', href: '/products/sale' }
    ]
  },
  {
    label: 'Services',
    href: '/services',
    children: [
      { label: 'Consulting', href: '/services/consulting' },
      { label: 'Support', href: '/services/support' },
      { label: 'Training', href: '/services/training' }
    ]
  },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' }
];

// Default story
export const Default: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: baseMenuItems,
      mobileBreakpoint: 768
    }
  }
};

// With image logo
export const WithImageLogo: Story = {
  args: {
    content: {
      logo: {
        // Using data URL to prevent loading issues
        src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTIwIDQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI2MCIgeT0iMjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TE9HTzwvdGV4dD48L3N2Zz4=',
        alt: 'Company Logo',
        href: '/',
        width: 120,
        height: 40
      },
      menuItems: baseMenuItems,
      mobileBreakpoint: 768
    }
  }
};

// With CTA button
export const WithCTA: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: baseMenuItems,
      cta: {
        text: 'Get Started',
        href: '/signup',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    }
  }
};

// With dropdown menus
export const WithDropdowns: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: menuWithDropdowns,
      cta: {
        text: 'Sign Up',
        href: '/signup',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    }
  }
};

export const StubMenuAlignment: Story = {
  args: {
    content: {
      logo: {
        text: 'Catalyst',
        href: '/'
      },
      menuItems: [
        { label: 'Overview', href: '/home' },
        {
          label: 'Solutions',
          href: '/home/solutions',
          panelAlign: 'start',
          panelOffset: -12,
          children: [
            { label: 'Marketing teams', href: '/home/solutions#marketing' },
            { label: 'Product launches', href: '/home/solutions#launches' },
            { label: 'Agency partners', href: '/home/solutions#agencies' }
          ]
        },
        {
          label: 'Resources',
          href: '/home/resources',
          panelAlign: 'center',
          children: [
            { label: 'Component library', href: '/home/resources#components' },
            { label: 'Design system', href: '/home/resources#design-system' },
            { label: 'Customer stories', href: '/home/resources#customers' }
          ]
        },
        {
          label: 'Pricing',
          href: '/home/pricing',
          panelAlign: 'end',
          panelWidth: '28rem',
          children: [
            { label: 'Plans', href: '/home/pricing#plans' },
            { label: 'Enterprise', href: '/home/pricing#enterprise' },
            { label: 'Compare tiers', href: '/home/pricing#compare' }
          ]
        },
        {
          label: 'About',
          href: '/home/about',
          children: [
            { label: 'Our story', href: '/home/about#story' },
            { label: 'Leadership', href: '/home/about#team' },
            { label: 'Careers', href: '/home/about#careers' }
          ]
        }
      ],
      cta: {
        text: 'Request demo',
        href: '/demo',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Snapshot-aligned navigation data verifies dropdown viewports position under the active trigger with restored motion tokens.'
      }
    }
  }
};

// Sticky navigation
export const Sticky: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: baseMenuItems,
      cta: {
        text: 'Get Started',
        href: '/signup',
        variant: 'primary'
      },
      sticky: true,
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Navigation bar that sticks to the top of the viewport when scrolling.'
      }
    }
  }
};

// Transparent navigation
export const Transparent: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: baseMenuItems,
      cta: {
        text: 'Get Started',
        href: '/signup',
        variant: 'outline'
      },
      transparent: true,
      mobileBreakpoint: 768
    }
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    },
    docs: {
      description: {
        story: 'Transparent navigation bar ideal for hero sections with background images.'
      }
    }
  }
};

// Mobile responsive
export const MobileResponsive: Story = {
  args: {
    content: {
      logo: {
        text: 'Logo',
        href: '/'
      },
      menuItems: baseMenuItems,
      cta: {
        text: 'Get App',
        href: '/download',
        variant: 'primary'
      },
      mobileBreakpoint: 1024
    }
  },

  parameters: {
    docs: {
      description: {
        story: 'Navigation bar optimized for mobile devices with hamburger menu.'
      }
    }
  },

  globals: {
    viewport: {
      value: 'mobile1',
      isRotated: false
    }
  }
};

// Complex mega menu
export const MegaMenu: Story = {
  args: {
    content: {
      logo: {
        text: 'Enterprise',
        href: '/'
      },
      menuItems: [
        { label: 'Home', href: '/' },
        {
          label: 'Products',
          href: '/products',
          children: [
            { label: 'Software Solutions', href: '/products/software' },
            { label: 'Hardware Products', href: '/products/hardware' },
            { label: 'Cloud Services', href: '/products/cloud' },
            { label: 'Mobile Apps', href: '/products/mobile' },
            { label: 'API Platform', href: '/products/api' },
            { label: 'Developer Tools', href: '/products/developer' }
          ]
        },
        {
          label: 'Solutions',
          href: '/solutions',
          children: [
            { label: 'By Industry', href: '/solutions/industry' },
            { label: 'By Company Size', href: '/solutions/size' },
            { label: 'By Use Case', href: '/solutions/use-case' },
            { label: 'Customer Stories', href: '/solutions/stories' }
          ]
        },
        {
          label: 'Resources',
          href: '/resources',
          children: [
            { label: 'Documentation', href: '/docs' },
            { label: 'Blog', href: '/blog' },
            { label: 'Tutorials', href: '/tutorials' },
            { label: 'Webinars', href: '/webinars' },
            { label: 'Support', href: '/support' }
          ]
        },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Contact', href: '/contact' }
      ],
      cta: {
        text: 'Start Free Trial',
        href: '/trial',
        variant: 'primary'
      },
      sticky: true,
      mobileBreakpoint: 1024
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Complex navigation with multiple dropdown menus for enterprise websites.'
      }
    }
  }
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    content: {
      logo: {
        text: 'Dark Mode',
        href: '/'
      },
      menuItems: baseMenuItems,
      cta: {
        text: 'Get Started',
        href: '/signup',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    },
    className: 'bg-gray-900 text-white'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    },
    docs: {
      description: {
        story: 'Navigation bar with dark theme styling.'
      }
    }
  }
};

// Minimal
export const Minimal: Story = {
  args: {
    content: {
      logo: {
        text: 'Minimal',
        href: '/'
      },
      menuItems: [
        { label: 'Work', href: '/work' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' }
      ],
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal navigation bar for portfolio or agency websites.'
      }
    }
  }
};

// With Search (simple inline)
export const WithSearch: Story = {
  args: {
    content: {
      logo: {
        text: 'SearchDemo',
        href: '/'
      },
      menuItems: baseMenuItems,
      search: {
        enabled: true,
        placeholder: 'Search...',
        action: '/search'
      },
      cta: {
        text: 'Get Started',
        href: '/signup',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Navigation bar with search icon that expands to inline search input when clicked.'
      }
    }
  }
};

// With Search Panel (suggestions)
export const WithSearchSuggestions: Story = {
  args: {
    content: {
      logo: {
        text: 'Enterprise',
        href: '/'
      },
      menuItems: baseMenuItems,
      search: {
        enabled: true,
        placeholder: 'Search products, services, or help articles...',
        action: '/search',
        showSuggestions: true,
        panelVariant: 'overlay',
        suggestions: [
          { text: 'Web Design Services', category: 'Services', url: '/services/web-design' },
          { text: 'Mobile App Development', category: 'Services', url: '/services/mobile' },
          { text: 'Cloud Hosting', category: 'Services', url: '/services/cloud' },
          { text: 'Pricing Plans', category: 'Pages', url: '/pricing' },
          { text: 'Contact Support', category: 'Pages', url: '/contact' },
          { text: 'Getting Started Guide', category: 'Help', url: '/docs/getting-started' },
          { text: 'API Documentation', category: 'Help', url: '/docs/api' }
        ],
        recentSearches: ['dashboard', 'billing', 'integrations']
      },
      cta: {
        text: 'Start Free Trial',
        href: '/trial',
        variant: 'primary'
      },
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Navigation bar with rich search panel featuring suggestions grouped by category, recent searches from localStorage, and full keyboard navigation.'
      }
    }
  }
};

// With Search Dropdown
export const WithSearchDropdown: Story = {
  args: {
    content: {
      logo: {
        text: 'CompactSearch',
        href: '/'
      },
      menuItems: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Docs', href: '/docs' }
      ],
      search: {
        enabled: true,
        placeholder: 'Quick search...',
        showSuggestions: true,
        panelVariant: 'dropdown',
        suggestions: [
          { text: 'Installation', category: 'Docs' },
          { text: 'Configuration', category: 'Docs' },
          { text: 'API Reference', category: 'Docs' },
          { text: 'Examples', category: 'Docs' }
        ]
      },
      mobileBreakpoint: 768
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Navigation bar with compact dropdown search panel, ideal for documentation sites.'
      }
    }
  }
};

// Full featured navbar
export const FullFeatured: Story = {
  args: {
    content: {
      logo: {
        src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTIwIDQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI2MCIgeT0iMjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QWNtZTwvdGV4dD48L3N2Zz4=',
        alt: 'Acme Corporation',
        href: '/',
        width: 120,
        height: 40
      },
      menuItems: [
        { label: 'Home', href: '/' },
        {
          label: 'Products',
          href: '/products',
          children: [
            { label: 'All Products', href: '/products' },
            { label: 'Featured', href: '/products/featured' },
            { label: 'New Arrivals', href: '/products/new' }
          ]
        },
        {
          label: 'Solutions',
          href: '/solutions',
          children: [
            { label: 'Enterprise', href: '/solutions/enterprise' },
            { label: 'Small Business', href: '/solutions/smb' },
            { label: 'Startups', href: '/solutions/startups' }
          ]
        },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Contact', href: '/contact' }
      ],
      search: {
        enabled: true,
        placeholder: 'Search Acme...',
        action: '/search',
        showSuggestions: true,
        panelVariant: 'overlay',
        suggestions: [
          { text: 'Product Catalog', category: 'Products' },
          { text: 'Enterprise Solutions', category: 'Solutions' },
          { text: 'Pricing Calculator', category: 'Tools' },
          { text: 'Contact Sales', category: 'Support' }
        ]
      },
      cta: {
        text: 'Get Demo',
        href: '/demo',
        variant: 'primary'
      },
      sticky: true,
      mobileBreakpoint: 1024
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Full-featured navigation bar with image logo, dropdown menus, search with suggestions, CTA button, and sticky positioning. Represents a production-ready enterprise navbar.'
      }
    }
  }
};
