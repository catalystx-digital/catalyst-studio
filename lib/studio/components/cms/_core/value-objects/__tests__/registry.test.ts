/**
 * Unit Tests for ValueObjectRegistry
 *
 * Tests the registry system for CMS value objects, including:
 * - Schema retrieval
 * - Type string generation for LLM consumption
 * - Field schema generation for property editor
 * - Schema validation
 * - Strict canonical schema validation
 */

import { z } from 'zod'
import {
  getSchema,
  getTypeString,
  getFieldSchema,
  LogoSchema,
  CTAButtonSchema,
  FAQSchema,
} from '../registry'

describe('ValueObjectRegistry', () => {
  describe('getSchema', () => {
    it('returns Zod schema for Logo', () => {
      const schema = getSchema('Logo')
      expect(schema).toBe(LogoSchema)
      expect(schema).toBeInstanceOf(z.ZodObject)
    })

    it('returns Zod schema for CTAButton', () => {
      const schema = getSchema('CTAButton')
      expect(schema).toBe(CTAButtonSchema)
      expect(schema).toBeInstanceOf(z.ZodObject)
    })

    it('returns Zod schema for all registered value objects', () => {
      const validNames = [
        'Logo', 'CTAButton', 'Image', 'Link', 'MenuItem', 'SocialLink',
        'ContactInfo', 'Address', 'PhoneNumber', 'Testimonial', 'TeamMember',
        'PricingTier', 'FAQ', 'VideoSource', 'FormField', 'Badge', 'Rating',
        'Author', 'Tag', 'Category', 'PricingFeature', 'EducationEntry', 'ExperienceEntry',
        'PageReference', 'ExternalLink', 'MediaReference', 'SmartLink'
      ] as const

      validNames.forEach((name) => {
        const schema = getSchema(name)
        expect(schema).toBeDefined()

        // MenuItem uses ZodLazy for recursive types
        // SmartLink uses ZodDiscriminatedUnion
        // Others use ZodObject
        if (name === 'MenuItem') {
          expect(schema).toBeInstanceOf(z.ZodLazy)
        } else if (name === 'SmartLink') {
          expect(schema).toBeInstanceOf(z.ZodDiscriminatedUnion)
        } else {
          expect(schema).toBeInstanceOf(z.ZodObject)
        }
      })
    })
  })

  describe('getTypeString', () => {
    it('returns type string for Logo', () => {
      const typeString = getTypeString('Logo')

      // Should be an object type string
      expect(typeString).toMatch(/^\{.*\}$/)

      // Should contain core Logo fields
      expect(typeString).toContain('src?:')
      expect(typeString).toContain('alt?:')
      expect(typeString).toContain('text?:')
      expect(typeString).toContain('href?:')

      // Should use string types
      expect(typeString).toContain('string')
    })

    it('returns type string for CTAButton', () => {
      const typeString = getTypeString('CTAButton')

      // Should be an object type string
      expect(typeString).toMatch(/^\{.*\}$/)

      expect(typeString).not.toContain('text?:')
      expect(typeString).toContain('label:')

      expect(typeString).toContain('href?:')
      expect(typeString).not.toContain('url?:')
      expect(typeString).toContain("type: 'external'")

      // Should contain variant enum
      expect(typeString).toContain('variant?:')
      expect(typeString).toContain("'primary'|'secondary'|'outline'")
    })

    it('generates correct format for LLM consumption', () => {
      const typeString = getTypeString('Logo')

      // Format should start with "{" and end with "}"
      expect(typeString).toMatch(/^\{/)
      expect(typeString).toMatch(/\}$/)
      expect(typeString).toContain(';')

      // Optional fields should have "?" marker
      expect(typeString).toMatch(/\w+\?:/g)
    })

    it('handles nested objects correctly', () => {
      const typeString = getTypeString('Logo')

      // Logo has renditions array with nested objects
      expect(typeString).toContain('renditions?:')
      expect(typeString).toContain('Array<')
    })

    it('returns valid type strings for all schemas', () => {
      const schemaNames = [
        'Logo', 'CTAButton', 'Image', 'Link', 'MenuItem', 'SocialLink',
        'ContactInfo', 'Address', 'PhoneNumber', 'Testimonial', 'TeamMember',
        'PricingTier', 'FAQ', 'VideoSource', 'FormField', 'Badge', 'Rating',
        'Author', 'Tag', 'Category', 'PricingFeature', 'EducationEntry', 'ExperienceEntry',
        'PageReference', 'ExternalLink', 'MediaReference', 'SmartLink'
      ] as const

      schemaNames.forEach((name) => {
        const typeString = getTypeString(name)

        // Should return a non-empty string
        expect(typeString).toBeTruthy()
        expect(typeof typeString).toBe('string')

        if (name === 'SmartLink') {
          expect(typeString).toContain("type: 'external'")
        } else {
          expect(typeString).toMatch(/^\{/)
          expect(typeString).toMatch(/\}$/)
        }
      })
    })
  })

  describe('getFieldSchema', () => {
    it('returns field schema for Logo', () => {
      const fieldSchema = getFieldSchema('Logo')

      // Should be an object type
      expect(fieldSchema.type).toBe('object')
      expect(fieldSchema.name).toBe('Logo')

      // Should have fields array
      expect(fieldSchema.fields).toBeDefined()
      expect(Array.isArray(fieldSchema.fields)).toBe(true)

      // Should contain core Logo fields
      const fieldNames = fieldSchema.fields!.map(f => f.name)
      expect(fieldNames).toContain('src')
      expect(fieldNames).toContain('alt')
      expect(fieldNames).toContain('text')
      expect(fieldNames).toContain('href')
    })

    it('returns field schema for CTAButton', () => {
      const fieldSchema = getFieldSchema('CTAButton')

      // Should be an object type
      expect(fieldSchema.type).toBe('object')
      expect(fieldSchema.name).toBe('CTAButton')

      // Should have fields
      expect(fieldSchema.fields).toBeDefined()

      const fieldNames = fieldSchema.fields!.map(f => f.name)
      expect(fieldNames).toContain('label')
      expect(fieldNames).toContain('href')
      expect(fieldNames).not.toContain('text')
      expect(fieldNames).not.toContain('url')

      // Variant field should be a select type
      const variantField = fieldSchema.fields!.find(f => f.name === 'variant')
      expect(variantField?.type).toBe('select')
      expect(variantField?.options).toBeDefined()
      expect(variantField?.options?.length).toBe(3)
    })

    it('marks optional fields correctly', () => {
      const fieldSchema = getFieldSchema('Logo')

      // All Logo fields are optional
      fieldSchema.fields!.forEach(field => {
        expect(field.required).toBe(false)
      })
    })

    it('extracts field descriptions as labels', () => {
      const fieldSchema = getFieldSchema('Logo')

      // Find src field which has a description
      const srcField = fieldSchema.fields!.find(f => f.name === 'src')
      expect(srcField?.label).toBe('Logo image URL')
    })

    it('handles nested objects correctly', () => {
      const fieldSchema = getFieldSchema('Logo')

      // Find renditions field (array of objects)
      const renditionsField = fieldSchema.fields!.find(f => f.name === 'renditions')
      expect(renditionsField?.type).toBe('array')
      expect(renditionsField?.items).toBeDefined()
      expect(renditionsField?.items?.type).toBe('object')
    })

    it('returns valid field schemas for all registered types', () => {
      const schemaNames = [
        'Logo', 'CTAButton', 'Image', 'Link', 'MenuItem', 'SocialLink',
        'ContactInfo', 'Address', 'PhoneNumber', 'Testimonial', 'TeamMember',
        'PricingTier', 'FAQ', 'VideoSource', 'FormField', 'Badge', 'Rating',
        'Author', 'Tag', 'Category', 'PricingFeature', 'EducationEntry', 'ExperienceEntry',
        'PageReference', 'ExternalLink', 'MediaReference', 'SmartLink'
      ] as const

      schemaNames.forEach((name) => {
        const fieldSchema = getFieldSchema(name)

        // Should have required properties
        expect(fieldSchema.name).toBe(name)

        // MenuItem resolves to its recursive object shape.
        // SmartLink uses ZodDiscriminatedUnion which converts to 'json' type
        if (name === 'SmartLink') {
          expect(fieldSchema.type).toBe('json')
        } else {
          expect(fieldSchema.type).toBe('object')
          expect(fieldSchema.fields).toBeDefined()
          expect(Array.isArray(fieldSchema.fields)).toBe(true)
        }
      })
    })
  })

  describe('Schema Validation', () => {
    describe('Logo schema', () => {
      it('validates valid Logo data', () => {
        const validLogo = {
          src: { mediaId: 'logo-media', mediaType: 'image' as const },
          alt: 'Company Logo',
          text: 'Company',
          href: '/',
          width: 200,
          height: 50,
        }

        const result = LogoSchema.safeParse(validLogo)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validLogo)
        }
      })

      it('validates Logo with minimal data', () => {
        const minimalLogo = {}

        const result = LogoSchema.safeParse(minimalLogo)
        expect(result.success).toBe(true)
      })

      it('validates Logo with renditions', () => {
        const logoWithRenditions = {
          src: { mediaId: 'logo-media', mediaType: 'image' as const },
          alt: 'Logo',
          renditions: [
            { src: '/logo-sm.png', width: 100, height: 25 },
            { src: '/logo-md.png', width: 200, height: 50 },
          ],
        }

        const result = LogoSchema.safeParse(logoWithRenditions)
        expect(result.success).toBe(true)
      })

      it('allows null Logo width and height when dimensions are unknown', () => {
        const logoWithUnknownDimensions = {
          src: { mediaId: 'logo-media', mediaType: 'image' as const },
          alt: 'Logo',
          width: null,
          height: null,
        }

        const result = LogoSchema.safeParse(logoWithUnknownDimensions)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.width).toBeNull()
          expect(result.data.height).toBeNull()
        }
      })

      it('rejects invalid Logo data types', () => {
        const invalidLogo = {
          src: 123, // Should be string
          alt: 'Logo',
        }

        const result = LogoSchema.safeParse(invalidLogo)
        expect(result.success).toBe(false)
      })

      it('rejects Logo with invalid width/height', () => {
        const invalidLogo = {
          src: '/logo.png',
          width: 'invalid', // Should be number
          height: 50,
        }

        const result = LogoSchema.safeParse(invalidLogo)
        expect(result.success).toBe(false)
      })
    })

    describe('CTAButton schema', () => {
      it('validates valid CTAButton data', () => {
        const validButton = {
          label: 'Click Me',
          href: { type: 'internal' as const, pageId: 'contact-page', path: '/contact' },
          variant: 'primary' as const,
          icon: '→',
        }

        const result = CTAButtonSchema.safeParse(validButton)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validButton)
        }
      })

      it('rejects CTAButton with raw string href', () => {
        const buttonWithLabel = {
          label: 'Click Me',
          href: '/contact',
          variant: 'secondary' as const,
        }

        const result = CTAButtonSchema.safeParse(buttonWithLabel)
        expect(result.success).toBe(false)
      })

      it('rejects CTAButton with url instead of href', () => {
        const buttonWithUrl = {
          label: 'Click Me',
          url: '/contact',
          variant: 'outline' as const,
        }

        const result = CTAButtonSchema.safeParse(buttonWithUrl)
        expect(result.success).toBe(false)
      })

      it('rejects legacy text when canonical label is present', () => {
        const button = {
          text: 'Text Value',
          label: 'Label Value',
          href: { type: 'internal' as const, pageId: 'page-1', path: '/page' },
        }

        const result = CTAButtonSchema.safeParse(button)
        expect(result.success).toBe(false)
      })

      it('rejects legacy url when canonical href is present', () => {
        const button = {
          label: 'Get Started',
          href: { type: 'internal' as const, pageId: 'page-1', path: '/page1' },
          url: '/page2',
        }

        const result = CTAButtonSchema.safeParse(button)
        expect(result.success).toBe(false)
      })

      it('rejects CTAButton without required label', () => {
        const minimalButton = {}

        const result = CTAButtonSchema.safeParse(minimalButton)
        expect(result.success).toBe(false)
      })

      it('rejects invalid variant values', () => {
        const invalidButton = {
          label: 'Click Me',
          href: { type: 'internal' as const, pageId: 'contact-page', path: '/contact' },
          variant: 'invalid-variant', // Not a valid enum value
        }

        const result = CTAButtonSchema.safeParse(invalidButton)
        expect(result.success).toBe(false)
      })

      it('rejects invalid data types', () => {
        const invalidButton = {
          label: 123, // Should be string
          href: { type: 'internal' as const, pageId: 'contact-page', path: '/contact' },
          external: 'yes', // Should be boolean
        }

        const result = CTAButtonSchema.safeParse(invalidButton)
        expect(result.success).toBe(false)
      })

      it('accepts valid boolean for external field', () => {
        const button = {
          label: 'External Link',
          href: { type: 'external' as const, url: 'https://example.com' },
          external: true,
        }

        const result = CTAButtonSchema.safeParse(button)
        expect(result.success).toBe(true)
      })
    })

    describe('FAQ schema', () => {
      it('validates FAQ items with question and answer content', () => {
        const result = FAQSchema.safeParse({
          question: 'What services do you offer?',
          answer: 'Strategy, design, and engineering.',
        })

        expect(result.success).toBe(true)
      })

      it('rejects empty or whitespace-only question and answer text', () => {
        const emptyAnswer = FAQSchema.safeParse({
          question: 'Technology',
          answer: '',
        })
        const whitespaceQuestion = FAQSchema.safeParse({
          question: '   ',
          answer: 'A real answer',
        })

        expect(emptyAnswer.success).toBe(false)
        expect(whitespaceQuestion.success).toBe(false)
        if (!emptyAnswer.success) {
          expect(emptyAnswer.error.issues[0]).toEqual(
            expect.objectContaining({
              path: ['answer'],
              message: 'FAQ answer must be non-empty',
            }),
          )
        }
      })
    })

    describe('Cross-schema validation', () => {
      it('validates all schemas accept empty objects (except those with required fields)', () => {
        // Schemas with required fields (discovered through testing)
        const schemasWithRequiredFields = [
          'MenuItem',
          'SocialLink',
          'PhoneNumber',
          'Testimonial',
          'TeamMember',
          'PricingTier',
          'FAQ',
          'VideoSource',
          'FormField',
          'Badge',
          'Rating',
          'Tag',
          'Category',
          'PricingFeature',
          'EducationEntry',
          'ExperienceEntry',
          'CTAButton',
          'PageReference',
          'ExternalLink',
          'MediaReference',
          'SmartLink',
        ]

        const schemaNames = [
          'Logo', 'CTAButton', 'Image', 'Link', 'MenuItem', 'SocialLink',
          'ContactInfo', 'Address', 'PhoneNumber', 'Testimonial', 'TeamMember',
          'PricingTier', 'FAQ', 'VideoSource', 'FormField', 'Badge', 'Rating',
          'Author', 'Tag', 'Category', 'PricingFeature', 'EducationEntry', 'ExperienceEntry',
          'PageReference', 'ExternalLink', 'MediaReference', 'SmartLink'
        ] as const

        schemaNames.forEach((name) => {
          const schema = getSchema(name)
          const result = schema.safeParse({})

          if (schemasWithRequiredFields.includes(name)) {
            // Schemas with required fields should reject empty objects
            expect(result.success).toBe(false)
          } else {
            // All other schemas should accept empty objects (all fields optional or have defaults)
            expect(result.success).toBe(true)
          }
        })
      })

      it('validates schemas reject null/undefined', () => {
        const schema = getSchema('Logo')

        expect(schema.safeParse(null).success).toBe(false)
        expect(schema.safeParse(undefined).success).toBe(false)
      })

      it('validates schemas reject primitive values', () => {
        const schema = getSchema('Logo')

        expect(schema.safeParse('string').success).toBe(false)
        expect(schema.safeParse(123).success).toBe(false)
        expect(schema.safeParse(true).success).toBe(false)
      })

      it('validates schemas reject arrays', () => {
        const schema = getSchema('Logo')

        expect(schema.safeParse([]).success).toBe(false)
        expect(schema.safeParse([{ src: '/logo.png' }]).success).toBe(false)
      })
    })

    describe('Reference schema validation', () => {
      describe('PageReference schema', () => {
        it('validates valid internal page reference', () => {
          const pageRef = {
            type: 'internal',
            pageId: 'page-123',
            path: '/about',
            label: 'About Us',
          }
          const schema = getSchema('PageReference')
          const result = schema.safeParse(pageRef)
          expect(result.success).toBe(true)
        })

        it('requires type, pageId, and path', () => {
          const schema = getSchema('PageReference')
          expect(schema.safeParse({}).success).toBe(false)
          expect(schema.safeParse({ type: 'internal' }).success).toBe(false)
          expect(schema.safeParse({ type: 'internal', pageId: '123' }).success).toBe(false)
        })
      })

      describe('ExternalLink schema', () => {
        it('validates valid external link', () => {
          const externalLink = {
            type: 'external',
            url: 'https://example.com',
            label: 'Example',
            openInNewTab: true,
          }
          const schema = getSchema('ExternalLink')
          const result = schema.safeParse(externalLink)
          expect(result.success).toBe(true)
        })

        it('requires valid URL format', () => {
          const schema = getSchema('ExternalLink')
          const invalidUrl = { type: 'external', url: 'not-a-url' }
          expect(schema.safeParse(invalidUrl).success).toBe(false)
        })
      })

      describe('MediaReference schema', () => {
        it('validates valid media reference', () => {
          const mediaRef = {
            mediaId: 'media-456',
            mediaType: 'image',
            url: '/uploads/image.jpg',
            alt: 'An image',
            width: 800,
            height: 600,
          }
          const schema = getSchema('MediaReference')
          const result = schema.safeParse(mediaRef)
          expect(result.success).toBe(true)
        })

        it('requires mediaId and mediaType', () => {
          const schema = getSchema('MediaReference')
          expect(schema.safeParse({}).success).toBe(false)
          expect(schema.safeParse({ mediaId: '123' }).success).toBe(false)
        })

        it('validates mediaType enum', () => {
          const schema = getSchema('MediaReference')
          expect(schema.safeParse({ mediaId: '1', mediaType: 'image' }).success).toBe(true)
          expect(schema.safeParse({ mediaId: '1', mediaType: 'video' }).success).toBe(true)
          expect(schema.safeParse({ mediaId: '1', mediaType: 'file' }).success).toBe(true)
          expect(schema.safeParse({ mediaId: '1', mediaType: 'invalid' }).success).toBe(false)
        })
      })

      describe('SmartLink schema (discriminated union)', () => {
        it('validates internal page reference', () => {
          const schema = getSchema('SmartLink')
          const internalLink = { type: 'internal', pageId: 'p1', path: '/home' }
          expect(schema.safeParse(internalLink).success).toBe(true)
        })

        it('validates external URL', () => {
          const schema = getSchema('SmartLink')
          const externalLink = { type: 'external', url: 'https://google.com' }
          expect(schema.safeParse(externalLink).success).toBe(true)
        })

        it('rejects invalid discriminator', () => {
          const schema = getSchema('SmartLink')
          const invalid = { type: 'unknown', pageId: 'p1' }
          expect(schema.safeParse(invalid).success).toBe(false)
        })
      })
    })
  })

  describe('Type safety', () => {
    it('getSchema returns correct type inference', () => {
      const schema = getSchema('Logo')

      // TypeScript should infer the correct type
      type InferredType = z.infer<typeof schema>

      // This is a compile-time check, but we can verify runtime behavior
      const parsed = schema.parse({
        src: { mediaId: 'logo-media', mediaType: 'image' },
        alt: 'Logo',
      })

      expect(parsed.src).toEqual({ mediaId: 'logo-media', mediaType: 'image' })
      expect(parsed.alt).toBe('Logo')
    })

    it('exported schemas match registry schemas', () => {
      expect(getSchema('Logo')).toBe(LogoSchema)
      expect(getSchema('CTAButton')).toBe(CTAButtonSchema)
    })
  })

  describe('Edge cases', () => {
    it('handles unknown fields gracefully', () => {
      const logoWithExtra = {
        src: { mediaId: 'logo-media', mediaType: 'image' },
        unknownField: 'should be stripped',
      }

      const result = LogoSchema.safeParse(logoWithExtra)
      expect(result.success).toBe(true)

      // Zod strips unknown fields by default
      if (result.success) {
        expect(result.data).not.toHaveProperty('unknownField')
      }
    })

    it('handles nullable values in optional fields', () => {
      const logoWithNulls = {
        src: null, // null in optional field
        alt: 'Logo',
      }

      // Optional fields don't accept null by default in our schemas
      const result = LogoSchema.safeParse(logoWithNulls)
      expect(result.success).toBe(false)
    })
  })
})
