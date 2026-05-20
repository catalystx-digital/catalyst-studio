import { ICMSProvider, UniversalContentItem, UniversalContentType } from '../types';
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import type { ContentTypeExport } from '@/lib/services/export/types';
import { buildUniversalContentType } from '@/lib/services/export/helpers/content-type-builder';
import { ContentstackClient } from './client';
import {
  BASE_CONTENT_TYPES,
  CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID,
  CONTENTSTACK_PAGE_CONTENT_TYPE_UID,
  CONTENTSTACK_MEDIA_CONTENT_TYPE_UID,
} from './constants';
import type {
  ContentstackClientConfig,
  ContentstackEntryReference,
  ContentstackContentTypeDefinition,
} from './types';
import type {
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  UnifiedBundleSyncOptions
} from '@/lib/services/export/types';
import { formatUnifiedBundleSyncResult } from '@/lib/cms-export/helpers/unified-bundle-result';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type ContentstackProviderConfig = ContentstackClientConfig;

type EntryUid = string;

const isUniversalContentField = (
  field: unknown
): field is UniversalContentType['fields'][number] => Boolean(field);

export class ContentstackProvider implements ICMSProvider {
  readonly id = 'contentstack';

  private client = new ContentstackClient();
  private configured = false;
  private ensuredBaseTypes = false;
  private componentCache = new Map<string, EntryUid>();
  private pageCache = new Map<string, EntryUid>();
  private typeUidMap = new Map<string, string>();

  constructor(config?: ContentstackProviderConfig) {
    if (config) {
      this.configure(config);
    } else {
      this.configureFromEnv();
    }
  }

  configure(config: ContentstackProviderConfig = {}): void {
    this.client.configure(config);
    this.configured = Boolean(config.stackApiKey && config.managementToken) || this.configured;
  }

  private configureFromEnv(): void {
    const stackApiKey = process.env.CONTENTSTACK_API_KEY;
    const managementToken = process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
    if (stackApiKey && managementToken) {
      this.configure({
        stackApiKey,
        managementToken,
        baseUrl: process.env.CONTENTSTACK_BASE_URL,
        environment: process.env.CONTENTSTACK_ENVIRONMENT,
        locale: process.env.CONTENTSTACK_LOCALE,
        branch: process.env.CONTENTSTACK_BRANCH,
      });
    }
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      this.configureFromEnv();
    }
    if (!this.configured) {
      throw new Error('ContentstackProvider requires stackApiKey and managementToken configuration');
    }
  }

  private sanitizeTypeUid(raw: string): string {
    let value = (raw || '').toString().toLowerCase();
    value = value.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!value) {
      value = `type_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (/^[0-9]/.test(value)) {
      value = `t_${value}`;
    }
    return value.slice(0, 50);
  }

  private sanitizeFieldUid(raw: string, fallback: string): string {
    let value = (raw || '').toString().toLowerCase();
    value = value.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!value) {
      value = fallback;
    }
    if (/^[0-9]/.test(value)) {
      value = `f_${value}`;
    }
    return value.slice(0, 50);
  }

  private ensureUniqueFieldUid(uid: string, used: Set<string>): string {
    let value = uid;
    let counter = 1;
    while (used.has(value)) {
      value = `${uid}_${counter++}`;
    }
    used.add(value);
    return value;
  }

  getCompiledTypeSupport() {
    return {
      compile: (contentTypes: ContentTypeExport[]) => {
        const byKey: Record<string, { universal: UniversalContentType; definition: ContentstackContentTypeDefinition }> = {};
        const all = contentTypes.map((ct) => {
          const universal = buildUniversalContentType(ct);
          const definition = this.mapUniversalTypeToContentstack(universal);
          const fields = (universal.fields || []).map(field => ({
            name: field.id || field.name,
            valueType: field.type,
          }));
          byKey[universal.id] = { universal, definition };
          return {
            key: universal.id,
            name: universal.name,
            baseType: universal.type,
            fields,
          };
        });
        return { byKey, all };
      },
      configure: async () => {
        this.ensureConfigured();
      },
      ensure: async (compiled: any) => {
        this.ensureConfigured();
        await this.ensureBaseContentTypes();
        const entries = Array.isArray(compiled?.all) ? compiled.all : [];
        for (const entry of entries) {
          const record = (compiled.byKey as Record<string, { universal: UniversalContentType; definition: ContentstackContentTypeDefinition }>)[entry.key];
          if (!record) continue;
          const { universal, definition } = record;
          try {
            let exists = false;
            try {
              await this.client.getContentType(definition.uid);
              exists = true;
            } catch (error: any) {
              const notFound = error?.status === 404 || error?.body?.error_code === 118;
              if (!notFound) throw error;
            }

            if (exists) {
              await this.client.updateContentType(definition.uid, { ...definition, schema: definition.schema });
            } else {
              try {
                await this.client.createContentType(definition);
              } catch (error: any) {
                const alreadyExists = error?.status === 422 && (error?.body?.error_message || '').includes('already exists');
                if (!alreadyExists) throw error;
                await this.client.updateContentType(definition.uid, { ...definition, schema: definition.schema });
              }
            }

            await sleep(200);
            await this.client.publishContentType(definition.uid);

            this.typeUidMap.set(universal.id, definition.uid);
            this.typeUidMap.set(definition.uid, definition.uid);
            const dbId = (universal.metadata as any)?.databaseId;
            if (typeof dbId === 'string' && dbId) {
              this.typeUidMap.set(dbId, definition.uid);
            }
          } catch (error) {
            console.error('[ContentstackProvider] Failed to ensure content type', {
              key: entry.key,
              error: error instanceof Error ? error.message : error,
            });
            throw error;
          }
        }
      },
      registerContentTypeMapping: (dbId: string, safeKey: string, baseType: '_page' | '_component') => {
        this.registerContentTypeMapping(dbId, safeKey, baseType);
      }
    };
  }

  private resolveReferenceTargets(field: UniversalContentType['fields'][number]): string[] | undefined {
    const platform = field.platformSpecific as Record<string, unknown> | undefined;
    const allowed = Array.isArray(platform?.allowedTypes)
      ? (platform!.allowedTypes as unknown[])
          .map((value) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
              return undefined;
            }
            const sanitized = this.sanitizeTypeUid(raw);
            const resolved =
              this.typeUidMap.get(raw) ??
              this.typeUidMap.get(raw.toLowerCase()) ??
              this.typeUidMap.get(sanitized);
            return resolved ?? sanitized;
          })
          .filter((value): value is string => Boolean(value))
      : undefined;
    if (allowed && allowed.length > 0) {
      return allowed;
    }
    if (field.type === 'component' || field.type === 'repeater') {
      return [CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID];
    }
    return undefined;
  }

  private mapUniversalFieldToContentstack(
    field: UniversalContentType['fields'][number],
    used: Set<string>
  ): ContentstackContentTypeDefinition['schema'][number] {
    const displayName = field.name || field.id || 'Field';
    const sanitized = this.sanitizeFieldUid(field.id || displayName, 'field');
    const uid = this.ensureUniqueFieldUid(sanitized, used);
    const metadata: Record<string, unknown> = {};
    if (field.description) {
      metadata.description = field.description;
    }
    const platform = field.platformSpecific as Record<string, unknown> | undefined;
    if (platform?.properties) {
      metadata.properties = platform.properties;
    }
    if (Array.isArray(platform?.options) && platform.options.length > 0) {
      metadata.options = platform.options;
    }

    let dataType: ContentstackContentTypeDefinition['schema'][number]['data_type'];
    let multiple: boolean | undefined;
    let referenceTo: string[] | undefined;
    let fieldMetadata: Record<string, unknown> | undefined = Object.keys(metadata).length > 0 ? metadata : undefined;

    switch (field.type) {
      case 'text':
      case 'slug':
        dataType = 'text';
        break;
      case 'longText':
        dataType = 'text';
        fieldMetadata = {
          ...(fieldMetadata || {}),
          display_type: 'multiline',
        };
        break;
      case 'richText':
        dataType = 'rich_text';
        break;
      case 'number':
      case 'decimal':
        dataType = 'number';
        break;
      case 'boolean':
        dataType = 'boolean';
        break;
      case 'date':
        dataType = 'isodate';
        break;
      case 'media':
        dataType = 'file';
        break;
      case 'component':
        dataType = 'reference';
        referenceTo = this.resolveReferenceTargets(field);
        break;
      case 'repeater':
        referenceTo = this.resolveReferenceTargets(field);
        if (referenceTo && referenceTo.length > 0) {
          dataType = 'reference';
          multiple = true;
        } else {
          dataType = 'json';
        }
        break;
      case 'collection':
      case 'tags':
        dataType = 'json';
        break;
      case 'json':
        dataType = 'json';
        break;
      default:
        dataType = 'text';
        break;
    }

    if (dataType === 'reference') {
      fieldMetadata = {
        ...(fieldMetadata || {}),
        ref_type: 'Entry',
        ref_multiple: Boolean(multiple),
      };
    }

    return {
      display_name: displayName,
      uid,
      data_type: dataType,
      mandatory: Boolean(field.required),
      ...(multiple !== undefined ? { multiple } : {}),
      ...(referenceTo && referenceTo.length > 0 ? { reference_to: referenceTo } : {}),
      ...(fieldMetadata ? { field_metadata: fieldMetadata } : {}),
    };
  }

  private mapUniversalTypeToContentstack(type: UniversalContentType): ContentstackContentTypeDefinition {
    const used = new Set<string>();
    const schema = type.fields.map((field) => this.mapUniversalFieldToContentstack(field, used));

    if (!schema.some((field) => field.uid === 'title')) {
      schema.unshift({
        display_name: 'Title',
        uid: this.ensureUniqueFieldUid('title', used),
        data_type: 'text',
        mandatory: true,
      });
    }

    const titleField = schema.find((field) => field.uid === 'title') ?? schema[0];
    const descriptionField = schema.find((field) => field.uid === 'summary' || field.uid === 'description');
    const sanitizedUid = this.sanitizeTypeUid(type.id);

    const options: Record<string, unknown> = {
      is_page: type.type === 'page',
      singleton: false,
      title: titleField.uid,
    };

    if (descriptionField) {
      options.sub_title = [descriptionField.uid];
    }

    if (type.type === 'page') {
      const slugField = schema.find((field) => /slug/.test(field.uid));
      const patternField = slugField?.uid ?? titleField.uid;
      options.url_pattern = `/${sanitizedUid}/{{${patternField}}}`;
      options.url_prefix = `/${sanitizedUid}`;
    }

    return {
      title: type.name || sanitizedUid,
      uid: sanitizedUid,
      description: type.description,
      schema,
      options,
    };
  }

  private mapContentTypeToUniversal(ct: any): UniversalContentType | null {
    if (!ct || !ct.uid) return null;
    const fields = Array.isArray(ct.schema)
      ? ct.schema
          .map((field: any) => this.mapContentstackFieldToUniversal(field))
          .filter(isUniversalContentField)
      : [];
    const typeClass: 'page' | 'component' = ct.options?.is_page ? 'page' : 'component';

    return {
      id: ct.uid,
      name: ct.title || ct.uid,
      description: ct.description || '',
      type: typeClass,
      version: '1.0',
      isRoutable: Boolean(ct.options?.is_page),
      fields,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        platformSpecific: { provider: 'contentstack' },
      } as any,
    } as UniversalContentType;
  }

  private mapContentstackFieldToUniversal(field: any): UniversalContentType['fields'][number] | null {
    if (!field || !field.uid) return null;

    const toUniversalType = (): UniversalContentType['fields'][number]['type'] => {
      switch (field.data_type) {
        case 'text':
          return 'text';
        case 'rich_text':
          return 'richText';
        case 'boolean':
          return 'boolean';
        case 'number':
          return 'number';
        case 'isodate':
          return 'date';
        case 'file':
          return 'media';
        case 'json':
          return 'json';
        case 'reference':
        case 'blocks':
          return field.multiple ? 'repeater' : 'component';
        default:
          return 'text';
      }
    };

    const determineLayer = (value: UniversalContentType['fields'][number]['type']): 'primitive' | 'common' | 'extension' => {
      switch (value) {
        case 'text':
        case 'longText':
        case 'number':
        case 'decimal':
        case 'boolean':
        case 'date':
        case 'json':
          return 'primitive';
        case 'media':
        case 'component':
        case 'repeater':
        case 'collection':
        case 'richText':
          return 'common';
        default:
          return 'extension';
      }
    };

    const type = toUniversalType();
    const platformSpecific: Record<string, unknown> = {};
    if (Array.isArray(field.reference_to) && field.reference_to.length > 0) {
      platformSpecific.allowedTypes = field.reference_to;
    }
    if (field.field_metadata && Object.keys(field.field_metadata).length > 0) {
      platformSpecific.fieldMetadata = field.field_metadata;
    }

    const result: UniversalContentType['fields'][number] = {
      id: field.uid,
      name: field.display_name || field.uid,
      layer: determineLayer(type),
      type,
      description: typeof field.field_metadata?.description === 'string' ? field.field_metadata.description : '',
      required: Boolean(field.mandatory),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    };

    if (Object.keys(platformSpecific).length > 0) {
      result.platformSpecific = platformSpecific;
    }

    return result;
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    try {
      const response = await this.client.getContentType(id);
      if (!response || !response.content_type) return null;
      const ct = response.content_type;
      const universal = this.mapContentTypeToUniversal(ct);
      if (universal) {
        this.typeUidMap.set(universal.id, ct.uid);
        const dbId = (universal.metadata as any)?.databaseId;
        if (typeof dbId === 'string' && dbId) {
          this.typeUidMap.set(dbId, ct.uid);
        }
        return universal;
      }
      return null;
    } catch (error: any) {
      if (error?.status === 404) return null;
      if (error?.status === 422 && (error?.body?.error_code === 118 || error?.body?.error_code === 141)) return null;
      throw error;
    }
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    this.ensureConfigured();
    await this.ensureBaseContentTypes();
    const definition = this.mapUniversalTypeToContentstack(type);

    try {
      await this.client.createContentType(definition);
      await sleep(200);
    } catch (error: any) {
      const alreadyExists = error?.status === 422 && (error?.body?.error_message || '').includes('already exists');
      if (!alreadyExists) {
        throw error;
      }
    }

    this.typeUidMap.set(type.id, definition.uid);
    this.typeUidMap.set(definition.uid, definition.uid);
    const dbId = (type.metadata as any)?.databaseId;
    if (typeof dbId === 'string' && dbId) {
      this.typeUidMap.set(dbId, definition.uid);
    }

    return type;
  }

  registerContentTypeMapping(dbId: string, safeKey: string, baseType?: '_page' | '_component'): void {
    if (dbId) {
      this.typeUidMap.set(dbId, safeKey);
    }
    this.typeUidMap.set(safeKey, safeKey);
  }

  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    _options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult> {
    const batchResult = await this.processBatchUnifiedContent(bundle.unifiedContent);
    return formatUnifiedBundleSyncResult(this.id, batchResult);
  }

  async processBatchUnifiedContent(unifiedItems: UnifiedContent[]): Promise<{
    successful: UniversalContentItem[];
    failed: { item: UnifiedContent; error: string }[];
  }> {
    this.ensureConfigured();
    await this.ensureBaseContentTypes();

    const successful: UniversalContentItem[] = [];
    const failed: { item: UnifiedContent; error: string }[] = [];

    if (!Array.isArray(unifiedItems) || unifiedItems.length === 0) {
      return { successful, failed };
    }

    const pages = this.sortPages(unifiedItems.filter(item => item.type === 'page'));

    for (const page of pages) {
      try {
        const entry = await this.upsertPage(page);
        successful.push(this.mapPageToUniversal(page, entry));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ item: page, error: message });
      }
    }

    return { successful, failed };
  }

  private async ensureBaseContentTypes(): Promise<void> {
    if (this.ensuredBaseTypes) return;
    for (const def of BASE_CONTENT_TYPES) {
      try {
        await this.client.getContentType(def.uid);
      } catch (error: any) {
        const notFound = error?.status === 404 || error?.body?.error_code === 118;
        if (!notFound) throw error;
        await this.client.createContentType(def as any);
        await sleep(200);
      }
    }
    this.ensuredBaseTypes = true;
  }

  private sortPages(pages: UnifiedContent[]): UnifiedContent[] {
    const copy = [...pages];
    copy.sort((a, b) => {
      const depthA = this.estimateDepth(a);
      const depthB = this.estimateDepth(b);
      if (depthA !== depthB) return depthA - depthB;
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
    return copy;
  }

  private estimateDepth(item: UnifiedContent): number {
    if (typeof item.metadata?.pathDepth === 'number') {
      return item.metadata.pathDepth;
    }
    if (item.url) {
      const trimmed = item.url.replace(/^[#\/]+|[#\/]+$/g, '');
      return trimmed ? trimmed.split('/').length : 0;
    }
    return item.parentId ? 1 : 0;
  }

  private async upsertPage(item: UnifiedContent): Promise<any> {
    const entryUid = this.resolvePageUid(item);
    const payload = this.buildPagePayload(item);
    payload.components = await this.buildComponentGroups(item);

    const existing = await this.safeGetEntry(CONTENTSTACK_PAGE_CONTENT_TYPE_UID, entryUid);
    let saved: any;
    if (existing) {
      const version = this.extractVersion(existing);
      saved = await this.client.updateEntry(CONTENTSTACK_PAGE_CONTENT_TYPE_UID, entryUid, {
        ...payload,
        uid: entryUid,
      }, version);
    } else {
      saved = await this.client.createEntry(CONTENTSTACK_PAGE_CONTENT_TYPE_UID, entryUid, {
        ...payload,
        uid: entryUid,
      });
    }

    const entry = this.normalizeEntry(saved);
    await this.publishSafely(CONTENTSTACK_PAGE_CONTENT_TYPE_UID, entry.uid);
    this.pageCache.set(item.id, entry.uid);
    return entry;
  }

  private buildPagePayload(item: UnifiedContent): Record<string, unknown> {
    const slug = this.resolveSlug(item);
    const rawTemplateKey = typeof item.templateKey === 'string' && item.templateKey.trim()
      ? item.templateKey.trim()
      : undefined;
    let resolvedTemplateKey: string | undefined;
    if (rawTemplateKey) {
      const sanitized = this.sanitizeTypeUid(rawTemplateKey);
      resolvedTemplateKey = this.typeUidMap.get(rawTemplateKey)
        || this.typeUidMap.get(sanitized)
        || sanitized;
    }

    const payload: Record<string, unknown> = {
      locale: this.client.getLocale(),
      title: item.title || slug,
      slug,
      url: item.url || undefined,
      summary: this.extractSummary(item),
      content_json: this.serializeJson(item.content),
      metadata: this.serializeJson(item.metadata),
      template_key: resolvedTemplateKey,
      template_props: this.serializeJson(item.templateProps),
    };

    const parentUid = item.parentId ? this.pageCache.get(item.parentId) : undefined;
    if (parentUid) {
      payload.parent = this.toReferenceArray(parentUid, CONTENTSTACK_PAGE_CONTENT_TYPE_UID);
    }

    return this.stripUndefined(payload);
  }

  private extractSummary(item: UnifiedContent): string | undefined {
    if (!item.metadata) return undefined;
    if (typeof item.metadata.summary === 'string') return item.metadata.summary;
    if (typeof item.metadata.description === 'string') return item.metadata.description;
    return undefined;
  }

  private async buildComponentGroups(item: UnifiedContent): Promise<Array<Record<string, unknown>>> {
    const components = Array.isArray(item.components) ? item.components : [];
    const groups: Array<Record<string, unknown>> = [];

    for (let index = 0; index < components.length; index += 1) {
      const component = components[index] as any;
      try {
        const entry = await this.ensureComponentEntry(component, item, index);
        groups.push({
          display_option: this.resolveDisplayOption(component, index),
          block: this.toReferenceArray(entry.uid, CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Component export failed for page '${item.title || item.id}' (component index ${index}): ${message}`);
      }
    }

    return groups;
  }

  private async ensureComponentEntry(component: any, page: UnifiedContent, index: number): Promise<{ uid: string }> {
    const cacheKey = this.buildComponentCacheKey(component, page, index);
    const cached = this.componentCache.get(cacheKey);
    if (cached) {
      return { uid: cached };
    }

    const entryUid = this.resolveComponentUid(component, page, index);
    const payload = this.buildComponentPayload(component, page, index);

    const existing = await this.safeGetEntry(CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID, entryUid);
    let saved: any;
    if (existing) {
      const version = this.extractVersion(existing);
      saved = await this.client.updateEntry(CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID, entryUid, {
        ...payload,
        uid: entryUid,
      }, version);
    } else {
      saved = await this.client.createEntry(CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID, entryUid, {
        ...payload,
        uid: entryUid,
      });
    }

    const entry = this.normalizeEntry(saved);
    await this.publishSafely(CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID, entry.uid);
    this.componentCache.set(cacheKey, entry.uid);
    return entry;
  }

  private buildComponentPayload(component: any, page: UnifiedContent, index: number): Record<string, unknown> {
    const localOnlyFlag = this.resolveLocalOnly(component);
    const sharedId = this.resolveSharedId(component);
    const metadata = {
      isShared: Boolean(component?.isShared),
      sharedId,
      pageId: page.id,
      position: component?.position ?? index,
      hasOverrides: Boolean(component?.hasOverrides),
    };

    const payload: Record<string, unknown> = {
      locale: this.client.getLocale(),
      title: this.resolveComponentTitle(component, page, index),
      component_type: String(component?.type || 'component'),
      local_only: localOnlyFlag,
      shared_id: sharedId || undefined,
      properties: this.serializeJson(component?.properties),
      metadata: this.serializeJson(metadata),
      position: component?.position ?? index,
    };

    return this.stripUndefined(payload);
  }

  private resolveComponentTitle(component: any, page: UnifiedContent, index: number): string {
    if (typeof component?.name === 'string' && component.name.trim()) return component.name;
    if (typeof component?.title === 'string' && component.title.trim()) return component.title;
    if (component?.properties && typeof component.properties === 'object') {
      const propTitle = (component.properties as any).title;
      if (typeof propTitle === 'string' && propTitle.trim()) {
        return propTitle;
      }
    }
    const base = component?.type ? String(component.type) : 'component';
    return `${base}-${index + 1}-of-${this.sanitizeUid(page.id || page.title || 'page', 'page')}`;
  }

  private resolveDisplayOption(component: any, index: number): string | undefined {
    const props = component?.properties || {};
    const candidates = [
      props.displayOption,
      props.display_option,
      props.display,
      props.variant,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return index % 3 === 0 ? 'full' : index % 3 === 1 ? 'half' : 'default';
  }

  private resolveLocalOnly(component: any): boolean {
    if (component?.isShared) return false;
    const props = component?.properties || {};
    const candidates = [
      component?.localOnly,
      component?.local_only,
      props.localOnly,
      props.local_only,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'boolean') return candidate;
      if (typeof candidate === 'string') {
        const normalized = candidate.toLowerCase();
        if (['true', '1', 'yes'].includes(normalized)) return true;
        if (['false', '0', 'no'].includes(normalized)) return false;
      }
    }
    return !component?.isShared;
  }

  private resolveSharedId(component: any): string | undefined {
    if (typeof component?.sharedId === 'string' && component.sharedId.trim()) {
      return component.sharedId;
    }
    if (typeof component?.shared_id === 'string' && component.shared_id.trim()) {
      return component.shared_id;
    }
    if (component?.properties && typeof component.properties === 'object') {
      const shared = (component.properties as any).sharedId || (component.properties as any).shared_id;
      if (typeof shared === 'string' && shared.trim()) return shared;
    }
    return undefined;
  }

  private buildComponentCacheKey(component: any, page: UnifiedContent, index: number): string {
    const sharedId = this.resolveSharedId(component);
    if (component?.isShared && sharedId) {
      return `shared:${sharedId}`;
    }
    const baseId = component?.id || component?.uuid || `${page.id}:${index}`;
    return `page:${page.id}:${baseId}`;
  }

  private resolveComponentUid(component: any, page: UnifiedContent, index: number): string {
    const sharedId = this.resolveSharedId(component);
    if (component?.isShared && sharedId) {
      return this.sanitizeUid(sharedId, 'component');
    }
    const raw = component?.id || `${page.id}-${component?.type || 'component'}-${index}`;
    return this.sanitizeUid(raw, 'component');
  }

  private resolvePageUid(item: UnifiedContent): string {
    const base = item.id || item.url || item.title || 'page';
    return this.sanitizeUid(base, 'page');
  }

  private resolveSlug(item: UnifiedContent): string {
    if (item.url) {
      const trimmed = item.url.replace(/^\/+|\/+$/g, '');
      if (trimmed) return trimmed;
    }
    const base = item.title || item.id || 'page';
    return this.sanitizeUid(base, 'page');
  }

  private stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      copy[key] = value;
    }
    return copy as T;
  }

  private cloneData<T>(value: T): T {
    if (value === undefined || value === null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  private serializeJson(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  private toReferenceArray(uid: string, contentTypeUid: string): ContentstackEntryReference[] {
    return [{ uid, _content_type_uid: contentTypeUid }];
  }

  private sanitizeUid(raw: string, fallback: string): string {
    let value = (raw || '').toString().toLowerCase();
    value = value.replace(/[^a-z0-9-_]+/g, '-');
    value = value.replace(/^-+|-+$/g, '');
    if (!value) {
      value = `${fallback}-${Math.random().toString(36).slice(2, 10)}`;
    }
    if (/^[^a-z]/.test(value)) {
      value = `${fallback}-${value}`;
    }
    return value.slice(0, 100);
  }

  private async safeGetEntry(contentTypeUid: string, entryUid: string): Promise<any | null> {
    try {
      return await this.client.getEntry(contentTypeUid, entryUid);
    } catch (error: any) {
      if (error?.status === 404) return null;
      if (error?.status === 422 && (error?.body?.error_code === 118 || error?.body?.error_code === 141)) return null;
      throw error;
    }
  }

  private async publishSafely(contentTypeUid: string, entryUid: string): Promise<void> {
    try {
      await this.client.publishEntry(contentTypeUid, entryUid);
    } catch (error: any) {
      const isLocaleError = error?.status === 401 && error?.body?.error_code === 161;
      if (isLocaleError) {
        console.warn('[Contentstack] Skipping publish for ' + contentTypeUid + '/' + entryUid + ': ' + (error?.body?.error_message || 'locale not available'));
        return;
      }
      throw error;
    }
  }

  private normalizeEntry(response: any): { uid: string; [key: string]: unknown } {
    if (!response) return { uid: 'unknown' };
    if (response.entry) {
      return response.entry;
    }
    if (response.entries && Array.isArray(response.entries) && response.entries.length > 0) {
      return response.entries[0];
    }
    if (response.uid) {
      return response;
    }
    if (response.data?.entry) {
      return response.data.entry;
    }
    return { uid: response.uid || 'unknown', ...response };
  }

  private extractVersion(entry: any): number | undefined {
    if (!entry) return undefined;
    const source = entry.entry || entry;
    if (typeof source._version === 'number') return source._version;
    if (typeof source.version === 'number') return source.version;
    if (typeof source.sys?.version === 'number') return source.sys.version;
    return undefined;
  }

  private mapPageToUniversal(item: UnifiedContent, entry: { uid: string }): UniversalContentItem {
    const slug = this.resolveSlug(item);
    const relationships = item.parentId && this.pageCache.has(item.parentId)
      ? [{ type: 'parent' as const, targetId: this.pageCache.get(item.parentId)! }]
      : [];

    return {
      id: entry.uid,
      contentTypeId: CONTENTSTACK_PAGE_CONTENT_TYPE_UID,
      name: item.title || slug,
      title: item.title || slug,
      slug,
      content: this.cloneData(item.content),
      contentType: CONTENTSTACK_PAGE_CONTENT_TYPE_UID,
      fields: this.cloneData(item.content),
      parentId: item.parentId,
      language: this.client.getLocale(),
      metadata: {
        sourceId: item.id,
        url: item.url,
        originalContentTypeId: item.contentTypeId,
        templateKey: item.templateKey,
        templateProps: item.templateProps,
        contentstack: {
          entryUid: entry.uid,
          contentTypeUid: CONTENTSTACK_PAGE_CONTENT_TYPE_UID,
          environment: this.client.getEnvironment(),
          locale: this.client.getLocale(),
        },
      },
      status: 'published',
      relationships,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1',
      platformSpecific: {
        provider: 'contentstack',
        entryUid: entry.uid,
      },
    };
  }
}











