# CMS Component Conventions

## Purpose

This document establishes standard prop naming conventions for CMS components to ensure consistency, clarity, and maintainability across the codebase.

---

## Prop Naming Standards

### Text Content Props

| Standard | Avoid | Usage | Reasoning |
|----------|-------|-------|-----------|
| `heading` | `title` | Primary headline text | Semantic clarity - "heading" is web-standard terminology (h1, h2, etc.) |
| `subheading` | `subtitle` | Secondary headline text | Consistent with `heading` pattern |
| `body` | `description` | Paragraph/body text | Short, clear, and distinguishes from `heading` levels |

### Current Usage (as of 2025-12-19)

**Analysis of 69 propsmeta files:**

| Pattern | Files | Status |
|---------|-------|--------|
| `heading` | 22 | Standard (preferred) |
| `title` | 25 | Non-standard (legacy) |
| `subheading` | 20 | Standard (preferred) |
| `subtitle` | 6 | Non-standard (legacy) |
| `body` | 7 | Standard (preferred) |
| `description` | 32 | Non-standard (legacy, but contextual) |

**Note:** `description` is acceptable when used for metadata, tooltips, or explanatory text that is NOT the main body content of a component.

---

## Implementation Guidelines

### For New Components (MANDATORY)

When creating new CMS components, ALWAYS use the standard naming:

```typescript
// ✅ CORRECT - Use standards
export const myNewComponentPropsMeta = {
  heading: { type: 'string', required: true },
  subheading: { type: 'string', required: false },
  body: { type: 'string', required: false },
}

// ❌ WRONG - Don't use legacy names
export const myNewComponentPropsMeta = {
  title: { type: 'string', required: true },      // Use 'heading' instead
  subtitle: { type: 'string', required: false },  // Use 'subheading' instead
  description: { type: 'string', required: false }, // Use 'body' instead
}
```

### For Existing Components (NON-BREAKING)

**DO NOT refactor existing component props.** This would be a breaking change.

Existing components may continue to use `title`, `subtitle`, or `description` until a major version refactor is planned. Legacy naming is acceptable in existing code to maintain backward compatibility.

---

## Rationale

### Why These Standards?

1. **Web Standards Alignment**: "Heading" aligns with HTML heading elements (h1, h2, h3)
2. **Semantic Clarity**: "Body" clearly indicates paragraph/content text
3. **Consistency**: Uniform naming reduces cognitive load for developers and LLMs
4. **CMS Convention**: Matches common CMS field naming patterns

### Examples from the Web

- **HTML**: `<h1>`, `<h2>` (headings, not titles)
- **WordPress**: Uses "Heading" in block editor
- **Contentful**: "Heading" and "Body" field types
- **Strapi**: "Text" and "Rich Text" but semantically uses heading patterns

---

## Special Cases

### When `description` IS Appropriate

Use `description` when it serves a different purpose than body content:

```typescript
// ✅ CORRECT - 'description' for metadata/tooltips
export const componentPropsMeta = {
  heading: { type: 'string', required: true },
  body: { type: 'string', required: false },
  icon: {
    type: 'string',
    required: false,
    description: 'Icon identifier or CSS class' // This is metadata, not content
  },
}

// ✅ CORRECT - 'description' for nested objects (not the component's main text)
features: {
  type: 'Array<{ name:string; description:string }>',
  required: true
}
```

### When `title` IS Appropriate

Use `title` for nested objects or metadata, NOT for the component's primary heading:

```typescript
// ✅ CORRECT - 'title' in nested objects
team: {
  type: 'Array<{ name:string; title:string; bio:string }>', // Job title
  required: true
}

// ❌ WRONG - 'title' as the component's main heading
export const componentPropsMeta = {
  title: { type: 'string', required: true }, // Use 'heading' instead
}
```

---

## Migration Strategy (Future)

When a major version refactor is planned:

1. Create a migration guide documenting the prop name changes
2. Add TypeScript type deprecation warnings
3. Provide codemod script for automated migration
4. Update all components in a single coordinated release
5. Update LLM prompts and type strings accordingly

**Until then:** Follow standards for NEW components, leave existing components unchanged.

---

## Checklist for New Components

Before submitting a new CMS component:

- [ ] Uses `heading` (not `title`) for primary headline?
- [ ] Uses `subheading` (not `subtitle`) for secondary headline?
- [ ] Uses `body` (not `description`) for paragraph content?
- [ ] Uses `description` only for metadata/tooltips, not body text?
- [ ] Follows existing patterns from similar components?

---

## Questions?

If unsure about prop naming for a specific case, consult existing components in the same category (heroes, features, cta, etc.) and prioritize the standard naming convention.
