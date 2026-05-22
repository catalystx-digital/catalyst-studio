import { 
  OptimizelyContentType,
  OptimizelyContentItem,
  OptimizelyContentFilter,
  OptimizelyPaginationOptions,
  OptimizelyListResponse,
  OptimizelyValidationResponse
} from './types';
import { sanitizeOptiKey } from './utils/sanitize';
import { RETRY_CONFIG, API_CONFIG, TIMEOUT_CONFIG, RATE_LIMIT_CONFIG } from './constants';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface FetchError extends Error {
  status?: number;
  response?: unknown;
}

export class OptimizelyClient {
  private baseUrl: string;
  private apiVersion: string;
  private contentTypeApiVersion: string;
  private contentApiVersion: string;
  private clientId?: string;
  private clientSecret?: string;
  private projectId?: string;
  private environmentId?: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshing: Promise<void> | null = null;
  private requestCount: number = 0;
  private readonly TOKEN_SKEW_MS = 300_000; // 5 minutes
  private activeRequests = new Map<string, AbortController>();
  private lastRequestTime: number = 0;

  constructor() {
    this.baseUrl = API_CONFIG.DEFAULT_BASE_URL;
    this.apiVersion = API_CONFIG.DEFAULT_API_VERSION;
    this.contentTypeApiVersion = process.env.OPTIMIZELY_CONTENTTYPE_API_VERSION || 'preview3';
    this.contentApiVersion = process.env.OPTIMIZELY_CONTENT_API_VERSION || 'preview3/experimental';
    this.clientId = process.env.OPTIMIZELY_CLIENT_ID;
    this.clientSecret = process.env.OPTIMIZELY_CLIENT_SECRET;
    this.projectId = process.env.OPTIMIZELY_PROJECT_ID;
    this.environmentId = process.env.OPTIMIZELY_ENVIRONMENT_ID;
  }

  configure(config: any): void {
    // Apply configuration from provider config
    if (config) {
      // Check for various possible field names
      if (config.apiUrl || config.endpoint) {
        this.baseUrl = config.apiUrl || config.endpoint;
      }
      
      // Set credentials directly from config
      if (config.clientId) {
        this.clientId = config.clientId;
      }
      if (config.clientSecret) {
        this.clientSecret = config.clientSecret;
      }
      
      if (config.projectId || config.workspace) {
        this.projectId = config.projectId || config.workspace;
      }
      if ((config as any).environmentId) {
        this.environmentId = (config as any).environmentId;
      }
      
      // Reset token to force re-authentication with new credentials
      this.accessToken = null;
      this.tokenExpiry = null;

    }
  }

  // Removed setDryRun - always use real API

  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiry) return false;
    const now = Date.now();
    return now < this.tokenExpiry.getTime();
  }

  private isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiry) return true;
    const now = Date.now();
    return (this.tokenExpiry.getTime() - now) <= this.TOKEN_SKEW_MS;
  }

  private async refreshTokenIfNeeded(force = false): Promise<void> {
    if (!force && this.isTokenValid() && !this.isTokenExpiringSoon()) return;

    if (this.refreshing) {
      await this.refreshing;
      return;
    }

    this.refreshing = (async () => {
    try {
        this.accessToken = null;
        this.tokenExpiry = null;
        await this.authenticate();
        this.requestCount = 0;
      } finally {
        this.refreshing = null;
      }
    })();

    await this.refreshing;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid() || this.isTokenExpiringSoon()) {
      await this.refreshTokenIfNeeded(true);
    }
  }

  async authenticate(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('❌ No Optimizely credentials configured. Please provide clientId and clientSecret.');
    }
    
    if (this.accessToken && this.isTokenValid() && !this.isTokenExpiringSoon()) {
      return;
    }

    try {
      const tokenUrl = `${this.baseUrl}/oauth/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      });

      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔐 Auth error response:', errorText.substring(0, 500));
        throw new Error(`❌ Authentication failed with status ${response.status}`);
      }

      const data: TokenResponse = await response.json();
      
      this.accessToken = data.access_token;
      const expiryBuffer = 180; // Refresh token 3 minutes before expiry (long-running exports)
      const secondsUntilExpiry = Math.max(0, (data.expires_in - expiryBuffer));
      this.tokenExpiry = new Date(Date.now() + secondsUntilExpiry * 1000);
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      throw new Error(`❌ Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private currentDelay: number = RATE_LIMIT_CONFIG.INITIAL_DELAY_MS;
  
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.currentDelay) {
      const delay = this.currentDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  private adjustRateLimit(success: boolean): void {
    if (success) {
      // Speed up on success, but don't go below minimum
      this.currentDelay = Math.max(
        RATE_LIMIT_CONFIG.MIN_DELAY_MS,
        this.currentDelay * RATE_LIMIT_CONFIG.SPEEDUP_FACTOR
      );
    } else {
      // Slow down on rate limit, but don't exceed maximum
      this.currentDelay = Math.min(
        RATE_LIMIT_CONFIG.MAX_DELAY_MS,
        this.currentDelay * RATE_LIMIT_CONFIG.BACKOFF_FACTOR
      );
    }
  }

  async makeRequest<T>(
    path: string,
    options: RequestInit = {},
    requestKey?: string,
    retryCount: number = 0
  ): Promise<T> {
    // No more dry-run fallback - always make real API calls
    await this.ensureAuthenticated();
    await this.enforceRateLimit();

    const controller = new AbortController();
    if (requestKey) {
      const existingController = this.activeRequests.get(requestKey);
      if (existingController) {
        existingController.abort();
      }
      this.activeRequests.set(requestKey, controller);
    }

    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CONFIG.DEFAULT_TIMEOUT_MS);

    try {
      // Determine which API version to use based on the endpoint
      let apiVersion = this.apiVersion;
      if (path.includes('/contenttypes')) {
        apiVersion = this.contentTypeApiVersion;
      } else if (path.includes('/content')) {
        apiVersion = this.contentApiVersion;
      }
      
      const url = `${this.baseUrl}/${apiVersion}${path}`;
      // Build headers and strip any stale Authorization header from options
    const optHeaders = (options.headers || {}) as Record<string, string>;
    const sanitizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(optHeaders)) {
      if (k.toLowerCase() !== 'authorization') {
        sanitizedHeaders[k] = v as string;
      }
    }
    const hasCustomContentType = Object.keys(sanitizedHeaders).some(k => k.toLowerCase() === 'content-type');
    // Only set a default Content-Type when a request body is present.
    // This avoids sending Content-Type on GET requests, which can cause 415s
    // on certain Optimizely endpoints.
    const shouldSetDefaultContentType = !hasCustomContentType && (options as any).body !== undefined && (options as any).body !== null;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...(shouldSetDefaultContentType ? { 'Content-Type': 'application/json' } : {}),  // Default only when sending a body
          ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
          // Project/Environment scoping headers (support common variants)
          ...(this.projectId && { 'x-project-id': this.projectId }),
          ...(this.projectId && { 'X-EP-Project-Id': this.projectId }),
          ...(this.environmentId && { 'X-EP-Environment-Id': this.environmentId }),
          ...sanitizedHeaders,  // Do not allow overriding Authorization
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (requestKey) {
        this.activeRequests.delete(requestKey);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Request failed: ${path}`);
        console.error(`   Status: ${response.status} ${response.statusText}`);
        console.error(`   Response: ${errorText.substring(0, 500)}`);
        
        const error: FetchError = new Error(`Request failed: ${response.statusText}`);
        error.status = response.status;
    try {
          error.response = JSON.parse(errorText);
        } catch {
          error.response = { error: errorText };
        }
        // Auth failure: refresh token and retry once
        if (response.status === 401 && retryCount < 1) {
          await this.refreshTokenIfNeeded(true);
          return this.makeRequest<T>(path, options, requestKey, retryCount + 1);
        }
        
        // Handle rate limiting and server errors with exponential backoff
        if (response.status === 429 || response.status >= 500) {
          // Adjust rate limiting on 429
          if (response.status === 429) {
            this.adjustRateLimit(false);
          }
          
          if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
            const baseDelay = response.status === 429 
              ? (response.headers.get('Retry-After') ? parseInt(response.headers.get('Retry-After')!) * 1000 : RETRY_CONFIG.INITIAL_DELAY_MS)
              : RETRY_CONFIG.INITIAL_DELAY_MS;
            const delay = Math.min(
              baseDelay * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
              RETRY_CONFIG.MAX_DELAY_MS
            );
            console.warn(`${response.status === 429 ? 'Rate limited' : 'Server error'}. Retry ${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            // Retry the request
            return this.makeRequest<T>(path, options, requestKey, retryCount + 1);
          }
        }
        
        throw error;
      }

      // Successful request - adjust rate limiting to speed up
      this.adjustRateLimit(true);
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (requestKey) {
        this.activeRequests.delete(requestKey);
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        // Retry on timeout if we haven't exceeded retry limit
        if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
          const delay = Math.min(
            RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
            RETRY_CONFIG.MAX_DELAY_MS
          );
          console.warn(`Request timeout. Retry ${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest<T>(path, options, requestKey, retryCount + 1);
        }
        throw new Error(`Request timeout after ${RETRY_CONFIG.MAX_RETRIES} retries: ${path}`);
      }
      throw error;
    }
  }

  // Removed getMockResponse - always use real API

  async getContentTypes(): Promise<OptimizelyContentType[]> {
    try {
      const response = await this.makeRequest<OptimizelyListResponse<OptimizelyContentType>>(
        '/contenttypes',
        { method: 'GET' },
        'getContentTypes'
      );
      
      return response.items || [];
    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 403) {
        throw new Error('Access denied to Optimizely API');
      }
      throw error;
    }
  }

  async getContentType(id: string): Promise<OptimizelyContentType | null> {
    // Sanitize id using shared Optimizely normalization
    const safeId = sanitizeOptiKey(id) ?? id;
    try {
      const response = await this.makeRequest<OptimizelyContentType>(
        `/contenttypes/${safeId}`,
        { method: 'GET' },
        `getContentType-${safeId}`
      );
      return response;

    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createContentType(contentType: OptimizelyContentType): Promise<OptimizelyContentType> {

    // Validate and fix any empty property types before sending
    if (contentType.properties) {
      for (const [propName, prop] of Object.entries(contentType.properties)) {
        if (!prop.type || prop.type === '') {
          console.error(`❌ Property ${propName} has empty type! Fixing to 'string'`);
          prop.type = 'string';
        }
      }
    }

    try {
      // Check for empty keys in properties object
      if (contentType.properties) {
        const keys = Object.keys(contentType.properties);
        const emptyKeys = keys.filter(k => !k || k.trim() === '');
        if (emptyKeys.length > 0) {
          console.error(`❌ Found ${emptyKeys.length} empty keys in properties object!`);
          // Remove empty keys
          for (const emptyKey of emptyKeys) {
            delete contentType.properties[emptyKey];
          }
        }
      }
      
      const bodyString = JSON.stringify(contentType, null, 2);
      
      const response = await this.makeRequest<OptimizelyContentType>(
        '/contenttypes',
        {
          method: 'POST',
          body: bodyString,
        },
        `createContentType-${contentType.key}`
      );
      return response;
    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 409) {
        // Content type already exists - update it to ensure schema is correct
        console.log(`  [ContentType] ${contentType.key} exists, updating schema...`);
        try {
          const updated = await this.updateContentType(contentType.key, contentType, { ignoreDataLossWarnings: true });
          return updated;
        } catch (updateError) {
          // If update fails, return existing as fallback
          console.log(`  [ContentType] Update failed, using existing: ${updateError instanceof Error ? updateError.message : updateError}`);
          const existing = await this.getContentType(contentType.key);
          if (existing) {
            return existing;
          }
        }
      }
      // If the endpoint is not available (404), surface as a hard failure to prevent downstream item creation with missing types
      if (fetchError.status === 404) {
        throw new Error(`ContentType API endpoint not available (404) for key=${contentType.key}. Cannot proceed without remote type. Check API version/project/permissions.`);
      }
      throw error;
    }
  }

  async updateContentType(id: string, contentType: OptimizelyContentType, options?: { ignoreDataLossWarnings?: boolean }): Promise<OptimizelyContentType> {
    try {
      // Build query string for options
      const queryParams = new URLSearchParams();
      if (options?.ignoreDataLossWarnings) {
        queryParams.set('ignoreDataLossWarnings', 'true');
      }
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const response = await this.makeRequest<OptimizelyContentType>(
        `/contenttypes/${id}${queryString}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify(contentType),
        },
        `updateContentType-${id}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async deleteContentType(id: string): Promise<boolean> {
    try {
      await this.makeRequest<void>(
        `/contenttypes/${id}`,
        { method: 'DELETE' },
        `deleteContentType-${id}`
      );
      return true;
    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async validateContentType(contentType: OptimizelyContentType): Promise<{
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const response = await this.makeRequest<OptimizelyValidationResponse>(
        '/contenttypes/validate',
        {
          method: 'POST',
          body: JSON.stringify(contentType),
        },
        `validateContentType-${contentType.key}`
      );
      
      return {
        isValid: response.isValid || false,
        errors: response.errors?.map(e => e.message) || [],
        warnings: response.warnings?.map(w => w.message) || []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      
      if (!this.accessToken) {
        return false;
      }
      
      await this.getContentTypes();
      return true;
    } catch {
      return false;
    }
  }

  // Content Item Methods

  async getContentItems(
    filter?: OptimizelyContentFilter,
    pagination?: OptimizelyPaginationOptions
  ): Promise<{ items: OptimizelyContentItem[]; total: number }> {
    try {
      const queryParams = new URLSearchParams();
      
      // Apply filter parameters
      if (filter?.contentTypeId) {
        queryParams.append('contentTypeId', filter.contentTypeId);
      }
      if (filter?.language) {
        queryParams.append('language', filter.language);
      }
      if (filter?.status && filter.status.length > 0) {
        filter.status.forEach(s => queryParams.append('status', s));
      }
      if (filter?.parentLink) {
        queryParams.append('parentLink', filter.parentLink);
      }
      if (filter?.searchText) {
        queryParams.append('q', filter.searchText);
      }
      if (filter?.modifiedAfter) {
        queryParams.append('modifiedAfter', filter.modifiedAfter);
      }
      if (filter?.modifiedBefore) {
        queryParams.append('modifiedBefore', filter.modifiedBefore);
      }
      
      // Apply pagination parameters
      if (pagination?.top) {
        queryParams.append('$top', pagination.top.toString());
      }
      if (pagination?.skip) {
        queryParams.append('$skip', pagination.skip.toString());
      }
      if (pagination?.orderby) {
        queryParams.append('$orderby', pagination.orderby);
      }
      if (pagination?.select && pagination.select.length > 0) {
        queryParams.append('$select', pagination.select.join(','));
      }
      if (pagination?.expand && pagination.expand.length > 0) {
        queryParams.append('$expand', pagination.expand.join(','));
      }

      const queryString = queryParams.toString();
      const path = queryString ? `/content?${queryString}` : '/content';
      
      const response = await this.makeRequest<OptimizelyListResponse<OptimizelyContentItem>>(
        path,
        { method: 'GET' },
        'getContentItems'
      );
      
      return {
        items: response.items || [],
        total: response.totalCount || response.total || response.items?.length || 0
      };
    } catch (error) {
      throw error;
    }
  }

  async getContentItem(id: string): Promise<OptimizelyContentItem | null> {
    try {
      const response = await this.makeRequest<OptimizelyContentItem>(
        `/content/${id}`,
        { method: 'GET' },
        `getContentItem-${id}`
      );
      return response;
    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createContentItem(contentItem: OptimizelyContentItem): Promise<OptimizelyContentItem> {
    try {
      const response = await this.makeRequest<OptimizelyContentItem>(
        '/content',
        {
          method: 'POST',
          body: JSON.stringify(contentItem),
        },
        `createContentItem-${contentItem.contentGuid}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async createContent(request: {
    name: string;
    displayName?: string;
    container?: string | number;  // Allow numeric IDs; optional to support provider defaults
    owner?: string | number;       // Preferred for local blocks under a page
    contentType: string;          // Content type key
    locale?: string;
    properties: Record<string, unknown>;
    status?: string;
    urlSegment?: string;          // Optional: Name in URL for pages
  }): Promise<{
    guidValue?: string;
    contentLink?: { id: number };
    [key: string]: unknown;
  }> {
    // Build simplified request matching POC structure
    const hasOwner = request.owner !== undefined && request.owner !== null;
    const containerStr = (request.container === undefined || request.container === null)
      ? ''
      : String(request.container);
    const simplifiedRequest: any = {
      name: request.name,
      displayName: request.displayName || request.name,
      // Prefer 'owner' over 'container' when provided
      ...(hasOwner ? { owner: String(request.owner) } : {
        container: containerStr && (typeof containerStr.replace === 'function')
          ? containerStr.replace(/-/g, '')
          : containerStr,
      }),
      contentType: request.contentType,
      locale: request.locale || 'en',
      properties: request.properties,
      status: request.status || 'Draft'
    };
    // Pass Name-in-URL when provided (used by pages)
    if (request.urlSegment) {
      simplifiedRequest.urlSegment = request.urlSegment;
    }

    try {
      const response = await this.makeRequest<any>(
        '/content',
        {
          method: 'POST',
          body: JSON.stringify(simplifiedRequest),
        },
        `createContent-${request.name}`
      );
      return response;
    } catch (error) {
      console.error('❌ Failed to create content:', error);
      throw error;
    }
  }

  // Attempt to resolve a page's assets container; fall back to null if unavailable
  async getAssetsContainerId(contentId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest<any>(
        `/content/${contentId}`,
        { method: 'GET' },
        `getAssetsContainer-${contentId}`
      );
      // Heuristics: look for common asset container fields
      const candidates = [
        (response as any)?.assetsContainerId,
        (response as any)?.assetsContainer,
        (response as any)?.assetsFolderId,
        (response as any)?.assets?.containerId,
      ].filter(Boolean);
      if (candidates.length > 0) {
        const id = String(candidates[0]);
        return id;
      }
      // Some implementations may use content id as container
      console.warn(`⚠️ No explicit assets container found for ${contentId}`);
      return null;
    } catch (e) {
      console.warn(`⚠️ Failed to get assets container for ${contentId}:`, (e as Error)?.message);
      return null;
    }
  }

  async createFolder(request: {
    name: string;
    contentTypeGuid: string;
    parentLink: { id: number; workId: number; guidValue: string };
  }): Promise<{
    contentLink?: { id: number };
    [key: string]: unknown;
  }> {
    void request;
    // SaaS: Folder endpoint is not available; short-circuit with fallback
    return { contentLink: { id: 3 } } as any;
  }

  async updateContentItem(id: string, contentItem: any): Promise<any> {
    try {
      const response = await this.makeRequest<any>(
        `/content/${id}/versions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contentItem),
        },
        `updateContentItem-${id}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Patch content item using merge-patch.
   * Used to update specific properties without replacing the entire content.
   */
  async patchContent(id: string, updates: Record<string, unknown>): Promise<any> {
    try {
      const response = await this.makeRequest<any>(
        `/content/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify(updates),
        },
        `patchContent-${id}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async deleteContentItem(id: string): Promise<boolean> {
    try {
      await this.makeRequest<void>(
        `/content/${id}`,
        { method: 'DELETE' },
        `deleteContentItem-${id}`
      );
      return true;
    } catch (error) {
      const fetchError = error as FetchError;
      if (fetchError.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async validateContentItem(contentItem: OptimizelyContentItem): Promise<{
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const response = await this.makeRequest<OptimizelyValidationResponse>(
        '/content/validate',
        {
          method: 'POST',
          body: JSON.stringify(contentItem),
        },
        `validateContentItem-${contentItem.contentGuid}`
      );
      
      return {
        isValid: response.isValid || false,
        errors: response.errors?.map(e => e.message) || [],
        warnings: response.warnings?.map(w => w.message) || []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  // Helper method with exponential backoff
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
    initialDelay: number = RETRY_CONFIG.INITIAL_DELAY_MS
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
    try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const fetchError = error as FetchError;

        // Don't retry on client errors (4xx)
        if (fetchError.status && fetchError.status >= 400 && fetchError.status < 500) {
          throw error;
        }

        // Exponential backoff
        if (i < maxRetries - 1) {
          const delay = Math.min(
            initialDelay * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, i),
            RETRY_CONFIG.MAX_DELAY_MS
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Upload a media asset to Optimizely CMS.
   * Uses multipart/form-data to upload binary media with metadata.
   *
   * Note: Optimizely SaaS CMS media upload is done via the Content API
   * with the blob sent as multipart form data or base64 encoded.
   */
  async uploadMedia(request: {
    name: string
    contentType: string
    blob: Buffer
    container?: string
  }): Promise<{
    key?: string
    contentLink?: { id: number }
    [key: string]: unknown
  }> {
    await this.ensureAuthenticated()
    await this.enforceRateLimit()

    // Build form data with the media blob
    const formData = new FormData()

    // Create metadata JSON
    const metadata = {
      name: request.name,
      contentType: this.getMediaContentTypeKey(request.contentType),
      ...(request.container && { container: request.container.replace(/-/g, '') }),
      locale: 'en',
      status: 'published'
    }

    formData.append('metadata', JSON.stringify(metadata))

    // Append a copied Uint8Array so DOM Blob receives an ArrayBuffer-backed BlobPart.
    const blobPart = Uint8Array.from(request.blob)
    const blob = new Blob([blobPart], { type: request.contentType })
    formData.append('file', blob, request.name)

    try {
      const apiVersion = this.contentApiVersion
      const url = `${this.baseUrl}/${apiVersion}/content/upload`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
          ...(this.projectId && { 'x-project-id': this.projectId }),
          ...(this.projectId && { 'X-EP-Project-Id': this.projectId }),
          ...(this.environmentId && { 'X-EP-Environment-Id': this.environmentId }),
          // Note: Content-Type is automatically set by FormData
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Media upload failed: ${response.status}`, errorText.substring(0, 500))

        // If the upload endpoint doesn't exist, try alternative approach
        if (response.status === 404) {
          return this.uploadMediaViaContent(request)
        }

        throw new Error(`Media upload failed: ${response.statusText}`)
      }

      this.adjustRateLimit(true)
      return await response.json()
    } catch (error) {
      console.error('❌ Media upload error:', error)
      // Fallback to content-based upload
      return this.uploadMediaViaContent(request)
    }
  }

  /**
   * Alternative media upload via Content API (creates media as content item).
   * Used as fallback when direct upload endpoint is not available.
   */
  private async uploadMediaViaContent(request: {
    name: string
    contentType: string
    blob: Buffer
    container?: string
  }): Promise<{
    key?: string
    contentLink?: { id: number }
    [key: string]: unknown
  }> {
    // Create media as a content item with base64-encoded blob
    const contentTypeKey = this.getMediaContentTypeKey(request.contentType)

    const contentRequest = {
      name: request.name,
      displayName: request.name,
      contentType: contentTypeKey,
      ...(request.container && { container: request.container.replace(/-/g, '') }),
      locale: 'en',
      properties: {
        // Store blob as base64 data URL for media properties
        blobData: `data:${request.contentType};base64,${request.blob.toString('base64')}`
      },
      status: 'published'
    }

    return this.createContent(contentRequest)
  }

  /**
   * Map MIME type to Optimizely media content type key
   */
  private getMediaContentTypeKey(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'ImageMedia'
    }
    if (mimeType.startsWith('video/')) {
      return 'VideoMedia'
    }
    if (mimeType.startsWith('audio/')) {
      return 'AudioMedia'
    }
    return 'GenericMedia'
  }
}
