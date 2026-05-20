import { DEFAULT_KONTENT_BASE_URL, DEFAULT_LANGUAGE_CODENAME, DEFAULT_MAX_RETRIES, DEFAULT_RATE_LIMIT_MS } from './constants';
import type {
  KontentClientConfig,
  KontentContentItem,
  KontentContentType,
  KontentVariantUpsert,
  KontentItemPayload,
} from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  attempt?: number;
}

interface RequestResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class KontentClient {
  private baseUrl = DEFAULT_KONTENT_BASE_URL;
  private environmentId: string | undefined;
  private apiKey: string | undefined;
  private languageCodename = DEFAULT_LANGUAGE_CODENAME;
  private rateLimitMs = DEFAULT_RATE_LIMIT_MS;
  private maxRetries = DEFAULT_MAX_RETRIES;
  private configured = false;

  constructor(config?: KontentClientConfig) {
    this.configureFromEnv();
    if (config) {
      this.configure(config);
    }
  }

  configure(config: KontentClientConfig = {}): void {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    if (config.environmentId) {
      this.environmentId = config.environmentId;
    }
    if (config.managementApiKey) {
      this.apiKey = config.managementApiKey;
    }
    if (config.languageCodename) {
      this.languageCodename = config.languageCodename;
    }
    if (typeof config.rateLimitMs === 'number' && !Number.isNaN(config.rateLimitMs)) {
      this.rateLimitMs = Math.max(0, config.rateLimitMs);
    }
    if (typeof config.maxRetries === 'number' && config.maxRetries >= 0) {
      this.maxRetries = config.maxRetries;
    }
    this.configured = Boolean(this.environmentId && this.apiKey);
  }

  getLanguageCodename(): string {
    return this.languageCodename || DEFAULT_LANGUAGE_CODENAME;
  }

  private configureFromEnv(): void {
    const environmentId = process.env.KONTENT_ENVIRONMENT_ID;
    const apiKey = process.env.KONTENT_MANAGEMENT_API_KEY;

    if (environmentId) {
      this.environmentId = environmentId;
    }
    if (apiKey) {
      this.apiKey = apiKey;
    }
    if (process.env.KONTENT_LANGUAGE_CODE) {
      this.languageCodename = process.env.KONTENT_LANGUAGE_CODE;
    }
    if (process.env.KONTENT_BASE_URL) {
      this.baseUrl = process.env.KONTENT_BASE_URL;
    }
    if (process.env.KONTENT_RATE_LIMIT_MS) {
      const parsed = Number(process.env.KONTENT_RATE_LIMIT_MS);
      if (!Number.isNaN(parsed)) {
        this.rateLimitMs = Math.max(0, parsed);
      }
    }
    if (process.env.KONTENT_MAX_RETRIES) {
      const parsed = Number(process.env.KONTENT_MAX_RETRIES);
      if (!Number.isNaN(parsed)) {
        this.maxRetries = Math.max(0, parsed);
      }
    }

    this.configured = Boolean(this.environmentId && this.apiKey);
  }

  private ensureConfigured(): void {
    if (!this.environmentId || !this.apiKey) {
      throw new Error('KontentClient requires environmentId and managementApiKey configuration');
    }
  }

  private projectUrl(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/projects/${this.environmentId}${path}`;
  }

  private async request<TResponse = unknown, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {}
  ): Promise<RequestResult<TResponse>> {
    this.ensureConfigured();

    const method = options.method ?? 'GET';
    const attempt = options.attempt ?? 0;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      ...options.headers,
    };

    const body =
      options.body !== undefined
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined;

    if (body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(this.projectUrl(path), {
      method,
      headers,
      body,
    });

    if (response.status === 429 && attempt < this.maxRetries) {
      const retryAfter = Number(response.headers.get('Retry-After') || '1');
      const waitMs = Math.max(250, retryAfter * 1000);
      await sleep(waitMs);
      return this.request(path, { ...options, attempt: attempt + 1 });
    }

    const text = await response.text();

    if (!response.ok) {
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = text;
      }

      const error = new Error(
        `Kontent API ${method} ${path} failed (${response.status}): ${typeof parsed === 'string' ? parsed : text}`
      );
      (error as Error & { status?: number; body?: unknown }).status = response.status;
      (error as Error & { status?: number; body?: unknown }).body = parsed;
      throw error;
    }

    if (this.rateLimitMs > 0) {
      await sleep(this.rateLimitMs);
    }

    if (!text) {
      return { data: undefined as unknown as TResponse, status: response.status, headers: response.headers };
    }

    try {
      return {
        data: JSON.parse(text) as TResponse,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw new Error(`Failed to parse Kontent API response for ${method} ${path}: ${(error as Error).message}`);
    }
  }

  async getContentType(codename: string): Promise<KontentContentType | null> {
    try {
      const { data } = await this.request<KontentContentType>(`/types/codename/${codename}`);
      return data;
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getContentTypeByExternalId(externalId: string): Promise<KontentContentType | null> {
    try {
      const { data } = await this.request<KontentContentType>(`/types/external-id/${externalId}`);
      return data;
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createContentType(definition: KontentContentType): Promise<KontentContentType> {
    try {
      const { data } = await this.request<KontentContentType, KontentContentType>('/types', {
        method: 'POST',
        body: definition,
      });
      return data;
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      const body = (error as Error & {
        body?: { message?: string; validation_errors?: Array<{ message?: string }> };
      }).body;
      const messages = [
        body?.message ?? (error as Error).message,
        ...(body?.validation_errors?.map(v => v.message ?? '') ?? []),
      ].filter(Boolean) as string[];
      const contains = (needle: string) =>
        messages.some(message => message.toLowerCase().includes(needle.toLowerCase()));

      if (status === 400 && contains('codename') && contains('not unique')) {
        const existing = await this.getContentType(definition.codename);
        if (existing) {
          return existing;
        }
      }

      if (status === 400 && contains('external id')) {
        const existingByExternal = definition.external_id
          ? await this.getContentTypeByExternalId(definition.external_id)
          : null;
        if (existingByExternal) {
          return existingByExternal;
        }
      }

      throw error;
    }
  }

  async updateContentType(codename: string, definition: KontentContentType): Promise<KontentContentType> {
    const { data } = await this.request<KontentContentType, KontentContentType>(`/types/codename/${codename}`, {
      method: 'PUT',
      body: definition,
    });
    return data;
  }

  async upsertContentType(definition: KontentContentType): Promise<KontentContentType> {
    const existing = await this.getContentType(definition.codename);
    if (existing) {
      try {
        return await this.updateContentType(definition.codename, definition);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 404) {
          return this.createContentType(definition);
        }
        throw error;
      }
    }
    return this.createContentType(definition);
  }

  async createContentItem(payload: KontentItemPayload): Promise<KontentContentItem> {
    const { data } = await this.request<KontentContentItem, KontentItemPayload>('/items', {
      method: 'POST',
      body: payload,
    });
    return data;
  }

  async getContentItemByCodename(codename: string): Promise<KontentContentItem | null> {
    try {
      const { data } = await this.request<KontentContentItem>(`/items/codename/${codename}`);
      return data;
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async upsertContentItem(payload: KontentItemPayload): Promise<KontentContentItem> {
    const existing = await this.getContentItemByCodename(payload.codename);
    if (existing) {
      // Kontent does not support updating items via PUT; we return existing for id reuse.
      return existing;
    }
    return this.createContentItem(payload);
  }

  async upsertVariant(itemCodename: string, language: string, variant: KontentVariantUpsert): Promise<void> {
    await this.request(`/items/codename/${itemCodename}/variants/codename/${language}`, {
      method: 'PUT',
      body: variant,
    });
  }
}
