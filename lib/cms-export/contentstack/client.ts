import fetch, { type RequestInit, type Response } from 'node-fetch';
import {
  CONTENTSTACK_DEFAULT_BASE_URL,
  CONTENTSTACK_DEFAULT_BRANCH,
  CONTENTSTACK_DEFAULT_ENVIRONMENT,
  CONTENTSTACK_DEFAULT_LOCALE,
} from './constants';
import type {
  ContentstackClientConfig,
  ContentstackContentTypeDefinition,
  ContentstackEntryData,
} from './types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class ContentstackClient {
  private baseUrl: string = CONTENTSTACK_DEFAULT_BASE_URL;
  private stackApiKey?: string;
  private managementToken?: string;
  private environment: string = CONTENTSTACK_DEFAULT_ENVIRONMENT;
  private locale: string = CONTENTSTACK_DEFAULT_LOCALE;
  private branch: string = CONTENTSTACK_DEFAULT_BRANCH;
  private rateLimitMs = 180;
  private maxRetries = 4;

  configure(config: ContentstackClientConfig = {}): void {
    if (config.baseUrl) {
      const normalized = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
      this.baseUrl = normalized || this.baseUrl;
    }
    if (config.stackApiKey) this.stackApiKey = config.stackApiKey;
    if (config.managementToken) this.managementToken = config.managementToken;
    if (config.environment) this.environment = config.environment;
    if (config.locale) this.locale = config.locale.toLowerCase();
    if (config.branch) this.branch = config.branch;
    if (typeof config.rateLimitMs === 'number' && config.rateLimitMs > 0) {
      this.rateLimitMs = config.rateLimitMs;
    }
    if (typeof config.maxRetries === 'number' && config.maxRetries >= 0) {
      this.maxRetries = config.maxRetries;
    }
  }

  getEnvironment(): string {
    return this.environment;
  }

  getLocale(): string {
    return this.locale;
  }

  private ensureCredentials(): void {
    if (!this.stackApiKey || !this.managementToken) {
      throw new Error('ContentstackClient not configured with stackApiKey and managementToken');
    }
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(normalizedPath, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          value.forEach(item => url.searchParams.append(key, this.serializeQueryValue(item)));
          continue;
        }
        url.searchParams.set(key, this.serializeQueryValue(value));
      }
    }
    return url.toString();
  }

  private serializeQueryValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private async request(path: string, options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    raw?: boolean;
  } = {}): Promise<any> {
    this.ensureCredentials();
    const { method = 'GET', body, headers = {}, query, raw = false } = options;
    const url = this.buildUrl(path, query);
    let attempt = 0;

    while (true) {
      const init: RequestInit = {
        method,
        headers: {
          'api_key': this.stackApiKey!,
          'authorization': this.managementToken!,
          'Content-Type': 'application/json',
          ...(this.branch ? { branch: this.branch } : {}),
          ...headers,
        },
      };

      if (body !== undefined) {
        (init as any).body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response: Response = await fetch(url, init as any);

      if (response.status === 429) {
        const resetHeader = response.headers.get('x-ratelimit-reset') || response.headers.get('x-rate-limit-reset');
        const retryAfter = Number(resetHeader) * 1000;
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.max(this.rateLimitMs, retryAfter) : this.rateLimitMs;
        await sleep(waitMs);
        attempt += 1;
        if (attempt > this.maxRetries) {
          throw this.buildError(`429 Too Many Requests after ${attempt} attempts: ${method} ${path}`, response);
        }
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        if (response.status >= 500 && response.status < 600 && attempt < this.maxRetries) {
          await sleep(this.rateLimitMs * Math.pow(2, attempt));
          attempt += 1;
          continue;
        }
        const error = this.buildError(`${method} ${path} failed: ${response.status} ${text.slice(0, 600)}`, response, text);
        throw error;
      }

      if (raw) return response;
      if (response.status === 204) return { status: 204 };
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    }
  }

  private buildError(message: string, response: Response, rawBody?: string): Error {
    const error = new Error(message) as Error & { status?: number; body?: unknown; responseText?: string };
    error.status = response.status;
    const body = rawBody ?? '';
    error.responseText = body;
    try {
      error.body = body ? JSON.parse(body) : undefined;
    } catch {
      error.body = undefined;
    }
    return error;
  }

  async getContentType(uid: string): Promise<any> {
    return this.request(`/content_types/${uid}`);
  }

  async createContentType(definition: ContentstackContentTypeDefinition): Promise<any> {
    return this.request('/content_types', {
      method: 'POST',
      body: { content_type: definition },
    });
  }

  async updateContentType(uid: string, definition: ContentstackContentTypeDefinition & { schema: any[] }): Promise<any> {
    return this.request(`/content_types/${uid}`, {
      method: 'PUT',
      body: { content_type: definition },
    });
  }

  async publishContentType(uid: string): Promise<any> {
    return this.request(`/content_types/${uid}/publish`, {
      method: 'POST',
    });
  }

  async createEntry(contentTypeUid: string, entryUid: string | undefined, data: ContentstackEntryData): Promise<any> {
    const payload = { entry: data };
    return this.request(`/content_types/${contentTypeUid}/entries`, {
      method: 'POST',
      body: entryUid ? { ...payload, entry: { ...data, uid: entryUid } } : payload,
    });
  }

  async updateEntry(contentTypeUid: string, entryUid: string, data: ContentstackEntryData, version?: number): Promise<any> {
    const headers: Record<string, string> = { 'X-Contentstack-Trigger': 'fallback' };
    if (typeof version === 'number') {
      headers['X-Contentstack-Version'] = String(version);
    }
    return this.request(`/content_types/${contentTypeUid}/entries/${entryUid}`, {
      method: 'PUT',
      headers,
      body: { entry: data },
    });
  }

  async publishEntry(contentTypeUid: string, entryUid: string): Promise<any> {
    return this.request(`/content_types/${contentTypeUid}/entries/${entryUid}/publish`, {
      method: 'POST',
      body: {
        entry: {
          environments: [this.environment],
          locales: [this.locale],
        },
      },
    });
  }

  async getEntry(contentTypeUid: string, entryUid: string): Promise<any> {
    return this.request(`/content_types/${contentTypeUid}/entries/${entryUid}`);
  }
}

