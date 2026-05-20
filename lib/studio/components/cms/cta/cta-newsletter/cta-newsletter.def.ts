/**
 * CTA Newsletter Component Definition
 *
 * Email newsletter signup form with configurable layout and messaging.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * CTA Newsletter component definition
 */
export const CTANewsletterDef = defineComponent({
  type: ComponentType.CTAWithForm,
  category: ComponentCategory.CTA,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().describe('Newsletter signup headline'),
    subheading: z.string().optional().describe('Supporting text explaining the value proposition'),
    subheadingHtml: z.string().optional().describe('HTML version of subheading for rich formatting'),
    placeholder: z.string().optional().describe('Email input placeholder text'),
    buttonText: z.string().optional().describe('Submit button text'),
    successMessage: z.string().optional().describe('Message displayed after successful subscription'),
    successDescription: z.string().optional().describe('Additional success state description'),
    successCta: CTAButtonSchema.optional().describe('Optional call-to-action button in success state'),
    errorMessage: z.string().optional().describe('Generic error message for failed submissions'),
    validationErrorMessage: z.string().optional().describe('Message for invalid email format'),
    networkErrorMessage: z.string().optional().describe('Message for network connectivity issues'),
    privacyText: z.string().optional().describe('Privacy policy text'),
    privacyLink: z.string().optional().describe('Link to full privacy policy'),
    layout: z.enum(['horizontal', 'vertical', 'compact']).optional().describe('Form layout orientation'),
    backgroundColor: z.string().optional().describe('Background color for the newsletter section'),
    formAction: z.string().optional().describe('Form submission endpoint URL'),
    emailFieldName: z.string().optional().describe('Name attribute for email input field'),
    honeypot: z.boolean().optional().describe('Whether to include honeypot spam protection'),
  }),

  // Detection metadata (replaces cta-newsletter.ai.ts)
  detection: {
    keywords: ['newsletter', 'subscribe', 'email', 'signup', 'mailing list', 'updates'],
    patterns: [
      'newsletter',
      'subscri(be|ption)',
      'email[\\s-]?signup',
      'mailing[\\s-]?list',
      'stay[\\s-]?updated',
      'get[\\s-]?updates',
    ],
    commonNames: ['Newsletter', 'EmailSignup', 'Subscribe', 'CTANewsletter'],
    pageLocation: ['footer', 'sidebar'],
    confidence: 0.88,
    relatedComponents: [ComponentType.CTASimple, ComponentType.ContactForm],
  },

  // LLM extraction directives
  directives: [
    'Data requirements: Provide the complete signup form configuration directly from the page. Include heading (and subheading if shown), placeholder, buttonText, success/error messaging, privacy copy/link, layout, formAction URL, emailFieldName, and honeypot boolean when present.',
    'Never return only a summary for this component. Populate the form fields exactly as rendered so downstream automation can reuse the form without importer fixups.',
    'Consent paragraphs that include inline links (privacy policy, terms, partner opt-ins) must populate both "subheading" (plain text) and "subheadingHtml" (full markup with <a> tags). Do not strip anchor tags or truncate the legal sentence—copy everything verbatim, including the link href.',
    'Example payload:',
    '  {',
    '    "heading": "Stay up to date",',
    '    "subheading": "Get centre news and special offers straight to your inbox.",',
    '    "placeholder": "Email address",',
    '    "buttonText": "Sign up",',
    '    "formAction": "https://example.com/newsletter-signup",',
    '    "emailFieldName": "email",',
    '    "successMessage": "Thanks for subscribing!",',
    '    "privacyText": "By subscribing you agree to our privacy policy.",',
    '    "privacyLink": "https://example.com/privacy",',
    '    "honeypot": false',
    '  }',
    'Mapping guidance: map the visible section heading directly to "heading", supporting paragraph to "subheading" (and "subheadingHtml" when markup or inline links are present), the input label/placeholder text to "placeholder", and the submit button label to "buttonText". Pull the <form action> attribute into "formAction", the email input name attribute into "emailFieldName", and copy beneath the form into "successMessage"/"privacyText"/"privacyLink" as applicable.',
    'If the CTA renders additional disclaimer or background styles, capture the documented contract fields (backgroundColor, theme, etc.). Omit only fields that are truly absent in the DOM.',
    'If any field is missing, call get_section for the form markup and retry until the contract fields are populated.'
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Stay Updated',
    subheading: 'Get the latest news and updates delivered to your inbox',
    placeholder: 'Enter your email',
    buttonText: 'Subscribe',
    successMessage: 'Thank you for subscribing!',
    successDescription: 'Check your inbox for a confirmation email',
    validationErrorMessage: 'Please enter a valid email address',
    errorMessage: 'Something went wrong. Please try again.',
    privacyText: 'We respect your privacy and never share your information',
    privacyLink: '/privacy',
    layout: 'horizontal',
    honeypot: true,
  },

  // Human-readable description
  description: 'Email newsletter signup form with configurable layout and messaging.',
})

// Export inferred TypeScript type
export type CTANewsletterContent = z.infer<typeof CTANewsletterDef.schema>
