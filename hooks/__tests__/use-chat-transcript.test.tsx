import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatTranscript } from '../use-chat-transcript';

global.fetch = jest.fn();

const createMockContextResponse = (overrides?: Partial<Record<string, unknown>>) => ({
  data: {
    id: 'ctx-1',
    websiteId: 'site-1',
    accountId: 'acct-1',
    sessionId: 'session-1',
    messages: [],
    metadata: {
      totalMessages: 0,
      tokens: 0,
      revision: 'rev-initial',
    },
    summary: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  },
});

describe('useChatTranscript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates messages from the API and exposes revision', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        createMockContextResponse({
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
          ],
          metadata: {
            totalMessages: 1,
            tokens: 10,
            revision: 'rev-1',
          },
        }),
    });

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-load',
        websiteId: 'site-load',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('msg-1');
    expect(result.current.revision).toBe('rev-1');
  });

  it('skips appending duplicate message IDs', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        createMockContextResponse({
          messages: [
            {
              id: 'msg-dup',
              role: 'assistant',
              content: 'Existing',
              timestamp: new Date().toISOString(),
            },
          ],
          metadata: { totalMessages: 1, tokens: 5, revision: 'rev-dup' },
        }),
    });

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-dedupe',
        websiteId: 'site-dedupe',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const callCount = fetchMock.mock.calls.length;
    const initialTimestamp = result.current.messages[0]?.timestamp ?? new Date();

    await act(async () => {
      await result.current.append([
        {
          id: 'msg-dup',
          role: 'assistant',
          content: 'Existing',
          timestamp: initialTimestamp,
        },
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(callCount); // no POST when deduped
  });

  it('updates existing messages when content changes', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-stream',
                role: 'assistant',
                content: 'Partial',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 1, tokens: 5, revision: 'rev-stream' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-stream',
                role: 'assistant',
                content: 'Final response',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 1, tokens: 7, revision: 'rev-stream-final' },
          }),
      });

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-stream',
        websiteId: 'site-stream',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.append([
        {
          id: 'msg-stream',
          role: 'assistant',
          content: 'Final response',
          timestamp: new Date(),
        },
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, [, request]] = fetchMock.mock.calls;
    const body = JSON.parse(request.body as string);
    expect(body.message.content).toBe('Final response');
    expect(result.current.messages[0]?.content).toBe('Final response');
    expect(result.current.revision).toBe('rev-stream-final');
  });

  it('appends new messages and updates revision', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [],
            metadata: { totalMessages: 0, tokens: 0, revision: 'rev-start' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-new',
                role: 'user',
                content: 'Hi!',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 1, tokens: 3, revision: 'rev-updated' },
          }),
      });

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-append',
        websiteId: 'site-append',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.append([
        {
          id: 'msg-new',
          role: 'user',
          content: 'Hi!',
          timestamp: new Date(),
        },
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, [, request]] = fetchMock.mock.calls;
    const body = JSON.parse(request.body as string);
    expect(body.revision).toBe('rev-start');
    expect(result.current.revision).toBe('rev-updated');
    expect(result.current.messages).toHaveLength(1);
  });

  it('retries append after a revision conflict and succeeds', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [],
            metadata: { totalMessages: 0, tokens: 0, revision: 'rev-initial' },
          }),
      })
      .mockResolvedValueOnce({ status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-import',
                role: 'system',
                content: 'import progress',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 1, tokens: 1, revision: 'rev-conflict' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-import',
                role: 'system',
                content: 'import progress',
                timestamp: new Date().toISOString(),
              },
              {
                id: 'msg-retry',
                role: 'user',
                content: 'Hi after retry',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 2, tokens: 4, revision: 'rev-final' },
          }),
      });

    try {
      const { result } = renderHook(() =>
        useChatTranscript({
          sessionId: 'session-conflict',
          websiteId: 'site-conflict',
          scope: 'website',
          enabled: true,
        }),
      );

      await waitFor(() => expect(result.current.hydrated).toBe(true));

      await act(async () => {
        await result.current.append([
          {
            id: 'msg-retry',
            role: 'user',
            content: 'Hi after retry',
            timestamp: new Date(),
          },
        ]);
      });

      const postCalls = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).filter(
        ([, options]) => options?.method === 'POST',
      );

      expect(postCalls).toHaveLength(2);
      const firstBody = JSON.parse(postCalls[0]?.[1]?.body as string);
      const secondBody = JSON.parse(postCalls[1]?.[1]?.body as string);
      expect(firstBody.message.content).toBe('Hi after retry');
      expect(secondBody.message).toEqual(firstBody.message);
      expect(secondBody.revision).toBe('rev-conflict');
      expect(result.current.revision).toBe('rev-final');
      expect(result.current.messages).toHaveLength(2);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('continues sending pending messages after a retry succeeds', async () => {
    const fetchMock = global.fetch as jest.Mock;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [],
            metadata: { totalMessages: 0, tokens: 0, revision: 'rev-start' },
          }),
      })
      .mockResolvedValueOnce({ status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [],
            metadata: { totalMessages: 0, tokens: 0, revision: 'rev-mid' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-1',
                role: 'user',
                content: 'first',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 1, tokens: 2, revision: 'rev-after-first' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createMockContextResponse({
            messages: [
              {
                id: 'msg-1',
                role: 'user',
                content: 'first',
                timestamp: new Date().toISOString(),
              },
              {
                id: 'msg-2',
                role: 'assistant',
                content: 'second',
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: { totalMessages: 2, tokens: 4, revision: 'rev-after-second' },
          }),
      });

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-batch',
        websiteId: 'site-batch',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      await result.current.append([
        {
          id: 'msg-1',
          role: 'user',
          content: 'first',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'second',
          timestamp: new Date(),
        },
      ]);
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]?.content).toBe('first');
    expect(result.current.messages[1]?.content).toBe('second');

    const postCalls = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).filter(
      ([, options]) => options?.method === 'POST',
    );
    expect(postCalls).toHaveLength(3); // initial attempt + retry + second message
    const [firstAttempt, retryAttempt, secondMessage] = postCalls;
    expect(JSON.parse(firstAttempt[1]?.body as string).message.id).toBe('msg-1');
    expect(JSON.parse(retryAttempt[1]?.body as string).message.id).toBe('msg-1');
    expect(JSON.parse(secondMessage[1]?.body as string).message.id).toBe('msg-2');
    expect(result.current.revision).toBe('rev-after-second');
  });

  it('keeps hydrated true while refreshing after the first load', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const initialResponse = {
      ok: true,
      status: 200,
      json: async () =>
        createMockContextResponse({
          messages: [],
          metadata: { totalMessages: 0, tokens: 0, revision: 'rev-initial' },
        }),
    };

    const refreshResponse = {
      ok: true,
      status: 200,
      json: async () =>
        createMockContextResponse({
          messages: [],
          metadata: { totalMessages: 0, tokens: 0, revision: 'rev-refreshed' },
        }),
    };

    let resolveRefreshFetch: ((value: unknown) => void) | null = null;

    fetchMock
      .mockResolvedValueOnce(initialResponse as never)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefreshFetch = resolve;
          }) as Promise<unknown>,
      );

    const { result } = renderHook(() =>
      useChatTranscript({
        sessionId: 'session-refresh',
        websiteId: 'site-refresh',
        scope: 'website',
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let refreshPromise: Promise<void> | undefined;
    await act(async () => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.hydrated).toBe(true);
    expect(result.current.status).toBe('loading');

    resolveRefreshFetch?.(refreshResponse as never);

    await act(async () => {
      await refreshPromise!;
    });

    expect(result.current.hydrated).toBe(true);
    expect(result.current.revision).toBe('rev-refreshed');
  });
});
