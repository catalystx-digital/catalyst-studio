import { z } from 'zod'

/**
 * Submit Button Schema
 *
 * Represents configuration for form submit buttons.
 * Used by ContactForm and SimpleForm components.
 *
 * @example
 * ```typescript
 * {
 *   text: "Send Message",
 *   loadingText: "Sending…"
 * }
 * ```
 */
export const SubmitButtonSchema = z.object({
  text: z.string().describe('Button text'),
  loadingText: z.string().optional().describe('Text shown while submitting'),
})

/**
 * Derived TypeScript type
 */
export type SubmitButton = z.infer<typeof SubmitButtonSchema>
