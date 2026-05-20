import type { Meta, StoryObj } from '@storybook/react';
import Breadcrumbs from './index';

const meta = {
  title: 'Studio/CMS/Navigation/Breadcrumbs',
  component: Breadcrumbs,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio breadcrumb navigation component for showing page hierarchy and improving navigation.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Breadcrumb content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default breadcrumbs
export const Default: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Electronics', href: '/products/electronics' },
        { label: 'Laptops', href: '/products/electronics/laptops' }
      ],
      separator: '/',
      showHome: true
    }
  }
};

// With chevron separator
export const ChevronSeparator: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Services', href: '/services' },
        { label: 'Consulting', href: '/services/consulting' }
      ],
      separator: '>',
      showHome: true
    }
  }
};

// With arrow separator
export const ArrowSeparator: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/blog' },
        { label: 'Technology', href: '/blog/technology' },
        { label: 'AI News', href: '/blog/technology/ai' }
      ],
      separator: '→',
      showHome: true
    }
  }
};

// Without home
export const WithoutHome: Story = {
  args: {
    content: {
      items: [
        { label: 'Documentation', href: '/docs' },
        { label: 'API Reference', href: '/docs/api' },
        { label: 'Authentication', href: '/docs/api/auth' }
      ],
      separator: '/',
      showHome: false
    }
  }
};

// Short path
export const ShortPath: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' }
      ],
      separator: '/',
      showHome: true
    }
  }
};

// Long path
export const LongPath: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Electronics', href: '/products/electronics' },
        { label: 'Computers', href: '/products/electronics/computers' },
        { label: 'Laptops', href: '/products/electronics/computers/laptops' },
        { label: 'Gaming Laptops', href: '/products/electronics/computers/laptops/gaming' }
      ],
      separator: '/',
      showHome: true,
      maxItems: 5
    }
  }
};

export const LongPathMobile: Story = {
  args: LongPath.args,
  globals: {
    viewport: {
      value: 'mobile2',
      isRotated: false
    }
  }
};

// With icons
export const WithIcons: Story = {
  args: {
    content: {
      items: [
        { label: '🏠 Home', href: '/' },
        { label: '📚 Docs', href: '/docs' },
        { label: '🔧 API', href: '/docs/api' }
      ],
      separator: '/',
      showHome: false
    }
  }
};

// Collapsed middle items
export const CollapsedItems: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Category', href: '/category' },
        { label: 'Subcategory', href: '/category/sub' },
        { label: 'Item', href: '/category/sub/item' },
        { label: 'Detail', href: '/category/sub/item/detail' }
      ],
      separator: '/',
      showHome: true,
      collapseAfter: 2
    }
  }
};

// Current page not linked
export const CurrentPageNotLinked: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Current Page', href: null }
      ],
      separator: '/',
      showHome: true
    }
  }
};

// Custom styling
export const CustomStyling: Story = {
  args: {
    content: {
      items: [
        { label: 'Home', href: '/' },
        { label: 'Shop', href: '/shop' },
        { label: 'Sale Items', href: '/shop/sale' }
      ],
      separator: '|',
      showHome: true
    },
    className: 'rounded border border-border/30 bg-card p-2'
  }
};
