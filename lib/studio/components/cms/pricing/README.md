# Pricing Components

## Overview
The pricing category provides 2 components for displaying pricing information and plans. These components are designed to clearly communicate value propositions and facilitate purchase decisions.

## Components

### PricingTable
Comparison table for multiple pricing tiers.
- **Use Case**: SaaS pricing pages, service comparisons, plan selection
- **Features**: Feature comparison, recommended plan highlight, toggle billing period
- **Import**: `@/lib/studio/components/cms/pricing/pricing-table`

### PricingCard
Individual pricing plan card.
- **Use Case**: Single plan display, special offers, add-on pricing
- **Features**: Feature list, CTA button, popular badge, custom styling
- **Import**: `@/lib/studio/components/cms/pricing/pricing-card`

## Usage Example

```tsx
import { PricingTable } from '@/lib/studio/components/cms/pricing/pricing-table';
import { PricingCard } from '@/lib/studio/components/cms/pricing/pricing-card';

export function PricingPage() {
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: { monthly: 9, yearly: 90 },
      features: [
        '10 GB Storage',
        '100 GB Bandwidth',
        'Email Support',
        'Basic Analytics'
      ],
      limitations: [
        'No API Access',
        'No Custom Domain'
      ]
    },
    {
      id: 'pro',
      name: 'Professional',
      price: { monthly: 29, yearly: 290 },
      popular: true,
      features: [
        '100 GB Storage',
        'Unlimited Bandwidth',
        '24/7 Support',
        'Advanced Analytics',
        'API Access',
        'Custom Domain'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      features: [
        'Unlimited Storage',
        'Unlimited Bandwidth',
        'Dedicated Support',
        'Custom Analytics',
        'Full API Access',
        'Multiple Domains',
        'SLA Guarantee'
      ]
    }
  ];

  return (
    <div>
      <PricingTable
        plans={plans}
        defaultBilling="yearly"
        highlightPlan="pro"
        comparisonFeatures={[
          'Storage',
          'Bandwidth',
          'Support',
          'Analytics',
          'API Access',
          'Custom Domain'
        ]}
      />
      
      {/* Alternative: Individual cards */}
      <div className="grid grid-cols-3 gap-6">
        {plans.map(plan => (
          <PricingCard
            key={plan.id}
            plan={plan}
            onSelect={() => handlePlanSelect(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Configuration Options

### Pricing Display
```tsx
// Different price formats
const priceFormats = {
  simple: '$29/mo',
  detailed: {
    amount: 29,
    currency: 'USD',
    period: 'month',
    decimals: 0
  },
  tiered: {
    starter: { users: '1-5', price: 29 },
    growth: { users: '6-20', price: 99 },
    scale: { users: '21+', price: 'Custom' }
  }
};
```

### Billing Periods
```tsx
const billingOptions = {
  periods: ['monthly', 'yearly', 'lifetime'],
  discounts: {
    yearly: 20, // 20% discount for yearly
    lifetime: 50 // 50% discount for lifetime
  },
  defaultPeriod: 'yearly'
};
```

### Feature Comparison
```tsx
const comparisonMatrix = {
  features: [
    {
      name: 'Storage',
      plans: {
        basic: '10 GB',
        pro: '100 GB',
        enterprise: 'Unlimited'
      }
    },
    {
      name: 'API Calls',
      plans: {
        basic: false, // Shows ✗
        pro: '100k/mo',
        enterprise: true // Shows ✓
      }
    }
  ]
};
```

## Design Patterns

### Visual Hierarchy
- Highlight recommended plan
- Use color coding for tiers
- Clear CTA buttons
- Prominent pricing display

### Psychological Pricing
- Anchor pricing (show highest first)
- Charm pricing ($29 vs $30)
- Bundle savings highlights
- Limited time offers

### Trust Signals
- Money-back guarantee badges
- Security certifications
- Customer testimonials
- Usage statistics

## Best Practices

### Clarity
- Clear feature descriptions
- No hidden fees disclosure
- Transparent billing terms
- Easy comparison between plans

### Conversion Optimization
- Single recommended plan
- Clear value proposition
- Urgency/scarcity indicators
- Social proof near pricing

### Mobile Optimization
- Swipeable plan cards
- Collapsible feature lists
- Sticky CTA buttons
- Simplified comparison view

## A/B Testing Ideas
- Price points
- Plan names
- Feature order
- CTA button text
- Billing period defaults
- Discount percentages

## International Pricing
```tsx
<PricingTable
  plans={plans}
  locale="en-US"
  currency="USD"
  taxLabel="VAT"
  showTaxInfo={true}
/>
```

## Analytics Integration
Track key metrics:
- Plan views
- Billing toggle usage
- CTA clicks
- Plan selection
- Conversion rate
- Price sensitivity

## Accessibility
- Screen reader friendly tables
- Keyboard navigation
- Clear focus indicators
- Alternative text for icons

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Conversion Optimization](../_docs/conversion-patterns.md)
- [API Reference](../_docs/api-reference.md)