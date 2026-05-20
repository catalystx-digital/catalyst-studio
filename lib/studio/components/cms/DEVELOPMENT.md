# CMS Component Development Guide

## 🚀 Quick Start

### Creating a New Component

```bash
# Use the scaffolding script
npm run cms:create <component-name> <category>

# Example:
npm run cms:create hero-video heroes
```

This creates:
- Component implementation (`hero-video.tsx`)
- TypeScript types (`hero-video.types.ts`)
- Unit tests (`hero-video.test.tsx`)
- AI metadata (`hero-video.ai.ts`)
- Storybook stories (`hero-video.stories.tsx`)
- Index file (`index.tsx`)

### Component Categories

- **navigation**: Menus, breadcrumbs, navigation bars
- **heroes**: Hero sections, banners, jumbotrons
- **content**: Text blocks, accordions, tabs
- **features**: Feature grids, lists, comparisons
- **cta**: Call-to-action sections and buttons
- **social-proof**: Testimonials, reviews, logos
- **contact**: Forms, contact info, maps
- **about**: Team grids, timelines, mission statements
- **blog**: Post layouts, lists, cards
- **pricing**: Tables, cards, comparisons
- **data**: Tables, charts, statistics

## 📁 File Structure

```
lib/studio/components/cms/
├── _core/               # Core utilities and types
│   ├── types.ts        # TypeScript interfaces
│   └── monitoring.ts   # Performance monitoring
├── _factory/           # Component factory system
│   ├── factory.ts      # Dynamic loading
│   └── renderer.tsx    # Component renderer
├── _tests/             # Testing infrastructure
│   ├── setup.ts       # Jest setup
│   └── test-utils.tsx # Testing utilities
├── {category}/         # Component categories
│   └── {component}/    # Individual components
│       ├── index.tsx
│       ├── {component}.tsx
│       ├── {component}.types.ts
│       ├── {component}.test.tsx
│       ├── {component}.ai.ts
│       └── {component}.stories.tsx
└── README.md
```

## 🔧 Development Workflow

### 1. Component Implementation

```typescript
// hero-video.tsx
import React from 'react';
import { CMSComponentProps } from '../../_core/types';
import { withPerformanceTracking } from '../../_core/monitoring';

const HeroVideoComponent: React.FC<CMSComponentProps> = (props) => {
  // Implementation
};

export const HeroVideo = withPerformanceTracking(
  HeroVideoComponent,
  ComponentType.HeroVideo
);
```

### 2. Type Definitions

```typescript
// hero-video.types.ts
export interface HeroVideoContent {
  heading: string;
  videoUrl: string;
  posterImage?: string;
  autoplay?: boolean;
}
```

### 3. AI Metadata

```typescript
// hero-video.ai.ts
export const heroVideoAIMetadata: AIComponentMetadata = {
  keywords: ['hero', 'video', 'banner'],
  patterns: ['video hero', 'hero with video'],
  commonNames: ['Video Hero', 'Hero Video'],
  pageLocation: ['hero'],
  confidence: 0.9
};
```

### 4. Testing

```typescript
// hero-video.test.tsx
describe('HeroVideo', () => {
  it('renders correctly', () => {
    // Test implementation
  });
});
```

### 5. Storybook

```typescript
// hero-video.stories.tsx
export default {
  title: 'Studio/CMS/Heroes/HeroVideo',
  component: HeroVideo
};
```

## ✅ Component Requirements

### Performance
- ✅ Render time < 50ms
- ✅ Bundle size < 10KB gzipped
- ✅ Lazy loading support
- ✅ Code splitting by category

### Quality
- ✅ TypeScript strict mode
- ✅ 85% test coverage
- ✅ ESLint compliance
- ✅ Accessibility (WCAG 2.1 AA)

### Documentation
- ✅ TypeScript types
- ✅ AI metadata
- ✅ Storybook stories
- ✅ Unit tests

## 🧪 Testing

### Run Tests
```bash
# All CMS component tests
npm run cms:test

# With coverage
npm run cms:test -- --coverage

# Watch mode
npm run cms:test -- --watch
```

### Visual Regression
```bash
# Run visual tests
npx playwright test visual-regression.spec.ts

# Update baselines
npx playwright test visual-regression.spec.ts --update-snapshots
```

### Performance Testing
```bash
# Analyze bundle sizes
npm run cms:analyze

# Check render times
npm run cms:test -- --testNamePattern="performance"
```

## 📚 Storybook

### Launch Storybook
```bash
npm run cms:storybook
```

### Story Structure
- **Default**: Basic component
- **Variants**: minimal, detailed, compact, expanded
- **Themes**: light, dark, auto
- **States**: loading, error, empty
- **Responsive**: mobile, tablet, desktop

## 🎨 Styling Guidelines

### Tailwind CSS
```tsx
className={cn(
  'cms-component',       // Base class
  'p-4 rounded-lg',     // Tailwind utilities
  variant === 'minimal' && 'p-2',
  theme === 'dark' && 'dark:bg-gray-800',
  className             // Custom classes
)}
```

### CSS Variables
```css
.cms-component {
  --cms-primary: theme('colors.blue.600');
  --cms-spacing: theme('spacing.4');
}
```

### Responsive Design
```tsx
className="
  w-full
  sm:w-3/4
  md:w-2/3
  lg:w-1/2
  xl:w-1/3
"
```

## 🔒 Security

### Input Sanitization
```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(userInput);
```

### XSS Prevention
- Never use `dangerouslySetInnerHTML` without sanitization
- Validate all props with Zod schemas
- Escape user-generated content

### Content Security Policy
```typescript
// Validate external URLs
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};
```

## 🚀 Performance Optimization

### Code Splitting
```typescript
// Dynamic imports
const HeroVideo = lazy(() => import('./heroes/hero-video'));
```

### Memoization
```typescript
const MemoizedComponent = React.memo(Component);
```

### Virtual Scrolling
```typescript
// For large lists
import { FixedSizeList } from 'react-window';
```

### Image Optimization
```typescript
import Image from 'next/image';

<Image
  src={image}
  loading="lazy"
  placeholder="blur"
/>
```

## 🐛 Debugging

### Performance Profiling
```typescript
// Enable in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.onAlert(alert => {
    console.warn('Performance issue:', alert);
  });
}
```

### React DevTools
- Install React DevTools extension
- Use Profiler tab for performance
- Check component re-renders

### Bundle Analysis
```bash
# Generate bundle report
npm run cms:analyze
```

## 📝 Best Practices

### Component Design
1. **Single Responsibility**: One component, one purpose
2. **Composition**: Build complex from simple
3. **Reusability**: Generic and configurable
4. **Testability**: Pure functions when possible

### State Management
1. **Local State**: useState for component state
2. **Global State**: Zustand for app state
3. **Server State**: React Query for API data
4. **URL State**: Next.js router for navigation

### Error Handling
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>
```

### Accessibility
1. **Semantic HTML**: Use proper elements
2. **ARIA Labels**: Add when needed
3. **Keyboard Navigation**: Tab order, focus management
4. **Screen Readers**: Test with NVDA/JAWS

## 🤝 Contributing

### Pull Request Process
1. Create feature branch
2. Implement component
3. Write tests (85% coverage)
4. Add Storybook stories
5. Run visual regression tests
6. Update documentation
7. Submit PR

### Code Review Checklist
- [ ] TypeScript types complete
- [ ] Tests passing with coverage
- [ ] Storybook stories working
- [ ] Performance budgets met
- [ ] Accessibility validated
- [ ] Documentation updated
- [ ] No console errors/warnings

## 📚 Resources

### Documentation
- [Component API Reference](./API.md)
- [TypeScript Types](./TYPES.md)
- [Testing Guide](./TESTING.md)

### External
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Storybook](https://storybook.js.org/docs)