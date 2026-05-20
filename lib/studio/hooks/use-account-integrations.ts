import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAccountIntegration,
  getStatusDisplayStatus,
  listAccountIntegrations,
  removeAccountIntegration,
  testAccountIntegration,
  updateAccountIntegration,
  type ListIntegrationsOptions,
  type RemoveIntegrationOptions,
} from '@/lib/studio/api/account-integrations';
import type {
  AccountIntegrationRecord,
  CreateIntegrationRequest,
  IntegrationStatus,
  IntegrationTestResult,
  UpdateIntegrationRequest,
} from '@/lib/studio/types/integration';

const BASE_QUERY_KEY = ['account', 'integrations'] as const;

function createQueryKey(options?: ListIntegrationsOptions) {
  return [...BASE_QUERY_KEY, options?.includeDisabled ? 'with-disabled' : 'enabled-only'] as const;
}

export interface UseAccountIntegrationsOptions extends ListIntegrationsOptions {
  enabled?: boolean;
}

export function useAccountIntegrations(options?: UseAccountIntegrationsOptions) {
  return useQuery({
    queryKey: createQueryKey({ includeDisabled: options?.includeDisabled }),
    queryFn: () => listAccountIntegrations({ includeDisabled: options?.includeDisabled }),
    enabled: options?.enabled ?? true,
  });
}

export function useIntegrationStatusBadge(status: IntegrationStatus) {
  return getStatusDisplayStatus(status);
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateIntegrationRequest) => createAccountIntegration(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIntegrationRequest }) =>
      updateAccountIntegration(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
    },
  });
}

export function useRemoveIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: RemoveIntegrationOptions }) =>
      removeAccountIntegration(id, options),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
    },
  });
}

export function useTestIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<IntegrationTestResult> => {
      const result = await testAccountIntegration(id);
      await queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
      return result;
    },
  });
}

export function useIntegrationById(
  id: string | undefined,
  options?: UseAccountIntegrationsOptions,
): AccountIntegrationRecord | undefined {
  const { data } = useAccountIntegrations(options);
  return data?.find(item => item.id === id);
}
