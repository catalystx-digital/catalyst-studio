/**
 * Value Objects Registry
 *
 * Central registry for all CMS value object schemas. Provides lookup functions
 * for getting schemas, type strings, and field schemas for the property editor.
 */

import { z } from 'zod'
import { zodToTypeString } from './utils/zod-to-type-string'
import { zodToFieldSchema } from './utils/zod-to-field-schema'

// Import all schemas (alphabetically)
import { AddressSchema, type Address } from './schemas/address.schema'
import { AnchorLinkSchema, type AnchorLink } from './schemas/anchor-link.schema'
import { AuthorSchema, type Author } from './schemas/author.schema'
import { AutoFillSchema, type AutoFill } from './schemas/auto-fill.schema'
import { BadgeSchema, type Badge } from './schemas/badge.schema'
import { BlogPostItemSchema, type BlogPostItem } from './schemas/blog-post-item.schema'
import { BlogPostMetadataSchema, type BlogPostMetadata } from './schemas/blog-post-metadata.schema'
import { CardItemSchema, type CardItem } from './schemas/card-item.schema'
import { CategorySchema, type Category } from './schemas/category.schema'
import { ComparisonProductSchema, ComparisonFeatureSchema, type ComparisonProduct, type ComparisonFeature } from './schemas/comparison-product.schema'
import { ComponentListSchema, type ComponentList } from './schemas/component-list.schema'
import { ConsentSchema, type Consent } from './schemas/consent.schema'
import { ContactInfoSchema, type ContactInfo } from './schemas/contact-info.schema'
import { ContentAreaSchema, type ContentArea } from './schemas/content-area.schema'
import { CTAButtonSchema, type CTAButton } from './schemas/cta-button.schema'
import { EducationEntrySchema, type EducationEntry } from './schemas/education-entry.schema'
import { EmailLinkSchema, type EmailLink } from './schemas/email-link.schema'
import { ExperienceEntrySchema, type ExperienceEntry } from './schemas/experience-entry.schema'
import { PageReferenceSchema, ExternalLinkSchema, type PageReference, type ExternalLink } from './schemas/page-reference.schema'
import { FAQSchema, type FAQ } from './schemas/faq.schema'
import { FeatureItemSchema, type FeatureItem } from './schemas/feature-item.schema'
import { FilterSchema, type Filter } from './schemas/filter.schema'
import { FooterColumnSchema, type FooterColumn } from './schemas/footer-column.schema'
import { FooterNewsletterSchema, type FooterNewsletter } from './schemas/footer-newsletter.schema'
import { FormFieldSchema, type FormField } from './schemas/form-field.schema'
import { HeroSlideSchema, type HeroSlide } from './schemas/hero-slide.schema'
import { ImageSchema, type Image } from './schemas/image.schema'
import { LinkSchema, type Link } from './schemas/link.schema'
import { LogoSchema, type Logo } from './schemas/logo.schema'
import { MediaReferenceSchema, type MediaReference } from './schemas/media-reference.schema'
import { MenuItemSchema, type MenuItem } from './schemas/menu-item.schema'
import { NavBarSearchSchema, type NavBarSearch } from './schemas/navbar-search.schema'
import { PhoneLinkSchema, type PhoneLink } from './schemas/phone-link.schema'
import { PhoneNumberSchema, type PhoneNumber } from './schemas/phone-number.schema'
import { PricingFeatureSchema, type PricingFeature } from './schemas/pricing-feature.schema'
import { PricingTierSchema, type PricingTier } from './schemas/pricing-tier.schema'
import { RatingSchema, type Rating } from './schemas/rating.schema'
import { ShowcaseSectionSchema, type ShowcaseSection } from './schemas/showcase-section.schema'
import { SideMenuSectionSchema, type SideMenuSection } from './schemas/sidemenu-section.schema'
import { SmartLinkSchema, type SmartLink } from './schemas/smart-link.schema'
import { SocialLinkSchema, type SocialLink } from './schemas/social-link.schema'
import { StatItemSchema, type StatItem, type StatDelta } from './schemas/stat-item.schema'
import { SubmitButtonSchema, type SubmitButton } from './schemas/submit-button.schema'
import { TabItemSchema, type TabItem } from './schemas/tab-item.schema'
import { TagSchema, type Tag } from './schemas/tag.schema'
import { TeamMemberSchema, type TeamMember } from './schemas/team-member.schema'
import { TestimonialSchema, type Testimonial } from './schemas/testimonial.schema'
import { TimelineEventSchema, TimelineActionSchema, type TimelineEvent, type TimelineAction } from './schemas/timeline-event.schema'
import { VideoSourceSchema, type VideoSource } from './schemas/video-source.schema'

/**
 * Schema registry map
 * Maps schema names to their Zod schema definitions (alphabetically ordered)
 */
const schemas = {
  Address: AddressSchema,
  AnchorLink: AnchorLinkSchema,
  Author: AuthorSchema,
  AutoFill: AutoFillSchema,
  Badge: BadgeSchema,
  BlogPostItem: BlogPostItemSchema,
  BlogPostMetadata: BlogPostMetadataSchema,
  CardItem: CardItemSchema,
  Category: CategorySchema,
  ComparisonFeature: ComparisonFeatureSchema,
  ComparisonProduct: ComparisonProductSchema,
  ComponentList: ComponentListSchema,
  Consent: ConsentSchema,
  ContactInfo: ContactInfoSchema,
  ContentArea: ContentAreaSchema,
  CTAButton: CTAButtonSchema,
  EducationEntry: EducationEntrySchema,
  EmailLink: EmailLinkSchema,
  ExperienceEntry: ExperienceEntrySchema,
  ExternalLink: ExternalLinkSchema,
  FAQ: FAQSchema,
  FeatureItem: FeatureItemSchema,
  Filter: FilterSchema,
  FooterColumn: FooterColumnSchema,
  FooterNewsletter: FooterNewsletterSchema,
  FormField: FormFieldSchema,
  HeroSlide: HeroSlideSchema,
  Image: ImageSchema,
  Link: LinkSchema,
  Logo: LogoSchema,
  MediaReference: MediaReferenceSchema,
  MenuItem: MenuItemSchema,
  NavBarSearch: NavBarSearchSchema,
  PageReference: PageReferenceSchema,
  PhoneLink: PhoneLinkSchema,
  PhoneNumber: PhoneNumberSchema,
  PricingFeature: PricingFeatureSchema,
  PricingTier: PricingTierSchema,
  Rating: RatingSchema,
  ShowcaseSection: ShowcaseSectionSchema,
  SideMenuSection: SideMenuSectionSchema,
  SmartLink: SmartLinkSchema,
  SocialLink: SocialLinkSchema,
  StatItem: StatItemSchema,
  SubmitButton: SubmitButtonSchema,
  TabItem: TabItemSchema,
  Tag: TagSchema,
  TeamMember: TeamMemberSchema,
  Testimonial: TestimonialSchema,
  TimelineAction: TimelineActionSchema,
  TimelineEvent: TimelineEventSchema,
  VideoSource: VideoSourceSchema,
} as const

/**
 * Type for schema names in the registry
 */
export type ValueObjectName = keyof typeof schemas

/**
 * Get a Zod schema by name
 *
 * @param name - The name of the schema to retrieve
 * @returns The Zod schema
 *
 * @example
 * const logoSchema = getSchema('Logo')
 * const validatedLogo = logoSchema.parse(data)
 */
export function getSchema<T extends ValueObjectName>(
  name: T
): (typeof schemas)[T] {
  return schemas[name]
}

/**
 * Get a TypeScript type string for a schema (for LLM consumption)
 *
 * @param name - The name of the schema
 * @returns Type string representation of the schema
 *
 * @example
 * const typeString = getTypeString('Logo')
 * // Returns: "{ src?: string; alt?: string; text?: string; ... }"
 */
export function getTypeString(name: ValueObjectName): string {
  return zodToTypeString(schemas[name])
}

/**
 * Get a FieldSchema for a schema (for property editor)
 *
 * @param name - The name of the schema
 * @returns FieldSchema configuration for property editor
 *
 * @example
 * const fieldSchema = getFieldSchema('Logo')
 * // Returns: { type: 'object', fields: [...] }
 */
export function getFieldSchema(name: ValueObjectName) {
  return zodToFieldSchema(name, schemas[name])
}

// Re-export all schemas (alphabetically)
export {
  AddressSchema,
  AnchorLinkSchema,
  AuthorSchema,
  AutoFillSchema,
  BadgeSchema,
  BlogPostItemSchema,
  BlogPostMetadataSchema,
  CardItemSchema,
  CategorySchema,
  ComparisonFeatureSchema,
  ComparisonProductSchema,
  ComponentListSchema,
  ConsentSchema,
  ContactInfoSchema,
  ContentAreaSchema,
  CTAButtonSchema,
  EducationEntrySchema,
  EmailLinkSchema,
  ExperienceEntrySchema,
  ExternalLinkSchema,
  FAQSchema,
  FeatureItemSchema,
  FilterSchema,
  FooterColumnSchema,
  FooterNewsletterSchema,
  FormFieldSchema,
  HeroSlideSchema,
  ImageSchema,
  LinkSchema,
  LogoSchema,
  MediaReferenceSchema,
  MenuItemSchema,
  NavBarSearchSchema,
  PageReferenceSchema,
  PhoneLinkSchema,
  PhoneNumberSchema,
  PricingFeatureSchema,
  PricingTierSchema,
  RatingSchema,
  ShowcaseSectionSchema,
  SideMenuSectionSchema,
  SmartLinkSchema,
  SocialLinkSchema,
  StatItemSchema,
  SubmitButtonSchema,
  TabItemSchema,
  TagSchema,
  TeamMemberSchema,
  TestimonialSchema,
  TimelineActionSchema,
  TimelineEventSchema,
  VideoSourceSchema,
}

// Re-export all types (alphabetically)
export type {
  Address,
  AnchorLink,
  Author,
  AutoFill,
  Badge,
  BlogPostItem,
  BlogPostMetadata,
  CardItem,
  Category,
  ComparisonFeature,
  ComparisonProduct,
  ComponentList,
  Consent,
  ContactInfo,
  ContentArea,
  CTAButton,
  EducationEntry,
  EmailLink,
  ExperienceEntry,
  ExternalLink,
  FAQ,
  FeatureItem,
  Filter,
  FooterColumn,
  FooterNewsletter,
  FormField,
  HeroSlide,
  Image,
  Link,
  Logo,
  MediaReference,
  MenuItem,
  NavBarSearch,
  PageReference,
  PhoneLink,
  PhoneNumber,
  PricingFeature,
  PricingTier,
  Rating,
  ShowcaseSection,
  SideMenuSection,
  SmartLink,
  SocialLink,
  StatDelta,
  StatItem,
  SubmitButton,
  TabItem,
  Tag,
  TeamMember,
  Testimonial,
  TimelineAction,
  TimelineEvent,
  VideoSource,
}
