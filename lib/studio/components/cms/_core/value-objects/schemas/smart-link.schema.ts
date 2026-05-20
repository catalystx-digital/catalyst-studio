import { z } from 'zod'
import { PageReferenceSchema } from './page-reference.schema'
import { ExternalLinkSchema } from './page-reference.schema'
import { EmailLinkSchema } from './email-link.schema'
import { PhoneLinkSchema } from './phone-link.schema'
import { AnchorLinkSchema } from './anchor-link.schema'

/**
 * Schema for SmartLink value object
 * A discriminated union that handles all link types:
 * - internal: Page references within the CMS
 * - external: External URLs
 * - email: mailto: links
 * - phone: tel: links
 * - anchor: In-page anchor links (#section-id)
 *
 * Uses the 'type' field as discriminator
 */
export const SmartLinkSchema = z.discriminatedUnion('type', [
  PageReferenceSchema,
  ExternalLinkSchema,
  EmailLinkSchema,
  PhoneLinkSchema,
  AnchorLinkSchema,
])

// Derived TypeScript type
export type SmartLink = z.infer<typeof SmartLinkSchema>
