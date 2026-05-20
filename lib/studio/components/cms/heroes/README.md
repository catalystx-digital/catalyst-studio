# Hero Components

Studio hero components for the CMS Component Library. These components provide diverse landing page hero sections with high-performance rendering and AI-powered detection.

## Components

### HeroBanner
Full-width hero with background image support and overlay text.

**Usage:**
```tsx
import { HeroBanner } from '@/lib/studio/components/cms/heroes/hero-banner';

<HeroBanner
  id="hero-1"
  type={ComponentType.HeroBanner}
  category={ComponentCategory.Heroes}
  content={{
    heading: "Welcome to Our Platform",
    subheading: "Build amazing experiences",
    body: "Start your journey today",
    backgroundImage: "/images/hero-bg.jpg",
    overlay: {
      enabled: true,
      opacity: 0.5
    },
    ctaButtons: [
      { label: "Get Started", href: "/signup", variant: "primary" },
      { label: "Learn More", href: "/about", variant: "outline" }
    ],
    alignment: "center",
    parallax: true
  }}
/>
```

### HeroSplit
Two-column layout with content and media side-by-side.

**Usage:**
```tsx
import { HeroSplit } from '@/lib/studio/components/cms/heroes/hero-split';

<HeroSplit
  id="hero-2"
  type={ComponentType.HeroSplit}
  category={ComponentCategory.Heroes}
  content={{
    heading: "Split Hero Example",
    subheading: "Content and media together",
    body: "Perfect for showcasing products",
    media: {
      type: "image",
      src: "/images/product.jpg",
      alt: "Product showcase"
    },
    mediaPosition: "right",
    splitRatio: "50-50",
    ctaButtons: [
      { label: "Shop Now", href: "/shop", variant: "primary" }
    ]
  }}
/>
```

### HeroMinimal
Text-focused hero with centered content and clean design.

**Usage:**
```tsx
import { HeroMinimal } from '@/lib/studio/components/cms/heroes/hero-minimal';

<HeroMinimal
  id="hero-3"
  type={ComponentType.HeroMinimal}
  category={ComponentCategory.Heroes}
  content={{
    heading: "Simple. Clean. Powerful.",
    subheading: "Focus on what matters",
    ctaButtons: [
      { label: "Start Free", href: "/trial", variant: "primary" },
      { label: "View Demo", href: "/demo", variant: "outline" }
    ],
    maxWidth: "medium"
  }}
/>
```

### HeroVideo
Hero with background video support and playback controls.

**Usage:**
```tsx
import { HeroVideo } from '@/lib/studio/components/cms/heroes/hero-video';

<HeroVideo
  id="hero-4"
  type={ComponentType.HeroVideo}
  category={ComponentCategory.Heroes}
  content={{
    heading: "Experience the Future",
    subheading: "Innovation in motion",
    videoUrl: "/videos/hero-bg.mp4",
    posterImage: "/images/video-poster.jpg",
    videoSettings: {
      autoplay: true,
      loop: true,
      muted: true,
      controls: false
    },
    overlayContent: {
      enabled: true,
      opacity: 0.4
    },
    ctaButtons: [
      { label: "Watch Demo", href: "/demo", variant: "primary" }
    ]
  }}
/>
```

### HeroCarousel
Rotating hero carousel that cycles through featured stories or promotions.

**Usage:**
```tsx
import { HeroCarousel } from '@/lib/studio/components/cms/heroes/hero-carousel';

<HeroCarousel
  id="hero-5"
  type={ComponentType.HeroCarousel}
  category={ComponentCategory.Heroes}
  content={{
    slides: [
      {
        id: 'slide-1',
        content: {
          heading: 'Coffee With a Cop',
          body: 'Join us for coffee and conversation.',
          image: { src: '/images/coffee-event.jpg', alt: 'Community event' },
          ctaButtons: [{ label: 'Read More', href: '/events', variant: 'primary' }]
        }
      },
      {
        id: 'slide-2',
        content: {
          heading: 'Seasonal Promotions',
          body: 'Discover inspiring ideas for the season ahead.',
          image: { src: '/images/seasonal.jpg', alt: 'Seasonal promotion' },
          ctaButtons: [{ label: 'Explore', href: '/promotions', variant: 'outline' }]
        }
      }
    ],
    autoPlay: true,
    autoPlayInterval: 7000
  }}
/>
```

## Features

- **Server/Client Architecture**: Optimized rendering with React Server Components
- **Performance Monitoring**: Built-in performance tracking (<50ms render target)
- **AI Detection**: Smart component detection with confidence scoring
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Responsive Design**: Mobile-first approach with all breakpoints covered
- **TypeScript**: Full type safety with strict mode compliance

## AI Metadata

Each hero component includes AI detection metadata for smart content migration:

| Component | Confidence | Keywords |
|-----------|------------|----------|
| HeroBanner | 0.90 | hero, banner, jumbotron, masthead |
| HeroSplit | 0.85 | split, two-column, side-by-side |
| HeroMinimal | 0.82 | minimal, simple, text-focused |
| HeroVideo | 0.88 | video, background-video, autoplay |
| HeroCarousel | 0.90 | carousel, slider, rotating hero |

## Performance

All components are wrapped with performance monitoring and achieve:
- Render time: <50ms average
- Lazy loading for below-fold content
- Optimized image loading with Next.js Image
- Code splitting for video component

## Testing

Each component includes comprehensive unit tests:
```bash
npm run test -- hero-banner.test.tsx
npm run test -- hero-split.test.tsx
npm run test -- hero-minimal.test.tsx
npm run test -- hero-video.test.tsx
npm run test -- hero-carousel.test.tsx
```

## Factory Registration

Components are automatically registered with the CMS factory:
```typescript
import { registerHeroComponents } from '@/lib/studio/components/cms/heroes/register';

// Auto-registers on import
registerHeroComponents();
```

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 12+, Chrome Android 89+

## License

Private - Studio Component Library
