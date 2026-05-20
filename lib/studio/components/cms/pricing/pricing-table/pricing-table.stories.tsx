import type { Meta, StoryObj } from '@storybook/react';
import PricingTable from './index';

const meta = {
  title: 'Studio/CMS/Pricing/PricingTable',
  component: PricingTable,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PricingTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      title: 'Transparent pricing for every stage',
      subtitle: 'Choose the plan that matches your team’s pace and scale as you grow.',
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          description: 'For personal projects and early prototypes.',
          price: 12,
          currency: 'USD',
          period: 'monthly',
          features: ['Up to 5 projects', 'Basic support', '10 GB storage'],
          ctaText: 'Start Building',
          ctaUrl: 'https://example.com/signup/starter',
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'Collaboration tools for growing teams.',
          price: 29,
          originalPrice: 39,
          currency: 'USD',
          period: 'monthly',
          features: ['Unlimited projects', 'Priority support', '100 GB storage'],
          badge: 'Most Popular',
          highlighted: true,
          ctaText: 'Go Pro',
          ctaUrl: 'https://example.com/signup/pro',
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Advanced governance and dedicated support.',
          price: 89,
          currency: 'USD',
          period: 'monthly',
          features: [
            'Unlimited workspaces',
            'Dedicated success manager',
            'Enterprise SSO',
          ],
          ctaText: 'Talk to sales',
          ctaUrl: 'https://example.com/contact',
        },
      ],
      features: [
        {
          name: 'Unlimited viewers',
          availability: [true, true, true],
        },
        {
          name: 'Priority support',
          availability: [false, true, true],
          tooltip: '24-hour response time with prioritized escalation.',
        },
        {
          name: 'Security review',
          availability: [false, false, true],
          tooltip: 'Annual audit and compliance reporting.',
        },
      ],
    },
  },
};

export const Compact: Story = {
  args: {
    variant: 'compact',
    content: {
      plans: [
        {
          id: 'basic-annual',
          name: 'Basic Annual',
          description: 'Save more with annual billing.',
          price: 99,
          originalPrice: 120,
          currency: 'USD',
          period: 'annual',
          features: ['Everything in Starter', 'Email reports'],
          ctaText: 'Choose Basic',
          ctaUrl: 'https://example.com/signup/basic-annual',
        },
        {
          id: 'team-annual',
          name: 'Team Annual',
          description: 'Best for product teams that iterate weekly.',
          price: 249,
          originalPrice: 312,
          currency: 'USD',
          period: 'annual',
          features: [
            'Unlimited editors',
            'Advanced analytics',
            'Bulk uploads',
          ],
          badge: 'Save 20%',
          popular: true,
          ctaText: 'Choose Team',
          ctaUrl: 'https://example.com/signup/team-annual',
        },
      ],
      showComparison: false,
    },
  },
};

export const DetailedWithComparison: Story = {
  args: {
    variant: 'detailed',
    content: {
      title: 'Built for scale',
      subtitle: 'Flexible plans with enterprise-grade compliance.',
      plans: [
        {
          id: 'scale',
          name: 'Scale',
          price: 149,
          currency: 'USD',
          period: 'monthly',
          description: 'Advanced performance tooling and unlimited seats.',
          features: [
            'Unlimited workflows',
            '1 TB asset library',
            'Usage analytics',
          ],
          ctaText: 'Upgrade to Scale',
          ctaUrl: 'https://example.com/signup/scale',
        },
        {
          id: 'enterprise-plus',
          name: 'Enterprise Plus',
          price: 299,
          currency: 'USD',
          period: 'monthly',
          description: 'Dedicated pods, custom SLAs, and private beta access.',
          features: [
            'Dedicated support pod',
            'Compliance assistance',
            'Private beta access',
          ],
          highlighted: true,
          badge: 'Early Access',
          ctaText: 'Contact partnership',
          ctaUrl: 'https://example.com/contact/enterprise',
        },
        {
          id: 'global',
          name: 'Global',
          price: 499,
          currency: 'USD',
          period: 'monthly',
          description: 'Global rollouts with regional content governance.',
          features: [
            'Regional content routing',
            'Multi-brand workspaces',
            'SAML + SCIM provisioning',
          ],
          ctaText: 'Talk with us',
          ctaUrl: 'https://example.com/contact/global',
        },
      ],
      features: [
        {
          name: 'Uptime SLA',
          availability: [true, true, true],
        },
        {
          name: 'Dedicated CSM',
          availability: [false, true, true],
        },
        {
          name: 'Compliance audit support',
          availability: [false, false, true],
          tooltip: 'Includes tailored audit documentation and remediation support.',
        },
        {
          name: 'Private data residency',
          availability: [false, false, true],
        },
      ],
      highlightDifferences: true,
    },
  },
};
