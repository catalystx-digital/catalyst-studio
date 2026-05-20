# Content Display Components

## Overview
The content display category provides 8 versatile components for presenting various types of content in your CMS. These components are optimized for performance and include built-in AI detection capabilities.

## Components

### TextBlock
A rich text content component with formatting support.
- **Use Case**: Articles, documentation, long-form content
- **Features**: Markdown support, syntax highlighting, responsive typography
- **Import**: `@/lib/studio/components/cms/content/text-block`

### TwoColumn
Flexible two-column layout for side-by-side content.
- **Use Case**: Feature comparisons, image + text layouts
- **Features**: Responsive stacking, adjustable column ratios
- **Import**: `@/lib/studio/components/cms/content/two-column`

### ImageGallery
Responsive image grid with lightbox functionality.
- **Use Case**: Product galleries, portfolios, photo collections
- **Features**: Lazy loading, zoom, slideshow mode
- **Import**: `@/lib/studio/components/cms/content/image-gallery`

### VideoPlayer
Embedded video player with custom controls.
- **Use Case**: Video content, tutorials, product demos
- **Features**: Multiple sources, captions, analytics tracking
- **Import**: `@/lib/studio/components/cms/content/video-player`

### Accordion
Collapsible content sections for space-efficient layouts.
- **Use Case**: FAQs, product details, documentation
- **Features**: Smooth animations, nested support, accessibility
- **Import**: `@/lib/studio/components/cms/content/accordion`

### Tabs
Tabbed interface for organizing related content.
- **Use Case**: Product specifications, category browsing
- **Features**: Lazy loading, keyboard navigation, mobile-friendly
- **Import**: `@/lib/studio/components/cms/content/tabs`

### CardGrid
Flexible grid layout for card-based content.
- **Use Case**: Product listings, blog previews, team members
- **Features**: Responsive grid, filtering, sorting
- **Import**: `@/lib/studio/components/cms/content/card-grid`

### QuoteBlock
Styled quotation display for testimonials or citations.
- **Use Case**: Customer testimonials, article quotes, reviews
- **Features**: Multiple styles, attribution, social sharing
- **Import**: `@/lib/studio/components/cms/content/quote-block`

## Usage Example

```tsx
import { Accordion } from '@/lib/studio/components/cms/content/accordion';
import { CardGrid } from '@/lib/studio/components/cms/content/card-grid';

export function ContentPage() {
  const faqs = [
    { title: 'How do I get started?', content: 'Getting started is easy...' },
    { title: 'What are the pricing options?', content: 'We offer flexible plans...' }
  ];

  const cards = [
    { title: 'Feature 1', description: 'Description...', image: '/img1.jpg' },
    { title: 'Feature 2', description: 'Description...', image: '/img2.jpg' }
  ];

  return (
    <div>
      <Accordion items={faqs} />
      <CardGrid cards={cards} columns={3} />
    </div>
  );
}
```

## Best Practices

### Performance
- Use lazy loading for image and video components
- Implement virtual scrolling for large card grids
- Enable code splitting for tabs with heavy content

### Accessibility
- Ensure proper heading hierarchy in TextBlock
- Provide alt text for all images in ImageGallery
- Use semantic HTML in custom card templates

### SEO
- Include structured data for video content
- Use proper meta tags for image galleries
- Ensure accordion content is crawlable

## Server/Client Components
Most content components support both server and client rendering:
- `.server.tsx` - Server-side rendering for SEO
- `.client.tsx` - Client-side for interactivity

Choose based on your performance and SEO requirements.

## AI Detection
All components include `.ai.ts` files with:
- Detection confidence scores
- Pattern matching for content types
- Metadata for AI classification

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Performance Guide](../_docs/performance-guide.md)
- [API Reference](../_docs/api-reference.md)