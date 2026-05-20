/**
 * Contact Info Component Definition
 *
 * Business contact information including address, phone/email lists, social links, and hours.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { AddressSchema, PhoneNumberSchema, SocialLinkSchema } from '../../_core/value-objects'

/**
 * Email entry schema
 */
const EmailEntrySchema = z.object({
  label: z.string().optional().describe('Label for the email (e.g., "Sales", "Support")'),
  email: z.string().describe('Email address'),
})

/**
 * Business hours schema
 */
const BusinessHoursSchema = z.object({
  monday: z.string().optional().describe('Monday hours'),
  tuesday: z.string().optional().describe('Tuesday hours'),
  wednesday: z.string().optional().describe('Wednesday hours'),
  thursday: z.string().optional().describe('Thursday hours'),
  friday: z.string().optional().describe('Friday hours'),
  saturday: z.string().optional().describe('Saturday hours'),
  sunday: z.string().optional().describe('Sunday hours'),
  holidays: z.string().optional().describe('Holiday hours note'),
})

/**
 * Contact Info component definition
 */
export const ContactInfoDef = defineComponent({
  type: ComponentType.ContactInfo,
  category: ComponentCategory.Contact,

  schema: z.object({
    businessName: z.string().optional().describe('Business or organization name'),
    logoUrl: z.string().optional().describe('Logo image URL'),
    address: AddressSchema.optional().describe('Physical business address'),
    phoneNumbers: z.array(PhoneNumberSchema).optional().describe('List of phone numbers'),
    emailAddresses: z.array(EmailEntrySchema).optional().describe('List of email addresses'),
    businessHours: BusinessHoursSchema.optional().describe('Operating hours by day'),
    socialLinks: z.array(SocialLinkSchema).optional().describe('Social media links'),
    showCopyButtons: z.boolean().optional().describe('Show copy-to-clipboard buttons'),
    cardStyle: z.enum(['bordered', 'shadow', 'none']).optional().describe('Card styling option'),
  }),

  detection: {
    keywords: [
      'contact info',
      'contact information',
      'business hours',
      'office location',
      'reach us',
    ],
    patterns: [
      'contact.*info',
      'business.*hours',
      'office.*location',
    ],
    commonNames: [
      'contact information',
      'contact details',
      'reach us',
    ],
    pageLocation: ['main', 'sidebar', 'footer'],
    confidence: 0.85,
    relatedComponents: [
      ComponentType.ContactForm,
      ComponentType.LocationMap,
    ],
    industry: ['general', 'corporate', 'retail', 'public-sector'],
    semanticRole: 'region',
  },

  directives: [
    'Extract: business name from heading or organization name',
    'Extract: address from address block or structured address data',
    'Extract: phone numbers from tel: links or phone number text',
    'Extract: email from mailto: links or email text',
    'Extract: business hours from schedule tables or lists',
    'Extract: social links from icon links in contact section',
    'Format: Preserve phone number formatting (country code, extension)',
  ],

  sample: {
    businessName: 'Acme Corporation',
    address: {
      street: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'United States',
    },
    phoneNumbers: [
      {
        label: 'Main Office',
        number: '+1 (555) 123-4567',
        type: 'office',
      },
      {
        label: 'Customer Support',
        number: '+1 (555) 987-6543',
        type: 'support',
      },
    ],
    emailAddresses: [
      {
        label: 'General Inquiries',
        email: 'info@acme.com',
      },
      {
        label: 'Sales',
        email: 'sales@acme.com',
      },
    ],
    businessHours: {
      monday: '9:00 AM - 5:00 PM',
      tuesday: '9:00 AM - 5:00 PM',
      wednesday: '9:00 AM - 5:00 PM',
      thursday: '9:00 AM - 5:00 PM',
      friday: '9:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed',
    },
    socialLinks: [
      {
        platform: 'facebook',
        url: 'https://facebook.com/acmecorp',
      },
      {
        platform: 'twitter',
        url: 'https://twitter.com/acmecorp',
      },
      {
        platform: 'linkedin',
        url: 'https://linkedin.com/company/acmecorp',
      },
    ],
    showCopyButtons: true,
    cardStyle: 'bordered',
  },

  description: 'Business contact information including address, phone/email lists, social links, and hours.',
})

export type ContactInfoContent = z.infer<typeof ContactInfoDef.schema>
