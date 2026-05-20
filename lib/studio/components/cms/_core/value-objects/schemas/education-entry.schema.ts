import { z } from 'zod'

/**
 * Schema for EducationEntry value object
 * Used in: Resume/CV components to represent education history
 */
export const EducationEntrySchema = z.object({
  /** Degree or certification name */
  degree: z.string().describe('Degree name'),
  /** Institution/university name */
  institution: z.string().describe('Institution name'),
  /** Year or time period */
  year: z.string().optional().describe('Year or period'),
})

// Derived TypeScript type
export type EducationEntry = z.infer<typeof EducationEntrySchema>
