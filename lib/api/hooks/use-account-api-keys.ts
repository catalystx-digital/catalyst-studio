import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AccountApiKeySummary,
  AccountApiKeyAuditEvent,
  CreateAccountApiKeyRequest,
  CreateAccountApiKeyResponse,
  RotateAccountApiKeyResponse,
} from '@/types/api';

const BASE_PATH = '/api/studio/accounts/current/api-keys';

function buildQueryKey(websiteId?: string | null) {
  return ['account-api-keys', websiteId ?? 'all'] as const;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const payload = await response.json();
      message = payload?.error?.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return data.data as T;
}

export function useAccountApiKeys(websiteId?: string) {
  return useQuery({
    queryKey: buildQueryKey(websiteId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (websiteId) {
        params.set('websiteId', websiteId);
      }
      const suffix = params.size ? `?${params.toString()}` : '';
      const response = await fetch(`${BASE_PATH}${suffix}`);
      return handleResponse<AccountApiKeySummary[]>(response);
    },
  });
}

export function useCreateAccountApiKey(websiteId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAccountApiKeyRequest) => {
      const response = await fetch(BASE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return handleResponse<CreateAccountApiKeyResponse>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildQueryKey(websiteId) });
    },
  });
}

export function useRotateAccountApiKey(websiteId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keyId, note }: { keyId: string; note?: string }) => {
      const response = await fetch(`${BASE_PATH}/${keyId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      return handleResponse<RotateAccountApiKeyResponse>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildQueryKey(websiteId) });
    },
  });
}

export function useRevokeAccountApiKey(websiteId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keyId, reason }: { keyId: string; reason?: string }) => {
      const response = await fetch(`${BASE_PATH}/${keyId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      return handleResponse<AccountApiKeySummary>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildQueryKey(websiteId) });
    },
  });
}

export function useUpdateAccountApiKey(websiteId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keyId, label, expiresAt }: { keyId: string; label?: string; expiresAt?: string | null }) => {
      const response = await fetch(`${BASE_PATH}/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, expiresAt }),
      });
      return handleResponse<AccountApiKeySummary>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildQueryKey(websiteId) });
    },
  });
}

export function useAccountApiKeyEvents(keyId: string | null) {
  return useQuery({
    queryKey: ['account-api-key-events', keyId],
    enabled: Boolean(keyId),
    queryFn: async () => {
      const response = await fetch(`${BASE_PATH}/${keyId}/events`);
      return handleResponse<AccountApiKeyAuditEvent[]>(response);
    },
  });
}
