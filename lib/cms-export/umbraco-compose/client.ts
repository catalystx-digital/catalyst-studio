/**
 * Umbraco Compose API Client
 *
 * Handles all API interactions with Umbraco Compose:
 * - Management API (type schemas, collections)
 * - Ingestion API (content batches)
 *
 * Features:
 * - Rate limiting with adaptive backoff
 * - Retry logic for transient failures
 * - Request/response logging for debugging
 */

import { UmbracoAuthManager } from './auth';
import {
  UMBRACO_MANAGEMENT_URL,
  UMBRACO_INGESTION_URL_PATTERN,
  TYPE_SCHEMAS_PATH_PATTERN,
  COLLECTIONS_PATH_PATTERN,
  DEFAULT_RATE_LIMIT_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_ENVIRONMENT,
  DEFAULT_COLLECTION,
  HTTP_STATUS,
  ENV_VARS,
} from './constants';
import type {
  UmbracoComposeClientConfig,
  UmbracoConnection,
  UmbracoTypeSchemaNode,
  UmbracoCollectionNode,
  UmbracoIngestionEntry,
  UmbracoIngestionResult,
  UmbracoMappedTypeSchema,
} from './types';
import {
  UmbracoComposeError,
  UmbracoRateLimitError,
  UmbracoConnectionError,
  UmbracoValidationError,
} from './types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Circuit breaker states
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,     // Open circuit after 5 consecutive failures
  resetTimeout: 30000,     // Try to reset after 30 seconds
  halfOpenRequests: 1,     // Allow 1 request in half-open state
};

export class UmbracoComposeClient {
  private authManager: UmbracoAuthManager;
  private projectAlias: string = '';
  private region: string = '';
  private environment: string = DEFAULT_ENVIRONMENT;
  private collection: string = DEFAULT_COLLECTION;
  private rateLimitMs: number = DEFAULT_RATE_LIMIT_MS;
  private timeout: number = DEFAULT_TIMEOUT_MS;
  private maxRetries: number = DEFAULT_MAX_RETRIES;
  private debug: boolean = false;
  private lastRequestTime: number = 0;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private circuitConfig: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG;

  constructor() {
    this.authManager = new UmbracoAuthManager();
  }

  /**
   * Configure the client
   */
  configure(config: UmbracoComposeClientConfig): void {
    if (config.projectAlias) this.projectAlias = config.projectAlias;
    if (config.region) this.region = config.region;
    if (config.environment) this.environment = config.environment;
    if (config.collection) this.collection = config.collection;
    if (config.rateLimitMs !== undefined) this.rateLimitMs = config.rateLimitMs;
    if (config.timeout !== undefined) this.timeout = config.timeout;
    if (config.maxRetries !== undefined) this.maxRetries = config.maxRetries;

    // Forward auth config
    this.authManager.configure(config);
  }

  /**
   * Configure from environment variables
   */
  configureFromEnv(): void {
    this.projectAlias = process.env[ENV_VARS.PROJECT_ALIAS] || '';
    this.region = process.env[ENV_VARS.REGION] || '';
    this.environment = process.env[ENV_VARS.ENVIRONMENT] || DEFAULT_ENVIRONMENT;
    this.collection = process.env[ENV_VARS.COLLECTION] || DEFAULT_COLLECTION;

    this.authManager.configureFromEnv();
  }

  /**
   * Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Get the configured collection name
   */
  getCollection(): string {
    return this.collection;
  }

  /**
   * Get the configured environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return Boolean(
      this.projectAlias &&
      this.region &&
      this.authManager.hasAnyCredentials()
    );
  }

  /**
   * Ensure client is configured, throw if not
   */
  ensureConfigured(): void {
    if (!this.isConfigured()) {
      this.configureFromEnv();
    }
    if (!this.isConfigured()) {
      throw new UmbracoComposeError(
        'Umbraco Compose client not configured. Required: projectAlias, region, and credentials.',
        'INVALID_CONFIG'
      );
    }
  }

  /**
   * Test connection to Umbraco Compose
   */
  async testConnection(): Promise<boolean> {
    try {
      this.ensureConfigured();
      return await this.authManager.testConnection();
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Type Schema Methods
  // ============================================================================

  /**
   * Get all type schemas
   */
  async getTypeSchemas(): Promise<UmbracoTypeSchemaNode[]> {
    const path = this.buildPath(TYPE_SCHEMAS_PATH_PATTERN);
    const response = await this.managementRequest<UmbracoConnection<UmbracoTypeSchemaNode>>(path);
    return response?.edges?.map((edge) => edge.node) || [];
  }

  /**
   * Create a type schema
   */
  async createTypeSchema(schema: UmbracoMappedTypeSchema): Promise<void> {
    const path = this.buildPath(TYPE_SCHEMAS_PATH_PATTERN);
    await this.managementRequest(path, {
      method: 'POST',
      body: schema,
    });
  }

  /**
   * Update an existing type schema
   */
  async updateTypeSchema(alias: string, schema: UmbracoMappedTypeSchema): Promise<void> {
    const path = `${this.buildPath(TYPE_SCHEMAS_PATH_PATTERN)}/${alias}`;
    await this.managementRequest(path, {
      method: 'PUT',
      body: { schema: schema.schema },
    });
  }

  /**
   * Delete a type schema
   */
  async deleteTypeSchema(alias: string): Promise<void> {
    const path = `${this.buildPath(TYPE_SCHEMAS_PATH_PATTERN)}/${alias}`;
    await this.managementRequest(path, { method: 'DELETE' });
  }

  /**
   * Ensure a type schema exists, create if not
   */
  async ensureTypeSchema(schema: UmbracoMappedTypeSchema): Promise<boolean> {
    const existing = await this.getTypeSchemas();
    const exists = existing.some((s) => s.typeSchemaAlias === schema.typeSchemaAlias);

    if (exists) {
      this.log(`Type schema "${schema.typeSchemaAlias}" already exists`);
      return false;
    }

    await this.createTypeSchema(schema);
    this.log(`Created type schema "${schema.typeSchemaAlias}"`);
    return true;
  }

  // ============================================================================
  // Collection Methods
  // ============================================================================

  /**
   * Get all collections
   */
  async getCollections(): Promise<UmbracoCollectionNode[]> {
    const path = this.buildPath(COLLECTIONS_PATH_PATTERN);
    const response = await this.managementRequest<UmbracoConnection<UmbracoCollectionNode>>(path);
    return response?.edges?.map((edge) => edge.node) || [];
  }

  /**
   * Create a collection
   */
  async createCollection(alias: string, description?: string): Promise<void> {
    const path = this.buildPath(COLLECTIONS_PATH_PATTERN);
    await this.managementRequest(path, {
      method: 'POST',
      body: {
        collectionAlias: alias,
        description: description || `Collection for ${alias}`,
      },
    });
  }

  /**
   * Ensure a collection exists, create if not
   */
  async ensureCollection(alias?: string): Promise<void> {
    const collectionAlias = alias || this.collection;
    const existing = await this.getCollections();
    const exists = existing.some((c) => c.collectionAlias === collectionAlias);

    if (exists) {
      this.log(`Collection "${collectionAlias}" already exists`);
      return;
    }

    await this.createCollection(collectionAlias);
    this.log(`Created collection "${collectionAlias}"`);
  }

  // ============================================================================
  // Ingestion Methods
  // ============================================================================

  /**
   * Ingest content entries in batch
   */
  async ingestContent(
    entries: UmbracoIngestionEntry[],
    collectionAlias?: string
  ): Promise<UmbracoIngestionResult> {
    const collection = collectionAlias || this.collection;

    return this.executeWithResilience(async () => {
      const url = this.buildIngestionUrl(collection);
      const token = this.authManager.getIngestionToken();
      await this.rateLimit();

      this.log(`Ingesting ${entries.length} entries to collection "${collection}"`);

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(entries),
        });
      } catch (error) {
        throw new UmbracoConnectionError(
          `Failed to connect to Umbraco ingestion API: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10);
          throw new UmbracoRateLimitError(retryAfter);
        }

        throw new UmbracoComposeError(
          `Ingestion failed: ${response.status} ${errorText.substring(0, 500)}`,
          'INGESTION_ERROR',
          response.status
        );
      }

      const text = await response.text();
      const result = text ? JSON.parse(text) : { success: true };

      this.log(`Ingestion complete: ${entries.length} entries processed`);
      return { success: true, processed: entries.length, ...result };
    }, `ingest ${entries.length} entries to ${collection}`);
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Build Management API path
   */
  private buildPath(pattern: string): string {
    return pattern
      .replace('{project}', this.projectAlias)
      .replace('{env}', this.environment);
  }

  /**
   * Build Ingestion API URL
   */
  private buildIngestionUrl(collection: string): string {
    const baseUrl = UMBRACO_INGESTION_URL_PATTERN.replace('{region}', this.region);
    return `${baseUrl}/v1/${this.projectAlias}/${this.environment}/${collection}`;
  }

  /**
   * Make a Management API request
   */
  private async managementRequest<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const { method = 'GET', body } = options;

    return this.executeWithResilience(async () => {
      const url = `${UMBRACO_MANAGEMENT_URL}${path}`;
      const token = await this.authManager.getManagementToken();

      await this.rateLimit();

      this.log(`${method} ${path}`);

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        throw new UmbracoConnectionError(
          `Failed to connect to Umbraco management API: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10);
          throw new UmbracoRateLimitError(retryAfter);
        }

        if (response.status === HTTP_STATUS.BAD_REQUEST || response.status === HTTP_STATUS.UNPROCESSABLE_ENTITY) {
          throw new UmbracoValidationError(
            `Validation failed: ${errorText.substring(0, 500)}`,
            errorText
          );
        }

        throw new UmbracoComposeError(
          `${method} ${path} failed: ${response.status} ${errorText.substring(0, 500)}`,
          'API_ERROR',
          response.status
        );
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    }, `${method} ${path}`);
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Apply rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await sleep(this.rateLimitMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[UmbracoClient] ${message}`);
    }
  }

  // ============================================================================
  // Resilience Methods (Circuit Breaker + Retry)
  // ============================================================================

  /**
   * Execute a request with retry logic and circuit breaker
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    // Check circuit breaker
    this.checkCircuitBreaker();

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.onSuccess();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (!this.isRetryable(lastError)) {
          this.onFailure();
          throw lastError;
        }

        // Log retry attempt
        this.log(`Attempt ${attempt}/${this.maxRetries} failed for ${context}: ${lastError.message}`);

        // Don't wait after the last attempt
        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          this.log(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.onFailure();
    throw lastError || new UmbracoConnectionError(`All ${this.maxRetries} attempts failed for ${context}`);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: Error): boolean {
    // Don't retry validation errors (400, 422)
    if (error instanceof UmbracoValidationError) {
      return false;
    }

    // Don't retry auth errors (401, 403)
    if (error.message.includes('401') || error.message.includes('403')) {
      return false;
    }

    // Retry rate limit errors (429) - they have built-in retry-after
    if (error instanceof UmbracoRateLimitError) {
      return true;
    }

    // Retry connection errors
    if (error instanceof UmbracoConnectionError) {
      return true;
    }

    // Retry 5xx errors
    if (error instanceof UmbracoComposeError && error.statusCode && error.statusCode >= 500) {
      return true;
    }

    // Default: don't retry
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    // Base delay: 1000ms, doubles with each attempt: 1s -> 2s -> 4s -> 8s
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Check circuit breaker state before request
   */
  private checkCircuitBreaker(): void {
    const now = Date.now();

    if (this.circuitState === 'open') {
      // Check if we should try half-open
      if (now - this.lastFailureTime >= this.circuitConfig.resetTimeout) {
        this.log('Circuit breaker: transitioning to half-open');
        this.circuitState = 'half-open';
      } else {
        throw new UmbracoConnectionError(
          'Circuit breaker is open. Too many consecutive failures. ' +
          `Retry after ${Math.ceil((this.circuitConfig.resetTimeout - (now - this.lastFailureTime)) / 1000)}s`
        );
      }
    }
  }

  /**
   * Record successful request
   */
  private onSuccess(): void {
    if (this.circuitState !== 'closed') {
      this.log('Circuit breaker: closing after successful request');
    }
    this.failureCount = 0;
    this.circuitState = 'closed';
  }

  /**
   * Record failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.log(`Circuit breaker: opening after ${this.failureCount} consecutive failures`);
      this.circuitState = 'open';
    }
  }

  /**
   * Get current circuit breaker state (for monitoring)
   */
  getCircuitState(): { state: CircuitState; failureCount: number } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
    };
  }

  /**
   * Reset circuit breaker manually (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
