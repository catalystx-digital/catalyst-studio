import type {
  AccountIntegrationRecord,
  CreateIntegrationRequest,
  IntegrationStatus,
  IntegrationTestResult,
  UpdateIntegrationRequest,
} from '@/lib/studio/types/integration';

export interface ListIntegrationsOptions {
  includeDisabled?: boolean;
}

function toQueryString(options?: ListIntegrationsOptions) {
  const params = new URLSearchParams();

  if (options?.includeDisabled) {
    params.set('includeDisabled', 'true');
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = (payload as any)?.error?.message || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return (payload as any)?.data as T;
}

export async function listAccountIntegrations(options?: ListIntegrationsOptions): Promise<AccountIntegrationRecord[]> {
  const response = await fetch(`/api/studio/account/integrations${toQueryString(options)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  const data = await parseResponse<AccountIntegrationRecord[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function createAccountIntegration(
  payload: CreateIntegrationRequest,
): Promise<AccountIntegrationRecord> {
  const response = await fetch('/api/studio/account/integrations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<AccountIntegrationRecord>(response);
}

export async function updateAccountIntegration(
  id: string,
  payload: UpdateIntegrationRequest,
): Promise<AccountIntegrationRecord> {
  const response = await fetch(`/api/studio/account/integrations/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<AccountIntegrationRecord>(response);
}

export interface RemoveIntegrationOptions {
  hardDelete?: boolean;
}

export async function removeAccountIntegration(id: string, options?: RemoveIntegrationOptions): Promise<void> {
  const query = options?.hardDelete ? '?hardDelete=true' : '';
  const response = await fetch(`/api/studio/account/integrations/${id}${query}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = (payload as any)?.error?.message || response.statusText || 'Failed to delete integration';
    throw new Error(message);
  }
}

export async function testAccountIntegration(id: string): Promise<IntegrationTestResult> {
  const response = await fetch(`/api/studio/account/integrations/${id}/test`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
  });

  return parseResponse<IntegrationTestResult>(response);
}

export function getStatusDisplayStatus(status: IntegrationStatus): 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'enabled':
      return 'success';
    case 'disabled':
      return 'warning';
    case 'error':
    default:
      return 'destructive';
  }
}
