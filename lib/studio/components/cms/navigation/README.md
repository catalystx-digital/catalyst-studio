# CMS Navigation Components

This directory contains the studio navigation components for the CMS Component Library.

## Components

### 1. NavBar (`nav-bar/`)
A responsive navigation bar component with logo, menu items, dropdown support, and CTA button.

**Features:**
- Logo placement (image or text)
- Multi-level menu items with dropdowns
- CTA button with variants
- Mobile collapse functionality
- Sticky and transparent modes
- Server-side rendering support

**AI Detection:**
- Confidence: 0.95
- Keywords: navigation, navbar, header, menu
- Location: header

### 2. Footer (`footer/`)
A comprehensive footer component with multi-column layout and interactive features.

**Features:**
- Multi-column link organization (2-6 columns)
- Social media icons with hover states
- Newsletter signup integration
- Legal/copyright section
- Responsive grid layout

**AI Detection:**
- Confidence: 0.95
- Keywords: footer, site-footer, bottom, copyright
- Location: footer

### 3. MobileMenu (`mobile-menu/`)
A mobile-specific navigation menu with slide panel and hamburger trigger.

**Features:**
- Hamburger button animation
- Slide panel with overlay
- Focus trap for accessibility
- Support for nested menu items
- Configurable position (left/right)

**AI Detection:**
- Confidence: 0.85
- Keywords: mobile-menu, hamburger, burger-menu
- Location: header

### 4. Breadcrumbs (`breadcrumbs/`)
Hierarchical navigation display with SEO optimization.

**Features:**
- Schema.org structured data
- Customizable separators
- Truncation for long paths
- Home link option
- Server-side rendering

**AI Detection:**
- Confidence: 0.90
- Keywords: breadcrumbs, navigation-path, trail
- Location: header, main

> **Note:** SearchBar functionality has been integrated into the NavBar component.
> Configure search via `content.search` property on NavBar.

## Usage Examples

All components follow the CMSComponentProps interface and can be used with the component factory:

### Using the Factory

```typescript
import { CMSComponentFactory } from '../_factory/factory';
import { ComponentType, ComponentCategory } from '../_core/types';
import { registerNavigationComponents } from '../navigation/register';

// Register components first (usually done once at app startup)
registerNavigationComponents();

// Get components from factory
const factory = CMSComponentFactory.getInstance();
const NavBar = factory.getComponent(ComponentType.NavBar);
const Footer = factory.getComponent(ComponentType.Footer);
```

### NavBar Example

```typescript
import { NavBar } from '@/lib/studio/components/cms/navigation/nav-bar';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

<NavBar
  id="main-nav"
  type={ComponentType.NavBar}
  category={ComponentCategory.Navigation}
  content={{
    logo: { 
      text: 'MyApp',
      src: '/logo.png',  // Optional: image logo
      href: '/',
      width: 150,
      height: 40
    },
    menuItems: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      {
        label: 'Services',
        href: '/services',
        children: [
          { label: 'Web Design', href: '/services/design' },
          { label: 'Development', href: '/services/dev' }
        ]
      }
    ],
    cta: {
      text: 'Get Started',
      href: '/signup',
      variant: 'primary'  // primary | secondary | outline
    },
    sticky: true,      // Stick to top on scroll
    transparent: true  // Transparent until scroll
  }}
  className="custom-nav"
  onInteraction={(action, data) => console.log(action, data)}
/>
```

### Footer Example

```typescript
import { Footer } from '@/lib/studio/components/cms/navigation/footer';

<Footer
  id="main-footer"
  type={ComponentType.Footer}
  category={ComponentCategory.Navigation}
  content={{
    columns: [
      {
        title: 'Products',
        links: [
          { label: 'Features', href: '/features' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'FAQ', href: '/faq' }
        ]
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Careers', href: '/careers' },
          { label: 'Contact', href: '/contact' }
        ]
      }
    ],
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/myapp' },
      { platform: 'github', url: 'https://github.com/myapp' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/myapp' }
    ],
    newsletter: {
      heading: 'Stay Updated',
      description: 'Get the latest news and updates',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe'
    },
    copyright: '© 2024 MyApp. All rights reserved.',
    legalLinks: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' }
    ]
  }}
  onInteraction={(action, data) => {
    if (action === 'newsletter-submit') {
      console.log('Newsletter signup:', data.email);
    }
  }}
/>
```

### Breadcrumbs Example

```typescript
import { Breadcrumbs } from '@/lib/studio/components/cms/navigation/breadcrumbs';

<Breadcrumbs
  id="page-breadcrumbs"
  type={ComponentType.Breadcrumbs}
  category={ComponentCategory.Navigation}
  content={{
    items: [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Electronics', href: '/products/electronics' },
      { label: 'Laptops', href: '/products/electronics/laptops' }
    ],
    separator: '>',      // Options: '/', '>', '→', '|', custom string
    showHome: true,      // Show home icon for first item
    maxItems: 5,         // Truncate if too many items
    structured: true     // Include schema.org structured data
  }}
  className="my-breadcrumbs"
/>
```

### NavBar with Search Example

```typescript
import { NavBar } from '@/lib/studio/components/cms/navigation/nav-bar';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

<NavBar
  id="main-nav"
  type={ComponentType.NavBar}
  category={ComponentCategory.Navigation}
  content={{
    logo: { text: 'MySite', href: '/' },
    menuItems: [...],
    search: {
      enabled: true,
      placeholder: 'Search...',
      action: '/search',
      showSuggestions: true,
      panelVariant: 'overlay',
      suggestions: [
        { text: 'Popular page', category: 'Pages', url: '/popular' },
        { text: 'Help docs', category: 'Help', url: '/docs' }
      ]
    }
  }}
  onInteraction={(action, data) => {
    if (action === 'search_submit') {
      console.log('Search query:', data.query);
    }
  }}
/>
```

### MobileMenu Example

```typescript
import { MobileMenu } from '@/lib/studio/components/cms/navigation/mobile-menu';

<MobileMenu
  id="mobile-nav"
  type={ComponentType.MobileMenu}
  category={ComponentCategory.Navigation}
  content={{
    menuItems: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      {
        label: 'Services',
        href: '/services',
        children: [
          { label: 'Web Design', href: '/services/design' },
          { label: 'Development', href: '/services/dev' }
        ]
      }
    ],
    position: 'right',    // 'left' | 'right'
    triggerIcon: 'hamburger',  // 'hamburger' | 'dots' | 'custom'
    showOverlay: true,
    closeOnEsc: true,
    focusTrap: true       // Trap focus for accessibility
  }}
  className="custom-mobile-menu"
/>

## Performance

All components are wrapped with performance monitoring and target <50ms render time:
- React.memo optimization where applicable
- Lazy loading for mobile menu
- Server-side rendering for SEO-critical components

## Testing

Each component includes comprehensive unit tests:
- Run tests: `npm run test`
- Coverage: Target >80%
- Accessibility: WCAG 2.1 AA compliance

## Architecture

Components follow a hybrid server/client architecture:
- `*.server.tsx` - Server-side rendering logic
- `*.client.tsx` - Client-side interactions
- `index.tsx` - Combined component with performance monitoring
- `*.types.ts` - TypeScript interfaces
- `*.ai.ts` - AI detection metadata
- `*.test.tsx` - Unit tests
