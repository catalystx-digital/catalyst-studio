/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { AIContextService } from '@/lib/services/ai-context-service';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn(),
}));

jest.mock('@/lib/services/ai-context-service', () => ({
  AIContextService: {
    adoptAccountSession: jest.fn(),
  },
}));

const mockAuth = getAuthContext as jest.Mock;
const mockOwnership = assertWebsiteOwnership as jest.Mock;
const mockAdopt = AIContextService.adoptAccountSession as jest.Mock;

describe('/api/ai-context/adopt POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ accountId: 'acct-123' });
    mockOwnership.mockResolvedValue(undefined as unknown);
    mockAdopt.mockResolvedValue({ id: 'ctx-1' });
  });

  const buildRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/ai-context/adopt', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  it('adopts an account scoped session into a website session', async () => {
    const request = buildRequest({
      sourceSessionId: 'dashboard-acct-123',
      targetSessionId: 'studio-session-site-1',
      websiteId: 'site-1',
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockOwnership).toHaveBeenCalledWith(expect.anything(), 'acct-123', 'site-1');
    expect(mockAdopt).toHaveBeenCalledWith('acct-123', 'dashboard-acct-123', 'site-1', 'studio-session-site-1');
    expect(payload.data).toEqual({ id: 'ctx-1' });
  });

  it('validates request body', async () => {
    const request = buildRequest({ websiteId: 'site-1' });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockAdopt).not.toHaveBeenCalled();
  });
});
