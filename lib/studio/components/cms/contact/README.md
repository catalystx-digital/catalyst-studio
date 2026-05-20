# Contact Components

## Overview
The contact category provides 4 components for facilitating communication between users and your organization. These components handle various contact scenarios from simple inquiries to complex support requests.

## Components

### ContactForm
Comprehensive contact form with multiple field types.
- **Use Case**: General inquiries, support requests, quotes
- **Features**: Field validation, file uploads, captcha support
- **Import**: `@/lib/studio/components/cms/contact/contact-form`

### ContactInfo
Display component for contact information.
- **Use Case**: Office locations, phone numbers, business hours
- **Features**: Multiple locations, social links, schema markup
- **Import**: `@/lib/studio/components/cms/contact/contact-info`

### LocationMap
Interactive map showing business locations.
- **Use Case**: Store locators, office directions, event venues
- **Features**: Multiple markers, directions, info windows
- **Import**: `@/lib/studio/components/cms/contact/location-map`

### SimpleForm
Lightweight contact form for quick inquiries.
- **Use Case**: Quick questions, callback requests, subscriptions
- **Features**: Minimal fields, inline validation, ajax submission
- **Import**: `@/lib/studio/components/cms/contact/simple-form`

## Usage Example

```tsx
import { ContactForm } from '@/lib/studio/components/cms/contact/contact-form';
import { LocationMap } from '@/lib/studio/components/cms/contact/location-map';

export function ContactPage() {
  const handleSubmit = async (formData) => {
    // Process form submission
    await sendContactForm(formData);
  };

  const locations = [
    {
      id: 'hq',
      name: 'Headquarters',
      address: '123 Main St, City, State 12345',
      coordinates: { lat: 40.7128, lng: -74.0060 },
      phone: '+1 234-567-8900'
    }
  ];

  return (
    <div>
      <ContactForm
        fields={[
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          { name: 'subject', type: 'select', options: ['Sales', 'Support', 'Other'] },
          { name: 'message', type: 'textarea', required: true }
        ]}
        onSubmit={handleSubmit}
        successMessage="Thank you! We'll be in touch soon."
      />
      
      <LocationMap
        locations={locations}
        zoom={12}
        height="400px"
      />
    </div>
  );
}
```

## Form Configuration

### Field Types
- **text**: Single-line text input
- **email**: Email with validation
- **tel**: Phone number input
- **textarea**: Multi-line text
- **select**: Dropdown selection
- **checkbox**: Multiple choices
- **radio**: Single choice
- **file**: File upload

### Validation Rules
```tsx
const validationRules = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    pattern: /^[\d\s\-\+\(\)]+$/
  }
};
```

## Map Integration

### Map Providers
- Google Maps (default)
- OpenStreetMap
- Mapbox
- Custom tile servers

### Configuration
```tsx
<LocationMap
  provider="google"
  apiKey={process.env.NEXT_PUBLIC_MAPS_API_KEY}
  theme="dark"
  controls={{
    zoom: true,
    fullscreen: true,
    streetView: true
  }}
/>
```

## Best Practices

### Form UX
- Show clear error messages
- Provide helpful placeholders
- Use progressive disclosure for complex forms
- Implement auto-save for long forms

### Security
- Implement CAPTCHA for public forms
- Sanitize all inputs
- Rate limit submissions
- Use HTTPS for form submissions

### Performance
- Lazy load map components
- Optimize form validation
- Use debouncing for real-time validation
- Cache map tiles

## Email Integration
```tsx
// Email service integration example
const emailConfig = {
  service: 'sendgrid', // or 'mailgun', 'ses', etc.
  template: 'contact-form',
  to: 'support@example.com',
  replyTo: formData.email
};
```

## Analytics
Track form interactions:
- Form views
- Field interactions
- Submission attempts
- Success/failure rates
- Abandonment points

## Accessibility
- Label all form fields
- Provide error announcements
- Ensure keyboard navigation
- Support screen readers

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Form Best Practices](../_docs/form-patterns.md)
- [API Reference](../_docs/api-reference.md)