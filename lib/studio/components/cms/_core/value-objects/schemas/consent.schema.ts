/**
 * Consent Schema
 *
 * Configuration for consent checkboxes in forms (privacy policy, terms of service, etc.).
 */

import { z } from 'zod'
import { LinkSchema } from './link.schema'

/**
 * Consent configuration schema
 */
export const ConsentSchema = z.object({
  label: z.string().describe('Consent checkbox label'),
  link: LinkSchema.optional().describe('Optional link to privacy policy or terms'),
  helperText: z.string().optional().describe('Helper text below checkbox'),
  errorMessage: z.string().optional().describe('Error message when not checked'),
  required: z.boolean().optional().describe('Whether consent is required'),
})

export type Consent = z.infer<typeof ConsentSchema>
