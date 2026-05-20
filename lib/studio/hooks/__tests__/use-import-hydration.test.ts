import { renderHook, waitFor, act } from '@testing-library/react';
import { useImportHydration } from '../use-import-hydration';
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store';

type VisibilityState = DocumentVisibilityState;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const setDocumentVisibility = (state: VisibilityState) => {
  if (typeof document === 'undefined') {
    return;
  }

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
};

describe('useImportHydration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    useImportTrackerStore.setState((draft) => {
      draft.jobs = [];
      draft.dismissedJobIds = new Set();
    });
    setDocumentVisibility('visible');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses the fast interval for active jobs and backs off once completed', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = fetchMock as typeof global.fetch;

    act(() => {
      useImportTrackerStore.getState().registerJob({
        id: 'job-1',
        websiteId: 'site-1',
        url: 'https://example.com',
        mode: 'new',
        status: 'processing',
      });
    });

    renderHook(() =>
      useImportHydration({
        jobId: 'job-1',
        pollInterval: 30,
        idlePollInterval: 200,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 100 });
    fetchMock.mockClear();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 120 });
    fetchMock.mockClear();

    act(() => {
      useImportTrackerStore
        .getState()
        .updateJob('job-1', { status: 'completed', state: 'completed' });
    });

    await sleep(80);
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 400 });
  });

  it('pauses polling while the document is hidden', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = fetchMock as typeof global.fetch;

    act(() => {
      useImportTrackerStore.getState().registerJob({
        id: 'job-hidden',
        websiteId: 'site-hidden',
        url: 'https://example.com',
        mode: 'new',
        status: 'processing',
      });
    });

    setDocumentVisibility('hidden');

    renderHook(() =>
      useImportHydration({
        jobId: 'job-hidden',
        pollInterval: 30,
        idlePollInterval: 200,
      }),
    );

    await sleep(80);
    expect(fetchMock).not.toHaveBeenCalled();

    setDocumentVisibility('visible');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 150 });
  });
});
