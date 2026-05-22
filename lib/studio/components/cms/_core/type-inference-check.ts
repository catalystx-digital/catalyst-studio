/**
 * Type Inference Check
 *
 * This file verifies that TypeScript type inference works correctly
 * with the defineComponent() pattern. If this file compiles without
 * errors, type inference is working.
 */

import { z } from 'zod'
import { HeroWithImageDef, type HeroWithImageContent } from '../heroes/hero-with-image/hero-with-image.def'

// Test 1: Verify type inference from schema
type InferredType = z.infer<typeof HeroWithImageDef.schema>

// Test 2: Verify inferred type matches exported type
const testTypeCompatibility = (props: HeroWithImageContent): InferredType => props
const testTypeCompatibility2 = (props: InferredType): HeroWithImageContent => props

// Test 3: Verify required vs optional fields
const validMinimal: HeroWithImageContent = {
  heading: 'Test Heading' // Only required field
}

const validComplete: HeroWithImageContent = {
  eyebrow: 'New',
  heading: 'Test Heading',
  subheading: 'Test Subheading',
  body: 'Test body text',
  alignment: 'left',
  layout: 'image-right',
  theme: 'light',
  image: {
    src: {
      mediaId: 'test-image',
      mediaType: 'image',
      url: 'test.jpg'
    },
    alt: 'Test image'
  },
  ctaButtons: [
    {
      label: 'Click me',
      href: {
        type: 'internal',
        pageId: 'test',
        path: '/test'
      }
    }
  ]
}

// Test 4: Verify schema validation works
const validateData = (data: unknown): HeroWithImageContent => {
  const result = HeroWithImageDef.schema.parse(data)
  return result
}

// Test 5: Verify enum type constraints
const testAlignment: HeroWithImageContent['alignment'] = 'left' // Valid
// const badAlignment: HeroWithImageContent['alignment'] = 'invalid' // Would error

const testLayout: HeroWithImageContent['layout'] = 'image-right' // Valid
// const badLayout: HeroWithImageContent['layout'] = 'invalid' // Would error

// Test 6: Verify nested object types (Image schema)
const testImage: NonNullable<HeroWithImageContent['image']> = {
  src: {
    mediaId: 'test-image',
    mediaType: 'image',
    url: 'test.jpg'
  },
  alt: 'Test',
  width: 800,
  height: 600
}

// Test 7: Verify array types (CTAButton schema)
const testCTAButtons: NonNullable<HeroWithImageContent['ctaButtons']> = [
  {
    label: 'Primary',
    href: {
      type: 'internal',
      pageId: 'primary',
      path: '/primary'
    },
    variant: 'primary'
  },
  {
    label: 'Secondary',
    href: {
      type: 'internal',
      pageId: 'secondary',
      path: '/secondary'
    },
    variant: 'secondary'
  }
]

// If this file compiles, type inference is working correctly!
export const typeInferenceWorks = true
