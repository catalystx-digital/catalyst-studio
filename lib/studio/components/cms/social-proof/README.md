# Social Proof Components

Studio social proof components for the CMS Component Library.

## Components

### TestimonialSlider
A rotating carousel component for displaying customer testimonials.

**Features:**
- Auto-rotation with configurable interval
- Manual navigation with arrows and dots
- Pause on hover functionality
- Keyboard navigation support
- Content sanitization for security

**Usage:**
```typescript
import { TestimonialSlider } from '@/lib/studio/components/cms/social-proof/testimonial-slider';

const content = {
  testimonials: [
    {
      id: '1',
      quote: 'Great product!',
      author: 'John Doe',
      role: 'CEO',
      company: 'Tech Corp',
      avatar: 'avatar.jpg'
    }
  ],
  autoPlayInterval: 5000,
  showNavigation: true,
  showDots: true,
  pauseOnHover: true
};
```

### TestimonialGrid
A responsive grid layout for displaying multiple testimonials.

**Features:**
- Responsive columns (desktop: 3, tablet: 2, mobile: 1)
- Optional star ratings
- Card-based design with hover effects
- Content sanitization for security

**Usage:**
```typescript
import { TestimonialGrid } from '@/lib/studio/components/cms/social-proof/testimonial-grid';

const content = {
  testimonials: [...],
  columns: {
    desktop: 3,
    tablet: 2,
    mobile: 1
  },
  showRating: true
};
```

### LogoStrip
A horizontal display of client/partner logos.

**Features:**
- Multiple size options (small, medium, large)
- Grayscale effect with color on hover
- Optional infinite scroll animation
- Mobile-optimized with horizontal scroll

**Usage:**
```typescript
import { LogoStrip } from '@/lib/studio/components/cms/social-proof/logo-strip';

const content = {
  logos: [
    {
      id: '1',
      src: 'logo.png',
      alt: 'Company Name',
      link: 'https://company.com'
    }
  ],
  size: 'medium',
  grayscale: true,
  animateScroll: false
};
```

### ReviewCard
An individual review card with star rating display.

**Features:**
- 1-5 star rating with half-star support
- Expandable review text with "Read more"
- Platform indicators (Google, Trustpilot, etc.)
- Verified badge support
- Helpful voting buttons

**Usage:**
```typescript
import { ReviewCard } from '@/lib/studio/components/cms/social-proof/review-card';

const content = {
  rating: 4.5,
  reviewText: 'Excellent product...',
  author: 'Jane Smith',
  date: new Date(),
  verified: true,
  platform: 'google',
  helpful: {
    yes: 42,
    no: 3
  }
};
```

## Performance

All components are optimized for performance:
- React.memo for preventing unnecessary re-renders
- Performance tracking with monitoring HOC
- Target render time: <50ms
- Lazy loading for images and avatars

## Accessibility

Components follow WCAG 2.1 AA standards:
- Keyboard navigation support
- Proper ARIA attributes
- Screen reader compatibility
- Focus management
- Semantic HTML structure

## AI Detection

Each component includes AI metadata for automatic detection:
- Keywords and patterns for identification
- Confidence scores
- Alternative component suggestions
- Semantic role definitions