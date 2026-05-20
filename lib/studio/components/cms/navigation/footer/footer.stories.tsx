import type { Meta, StoryObj } from '@storybook/react';
import Footer from './index';
import type { FooterColumn, FooterSocialLink } from './footer.types';

const meta = {
  title: 'Studio/CMS/Navigation/Footer',
  component: Footer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Studio footer component with column navigation, legal links, social icons, and optional newsletter signup.'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

const navigationColumns: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Security', href: '/security' }
    ]
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'API Reference', href: '/api' },
      { label: 'Status', href: '/status' },
      { label: 'Support', href: '/support' }
    ]
  }
];

const socialLinks: FooterSocialLink[] = [
  { platform: 'twitter', url: 'https://twitter.com/catalyststudio', label: 'Follow on Twitter/X' },
  { platform: 'linkedin', url: 'https://linkedin.com/company/catalyststudio', label: 'Connect on LinkedIn' },
  { platform: 'github', url: 'https://github.com/catalyst', label: 'View GitHub' }
];

export const Default: Story = {
  args: {
    theme: 'auto',
    content: {
      logo: 'Catalyst Studio',
      description: 'Design, launch, and scale studio customer experiences without touching code.',
      columns: navigationColumns,
      socialLinks,
      legalLinks: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms', href: '/terms' }
      ],
      copyright: '© 2024 Catalyst Studio. All rights reserved.'
    }
  }
};

export const WithNewsletter: Story = {
  args: {
    theme: 'auto',
    content: {
      logo: 'Catalyst Studio',
      description: 'Subscribe for product updates, best practices, and release notes.',
      columns: navigationColumns.slice(0, 2),
      socialLinks,
      newsletter: {
        heading: 'Stay in the loop',
        description: 'Join our newsletter for monthly updates.',
        placeholder: 'Enter your email',
        buttonText: 'Subscribe'
      },
      copyright: '© 2024 Catalyst Studio. All rights reserved.'
    }
  }
};

export const Minimal: Story = {
  args: {
    theme: 'auto',
    content: {
      logo: 'Catalyst Studio',
      socialLinks: [socialLinks[0]],
      copyright: '© 2024 Catalyst Studio'
    }
  }
};

export const DarkTheme: Story = {
  args: {
    theme: 'dark',
    content: {
      logo: 'Catalyst Studio',
      description: 'Purpose-built tools for studio experiences.',
      columns: navigationColumns,
      socialLinks,
      legalLinks: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms', href: '/terms' }
      ],
      newsletter: {
        heading: 'Join the studio newsletter',
        description: 'Monthly updates, product launches, and curated insights.',
        placeholder: 'you@example.com',
        buttonText: 'Notify me'
      },
      copyright: '© 2024 Catalyst Studio. All rights reserved.'
    }
  }
};
