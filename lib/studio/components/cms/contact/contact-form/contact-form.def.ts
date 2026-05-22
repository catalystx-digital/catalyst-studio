/**
 * Contact Form Component Definition
 *
 * Contact form with configurable fields, validation, endpoint, and success/error handling.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { FormFieldSchema, CTAButtonSchema, SubmitButtonSchema, ConsentSchema } from '../../_core/value-objects'

/**
 * Contact Form component definition
 */
export const ContactFormDef = defineComponent({
  type: ComponentType.ContactForm,
  category: ComponentCategory.Contact,

  schema: z.object({
    title: z.string().optional().describe('Form title'),
    description: z.string().optional().describe('Form description or instructions'),
    fields: z.array(FormFieldSchema).describe('Form fields configuration'),
    submitButton: SubmitButtonSchema.describe('Submit button configuration'),
    successMessage: z.string().optional().describe('Message shown on successful submission'),
    successDescription: z.string().optional().describe('Additional success details'),
    successCta: CTAButtonSchema.optional().describe('Optional CTA button shown after success'),
    errorMessage: z.string().optional().describe('Generic error message'),
    validationErrorMessage: z.string().optional().describe('Message for validation errors'),
    networkErrorMessage: z.string().optional().describe('Message for network errors'),
    endpoint: z.string().optional().describe('Form submission endpoint URL'),
    method: z.enum(['POST', 'PUT']).optional().describe('HTTP method for submission'),
    headers: z.record(
      z.enum(['Content-Type', 'Accept', 'X-Requested-With', 'X-CSRF-Token']),
      z.string()
    ).optional().describe('Allowed custom HTTP headers'),
    honeypot: z.boolean().optional().describe('Enable honeypot field for spam prevention'),
    resetOnSuccess: z.boolean().optional().describe('Reset form after successful submission'),
    consent: ConsentSchema.optional().describe('Consent checkbox configuration'),
  }),

  detection: {
    keywords: [
      'contact form',
      'get in touch',
      'reach out',
      'send message',
      'inquiry form',
    ],
    patterns: [
      'contact.*form',
      'inquiry.*form',
      'message.*form',
    ],
    commonNames: [
      'contact form',
      'contact us',
      'get in touch',
    ],
    pageLocation: ['main', 'footer'],
    confidence: 0.9,
    relatedComponents: [
      ComponentType.ContactInfo,
      ComponentType.SimpleForm,
    ],
    industry: ['general', 'corporate', 'public-sector'],
    semanticRole: 'form',
    accessibility: {
      role: 'form',
      ariaLabel: 'Contact form',
    },
  },

  directives: [
    'Extract: title from h2/h3 above form',
    'Extract: fields from input/textarea/select elements with labels',
    'Extract: endpoint from form action attribute',
    'Fields: Common fields are name, email, phone, subject, message',
    'Validation: Infer required fields from asterisks or "required" labels',
    'FORM: This is a complete form component with submission handling',
  ],

  sample: {
    title: 'Get In Touch',
    description: 'Have a question? We\'d love to hear from you. Send us a message and we\'ll respond as soon as possible.',
    fields: [
      {
        name: 'name',
        label: 'Your Name',
        type: 'text',
        placeholder: 'John Doe',
        required: true,
      },
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        placeholder: 'john@example.com',
        required: true,
      },
      {
        name: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'How can we help?',
        required: true,
      },
      {
        name: 'message',
        label: 'Message',
        type: 'textarea',
        placeholder: 'Tell us more about your inquiry...',
        required: true,
      },
    ],
    submitButton: {
      text: 'Send Message',
      loadingText: 'Sending…',
    },
    successMessage: 'Thank you for your message!',
    successDescription: 'We\'ll get back to you within 24 hours.',
    errorMessage: 'Something went wrong. Please try again.',
    validationErrorMessage: 'Please fill in all required fields.',
    networkErrorMessage: 'Network error. Please check your connection.',
    endpoint: '/api/contact',
    method: 'POST',
    honeypot: true,
    resetOnSuccess: true,
    consent: {
      label: 'I agree to the privacy policy',
      link: {
        label: 'privacy policy',
        href: { type: 'internal', pageId: 'privacy', path: '/privacy' },
      },
      required: true,
    },
  },

  description: 'Contact form with configurable fields, validation, endpoint, and success/error handling.',
})

export type ContactFormContent = z.infer<typeof ContactFormDef.schema>
