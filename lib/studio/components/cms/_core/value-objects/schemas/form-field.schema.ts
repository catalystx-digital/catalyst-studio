import { z } from 'zod'

/**
 * Schema for Form Field value object
 * Used in: ContactForm, SimpleForm, custom forms
 */
export const FormFieldSchema = z.object({
  /** Field name (used as key in form data) */
  name: z.string().describe('Field identifier'),
  /** Input type */
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox', 'radio', 'number', 'date', 'file']).describe('Input field type'),
  /** Field label */
  label: z.string().describe('Field label'),
  /** Placeholder text */
  placeholder: z.string().optional().describe('Placeholder text'),
  /** Whether field is required */
  required: z.boolean().optional().describe('Required field'),
  /** Options for select/radio/checkbox fields */
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional().describe('Field options for select/radio'),
  /** Validation rules */
  validation: z.object({
    pattern: z.string().optional(), // RegExp pattern as string
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    message: z.string().optional(),
  }).optional().describe('Validation rules'),
  /** Layout width hint */
  width: z.enum(['auto', 'half', 'full']).optional().describe('Field width in form layout'),
})

// Derived TypeScript type
export type FormField = z.infer<typeof FormFieldSchema>
