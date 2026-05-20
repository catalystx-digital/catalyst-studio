import { z } from 'zod';

/**
 * Schema for starting a deployment
 */
export const startDeploymentSchema = z.object({
  websiteId: z.string().min(1, 'Website ID is required'),
  integrationId: z.string().min(1, 'Integration ID is required'),
  selectedTypes: z.array(z.string()).optional().default([]),
  /** Publish content after export instead of leaving as draft (default: false) */
  publish: z.boolean().optional().default(false),
});

export type StartDeploymentInput = z.infer<typeof startDeploymentSchema>;

/**
 * Schema for deployment status
 */
export const deploymentStatusSchema = z.enum([
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;
