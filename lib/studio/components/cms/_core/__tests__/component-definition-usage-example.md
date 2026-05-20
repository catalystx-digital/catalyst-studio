# Component Definition Usage Examples

## Basic Usage

### 1. Define a Component

```typescript
// hero-simple.def.ts
import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

export const HeroSimpleDef = defineComponent({
  type: ComponentType.HeroSimple,
  category: ComponentCategory.Heroes,

  description: 'Minimal hero section with headline and CTA',

  schema: z.object({
    heading: z.string().describe('Primary headline'),
    subheading: z.string().optional().describe('Supporting text'),
    cta: CTAButtonSchema.optional().describe('Call to action button')
  }),

  detection: {
    keywords: ['hero', 'simple hero', 'minimal hero'],
    confidence: 0.9,
    pageLocation: ['hero']
  },

  sample: {
    heading: 'Welcome to Our Platform',
    subheading: 'Build amazing experiences',
    cta: {
      label: 'Get Started',
      href: '/signup',
      variant: 'primary'
    }
  }
})

// Type is automatically inferred from schema
export type HeroSimpleContent = z.infer<typeof HeroSimpleDef.schema>
```

### 2. Use the Component Type

```typescript
// hero-simple.tsx
import { HeroSimpleContent } from './hero-simple.def'

interface HeroSimpleProps {
  content: HeroSimpleContent
}

export function HeroSimple({ content }: HeroSimpleProps) {
  return (
    <div>
      <h1>{content.heading}</h1>
      {content.subheading && <p>{content.subheading}</p>}
      {content.cta && (
        <a href={content.cta.href}>
          {content.cta.label}
        </a>
      )}
    </div>
  )
}
```

### 3. Validate Data

```typescript
import { HeroSimpleDef } from './hero-simple.def'

// At data entry points (API boundaries, imports)
const result = HeroSimpleDef.schema.safeParse(untrustedData)

if (!result.success) {
  console.error('Invalid data:', result.error)
} else {
  const validContent: HeroSimpleContent = result.data
  // Use validContent safely
}
```

## Advanced Patterns

### Reusing Value Objects

```typescript
import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import {
  CTAButtonSchema,
  ImageSchema,
  TestimonialSchema
} from '../../_core/value-objects'

export const TestimonialSectionDef = defineComponent({
  type: ComponentType.Testimonials,
  category: ComponentCategory.SocialProof,

  schema: z.object({
    heading: z.string(),
    testimonials: z.array(TestimonialSchema), // Reuse value object
    image: ImageSchema.optional(),
    cta: CTAButtonSchema.optional()
  })
})
```

### Nested Schemas

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string()
})

export const ContactFormDef = defineComponent({
  type: ComponentType.ContactForm,
  category: ComponentCategory.Contact,

  schema: z.object({
    heading: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['text', 'email', 'tel']),
      required: z.boolean()
    })),
    address: AddressSchema.optional()
  })
})
```

### Converting to PropsMeta (Backward Compatibility)

```typescript
import { zodToPropsMetaFields } from '../../_core/component-definition'
import { HeroSimpleDef } from './hero-simple.def'

// Generate PropsMeta from Zod schema
export const heroSimplePropsMeta = zodToPropsMetaFields(HeroSimpleDef.schema)

// Result:
// {
//   heading: { type: 'string', required: true, description: 'Primary headline' },
//   subheading: { type: 'string', required: false, description: 'Supporting text' },
//   cta: { type: 'object', required: false, description: 'Call to action button' }
// }
```

### Using Detection Metadata

```typescript
import { detectionToAIMetadata } from '../../_core/component-definition'
import { HeroSimpleDef } from './hero-simple.def'

// Convert to AIComponentMetadata format
const aiMetadata = detectionToAIMetadata(
  HeroSimpleDef.detection!,
  HeroSimpleDef.type
)

// Register in component registry
componentRegistry[ComponentType.HeroSimple] = {
  component: HeroSimple,
  metadata: aiMetadata,
  propsMeta: zodToPropsMetaFields(HeroSimpleDef.schema)
}
```

## Migration from Old Pattern

### Before (3-4 files)

```typescript
// hero-simple.types.ts
export interface HeroSimpleContent {
  heading: string
  subheading?: string
  cta?: CTAButton
}

// hero-simple.propsmeta.ts
export const heroSimplePropsMeta = {
  heading: { type: 'string', required: true },
  subheading: { type: 'string', required: false },
  cta: { type: getTypeString('CTAButton'), required: false }
}

// hero-simple.ai.ts
export const heroSimpleMetadata: AIComponentMetadata = {
  keywords: ['hero', 'simple hero'],
  patterns: ['hero.*simple'],
  // ...
}

// canonical/hero-simple.ts
export const detectHeroSimple = (node: CheerioElement) => {
  // Detection logic
}
```

### After (1 file)

```typescript
// hero-simple.def.ts
import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { CTAButtonSchema } from '../../_core/value-objects'

export const HeroSimpleDef = defineComponent({
  type: ComponentType.HeroSimple,
  category: ComponentCategory.Heroes,

  schema: z.object({
    heading: z.string().describe('Primary headline'),
    subheading: z.string().optional().describe('Supporting text'),
    cta: CTAButtonSchema.optional().describe('Call to action')
  }),

  detection: {
    keywords: ['hero', 'simple hero'],
    patterns: ['hero.*simple'],
    confidence: 0.9,
    pageLocation: ['hero']
  },

  sample: {
    heading: 'Welcome',
    cta: { label: 'Start', href: '/signup' }
  }
})

export type HeroSimpleContent = z.infer<typeof HeroSimpleDef.schema>
```

## Benefits

1. **Single Source of Truth**: Zod schema defines everything
2. **Type Safety**: TypeScript types inferred automatically
3. **Runtime Validation**: Zod provides runtime checking
4. **Fewer Files**: 1 file instead of 3-4
5. **Better DX**: All metadata in one place
6. **Easier Maintenance**: Change schema, everything updates
7. **Backward Compatible**: Can generate PropsMeta when needed
