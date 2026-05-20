import { saveManager } from '../save-manager';

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
    jest.advanceTimersByTime(1000);
    
    // Should retry after 2 seconds (first retry)
    jest.advanceTimersByTime(2000);
    
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
    jest.advanceTimersByTime(1000);
    
    // Should retry with exponential backoff
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(4000);
    jest.advanceTimersByTime(6000);
    
    // After max retries, should call error callback
    expect(errorCallback).toHaveBeenCalled();
    
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true });
  });
});