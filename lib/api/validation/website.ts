import { z } from 'zod';

const WebsiteMediaReferenceSchema = z.object({
  mediaId: z.string().min(1, 'mediaId is required'),
  originalUrl: z.string().url().optional(),
  signedUrl: z.string().url().optional(),
  publicUrl: z.string().url().optional(),
  altText: z.string().optional(),
}).passthrough();

const WebsiteIconSchema = z.union([
  z.string().max(100, 'Icon must be less than 100 characters'),
  WebsiteMediaReferenceSchema,
]);

/**
 * Schema for website settings
 */
export const WebsiteSettingsSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  features: z.object({
    blog: z.boolean().optional(),
    shop: z.boolean().optional(),
    analytics: z.boolean().optional()
  }).optional()
}).passthrough(); // Allow additional properties

/**
 * Schema for creating a new website
 */
export const CreateWebsiteSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  description: z.string()
    .max(100000, 'Description must be less than 100000 characters')
    .trim()
    .optional(),
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category must be less than 100 characters')
    .trim(),
  metadata: z.record(z.any()).optional(),
  icon: WebsiteIconSchema.optional(),
  settings: WebsiteSettingsSchema.optional(),
  isActive: z.boolean().optional().default(true)
});

/**
 * Schema for updating an existing website
 */
export const UpdateWebsiteSchema = CreateWebsiteSchema.partial();

/**
 * Schema for query parameters
 */
export const WebsiteQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  sortBy: z.enum(['name', 'category', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  category: z.string().optional(),
  search: z.string().optional()
});

export type CreateWebsiteInput = z.infer<typeof CreateWebsiteSchema>;
export type UpdateWebsiteInput = z.infer<typeof UpdateWebsiteSchema>;
export type WebsiteQueryInput = z.infer<typeof WebsiteQuerySchema>;
