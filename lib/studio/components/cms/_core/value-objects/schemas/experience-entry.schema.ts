import { z } from 'zod'

/**
 * Schema for ExperienceEntry value object
 * Used in: Resume/CV components to represent work experience
 */
export const ExperienceEntrySchema = z.object({
  /** Job title/position */
  position: z.string().describe('Position title'),
  /** Company name */
  company: z.string().describe('Company name'),
  /** Duration of employment */
  duration: z.string().optional().describe('Employment duration'),
  /** Job description/responsibilities */
  description: z.string().optional().describe('Job description'),
})

// Derived TypeScript type
export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>
