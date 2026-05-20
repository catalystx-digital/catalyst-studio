/**
 * Enhanced API client with request cancellation
 */

interface RequestOptions extends RequestInit {
  timeout?: number;
}

class APIClient {
  private activeRequests = new Map<string, AbortController>();

  /**
   * Creates an abort controller with optional timeout
   */
  private createAbortController(key: string, timeout?: number): AbortController {
    // Cancel any existing request with the same key
    this.cancelRequest(key);
    
    const controller = new AbortController();
    this.activeRequests.set(key, controller);
    
    if (timeout) {
      setTimeout(() => {
        if (this.activeRequests.get(key) === controller) {
          controller.abort();
          this.activeRequests.delete(key);
        }
      }, timeout);
    }
    
    return controller;
  }

  /**
   * Cancels a request by key
   */
  public cancelRequest(key: string): void {
    const controller = this.activeRequests.get(key);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(key);
    }
  }

  /**
   * Cancels all active requests
   */
  public cancelAllRequests(): void {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Makes an API request with cancellation support
   */
  public async request(
    url: string,
    options: RequestOptions = {},
    requestKey?: string
  ): Promise<Response> {
    const {
      timeout = 30000, // 30 seconds default
      ...fetchOptions
    } = options;

    // Create abort controller if request key is provided
    const controller = requestKey 
      ? this.createAbortController(requestKey, timeout)
      : new AbortController();

    // Add timeout even if no request key
    if (!requestKey && timeout) {
      setTimeout(() => controller.abort(), timeout);
    }

    // Prepare headers
    const headers = new Headers(fetchOptions.headers);

    // Ensure JSON content type for JSON requests
    if (fetchOptions.body && typeof fetchOptions.body === 'string') {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      // Clean up after successful request
      if (requestKey) {
        this.activeRequests.delete(requestKey);
      }


      return response;
    } catch (error) {
      // Clean up on error
      if (requestKey) {
        this.activeRequests.delete(requestKey);
      }
      
      // Handle abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request cancelled: ${url}`);
      }
      
      throw error;
    }
  }

  /**
   * Convenience methods for common HTTP methods
   */
  public async get(url: string, options?: RequestOptions, requestKey?: string) {
    return this.request(url, { ...options, method: 'GET' }, requestKey);
  }

  public async post(url: string, body?: unknown, options?: RequestOptions, requestKey?: string) {
    return this.request(
      url,
      {
        ...options,
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      requestKey
    );
  }

  public async put(url: string, body?: unknown, options?: RequestOptions, requestKey?: string) {
    return this.request(
      url,
      {
        ...options,
        method: 'PUT',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      requestKey
    );
  }

  public async patch(url: string, body?: unknown, options?: RequestOptions, requestKey?: string) {
    return this.request(
      url,
      {
        ...options,
        method: 'PATCH',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      requestKey
    );
  }

  public async delete(url: string, options?: RequestOptions, requestKey?: string) {
    return this.request(url, { ...options, method: 'DELETE' }, requestKey);
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export convenience functions
export const api = {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  cancelRequest: apiClient.cancelRequest.bind(apiClient),
  cancelAllRequests: apiClient.cancelAllRequests.bind(apiClient),
};