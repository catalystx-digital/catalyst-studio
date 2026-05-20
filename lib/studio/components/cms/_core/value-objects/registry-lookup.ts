/**
 * Registry Lookup Utilities
 *
 * Provides helper functions to check if a Zod schema is registered in the
 * ValueObjectRegistry. This is separated from the main registry to avoid
 * circular dependencies.
 */

import { z } from 'zod'
import type { ValueObjectName } from './registry'

// Import schemas for comparison (alphabetically)
import { AddressSchema } from './schemas/address.schema'
import { AuthorSchema } from './schemas/author.schema'
import { AutoFillSchema } from './schemas/auto-fill.schema'
import { BadgeSchema } from './schemas/badge.schema'
import { BlogPostItemSchema } from './schemas/blog-post-item.schema'
import { BlogPostMetadataSchema } from './schemas/blog-post-metadata.schema'
import { CardItemSchema } from './schemas/card-item.schema'
import { CategorySchema } from './schemas/category.schema'
import { ComparisonProductSchema, ComparisonFeatureSchema } from './schemas/comparison-product.schema'
import { ComponentListSchema } from './schemas/component-list.schema'
import { ConsentSchema } from './schemas/consent.schema'
import { ContactInfoSchema } from './schemas/contact-info.schema'
import { ContentAreaSchema } from './schemas/content-area.schema'
import { CTAButtonSchema } from './schemas/cta-button.schema'
import { EducationEntrySchema } from './schemas/education-entry.schema'
import { ExperienceEntrySchema } from './schemas/experience-entry.schema'
import { PageReferenceSchema, ExternalLinkSchema } from './schemas/page-reference.schema'
import { FAQSchema } from './schemas/faq.schema'
import { FeatureItemSchema } from './schemas/feature-item.schema'
import { FilterSchema } from './schemas/filter.schema'
import { FooterColumnSchema } from './schemas/footer-column.schema'
import { FooterNewsletterSchema } from './schemas/footer-newsletter.schema'
import { FormFieldSchema } from './schemas/form-field.schema'
import { HeroSlideSchema } from './schemas/hero-slide.schema'
import { ImageSchema } from './schemas/image.schema'
import { LinkSchema } from './schemas/link.schema'
import { LogoSchema } from './schemas/logo.schema'
import { MediaReferenceSchema } from './schemas/media-reference.schema'
import { MenuItemSchema } from './schemas/menu-item.schema'
import { NavBarSearchSchema } from './schemas/navbar-search.schema'
import { PhoneNumberSchema } from './schemas/phone-number.schema'
import { PricingFeatureSchema } from './schemas/pricing-feature.schema'
import { PricingTierSchema } from './schemas/pricing-tier.schema'
import { RatingSchema } from './schemas/rating.schema'
import { ShowcaseSectionSchema } from './schemas/showcase-section.schema'
import { SideMenuSectionSchema } from './schemas/sidemenu-section.schema'
import { SmartLinkSchema } from './schemas/smart-link.schema'
import { SocialLinkSchema } from './schemas/social-link.schema'
import { StatItemSchema } from './schemas/stat-item.schema'
import { SubmitButtonSchema } from './schemas/submit-button.schema'
import { TabItemSchema } from './schemas/tab-item.schema'
import { TagSchema } from './schemas/tag.schema'
import { TeamMemberSchema } from './schemas/team-member.schema'
import { TestimonialSchema } from './schemas/testimonial.schema'
import { TimelineEventSchema, TimelineActionSchema } from './schemas/timeline-event.schema'
import { VideoSourceSchema } from './schemas/video-source.schema'

/**
 * Map of schema instances to their registry names (alphabetically ordered)
 */
const schemaToNameMap = new Map<z.ZodTypeAny, ValueObjectName>([
  [AddressSchema, 'Address'],
  [AuthorSchema, 'Author'],
  [AutoFillSchema, 'AutoFill'],
  [BadgeSchema, 'Badge'],
  [BlogPostItemSchema, 'BlogPostItem'],
  [BlogPostMetadataSchema, 'BlogPostMetadata'],
  [CardItemSchema, 'CardItem'],
  [CategorySchema, 'Category'],
  [ComparisonFeatureSchema, 'ComparisonFeature'],
  [ComparisonProductSchema, 'ComparisonProduct'],
  [ComponentListSchema, 'ComponentList'],
  [ConsentSchema, 'Consent'],
  [ContactInfoSchema, 'ContactInfo'],
  [ContentAreaSchema, 'ContentArea'],
  [CTAButtonSchema, 'CTAButton'],
  [EducationEntrySchema, 'EducationEntry'],
  [ExperienceEntrySchema, 'ExperienceEntry'],
  [ExternalLinkSchema, 'ExternalLink'],
  [FAQSchema, 'FAQ'],
  [FeatureItemSchema, 'FeatureItem'],
  [FilterSchema, 'Filter'],
  [FooterColumnSchema, 'FooterColumn'],
  [FooterNewsletterSchema, 'FooterNewsletter'],
  [FormFieldSchema, 'FormField'],
  [HeroSlideSchema, 'HeroSlide'],
  [ImageSchema, 'Image'],
  [LinkSchema, 'Link'],
  [LogoSchema, 'Logo'],
  [MediaReferenceSchema, 'MediaReference'],
  [MenuItemSchema, 'MenuItem'],
  [NavBarSearchSchema, 'NavBarSearch'],
  [PageReferenceSchema, 'PageReference'],
  [PhoneNumberSchema, 'PhoneNumber'],
  [PricingFeatureSchema, 'PricingFeature'],
  [PricingTierSchema, 'PricingTier'],
  [RatingSchema, 'Rating'],
  [ShowcaseSectionSchema, 'ShowcaseSection'],
  [SideMenuSectionSchema, 'SideMenuSection'],
  [SmartLinkSchema, 'SmartLink'],
  [SocialLinkSchema, 'SocialLink'],
  [StatItemSchema, 'StatItem'],
  [SubmitButtonSchema, 'SubmitButton'],
  [TabItemSchema, 'TabItem'],
  [TagSchema, 'Tag'],
  [TeamMemberSchema, 'TeamMember'],
  [TestimonialSchema, 'Testimonial'],
  [TimelineActionSchema, 'TimelineAction'],
  [TimelineEventSchema, 'TimelineEvent'],
  [VideoSourceSchema, 'VideoSource'],
])

/**
 * Map of ZodObject._def.shape function references to registry names.
 * This enables matching schemas modified with .describe() which creates
 * a new ZodObject but preserves the shape function reference.
 */
const objectShapeToNameMap = new Map<() => z.ZodRawShape, ValueObjectName>()

/**
 * Map of ZodLazy._def.getter function references to registry names.
 * This enables matching recursive schemas like MenuItem which use z.lazy().
 */
const lazyGetterToNameMap = new Map<() => z.ZodTypeAny, ValueObjectName>()

// Build the identity maps from registered schemas
schemaToNameMap.forEach((name, schema) => {
  if (schema instanceof z.ZodLazy) {
    lazyGetterToNameMap.set((schema._def as { getter: () => z.ZodTypeAny }).getter, name)
  } else if (schema instanceof z.ZodObject) {
    objectShapeToNameMap.set((schema._def as { shape: () => z.ZodRawShape }).shape, name)
  }
})

/**
 * Cache for O(1) repeated lookups
 * WeakMap automatically garbage collects when schemas are no longer referenced
 */
const schemaLookupCache = new WeakMap<z.ZodTypeAny, ValueObjectName | null>()

/**
 * Unwrap Zod schema wrappers to get the base schema
 * Handles: ZodEffects (.describe()), ZodOptional, ZodNullable, ZodDefault
 *
 * @param schema - Zod schema to unwrap
 * @returns Unwrapped base schema
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodEffects) {
    return unwrapSchema(schema._def.schema)
  }
  if (schema instanceof z.ZodOptional) {
    return unwrapSchema(schema._def.innerType)
  }
  if (schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType)
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema._def.innerType)
  }
  return schema
}

/**
 * Check if a Zod schema is registered in the ValueObjectRegistry
 *
 * Handles multiple cases:
 * 1. Direct identity match (fastest path)
 * 2. Wrapped schemas (ZodOptional, ZodNullable, ZodDefault, ZodEffects)
 * 3. Described ZodObject schemas - uses _def.shape function identity
 * 4. ZodLazy schemas - uses _def.getter function identity
 *
 * @param schema - Zod schema to check
 * @returns Registry name if found, null otherwise
 */
export function isRegisteredSchema(schema: z.ZodTypeAny): ValueObjectName | null {
  // Fast path: cache hit
  if (schemaLookupCache.has(schema)) {
    return schemaLookupCache.get(schema) || null
  }

  // Try direct lookup first (for unwrapped schemas)
  const direct = schemaToNameMap.get(schema)
  if (direct) {
    schemaLookupCache.set(schema, direct)
    return direct
  }

  // Unwrap ZodEffects, ZodOptional, ZodNullable, ZodDefault
  const unwrapped = unwrapSchema(schema)
  if (unwrapped !== schema) {
    const unwrappedResult = schemaToNameMap.get(unwrapped)
    if (unwrappedResult) {
      schemaLookupCache.set(schema, unwrappedResult)
      return unwrappedResult
    }
  }

  // Check ZodObject by shape function identity
  // This handles cases like CTAButtonSchema.describe('...') where
  // .describe() creates a new ZodObject but preserves the shape function
  if (unwrapped instanceof z.ZodObject) {
    const shapeFn = (unwrapped._def as { shape: () => z.ZodRawShape }).shape
    const name = objectShapeToNameMap.get(shapeFn)
    if (name) {
      schemaLookupCache.set(schema, name)
      return name
    }
  }

  // Check ZodLazy by getter function identity
  // This handles recursive schemas like MenuItem which use z.lazy()
  if (unwrapped instanceof z.ZodLazy) {
    const getterFn = (unwrapped._def as { getter: () => z.ZodTypeAny }).getter
    const name = lazyGetterToNameMap.get(getterFn)
    if (name) {
      schemaLookupCache.set(schema, name)
      return name
    }

    // For nested lazy schemas like z.lazy(() => MenuItemSchema) inside MenuItemSchema.children,
    // the getter function is different, but it returns a registered schema.
    // Resolve the lazy and check if the resolved schema is registered.
    try {
      const resolvedSchema = unwrapped.schema // Uses public .schema property
      // Recursive call but with a different schema, so won't infinite loop
      const resolvedName = isRegisteredSchema(resolvedSchema)
      if (resolvedName) {
        schemaLookupCache.set(schema, resolvedName)
        return resolvedName
      }
    } catch (error) {
      // Log the error so we can track potential issues with lazy schema resolution
      console.warn(
        '[isRegisteredSchema] Failed to resolve lazy schema:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  // Cache miss: not a registered schema
  schemaLookupCache.set(schema, null)
  return null
}

/**
 * Get the registry name for a schema (alias for isRegisteredSchema)
 *
 * @param schema - Zod schema to check
 * @returns Registry name if found, null otherwise
 */
export function getRegisteredSchemaName(schema: z.ZodTypeAny): ValueObjectName | null {
  return isRegisteredSchema(schema)
}

/**
 * Get all registered value object names
 *
 * @returns Array of all registered value object names
 */
export function getAllValueObjectNames(): ValueObjectName[] {
  return Array.from(schemaToNameMap.values())
}

/**
 * Get all registered schemas with their names
 *
 * @returns Array of [schema, name] pairs
 */
export function getAllRegisteredSchemas(): [z.ZodTypeAny, ValueObjectName][] {
  return Array.from(schemaToNameMap.entries())
}
