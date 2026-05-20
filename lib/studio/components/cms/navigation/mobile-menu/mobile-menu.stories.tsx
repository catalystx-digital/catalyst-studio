import type { Meta, StoryObj } from '@storybook/react';
import MobileMenu from './index';

const meta = {
  title: 'Studio/CMS/Navigation/MobileMenu',
  component: MobileMenu,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1'
    },
    docs: {
      description: {
        component: 'Studio mobile menu component with slide-out navigation, nested menus, and smooth animations.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Mobile menu content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MobileMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default mobile menu
export const Default: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Services', href: '/services' },
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left'
    }
  }
};

// With nested items
export const WithNestedItems: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: 'Home', href: '/' },
        {
          label: 'Products',
          href: '/products',
          children: [
            { label: 'All Products', href: '/products' },
            { label: 'Featured', href: '/products/featured' },
            { label: 'New', href: '/products/new' },
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
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left'
    }
  }
};

// Right side menu
export const RightSideMenu: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Profile', href: '/profile' },
        { label: 'Settings', href: '/settings' },
        { label: 'Logout', href: '/logout' }
      ],
      position: 'right'
    }
  }
};

// With header
export const WithHeader: Story = {
  args: {
    content: {
      isOpen: true,
      header: {
        title: 'Menu',
        showClose: true
      },
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'Shop', href: '/shop' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left'
    }
  }
};

// With user info
export const WithUserInfo: Story = {
  args: {
    content: {
      isOpen: true,
      userInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjIwIiB5PSIyNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SkQ8L3RleHQ+PC9zdmc+'
      },
      menuItems: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My Account', href: '/account' },
        { label: 'Orders', href: '/orders' },
        { label: 'Settings', href: '/settings' },
        { label: 'Sign Out', href: '/signout' }
      ],
      position: 'left'
    }
  }
};

// With footer
export const WithFooter: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' }
      ],
      footer: {
        links: [
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' }
        ],
        text: '© 2024 Company'
      },
      position: 'left'
    }
  }
};

// With search
export const WithSearch: Story = {
  args: {
    content: {
      isOpen: true,
      showSearch: true,
      searchPlaceholder: 'Search...',
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Blog', href: '/blog' },
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left'
    }
  }
};

// With icons
export const WithIcons: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: '🏠 Home', href: '/', icon: '🏠' },
        { label: '📦 Products', href: '/products', icon: '📦' },
        { label: '📝 Blog', href: '/blog', icon: '📝' },
        { label: '⚙️ Settings', href: '/settings', icon: '⚙️' },
        { label: '📞 Contact', href: '/contact', icon: '📞' }
      ],
      position: 'left'
    }
  }
};

// Full height menu
export const FullHeight: Story = {
  args: {
    content: {
      isOpen: true,
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Services', href: '/services' },
        { label: 'Portfolio', href: '/portfolio' },
        { label: 'Team', href: '/team' },
        { label: 'Blog', href: '/blog' },
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left',
      fullHeight: true
    }
  }
};

// Closed state
export const ClosedState: Story = {
  args: {
    content: {
      isOpen: false,
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' }
      ],
      position: 'left'
    }
  }
};