import { saveManager, toPageComponentOverrides } from '../save-manager';

// Mock fetch
global.fetch = jest.fn();

describe('SaveManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    saveManager.clearPending();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce save operations', () => {
    saveManager.initialize('test-website');
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test 1' } });
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test 2' } });
    
    // Should not call fetch immediately
    expect(fetch).not.toHaveBeenCalled();
    
    // Fast-forward debounce time
    jest.advanceTimersByTime(1000);
    
    // Should call fetch once with both operations
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/sitemap/save',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Test 1')
      })
    );
  });

  it('should retry failed saves with exponential backoff', async () => {
    saveManager.initialize('test-website');
    
    // Mock fetch to fail first time, succeed second time
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test' } });
    
    // Trigger initial save
    await jest.advanceTimersByTimeAsync(1000);
    
    // Should retry after 2 seconds (first retry)
    await jest.advanceTimersByTimeAsync(2000);
    
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should clear pending operations', () => {
    saveManager.initialize('test-website');
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test' } });
    expect(saveManager.getPendingCount()).toBe(1);
    
    saveManager.clearPending();
    expect(saveManager.getPendingCount()).toBe(0);
    
    // Should not trigger save
    jest.advanceTimersByTime(1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should handle immediate save', async () => {
    saveManager.initialize('test-website');
    
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test' } });
    
    // Don't wait for debounce
    await saveManager.saveNow();
    
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should track save status', () => {
    const statusCallback = jest.fn();
    saveManager.initialize('test-website', {
      onStatusChange: statusCallback
    });
    
    expect(saveManager.getStatus()).toBe('idle');
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test' } });
    
    // Trigger save
    jest.advanceTimersByTime(1000);
    
    expect(statusCallback).toHaveBeenCalledWith('saving');
  });

  it('should handle multiple operations batch', () => {
    saveManager.initialize('test-website');
    
    const operations = [
      { type: 'CREATE' as const, data: { title: 'Test 1' } },
      { type: 'UPDATE' as const, nodeId: 'node-1', data: { title: 'Updated' } },
      { type: 'DELETE' as const, nodeId: 'node-2' }
    ];
    
    saveManager.addOperations(operations);
    
    jest.advanceTimersByTime(1000);
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/sitemap/save',
      expect.objectContaining({
        body: expect.stringContaining('"operations"')
      })
    );
  });

  it('extracts canonical page component overrides from live edit payloads', () => {
    expect(toPageComponentOverrides({ title: 'Direct' })).toEqual({ title: 'Direct' });
    expect(toPageComponentOverrides({ content: { title: 'From content' }, props: { content: { title: 'Mirror' } } }))
      .toEqual({ title: 'From content' });
    expect(() => toPageComponentOverrides({ props: { content: { title: 'From props content' } } }))
      .toThrow('Page component update payload contains malformed legacy content mirrors');
    expect(() => toPageComponentOverrides({ props: { text: { title: 'From props text' } } }))
      .toThrow('Page component update payload contains malformed legacy content mirrors');
  });

  it('surfaces malformed legacy page component wrappers instead of sending them', async () => {
    const errorCallback = jest.fn();
    saveManager.initialize('test-website');
    saveManager.initialize('test-website', {
      onError: errorCallback
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      data: { props: { content: JSON.stringify({ title: 'Legacy' }) } },
    });

    await saveManager.saveNow();

    expect(fetch).not.toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect(saveManager.getStatus()).toBe('error');
  });

  it('sends canonical content for page-only component updates', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      data: { content: { title: 'Edited' } },
    });

    await saveManager.saveNow();

    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/site-builder/page-components/component-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          pageId: 'page-1',
          overrides: { title: 'Edited' },
        }),
      })
    );
  });

  it('merges pending same-component update data before saving page-only overrides', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      data: { content: { title: 'Edited' } },
    });
    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      data: { props: { metadata: { schema: 'hero' } } },
    });

    await saveManager.saveNow();

    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/site-builder/page-components/component-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          pageId: 'page-1',
          overrides: { title: 'Edited' },
        }),
      })
    );
  });

  it.each([
    ['COMPONENT_ADD' as const, 'component-2'],
    ['COMPONENT_DELETE' as const, 'component-1'],
    ['COMPONENT_REORDER' as const, 'reorder'],
  ])('persists %s structurally without calling override PATCH', async (type, componentId) => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const components = [
      {
        id: 'component-1',
        type: 'hero',
        parentId: null,
        position: 0,
        props: {},
        content: {},
        styles: {},
        metadata: {},
      },
    ];

    saveManager.addComponentOperation({
      type,
      nodeId: 'page-1',
      componentId,
      data: { components },
    });

    await saveManager.saveNow();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/site-builder/pages/page-1/components',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          pageId: 'page-1',
          components,
        }),
      })
    );
    expect((fetch as jest.Mock).mock.calls[0][0]).not.toContain('/page-components/');
  });

  it('keeps structural add pending when the added component is edited before save', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_ADD',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: {
        components: [
          {
            id: 'component-2',
            type: 'hero',
            parentId: null,
            position: 0,
            props: {},
            content: {},
            styles: {},
            metadata: {},
          },
        ],
        ifUnchangedSince: '2026-05-22T00:00:00.000Z',
      },
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: { content: { title: 'Edited before save' } },
    });

    await saveManager.saveNow();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/site-builder/pages/page-1/components',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          pageId: 'page-1',
          components: [
            {
              id: 'component-2',
              type: 'hero',
              parentId: null,
              position: 0,
              props: {},
              content: { title: 'Edited before save' },
              styles: {},
              metadata: {},
            },
          ],
          ifUnchangedSince: '2026-05-22T00:00:00.000Z',
        }),
      })
    );
    expect((fetch as jest.Mock).mock.calls[0][0]).not.toContain('/page-components/');
  });

  it('does not persist stale props content mirrors when a pending structural component is canonically edited before save', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_ADD',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: {
        components: [
          {
            id: 'component-2',
            type: 'hero',
            parentId: null,
            position: 0,
            props: {
              content: { title: 'Stale props.content title' },
              text: { title: 'Stale props.text title' },
              metadata: { schema: 'old-hero' },
            },
            content: { title: 'Initial title' },
            styles: {},
            metadata: {},
          },
        ],
      },
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: {
        content: { title: 'Canonical title' },
        props: {
          metadata: { schema: 'hero' },
          sharedComponentId: 'shared-1',
          overrides: { title: 'Canonical title' },
          hasOverrides: true,
        },
      },
    });

    await saveManager.saveNow();

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.components[0]).toEqual({
      id: 'component-2',
      type: 'hero',
      parentId: null,
      position: 0,
      props: {
        metadata: { schema: 'hero' },
        sharedComponentId: 'shared-1',
        overrides: { title: 'Canonical title' },
        hasOverrides: true,
      },
      content: { title: 'Canonical title' },
      styles: {},
      metadata: {},
    });
    expect(body.components[0].props).not.toHaveProperty('content');
    expect(body.components[0].props).not.toHaveProperty('text');
  });

  it('preserves canonical content while merging legitimate props into a pending same-component structural update', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_ADD',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: {
        components: [
          {
            id: 'component-2',
            type: 'hero',
            parentId: null,
            position: 0,
            props: {
              metadata: { schema: 'hero' },
              sharedComponentId: 'shared-1',
            },
            content: { title: 'Canonical title' },
            styles: {},
            metadata: {},
          },
        ],
      },
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-2',
      data: {
        props: {
          overrides: { title: 'Override title' },
          hasOverrides: true,
        },
      },
    });

    await saveManager.saveNow();

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.components[0].content).toEqual({ title: 'Canonical title' });
    expect(body.components[0].props).toEqual({
      metadata: { schema: 'hero' },
      sharedComponentId: 'shared-1',
      overrides: { title: 'Override title' },
      hasOverrides: true,
    });
  });

  it('uses returned structural page timestamp for later structural saves', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, updatedAt: '2026-05-22T00:10:00.000Z' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, updatedAt: '2026-05-22T00:11:00.000Z' })
      });

    const components = [
      {
        id: 'component-1',
        type: 'hero',
        parentId: null,
        position: 0,
        props: {},
        content: {},
        styles: {},
        metadata: {},
      },
    ];

    saveManager.addComponentOperation({
      type: 'COMPONENT_REORDER',
      nodeId: 'page-1',
      componentId: 'reorder',
      data: {
        components,
        ifUnchangedSince: '2026-05-22T00:00:00.000Z',
      },
    });
    await saveManager.saveNow();

    saveManager.addComponentOperation({
      type: 'COMPONENT_REORDER',
      nodeId: 'page-1',
      componentId: 'reorder',
      data: {
        components,
        ifUnchangedSince: '2026-05-22T00:00:00.000Z',
      },
    });
    await saveManager.saveNow();

    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).ifUnchangedSince)
      .toBe('2026-05-22T00:00:00.000Z');
    expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).ifUnchangedSince)
      .toBe('2026-05-22T00:10:00.000Z');
  });

  it('surfaces missing structural components payloads instead of calling override PATCH', async () => {
    const errorCallback = jest.fn();
    saveManager.initialize('test-website', {
      onError: errorCallback
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_DELETE',
      nodeId: 'page-1',
      componentId: 'component-1',
    });

    await saveManager.saveNow();

    expect(fetch).not.toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect((errorCallback.mock.calls[0][0] as Error).message).toBe(
      'COMPONENT_DELETE requires data.components for structural page content persistence'
    );
    expect(saveManager.getStatus()).toBe('error');
  });

  it('keeps global component update coalescing as latest update wins', async () => {
    saveManager.initialize('test-website');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      globalComponentId: 'global-1',
      data: { content: { title: 'First global title' }, props: { metadata: { schema: 'old' } } },
    });
    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      globalComponentId: 'global-1',
      data: { content: { title: 'Latest global title' } },
    });

    await saveManager.saveNow();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/studio/site-builder/global-components/global-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          content: { content: { title: 'Latest global title' } },
        }),
      })
    );
  });

  it('surfaces global component save errors', async () => {
    const errorCallback = jest.fn();
    saveManager.initialize('test-website', {
      onError: errorCallback
    });
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid global content' })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      globalComponentId: 'global-1',
      data: { title: 'Bad global update' },
    });

    await saveManager.saveNow();

    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect((errorCallback.mock.calls[0][0] as Error).message).toBe('Invalid global content');
    expect(saveManager.getStatus()).toBe('error');
  });

  it('surfaces page component PATCH errors', async () => {
    const errorCallback = jest.fn();
    saveManager.initialize('test-website', {
      onError: errorCallback
    });
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Overrides must be an object or null' })
    });

    saveManager.addComponentOperation({
      type: 'COMPONENT_UPDATE',
      nodeId: 'page-1',
      componentId: 'component-1',
      data: { content: { title: 'Edited' } },
    });

    await saveManager.saveNow();

    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect((errorCallback.mock.calls[0][0] as Error).message).toBe('Overrides must be an object or null');
    expect(saveManager.getStatus()).toBe('error');
  });

  it('should abort previous requests when new save triggered', () => {
    saveManager.initialize('test-website');
    
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test 1' } });
    jest.advanceTimersByTime(1000);
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test 2' } });
    jest.advanceTimersByTime(1000);
    
    expect(abortSpy).toHaveBeenCalled();
    
    abortSpy.mockRestore();
  });

  it('should handle network offline gracefully', async () => {
    saveManager.initialize('test-website');
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    const errorCallback = jest.fn();
    saveManager.initialize('test-website', {
      onError: errorCallback
    });
    
    saveManager.addOperation({ type: 'CREATE', data: { title: 'Test' } });
    await jest.advanceTimersByTimeAsync(1000);
    
    // Should retry with exponential backoff
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);
    await jest.advanceTimersByTimeAsync(6000);
    
    // After max retries, should call error callback
    expect(errorCallback).toHaveBeenCalled();
    
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true });
  });
});
