# Studio CMS Components Library

This directory contains the studio CMS component library for Catalyst Studio.

## Directory Structure

```
cms/
├── _core/           # Core interfaces, types, and utilities
├── _factory/        # Component factory and dynamic loading system
├── _ai/            # AI metadata and detection utilities
├── _tests/         # Shared test utilities and configurations
├── _docs/          # Documentation and Storybook templates
│
├── navigation/     # Navigation components (menus, breadcrumbs)
├── heroes/         # Hero sections and banners
├── content/        # Content display components
├── features/       # Feature sections and showcases
├── cta/           # Call-to-action components
├── social-proof/   # Testimonials, reviews, logos
├── contact/        # Contact forms and information (COMPLETED)
├── about/          # About sections and team components (COMPLETED)
├── blog/           # Blog posts, lists, and cards (COMPLETED)
├── pricing/        # Pricing tables and plans
└── data/          # Data display components (tables, charts)
```

## Component Standards

### Required Interface
Every component must implement `CMSComponentProps`:
- `id`: Unique identifier
- `type`: Component type enum
- `category`: Component category
- `content`: Component-specific content

### File Structure
Each component follows this structure:
```
{component-name}/
├── index.tsx                      # Main component export
├── {component-name}.types.ts      # TypeScript interfaces
├── {component-name}.test.tsx      # Unit tests
├── {component-name}.ai.ts         # AI detection metadata
└── {component-name}.stories.tsx   # Storybook stories
```

### Performance Requirements
- Render time < 50ms
- Bundle size < 10KB gzipped
- Lazy loading for below-fold components
- Code splitting by category

### Import Conventions
```typescript
// Always use studio paths
import { Component } from '@/lib/studio/components/cms/category/component'

// Never import from common paths
// ❌ import { Something } from '@/components/...'
```

## Development Commands

```bash
# Create new component
npm run cms:create

# Run component tests
npm run cms:test

# Build component library
npm run cms:build

# Analyze bundle sizes
npm run cms:analyze

# Launch Storybook
npm run cms:storybook
```

## Testing

All components require:
- Unit tests (85% coverage minimum)
- Visual regression tests
- Accessibility tests (WCAG 2.1 AA)
- Performance benchmarks

## Security

- Input sanitization using DOMPurify
- XSS prevention  
- Prop validation with Zod schemas
- No PII in component props
- Security utilities available in `_core/security.ts` (Story 10.10)

## Completed Stories

### Story 10.10: Contact & Forms Components
- **Components**: ContactForm, ContactInfo, LocationMap, SimpleForm
- **Security**: Added security module with validation utilities
- **Performance**: All components wrapped with performance tracking
- **Coverage**: Unit tests implemented for all components

### Story 10.11: About & Team Components
- **Components**: TeamGrid, TeamMember, AboutSection
- **Features**: 
  - Team member grid with responsive layout
  - Individual team member profiles with social links
  - Company about section with mission/vision/values
- **Security**: All content sanitized using security module from Story 10.10
- **Performance**: All components wrapped with performance tracking (<50ms render)
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Coverage**: Unit tests >80% coverage for all components