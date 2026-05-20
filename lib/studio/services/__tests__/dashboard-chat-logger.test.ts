import { adoptDashboardChatSession, createPromptIdempotencyKey, getDashboardSessionId, logDashboardPrompt } from '@/lib/studio/services/dashboard-chat-logger';

describe('dashboard chat logger helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('sends log payloads to /api/chat/log', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });

    const sessionId = getDashboardSessionId('acct-123');
    const key = createPromptIdempotencyKey(sessionId, 'log me');

    await logDashboardPrompt({
      sessionId,
      idempotencyKey: key,
      prompt: 'log me',
      metadata: { source: 'test' },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/log',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('log me'),
      })
    );
  });

  it('throws when the log API returns an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'nope' } }) });

    await expect(
      logDashboardPrompt({
        sessionId: 'dashboard-test',
        prompt: 'fail me',
        idempotencyKey: 'key',
      })
    ).rejects.toThrow('nope');
  });

  it('calls adoption endpoint when adopting sessions', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    await adoptDashboardChatSession({
      sourceSessionId: 'dashboard-test',
      websiteId: 'site-123',
      targetSessionId: 'target-session',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai-context/adopt',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sourceSessionId: 'dashboard-test',
          websiteId: 'site-123',
          targetSessionId: 'target-session',
        }),
      })
    );
  });
});
