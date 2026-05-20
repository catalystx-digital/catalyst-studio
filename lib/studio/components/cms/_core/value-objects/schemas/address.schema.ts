import { z } from 'zod'

/**
 * Schema for Address value object
 * Used in: ContactInfo, Footer, TeamGrid, LocationMap
 */
export const AddressSchema = z.object({
  /** Street address line */
  street: z.string().optional().describe('Street address'),
  /** City name */
  city: z.string().optional().describe('City'),
  /** State or province */
  state: z.string().optional().describe('State or province'),
  /** Postal/ZIP code */
  zip: z.string().optional().describe('Postal or ZIP code'),
  /** Country name */
  country: z.string().optional().describe('Country'),
  /** ZIP code (alternative to 'zip') */
  zipCode: z.string().optional().describe('Postal code (alternative to zip)'),
})

// Derived TypeScript type
export type Address = z.infer<typeof AddressSchema>
