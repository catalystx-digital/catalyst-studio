/**
 * Simple Form Component Definition
 *
 * Lightweight form with up to three fields, templates (newsletter/contact/callback),
 * and customizable submit handling.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { FormFieldSchema, CTAButtonSchema, SubmitButtonSchema } from '../../_core/value-objects'

/**
 * Simple Form component definition
 */
export const SimpleFormDef = defineComponent({
  type: ComponentType.SimpleForm,
  category: ComponentCategory.Contact,

  schema: z.object({
    template: z.enum(['newsletter', 'quick-contact', 'callback', 'custom']).optional().describe('Preset form template'),
    title: z.string().optional().describe('Form title'),
    description: z.string().optional().describe('Form description'),
    fields: z.array(FormFieldSchema).describe('Form fields (typically 1-3 fields)'),
    submitButton: SubmitButtonSchema.describe('Submit button configuration'),
    successMessage: z.string().optional().describe('Success message'),
    successDescription: z.string().optional().describe('Additional success details'),
    successCta: CTAButtonSchema.optional().describe('Optional CTA after success'),
    errorMessage: z.string().optional().describe('Generic error message'),
    validationErrorMessage: z.string().optional().describe('Validation error message'),
    networkErrorMessage: z.string().optional().describe('Network error message'),
    consentText: z.string().optional().describe('Consent checkbox text'),
    layout: z.enum(['inline', 'stacked']).optional().describe('Form layout style'),
    maxWidth: z.union([z.string(), z.number()]).optional().describe('Maximum form width'),
    endpoint: z.string().optional().describe('Submission endpoint URL'),
    method: z.enum(['POST', 'PUT']).optional().describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('Custom headers'),
    resetOnSuccess: z.boolean().optional().describe('Reset form after success'),
    honeypot: z.boolean().optional().describe('Enable honeypot spam prevention'),
  }),

  detection: {
    keywords: [
      'simple form',
      'newsletter',
      'subscribe',
      'quick contact',
      'callback',
      'sign up',
    ],
    patterns: [
      'simple.*form',
      'newsletter.*form',
      'subscribe.*form',
      'callback.*form',
    ],
    commonNames: [
      'simple form',
      'newsletter signup',
      'quick contact',
    ],
    pageLocation: ['main', 'sidebar', 'footer'],
    confidence: 0.85,
    relatedComponents: [
      ComponentType.ContactForm,
    ],
    industry: ['general', 'marketing', 'saas'],
    semanticRole: 'form',
    accessibility: {
      role: 'form',
      ariaLabel: 'Simple contact form',
    },
  },

  directives: [
    'Extract: template from form purpose (newsletter=email only, callback=name+phone, etc.)',
    'Extract: fields from input elements (limit to 3 fields for simplicity)',
    'LIGHTWEIGHT: Use for simple forms; use contact-form for complex multi-field forms',
    'Templates: newsletter (email), quick-contact (name+email+message), callback (name+phone)',
    'Layout: Use inline for newsletter forms, stacked for contact forms',
  ],

  sample: {
    template: 'newsletter',
    title: 'Stay Updated',
    description: 'Subscribe to our newsletter for the latest updates.',
    fields: [
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        placeholder: 'you@example.com',
        required: true,
      },
    ],
    submitButton: {
      text: 'Subscribe',
      loadingText: 'Subscribing…',
    },
    successMessage: 'Thanks for subscribing!',
    successDescription: 'Check your inbox for a confirmation email.',
    errorMessage: 'Something went wrong. Please try again.',
    consentText: 'I agree to receive marketing emails',
    layout: 'inline',
    maxWidth: '500px',
    endpoint: '/api/newsletter',
    method: 'POST',
    resetOnSuccess: true,
    honeypot: true,
  },

  description: 'Lightweight form with up to three fields, templates (newsletter/contact/callback), and customizable submit handling.',
})

export type SimpleFormContent = z.infer<typeof SimpleFormDef.schema>
