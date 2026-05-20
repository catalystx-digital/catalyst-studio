# CMS Component Prop Naming Convention

## Overview

This document establishes the standard naming convention for common props across all CMS components. Consistent naming improves developer experience, reduces cognitive load, and enables better tooling support.

## Standard Prop Names

### Text Content Props

| Standard Name | Usage | Type | Example |
|--------------|-------|------|---------|
| `heading` | Main heading text | `string` | "Welcome to Our Company" |
| `subheading` | Secondary heading text | `string` | "We build amazing products" |
| `body` | Body/paragraph text | `string` | "Lorem ipsum dolor sit amet..." |

### When to Use Each

**`heading`**
- Primary title of a section or component
- Most prominent text element
- Typically rendered as `<h1>`, `<h2>`, or `<h3>`

**`subheading`**
- Supporting text below the heading
- Secondary messaging or tagline
- Typically rendered as `<p>` with muted styling or smaller heading tag

**`body`**
- Main content or description text
- Longer form explanatory text
- Typically rendered as `<p>` with body text styling

## Deprecated Aliases (Avoid in New Components)

| Deprecated | Standard | Migration Status |
|-----------|----------|------------------|
| `title` | `heading` | Legacy (436 uses) |
| `subtitle` | `subheading` | Legacy (22 uses) |
| `description` | `body` or context-specific | Legacy (633 uses) |

Note: `description` is context-dependent. Use `body` for general content, but specific props like `metaDescription`, `imageDescription`, etc. are acceptable when the context is clear.

## Migration Strategy

### For New Components
Always use standard names (`heading`, `subheading`, `body`).

### For Existing Components
Components with legacy naming will be migrated gradually during:
- Major refactors
- Component rewrites
- When touching prop interfaces

Do NOT do mass renames across the codebase - this creates merge conflicts and breaks in-flight work.

## Current Usage Analysis (as of 2025-12-19)

| Pattern | Count | Recommended |
|---------|-------|-------------|
| `title:` | 436 | Use `heading` |
| `heading:` | 374 | Standard (use this) |
| `subtitle:` | 22 | Use `subheading` |
| `subheading:` | 133 | Standard (use this) |
| `description:` | 633 | Context-dependent |
| `body:` | 91 | Standard (use this) |

Total files affected: 1,689 occurrences across components.

## Examples

### Correct Usage (New Component)
```typescript
// hero.propsmeta.ts
export const heroPropsMeta = {
  heading: { type: 'string', required: true },
  subheading: { type: 'string', required: false },
  body: { type: 'string', required: false },
}

// hero.tsx
interface HeroProps {
  heading: string
  subheading?: string
  body?: string
}

export function Hero({ heading, subheading, body }: HeroProps) {
  return (
    <section>
      <h1>{heading}</h1>
      {subheading && <p className="text-muted-foreground">{subheading}</p>}
      {body && <p>{body}</p>}
    </section>
  )
}
```

### Legacy Usage (Existing Component - Do Not Change Unless Refactoring)
```typescript
// Some components still use legacy names - this is OK for now
export const oldComponentPropsMeta = {
  title: { type: 'string', required: true },  // Legacy: would be 'heading' if new
  subtitle: { type: 'string', required: false },  // Legacy: would be 'subheading' if new
  description: { type: 'string', required: false },  // Legacy: would be 'body' if new
}
```

## Special Cases

### When `description` is Appropriate
Use context-specific `description` props when the semantic meaning is clear:

- `metaDescription` - SEO meta description
- `imageDescription` - Alt text or caption for images
- `productDescription` - Specific to product content
- `eventDescription` - Specific to event content

### Component-Specific Props
Some components have domain-specific props that don't map to standard names:
- `tagline` - Marketing-specific short phrase
- `caption` - Image or media caption
- `label` - Form field or UI element label
- `placeholder` - Form input placeholder

These are acceptable and should NOT be forced into `heading`/`subheading`/`body`.

## Implementation Checklist

When creating a new CMS component:
- [ ] Use `heading` for primary text (not `title`)
- [ ] Use `subheading` for secondary text (not `subtitle`)
- [ ] Use `body` for paragraph content (not `description` unless context-specific)
- [ ] Document any deviation from standard in component README
- [ ] Use TypeScript types from value objects when applicable

## Related Documentation

- **Value Objects**: `lib/studio/components/cms/_core/value-objects/` - Reusable type definitions
- **Component Definition**: `lib/studio/components/cms/_core/component-definition.ts` - Component metadata
- **PropsMeta**: `lib/studio/components/cms/_core/propsmeta.ts` - Runtime prop schemas

## Decision Authority

This convention was established as part of TKT-016 Schema Registry Refactor (Task 4.2).

For questions or proposed changes to this convention, create a ticket and tag the CMS architecture team.
