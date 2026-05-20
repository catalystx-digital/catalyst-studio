import { ICMSProvider, UniversalContentType, UniversalContentItem } from '../types';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import fetch from 'node-fetch';
import type {
  ContentTypeExport,
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  UnifiedBundleSyncOptions,
  CompiledTypeIndex
} from '@/lib/services/export/types';
import { buildUniversalContentType } from '@/lib/services/export/helpers/content-type-builder';
import { formatUnifiedBundleSyncResult } from '@/lib/cms-export/helpers/unified-bundle-result';

type ContentfulField = {
  id: string;
  name: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  validations?: any[];
  linkType?: string;
  items?: any;
  disabled?: boolean;
};

type ContentfulContentType = {
  sys?: { id?: string; version?: number; publishedVersion?: number };
  name: string;
  description?: string;
  fields: ContentfulField[];
};

type ProviderConfig = {
  apiKey?: string; // CMA token
  workspace?: string; // spaceId
  environment?: string; // environmentId
  locale?: string; // default locale (e.g., en-US)
};

class ContentfulClient {
  private spaceId?: string;
  private environmentId?: string;
  private token?: string;
  private baseUrl = 'https://api.contentful.com';

  configure(cfg: ProviderConfig) {
    if (cfg.workspace) this.spaceId = cfg.workspace;
    if (cfg.environment) this.environmentId = cfg.environment;
    if (cfg.apiKey) this.token = cfg.apiKey;
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    if (!this.spaceId || !this.environmentId || !this.token) {
      throw new Error('ContentfulClient not configured (spaceId, environmentId, apiKey required)');
    }
    const url = `${this.baseUrl}/spaces/${this.spaceId}/environments/${this.environmentId}${path}`;
    let attempt = 0;
    while (true) {
      const res = await fetch(url as any, {
        ...init,
        headers: {
          Accept: 'application/vnd.contentful.management.v1+json',
          Authorization: `Bearer ${this.token}`,
          ...(init.body ? { 'Content-Type': 'application/vnd.contentful.management.v1+json' } : {}),
          ...(init.headers as any),
        },
      } as any);
      if (res.status === 429) {
        const reset = Number(res.headers.get('x-contentful-ratelimit-reset')) || 0;
        const waitMs = Math.max(150, reset * 1000);
        await new Promise((r) => setTimeout(r, waitMs));
        attempt++;
        if (attempt > 4) throw new Error(`429 Too Many Requests on ${init.method || 'GET'} ${path}`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        if (res.status >= 500 && res.status < 600 && attempt < 4) {
          await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
          attempt++;
          continue;
        }
        throw new Error(`${init.method || 'GET'} ${path} failed: ${res.status} ${text.substring(0, 400)}`);
      }
      if (res.status === 204) return { status: 204 };
      return res.json();
    }
  }

  getContentType(id: string) {
    return this.request(`/content_types/${id}`);
  }

  createOrUpdateContentType(def: ContentfulContentType & { sys?: { id: string } }, version?: number) {
    const headers = version !== undefined ? { 'X-Contentful-Version': String(version) } : undefined;
    return this.request(`/content_types/${def.sys?.id}`, { method: 'PUT', body: JSON.stringify(def), headers });
  }

  publishContentType(id: string, version: number) {
    return this.request(`/content_types/${id}/published`, { method: 'PUT', headers: { 'X-Contentful-Version': String(version) } });
  }

  createEntry(contentTypeId: string, fields: any) {
    return this.request(`/entries`, {
      method: 'POST',
      headers: { 'X-Contentful-Content-Type': contentTypeId },
      body: JSON.stringify({ fields }),
    });
  }

  updateEntry(entryId: string, version: number, fields: any) {
    return this.request(`/entries/${entryId}`, {
      method: 'PUT',
      headers: { 'X-Contentful-Version': String(version) },
      body: JSON.stringify({ fields }),
    });
  }

  publishEntry(entryId: string, version: number) {
    return this.request(`/entries/${entryId}/published`, {
      method: 'PUT',
      headers: { 'X-Contentful-Version': String(version) },
    });
  }

  getEntry(entryId: string) {
    return this.request(`/entries/${entryId}`);
  }

  upsertEntry(entryId: string, contentTypeId: string, fields: any, version?: number) {
    const headers: Record<string, string> = { 'X-Contentful-Content-Type': contentTypeId };
    if (typeof version === 'number') headers['X-Contentful-Version'] = String(version);
    return this.request(`/entries/${entryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ fields }),
    });
  }

  createAsset(payload: any) {
    return this.request(`/assets`, { method: 'POST', body: JSON.stringify(payload) });
  }

  processAsset(assetId: string, locale: string) {
    return this.request(`/assets/${assetId}/files/${encodeURIComponent(locale)}/process`, { method: 'PUT' });
  }

  publishAsset(assetId: string, version: number) {
    return this.request(`/assets/${assetId}/published`, {
      method: 'PUT',
      headers: { 'X-Contentful-Version': String(version) },
    });
  }

  getAsset(assetId: string) {
    return this.request(`/assets/${assetId}`);
  }
}

export class ContentfulProvider implements ICMSProvider {
  readonly id = 'contentful';

  private client = new ContentfulClient();
  private defaultLocale = process.env.CONTENTFUL_DEFAULT_LOCALE || 'en-US';
  private contentTypeCache = new Map<string, ContentfulContentType>();
  private contentTypeMapping = new Map<string, string>();
  private assetCache = new Map<string, string>();
  private compiledIndex?: CompiledTypeIndex;

  // Allow UI to pass CMA token + space/environment stored in browser
  configure(config: ProviderConfig) {
    this.client.configure(config);
    if (config.locale) {
      this.defaultLocale = config.locale;
    }
  }

  getCompiledTypeSupport() {
    return {
      compile: (contentTypes: ContentTypeExport[]) => {
        const byKey: Record<string, { universal: UniversalContentType; native: ReturnType<ContentfulProvider['mapTypeFromUniversal']> }> = {};
        const all = contentTypes.map((ct) => {
          const universal = buildUniversalContentType(ct as ContentTypeExport);
          const native = this.mapTypeFromUniversal(universal);
          const fields = (universal.fields || []).map(field => ({
            name: field.id || field.name,
            valueType: field.type,
          }));
          byKey[universal.id] = { universal, native };
          return {
            key: universal.id,
            name: universal.name,
            baseType: universal.type,
            fields,
          };
        });
        const compiled: CompiledTypeIndex = { byKey, all };
        this.compiledIndex = compiled;
        return compiled;
      },
      configure: async (compiled: CompiledTypeIndex) => {
        this.compiledIndex = compiled;
      },
      ensure: async (compiled: CompiledTypeIndex) => {
        const entries = Array.isArray(compiled?.all) ? compiled.all : [];
        for (const entry of entries) {
          const record = (compiled.byKey as Record<string, { universal: UniversalContentType; native: ReturnType<ContentfulProvider['mapTypeFromUniversal']> }>)[entry.key];
          if (!record) continue;
          const { universal, native } = record;
          try {
            let existing: ContentfulContentType | null = null;
            try {
              existing = await this.client.getContentType(native.sys!.id!);
            } catch (err) {
              if (!(err instanceof Error && /404/.test(err.message))) {
                throw err;
              }
            }

            const created = await this.client.createOrUpdateContentType(native, existing?.sys?.version);
            const target = created ?? (await this.client.getContentType(native.sys!.id!));
            const version = target?.sys?.version ?? existing?.sys?.version ?? 1;
            await this.client.publishContentType(native.sys!.id!, version);

            this.contentTypeCache.set(native.sys!.id!, target as ContentfulContentType);

            try {
              const meta = (universal.metadata ?? {}) as unknown as Record<string, unknown>;
              const dbId = meta?.databaseId as string | undefined;
              if (dbId) this.contentTypeMapping.set(String(dbId), native.sys!.id!);
              if (meta?.originalKey) this.contentTypeMapping.set(String(meta.originalKey), native.sys!.id!);
              this.contentTypeMapping.set(universal.id, native.sys!.id!);
              this.contentTypeMapping.set(native.sys!.id!, native.sys!.id!);
            } catch {}
          } catch (error) {
            console.error('[ContentfulProvider] Failed to ensure content type', {
              key: entry.key,
              error: error instanceof Error ? error.message : error,
            });
            throw error;
          }
        }
      },
      registerContentTypeMapping: (dbId: string, safeKey: string, _baseType: '_page' | '_component') => {
        this.registerContentTypeMapping(dbId, safeKey);
      }
    };
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    try {
      const ct = (await this.client.getContentType(id)) as ContentfulContentType;
      const universal = this.mapTypeToUniversal(ct, id);
      try {
        this.contentTypeMapping.set(universal.id, universal.id);
      } catch {}
      return universal;
    } catch (e) {
      if (e instanceof Error && /404/.test(e.message)) {
        return null;
      }
      throw e;
    }
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    const native = this.mapTypeFromUniversal(type);
    let existing: any = null;
    try {
      existing = await this.client.getContentType(native.sys!.id!);
    } catch (err) {
      if (!(err instanceof Error && /404/.test(err.message))) {
        throw err;
      }
    }

    const created = await this.client.createOrUpdateContentType(native, existing?.sys?.version);
    const target = created ?? (await this.client.getContentType(native.sys!.id!));
    const version = target?.sys?.version ?? existing?.sys?.version ?? 1;
    await this.client.publishContentType(native.sys!.id!, version);

    this.contentTypeCache.set(native.sys!.id!, target as ContentfulContentType);

    try {
      const meta = (type.metadata ?? {}) as unknown as Record<string, unknown>;
      const dbId = meta?.databaseId as string | undefined;
      if (dbId) this.contentTypeMapping.set(String(dbId), native.sys!.id!);
      if (meta?.originalKey) this.contentTypeMapping.set(String(meta.originalKey), native.sys!.id!);
      this.contentTypeMapping.set(native.sys!.id!, native.sys!.id!);
    } catch {}

    return this.mapTypeToUniversal(target as ContentfulContentType, native.sys!.id!);
  }

  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    _options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult> {
    const batchResult = await this.processBatchUnifiedContent(bundle.unifiedContent);
    return formatUnifiedBundleSyncResult(this.id, batchResult);
  }

  async processBatchUnifiedContent(unifiedItems: UnifiedContent[]): Promise<{ successful: UniversalContentItem[]; failed: { item: UnifiedContent; error: string }[] }> {
    const successful: UniversalContentItem[] = [];
    const failed: { item: UnifiedContent; error: string }[] = [];

    if (!Array.isArray(unifiedItems) || unifiedItems.length === 0) {
      return { successful, failed };
    }

    const ordered = this.sortUnifiedItems(unifiedItems);
    const entryIdMap = new Map<string, string>();

    for (const item of ordered) {
      try {
        const contentTypeKey = this.resolveContentTypeKey(item);
        if (!contentTypeKey) {
          throw new Error(`No Contentful content type mapping for ${item.contentTypeId}`);
        }

        this.contentTypeMapping.set(contentTypeKey, contentTypeKey);
        const originalTypeId = (item.metadata as any)?.originalContentTypeId || item.contentTypeId;
        if (originalTypeId) {
          this.contentTypeMapping.set(String(originalTypeId), contentTypeKey);
        }

        const contentType = await this.getCachedContentType(contentTypeKey);
        const { entryFields, rawFields } = await this.buildEntryPayload(contentType, item, entryIdMap);
        if (Object.keys(entryFields).length === 0) {
          throw new Error(`No fields mapped for ${item.id}`);
        }

        const entryId = this.sanitizeEntryId(item.id || `${contentTypeKey}-${Date.now()}`);
        const existing = await this.getExistingEntry(entryId);
        const saved = await this.client.upsertEntry(entryId, contentTypeKey, entryFields, existing?.sys?.version);
        const publishVersion = saved?.sys?.version ?? existing?.sys?.version ?? 1;
        const published = await this.client.publishEntry(entryId, publishVersion);

        entryIdMap.set(String(item.id), entryId);
        const universal = this.mapEntryToUniversalItem(item, published, rawFields, contentTypeKey, entryId, entryIdMap);
        successful.push(universal);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ item, error: message });
      }
    }

    return { successful, failed };
  }



  registerContentTypeMapping(originalId?: string, key?: string) {
    if (!originalId || !key) return;
    this.contentTypeMapping.set(String(originalId), key);
    this.contentTypeMapping.set(key, key);
  }


  private sanitizeFieldId(raw: string, fallbackIndex: number): string {
    let s = (raw || '').toString().trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) s = `field_${fallbackIndex}`;
    if (/^[0-9]/.test(s)) s = `f_${s}`;
    if (s.length > 60) s = s.slice(0, 60);
    return s;
  }

  private normalizeUniversalFieldType(raw?: string): string {
    const type = (raw || '').toString().trim().toLowerCase();
    switch (type) {
      case 'text':
      case 'string':
      case 'shorttext':
        return 'text';
      case 'textarea':
      case 'longtext':
        return 'longText';
      case 'richtext':
      case 'rich_text':
      case 'wysiwyg':
      case 'markdown':
        return 'richText';
      case 'number':
      case 'integer':
        return 'number';
      case 'decimal':
      case 'float':
      case 'double':
        return 'decimal';
      case 'boolean':
      case 'checkbox':
        return 'boolean';
      case 'date':
      case 'datetime':
        return 'date';
      case 'json':
      case 'object':
        return 'json';
      case 'media':
      case 'image':
      case 'asset':
      case 'file':
        return 'media';
      case 'reference':
      case 'component':
      case 'entry':
      case 'link':
        return 'component';
      case 'repeater':
      case 'list':
      case 'array':
        return 'repeater';
      case 'tags':
      case 'multiselect':
      case 'multi-select':
      case 'multi_select':
        return 'collection';
      case 'select':
      case 'dropdown':
        return 'text';
      case 'slug':
        return 'slug';
      default:
        return 'text';
    }
  }

  private inferLayerFromUniversalFieldType(type: string): 'primitive' | 'common' | 'extension' {
    switch (type) {
      case 'text':
      case 'longText':
      case 'number':
      case 'decimal':
      case 'boolean':
      case 'date':
      case 'json':
        return 'primitive';
      case 'richText':
      case 'media':
      case 'collection':
      case 'component':
      case 'repeater':
        return 'common';
      default:
        return 'common';
    }
  }

  private async buildEntryPayload(
    contentType: ContentfulContentType,
    item: UnifiedContent,
    entryIdMap: Map<string, string>
  ): Promise<{ entryFields: Record<string, any>; rawFields: Record<string, unknown> }> {
    const entryFields: Record<string, any> = {};
    const rawFields: Record<string, unknown> = {};

    const content = this.cloneData(item.content);
    const metadata = this.cloneData(item.metadata);
    const templateProps = this.cloneData(item.templateProps);
    const contentLookup = this.buildNormalizedLookup(content);
    const metadataLookup = this.buildNormalizedLookup(metadata);
    const templatePropsLookup = this.buildNormalizedLookup(templateProps);
    const slug = this.generateSlug(item);

    for (const field of contentType.fields || []) {
      const candidates = this.buildFieldCandidates(field);
      let value = this.pickValue(candidates, content, contentLookup);
      if (value === undefined) {
        value = this.pickValue(candidates, metadata, metadataLookup);
      }
      if (value === undefined) {
        value = this.pickValue(candidates, templateProps, templatePropsLookup);
      }
      const fallbackValue = this.applyFieldFallback(field, value, item, slug, entryIdMap);
      if (fallbackValue === undefined || fallbackValue === null) continue;

      const prepared = await this.prepareFieldValue(field, fallbackValue, entryIdMap);
      if (!prepared) continue;

      entryFields[field.id] = { [this.defaultLocale]: prepared.formatted };
      rawFields[this.canonicalFieldName(field)] = prepared.raw;
    }

    return { entryFields, rawFields };
  }

  private buildFieldCandidates(field: ContentfulField): string[] {
    const candidates = new Set<string>();
    const push = (val?: string) => {
      if (!val) return;
      candidates.add(val);
    };
    push(field.id);
    push(field.name);
    if (field.id?.startsWith('field_')) push(field.id.replace(/^field_/, ''));
    if (field.id) {
      const withoutSuffix = field.id.replace(/^field_/, '').replace(/_[0-9]+.*$/, '');
      push(withoutSuffix);
    }
    return Array.from(candidates);
  }

  private pickValue(candidates: string[], source: any, lookup: Map<string, string>) {
    if (!source || typeof source !== 'object') return undefined;
    for (const candidate of candidates) {
      const key = lookup.get(this.normalizeKey(candidate));
      if (key && Object.prototype.hasOwnProperty.call(source, key)) {
        const val = (source as any)[key];
        if (val !== undefined) return val;
      }
    }
    return undefined;
  }

  private applyFieldFallback(
    field: ContentfulField,
    value: unknown,
    item: UnifiedContent,
    slug: string,
    entryIdMap: Map<string, string>
  ) {
    if (value !== undefined && value !== null) return value;
    const normalized = this.normalizeKey(this.canonicalFieldName(field));
    switch (normalized) {
      case 'title':
        return item.title;
      case 'slug':
        return slug;
      case 'status':
        return item.status;
      case 'url':
        return item.url;
      case 'templatekey':
        return item.templateKey ?? value;
      case 'templateprops':
        return item.templateProps ?? value ?? null;
      case 'parentpage':
      case 'parent':
        return item.parentId ? entryIdMap.get(item.parentId) : undefined;
      default:
        return value;
    }
  }

  private async prepareFieldValue(
    field: ContentfulField,
    rawValue: any,
    entryIdMap: Map<string, string>
  ): Promise<{ formatted: any; raw: any } | null> {
    const type = (field.type || '').toLowerCase();

    const coerceString = (input: any) => {
      if (input === undefined || input === null) return '';
      if (typeof input === 'string') return input;
      return Array.isArray(input) || typeof input === 'object' ? JSON.stringify(input) : String(input);
    };

    if (rawValue === undefined || rawValue === null) {
      return null;
    }

    switch (type) {
      case 'symbol':
      case 'text':
        return { formatted: coerceString(rawValue), raw: coerceString(rawValue) };
      case 'richtext': {
        if (typeof rawValue === 'object' && rawValue?.nodeType) {
          return { formatted: rawValue, raw: rawValue };
        }
        const text = coerceString(rawValue);
        const richText = {
          nodeType: 'document',
          data: {},
          content: [
            {
              nodeType: 'paragraph',
              data: {},
              content: [
                {
                  nodeType: 'text',
                  value: text,
                  marks: [],
                  data: {},
                },
              ],
            },
          ],
        };
        return { formatted: richText, raw: text };
      }
      case 'integer':
        return { formatted: Number.parseInt(rawValue, 10), raw: Number.parseInt(rawValue, 10) };
      case 'number':
        return { formatted: Number(rawValue), raw: Number(rawValue) };
      case 'boolean':
        return { formatted: Boolean(rawValue), raw: Boolean(rawValue) };
      case 'date': {
        const date = new Date(rawValue);
        const iso = Number.isNaN(date.valueOf()) ? coerceString(rawValue) : date.toISOString();
        return { formatted: iso, raw: iso };
      }
      case 'object':
        return { formatted: rawValue, raw: rawValue };
      case 'link': {
        if (field.linkType === 'Entry') {
          const linkId = typeof rawValue === 'string' ? rawValue : rawValue?.sys?.id;
          const resolved = linkId && entryIdMap.get(linkId) ? entryIdMap.get(linkId) : linkId;
          if (!resolved) return null;
          const link = { sys: { type: 'Link', linkType: 'Entry', id: resolved } };
          return { formatted: link, raw: resolved };
        }
        if (field.linkType === 'Asset') {
          const url = typeof rawValue === 'string' ? rawValue : rawValue?.url;
          if (!url) return null;
          const assetId = await this.ensureAssetFromUrl(url);
          const link = { sys: { type: 'Link', linkType: 'Asset', id: assetId } };
          return { formatted: link, raw: url };
        }
        return null;
      }
      case 'array': {
        const items = field.items || {};
        if (items.type === 'Link' && items.linkType === 'Entry') {
          const arr = Array.isArray(rawValue) ? rawValue : [rawValue];
          const links = arr
            .map((val) => {
              const linkId = typeof val === 'string' ? val : val?.sys?.id;
              const resolved = linkId && entryIdMap.get(linkId) ? entryIdMap.get(linkId) : linkId;
              return resolved ? { sys: { type: 'Link', linkType: 'Entry', id: resolved } } : null;
            })
            .filter(Boolean);
          if (!links.length) return null;
          return { formatted: links, raw: arr };
        }
        if (items.type === 'Symbol') {
          const source = Array.isArray(rawValue)
            ? rawValue
            : (typeof rawValue === 'string' ? (() => {
                try {
                  const parsed = JSON.parse(rawValue);
                  return Array.isArray(parsed) ? parsed : [rawValue];
                } catch {
                  return [rawValue];
                }
              })() : [rawValue]);
          const arr = source.map((v) => coerceString(v));
          return { formatted: arr, raw: arr };
        }
        return null;
      }
      default:
        return { formatted: rawValue, raw: rawValue };
    }
  }

  private async ensureAssetFromUrl(url: string): Promise<string> {
    if (this.assetCache.has(url)) return this.assetCache.get(url)!;

    const fileName = this.deriveFileName(url);
    const contentType = this.inferMimeType(fileName);
    const title = fileName.replace(/\.[^.]+$/, '') || 'asset';

    const payload = {
      fields: {
        title: { [this.defaultLocale]: title },
        file: {
          [this.defaultLocale]: {
            fileName,
            contentType,
            upload: url,
          },
        },
      },
    };

    const asset = await this.client.createAsset(payload);
    await this.client.processAsset(asset.sys.id, this.defaultLocale);
    const published = await this.waitForAssetPublish(asset.sys.id);
    this.assetCache.set(url, published.sys.id);
    return published.sys.id;
  }

  private async waitForAssetPublish(assetId: string): Promise<any> {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.delay(1500);
      try {
        const asset = await this.client.getAsset(assetId);
        const version = asset?.sys?.version ?? 1;
        try {
          return await this.client.publishAsset(assetId, version);
        } catch (err) {
          if (attempt === maxAttempts - 1) throw err;
        }
      } catch (err) {
        if (attempt === maxAttempts - 1) throw err;
      }
    }
    throw new Error(`Asset ${assetId} processing timeout`);
  }

  private canonicalFieldName(field: ContentfulField): string {
    if (field.name) return field.name;
    if (field.id?.startsWith('field_')) {
      return field.id.replace(/^field_/, '').replace(/_[0-9]+.*$/, '') || field.id;
    }
    return field.id;
  }

  private normalizeKey(raw?: string): string {
    return (raw || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private buildNormalizedLookup(source: Record<string, unknown> | null | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!source || typeof source !== 'object') return map;
    for (const key of Object.keys(source)) {
      map.set(this.normalizeKey(key), key);
    }
    return map;
  }

  private sanitizeEntryId(raw: string): string {
    let sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '-');
    sanitized = sanitized.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (!sanitized) sanitized = `entry-${Date.now()}`;
    if (sanitized.length > 60) sanitized = sanitized.slice(0, 60);
    return sanitized;
  }

  private sanitizeKey(raw: string): string {
    let key = (raw || '').toString().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (/^[0-9]/.test(key)) key = `t_${key}`;
    return key || 'content';
  }

  private resolveContentTypeKey(item: UnifiedContent): string {
    const direct = this.contentTypeMapping.get(item.contentTypeId);
    if (direct) return direct;
    const sanitized = this.sanitizeKey(item.contentTypeId);
    const fallback = this.contentTypeMapping.get(sanitized);
    if (fallback) return fallback;
    return sanitized;
  }

  private async getCachedContentType(id: string): Promise<ContentfulContentType> {
    if (this.contentTypeCache.has(id)) return this.contentTypeCache.get(id)!;
    const ct = await this.client.getContentType(id);
    if (!ct) throw new Error(`Content type not found: ${id}`);
    this.contentTypeCache.set(id, ct);
    return ct;
  }

  private async getExistingEntry(entryId: string): Promise<any | null> {
    try {
      return await this.client.getEntry(entryId);
    } catch (err) {
      if (err instanceof Error && /404/.test(err.message)) {
        return null;
      }
      throw err;
    }
  }

  private sortUnifiedItems(unifiedItems: UnifiedContent[]): UnifiedContent[] {
    const weight = (item: UnifiedContent) => {
      switch (item.type) {
        case 'folder':
          return 0;
        case 'page':
          return 1;
        default:
          return 2;
      }
    };
    const depth = (item: UnifiedContent) => {
      if (item.url) {
        return item.url.split('/').filter(Boolean).length;
      }
      return item.parentId ? 1 : 0;
    };
    return [...unifiedItems].sort((a, b) => {
      const w = weight(a) - weight(b);
      if (w !== 0) return w;
      const d = depth(a) - depth(b);
      if (d !== 0) return d;
      return (a.title || '').localeCompare(b.title || '');
    });
  }

  private mapEntryToUniversalItem(
    item: UnifiedContent,
    entry: any,
    rawFields: Record<string, unknown>,
    contentTypeKey: string,
    entryId: string,
    entryIdMap: Map<string, string>
  ): UniversalContentItem {
    const slug = this.generateSlug(item);
    const metadata = this.cloneData(item.metadata);
    const relationships = item.parentId
      ? [{ type: 'parent' as const, targetId: entryIdMap.get(item.parentId) || item.parentId }]
      : undefined;

    return {
      id: entry?.sys?.id || entryId,
      contentTypeId: contentTypeKey,
      name: item.title || slug,
      title: item.title || slug,
      slug,
      content: this.cloneData(item.content),
      contentType: contentTypeKey,
      fields: rawFields,
      parentId: item.parentId,
      language: this.defaultLocale,
      metadata: {
        ...(metadata || {}),
        sourceId: item.id,
        url: item.url,
        originalContentTypeId: item.contentTypeId,
        templateKey: item.templateKey ?? (rawFields.templateKey as string | undefined),
        templateProps: item.templateProps ?? (rawFields.templateProps as Record<string, unknown> | undefined),
      },
      status: 'published',
      relationships,
      publishedAt: new Date(),
      platformSpecific: {
        provider: 'contentful',
        entryVersion: entry?.sys?.version,
      },
    };
  }

  private cloneData<T>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return data;
    }
  }

  private generateSlug(item: UnifiedContent): string {
    if (item.url) {
      const path = item.url.replace(/^\/+/, '').replace(/\/+$/, '');
      if (path) return path;
    }
    const base = item.title || item.id || 'entry';
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'entry';
  }

  private deriveFileName(url: string): string {
    try {
      const parsed = new URL(url);
      const basename = parsed.pathname.split('/').filter(Boolean).pop();
      if (basename) return basename;
    } catch {}
    return `asset-${Date.now()}.dat`;
  }

  private inferMimeType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapTypeToUniversal(ct: ContentfulContentType, idFallback: string): UniversalContentType {
    const id = (ct as any)?.sys?.id || idFallback;
    const fields = (ct.fields || []).map((f) => {
      const layer: 'primitive' | 'common' | 'extension' = this.inferLayer(f);
      const type = this.mapFieldTypeToUniversal(f);
      return {
        id: f.id,
        name: f.name || f.id,
        layer,
        type,
        required: !!f.required,
      } as any;
    });
    const classification: 'page' | 'component' = this.classifyContentType(ct, fields);
    return {
      version: '1.0.0',
      id,
      name: ct.name || id,
      type: classification,
      description: ct.description,
      isRoutable: classification === 'page',
      fields,
      metadata: { createdAt: new Date(), updatedAt: new Date(), platformSpecific: { provider: 'contentful' } },
    };
  }

  private classifyContentType(ct: ContentfulContentType, fields: any[]): 'page' | 'component' {
    if (fields.some((f: any) => {
      const key = this.normalizeKey(f.id);
      return key === 'templatekey' || key === 'templateprops';
    })) {
      return 'page';
    }
    const description = (ct.description || '').toLowerCase();
    const name = (ct.name || '').toLowerCase();
    if (description.includes('[page]') || name.includes('page')) {
      return 'page';
    }
    if (fields.some((f: any) => {
      const key = this.normalizeKey(f.id);
      return key === 'components' || key === 'parentpage';
    })) {
      return 'page';
    }
    return 'component';
  }

  private mapTypeFromUniversal(ut: UniversalContentType): ContentfulContentType & { sys: { id: string } } {
    const fields: ContentfulField[] = ut.fields.map((f) => this.mapFieldFromUniversal(f));
    if (ut.type === 'page') {
      if (!fields.some(field => this.normalizeKey(field.id) === 'templatekey')) {
        fields.push({ id: 'templateKey', name: 'templateKey', type: 'Symbol', localized: false });
      }
      if (!fields.some(field => this.normalizeKey(field.id) === 'templateprops')) {
        fields.push({ id: 'templateProps', name: 'templateProps', type: 'Object', localized: false });
      }
    }
    return {
      sys: { id: ut.id },
      name: ut.name || ut.id,
      description: ut.description,
      fields,
    };
  }

  private inferLayer(f: ContentfulField): 'primitive' | 'common' | 'extension' {
    const t = f.type.toLowerCase();
    if (['symbol', 'text', 'number', 'integer', 'boolean', 'date', 'object'].includes(t)) return 'primitive';
    if (t === 'richtext' || t === 'link' || t === 'array') return 'common';
    return 'extension';
  }

  private mapFieldTypeToUniversal(f: ContentfulField): string {
    switch (f.type) {
      case 'Symbol': return 'text';
      case 'Text': return 'longText';
      case 'RichText': return 'richText';
      case 'Integer': return 'number';
      case 'Number': return 'decimal';
      case 'Boolean': return 'boolean';
      case 'Date': return 'date';
      case 'Object': return 'json';
      case 'Array':
        if (f.items?.type === 'Link' && f.items.linkType === 'Entry') return 'repeater';
        if (f.items?.type === 'Symbol') return 'collection';
        return 'collection';
      case 'Link':
        if (f.linkType === 'Asset') return 'media';
        if (f.linkType === 'Entry') return 'component';
        return 'component';
      default:
        return 'text';
    }
  }

  private mapFieldFromUniversal(f: any): ContentfulField {
    const allowed: string[] | undefined = (f.platformSpecific && (f.platformSpecific.allowedTypes as string[])) || undefined;
    const normalizedType = this.normalizeUniversalFieldType(f.type);
    const withEntryValidation = (base: ContentfulField): ContentfulField => {
      if (allowed && allowed.length > 0) {
        const v = { linkContentType: allowed } as any;
        if (base.type === 'Link' && base.linkType === 'Entry') {
          base.validations = (base.validations || []).concat([v]);
        }
        if (base.type === 'Array' && base.items && base.items.type === 'Link' && base.items.linkType === 'Entry') {
          base.items.validations = (base.items.validations || []).concat([v]);
        }
      }
      return base;
    };
    switch (normalizedType) {
      case 'text':
        return { id: f.id, name: f.name || f.id, type: 'Symbol', localized: true, required: !!f.required };
      case 'longText':
        return { id: f.id, name: f.name || f.id, type: 'Text', localized: true, required: !!f.required };
      case 'richText':
        return { id: f.id, name: f.name || f.id, type: 'RichText', localized: true, required: !!f.required };
      case 'number':
        return { id: f.id, name: f.name || f.id, type: 'Integer', localized: true, required: !!f.required };
      case 'decimal':
        return { id: f.id, name: f.name || f.id, type: 'Number', localized: true, required: !!f.required };
      case 'boolean':
        return { id: f.id, name: f.name || f.id, type: 'Boolean', localized: true, required: !!f.required };
      case 'date':
        return { id: f.id, name: f.name || f.id, type: 'Date', localized: true, required: !!f.required };
      case 'json':
        return { id: f.id, name: f.name || f.id, type: 'Object', localized: true };
      case 'media':
        return { id: f.id, name: f.name || f.id, type: 'Link', linkType: 'Asset', localized: true, required: !!f.required };
      case 'component':
        return withEntryValidation({ id: f.id, name: f.name || f.id, type: 'Link', linkType: 'Entry', localized: true, required: !!f.required });
      case 'repeater':
        return withEntryValidation({ id: f.id, name: f.name || f.id, type: 'Array', localized: true, items: { type: 'Link', linkType: 'Entry' } });
      case 'collection':
        return { id: f.id, name: f.name || f.id, type: 'Array', localized: true, items: { type: 'Symbol' } };
      default:
        return { id: f.id, name: f.name || f.id, type: 'Symbol', localized: true };
    }
  }

  // No POC type creation here; provider only creates types based on universal definitions
}

