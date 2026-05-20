# Call-to-Action Components

## Overview
The CTA category provides 4 conversion-focused components designed to drive user engagement and actions. These components are optimized for high conversion rates with A/B testing support.

## Components

### CTASimple
Compact CTA card for succinct promotions or announcements.
- **Use Case**: Highlight a primary action alongside supporting copy
- **Features**: Eyebrow support, dual buttons, surface or accent backgrounds
- **Import**: `@/lib/studio/components/cms/cta/cta-simple`

### CTABanner
Full-width banner for prominent calls-to-action.
- **Use Case**: Site-wide promotions, announcements, special offers
- **Features**: Dismissible, countdown timers, multiple CTAs
- **Import**: `@/lib/studio/components/cms/cta/cta-banner`

### CTANewsletter
Email newsletter signup form with validation.
- **Use Case**: Lead generation, email list building, content subscriptions
- **Features**: Form validation, GDPR compliance, success messages
- **Import**: `@/lib/studio/components/cms/cta/cta-newsletter`

### CTAButtonGroup
Group of action buttons for multiple CTAs.
- **Use Case**: Multi-step processes, download options, social sharing
- **Features**: Button variants, loading states, analytics tracking
- **Import**: `@/lib/studio/components/cms/cta/cta-button-group`

## Usage Example

```tsx
import { CTABanner } from '@/lib/studio/components/cms/cta/cta-banner';
import { CTANewsletter } from '@/lib/studio/components/cms/cta/cta-newsletter';

export function LandingPage() {
  const handleSubscribe = async (email: string) => {
    // Handle newsletter subscription
    await subscribeToNewsletter(email);
  };

  return (
    <div>
      <CTABanner
        title="Limited Time Offer!"
        description="Get 50% off your first month"
        primaryAction={{
          label: 'Get Started',
          href: '/signup'
        }}
        secondaryAction={{
          label: 'Learn More',
          href: '/pricing'
        }}
        dismissible={true}
      />

      <CTANewsletter
        title="Stay Updated"
        description="Get the latest updates and exclusive offers"
        onSubmit={handleSubscribe}
        gdprText="We respect your privacy. Unsubscribe at any time."
      />
    </div>
  );
}
```

## Best Practices

### Conversion Optimization
- Use contrasting colors for CTA buttons
- Keep copy clear and action-oriented
- Place CTAs above the fold when possible
- Limit the number of CTAs per page

### A/B Testing
- Test button colors and sizes
- Experiment with different copy variations
- Try different placements and layouts
- Monitor conversion metrics

### Mobile Optimization
- Ensure touch-friendly button sizes (min 44x44px)
- Stack CTAs vertically on mobile
- Use thumb-reachable positions
- Optimize form inputs for mobile keyboards

## Design Patterns

### Button Hierarchy
- **Primary**: Main action (high contrast)
- **Secondary**: Alternative action (medium contrast)
- **Tertiary**: Additional options (low contrast)

### Form Patterns
- Single-field newsletter (email only)
- Extended forms (name + email)
- Multi-step forms (progressive disclosure)

## Analytics Integration
All CTA components support:
- Click tracking
- Conversion tracking
- A/B test variants
- Custom event triggers

```tsx
<CTABanner
  analytics={{
    category: 'CTA',
    action: 'banner_click',
    label: 'summer_sale'
  }}
/>
```

## Accessibility
- Clear focus indicators
- Descriptive button labels
- Form field validation messages
- Keyboard navigation support

## Performance
- Lazy load non-critical CTAs
- Optimize animation performance
- Minimize JavaScript for simple CTAs
- Use CSS for hover effects

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Conversion Patterns](../_docs/conversion-patterns.md)
- [API Reference](../_docs/api-reference.md)
