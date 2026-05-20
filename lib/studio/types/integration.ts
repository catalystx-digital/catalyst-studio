import type { IntegrationProviderSlug } from '@/lib/studio/integrations/provider-config';

export type IntegrationStatus = 'enabled' | 'disabled' | 'error';

export interface AccountIntegrationRecord {
  id: string;
  accountId: string;
  provider: IntegrationProviderSlug;
  displayName: string;
  status: IntegrationStatus;
  providerDisabled: boolean;
  config: Record<string, unknown>;
  secretFields: Record<string, boolean>;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationTestResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateIntegrationRequest {
  provider: IntegrationProviderSlug;
  displayName: string;
  config: Record<string, unknown>;
}

export interface UpdateIntegrationRequest {
  displayName?: string;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
}
