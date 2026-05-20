/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { AIContextService } from '@/lib/services/ai-context-service';
import { checkAndRecordUsage, QuotaExceededError } from '@/lib/usage/limits';
import type { QuotaUsage } from '@/lib/usage/limits';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn(),
}));

jest.mock('@/lib/services/ai-context-service', () => ({
  AIContextService: {
    getAIContext: jest.fn(),
    createAIContext: jest.fn(),
    appendMessage: jest.fn(),
  },
}));

jest.mock('@/lib/usage/limits', () => {
  const actual = jest.requireActual('@/lib/usage/limits');
  return {
    ...actual,
    checkAndRecordUsage: jest.fn(),
  };
});

jest.mock('@/lib/utils/ai-context-pruning', () => ({
  estimateTokenCount: jest.fn(() => 128),
}));

const mockAuth = getAuthContext as jest.Mock;
const mockOwnership = assertWebsiteOwnership as jest.Mock;
const mockGetContext = AIContextService.getAIContext as jest.Mock;
const mockCreateContext = AIContextService.createAIContext as jest.Mock;
const mockAppendMessage = AIContextService.appendMessage as jest.Mock;
const mockCheckUsage = checkAndRecordUsage as jest.Mock;

describe('/api/chat/log POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ accountId: 'acct-123' });
    mockOwnership.mockResolvedValue(undefined as unknown);
    mockGetContext.mockResolvedValue(null);
    mockCreateContext.mockResolvedValue({ id: 'ctx-1' });
    mockAppendMessage.mockResolvedValue({ id: 'ctx-1' });
    mockCheckUsage.mockResolvedValue(undefined);
  });

  const buildRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/chat/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('creates a new context when none exists', async () => {
    const request = buildRequest({
      sessionId: 'dashboard-acct-123',
      websiteId: 'site-1',
      idempotencyKey: 'key-123456789',
      message: { content: 'Hello world' },
      metadata: { scopeLabel: 'Dashboard Prompt' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ sessionId: 'dashboard-acct-123', websiteId: 'site-1', deduped: false });
    expect(mockOwnership).toHaveBeenCalledWith(expect.anything(), 'acct-123', 'site-1');
    expect(mockCreateContext).toHaveBeenCalledWith('site-1', expect.any(Object), 'dashboard-acct-123', 'acct-123');
    expect(mockAppendMessage).not.toHaveBeenCalled();
  });

  it('skips appending duplicate messages', async () => {
    mockGetContext.mockResolvedValue({
      id: 'ctx-1',
      websiteId: 'site-1',
      sessionId: 'dashboard-acct-123',
      messages: [
        {
          role: 'user',
          content: 'Hello world',
          metadata: { idempotencyKey: 'key-123456789' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const request = buildRequest({
      sessionId: 'dashboard-acct-123',
      websiteId: 'site-1',
      idempotencyKey: 'key-123456789',
      message: { content: 'Hello world' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.deduped).toBe(true);
    expect(mockAppendMessage).not.toHaveBeenCalled();
  });

  it('returns 429 when quota is exceeded', async () => {
    const usage: QuotaUsage = {
      kind: 'chat_sessions',
      limit: 1,
      period: 'day',
      used: 1,
      available: 0,
      mode: 'enforce',
    };
    const quotaError = new QuotaExceededError('chat_sessions', usage, 1);
    mockCheckUsage.mockRejectedValueOnce(quotaError);

    const request = buildRequest({
      sessionId: 'dashboard-acct-123',
      idempotencyKey: 'key-2233445566',
      message: { content: 'Too many requests' },
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(mockCreateContext).not.toHaveBeenCalled();
  });

  it('requires websiteId when explicitly scoped to website', async () => {
    const request = buildRequest({
      sessionId: 'dashboard-acct-123',
      idempotencyKey: 'key-3344556677',
      scope: 'website',
      message: { content: 'Missing website' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
