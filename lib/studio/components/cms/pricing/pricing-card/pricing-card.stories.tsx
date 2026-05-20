import type { Meta, StoryObj } from '@storybook/react';
import PricingCard from './index';

const meta = {
  title: 'Studio/CMS/Pricing/PricingCard',
  component: PricingCard,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof PricingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      name: 'Professional',
      description: 'Everything teams need to design, launch, and iterate quickly.',
      price: 49,
      originalPrice: 69,
      currency: 'USD',
      period: 'monthly',
      features: [
        { text: 'Unlimited projects', included: true },
        { text: 'Priority chat support', included: true },
        { text: 'Advanced analytics dashboard', included: true, tooltip: 'Usage-based funnels, retention cohorts, and custom exports.' },
        { text: 'Dedicated success manager', included: false },
      ],
      ctaText: 'Start free trial',
      ctaUrl: 'https://example.com/signup/professional',
      badge: 'Best value',
      highlighted: true,
    },
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    content: {
      name: 'Starter',
      description: 'Great for individuals validating new ideas.',
      price: 12,
      currency: 'USD',
      period: 'monthly',
      features: [
        { text: 'Up to 5 projects', included: true },
        { text: 'Email support', included: true },
        { text: 'Shared asset library', included: false },
      ],
      ctaText: 'Choose Starter',
      ctaUrl: '/signup/starter',
      badge: 'New',
    },
  },
};

export const FilledDisabled: Story = {
  args: {
    variant: 'filled',
    content: {
      name: 'Enterprise',
      description: 'Custom integrations, SLAs, and dedicated support pods.',
      price: 249,
      currency: 'USD',
      period: 'monthly',
      features: [
        { text: 'Unlimited workspaces', included: true },
        { text: 'SAML + SCIM provisioning', included: true },
        { text: 'Dedicated support pod', included: true },
        { text: 'Regional data residency', included: true, tooltip: 'Route customer data through the closest available region.' },
      ],
      ctaText: 'Talk to sales',
      ctaUrl: 'https://example.com/contact/enterprise',
      badge: 'Limited beta',
      highlighted: false,
      disabled: true,
    },
  },
};
