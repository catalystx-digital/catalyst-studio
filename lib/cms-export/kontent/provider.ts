import type { ICMSProvider, UniversalContentType, UniversalContentItem } from '../types';
import type {
  UnifiedBundleSyncOptions,
  UnifiedBundleSyncResult,
  UnifiedExportBundle,
  ContentTypeExport,
  ComponentExport,
} from '@/lib/services/export/types';
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import type { KontentClientConfig, KontentTypeMappingResult, KontentVariantElement } from './types';
import { KontentClient } from './client';
import { KontentTypeMapper } from './mappers/type-mapper';
import { KontentUnifiedContentTransformer } from './transformers/unified-content-transformer';
import { formatUnifiedBundleSyncResult } from '@/lib/cms-export/helpers/unified-bundle-result';
import { KONTENT_PROVIDER_ID, MAX_CODENAME_LENGTH } from './constants';
import { sanitizeCodename } from './utils';
import { buildUniversalContentType } from '@/lib/services/export/helpers/content-type-builder';

const DEFAULT_MAX_CONCURRENCY = 5;
const PROGRESS_INTERVAL = 25;

export class KontentProvider implements ICMSProvider {
  readonly id = KONTENT_PROVIDER_ID;

  private client: KontentClient;
  private typeCodenameLookup = new Map<string, string>();
  private maxConcurrency = DEFAULT_MAX_CONCURRENCY;

  constructor(config?: KontentClientConfig, client?: KontentClient) {
    this.initialiseConcurrency(config);
    this.client = client ?? new KontentClient(config);
    if (config && client) {
      this.client.configure(config);
    }
  }

  configure(config: KontentClientConfig = {}): void {
    if (typeof config.maxConcurrency === 'number') {
      this.maxConcurrency = this.normaliseConcurrency(config.maxConcurrency);
    }
    this.client.configure(config);
  }

  getCompiledTypeSupport() {
    return {
      compile: (contentTypes: ContentTypeExport[]) => {
        const mapper = new KontentTypeMapper({
          resolveTypeCodename: value => this.resolveTypeCodename(value),
        });
        const byKey: Record<string, { universal: UniversalContentType; mapping: KontentTypeMappingResult }> = {};
        const all = contentTypes.map(ct => {
          const universal = buildUniversalContentType(ct);
          const mapping = mapper.map(universal);
          const fields = (universal.fields || []).map(field => ({
            name: field.id || field.name,
            valueType: field.type,
          }));
          byKey[universal.id] = { universal, mapping };
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
        // no-op: Kontent provider resolves lookups during ensure
      },
      ensure: async (compiled: any) => {
        const entries = Array.isArray(compiled?.all) ? compiled.all : [];
        for (const entry of entries) {
          const record = (compiled.byKey as Record<string, { universal: UniversalContentType; mapping: KontentTypeMappingResult }>)[entry.key];
          if (!record) continue;
          const { universal, mapping } = record;
          try {
            const ensured = await this.client.upsertContentType(mapping.contentType);
            this.registerTypeMapping(universal, ensured.codename, mapping.source.id);
          } catch (error) {
            console.error('[KontentProvider] Failed to ensure content type', {
              key: entry.key,
              error: error instanceof Error ? error.message : error,
            });
            throw error;
          }
        }
      },
      registerContentTypeMapping: (dbId: string, safeKey: string, _baseType: '_page' | '_component') => {
        if (!dbId || !safeKey) return;
        this.typeCodenameLookup.set(dbId, safeKey);
        this.typeCodenameLookup.set(dbId.toLowerCase?.() ?? dbId, safeKey);
        this.typeCodenameLookup.set(safeKey, safeKey);
        this.typeCodenameLookup.set(safeKey.toLowerCase(), safeKey);
      }
    };
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    const codename = this.resolveTypeCodename(id) ?? sanitizeCodename(id);
    const type = await this.client.getContentType(codename);
    if (!type) {
      return null;
    }
    return this.mapKontentTypeToUniversal(type);
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    const mapper = new KontentTypeMapper({
      resolveTypeCodename: value => this.resolveTypeCodename(value),
    });
    const mapping = mapper.map(type);
    const created = await this.client.upsertContentType(mapping.contentType);
    this.registerTypeMapping(type, created.codename);
    return this.mapKontentTypeToUniversal(created);
  }

  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    options: UnifiedBundleSyncOptions = {}
  ): Promise<UnifiedBundleSyncResult> {
    const typeMappings = this.prepareTypeMappings(bundle.contentTypes);

    // Ensure content types exist remotely
    for (const [key, mapping] of typeMappings.entries()) {
      const ensured = await this.client.upsertContentType(mapping.contentType);
      typeMappings.set(key, {
        ...mapping,
        contentType: ensured,
      });
      this.registerTypeMapping(mapping.source, ensured.codename, mapping.source.id);
    }

    const componentReferences = await this.syncComponents(bundle.components);

    const transformer = new KontentUnifiedContentTransformer(typeMappings, {
      languageCodename: this.client.getLanguageCodename(),
      componentReferences,
    });

    const successful: UniversalContentItem[] = [];
    const failed: Array<{ item: UnifiedContent; error: string }> = [];
    const totalItems = bundle.unifiedContent.length;
    let processedItems = 0;

    console.log(
      `[KontentProvider] Syncing ${totalItems} content items with concurrency ${this.maxConcurrency}`
    );

    await this.processQueue(bundle.unifiedContent, async (item, index) => {
      if (item.type === 'folder' || item.contentTypeId === 'folder') {
        console.warn('[KontentProvider] Skipping folder content item', { id: item.id });
        processedItems += 1;
        this.logProgress('Content item', processedItems, totalItems);
        return;
      }
      try {
        const upsert = transformer.build(item);
        if (!upsert) {
          failed.push({
            item,
            error: `Unable to transform content item ${item.id} for Kontent.ai`,
          });
          processedItems += 1;
          this.logProgress('Content item', processedItems, totalItems);
          return;
        }

        const typeCodename =
          this.resolveTypeCodename(item.contentTypeId) ??
          this.resolveTypeCodename(upsert.item.type.codename ?? '') ??
          upsert.item.type.codename ??
          sanitizeCodename(item.contentTypeId);

        const payload = {
          name: upsert.item.name,
          codename: upsert.item.codename,
          type: { codename: typeCodename },
          external_id: item.id,
        };
        const created = await this.client.upsertContentItem(payload);
        await this.client.upsertVariant(created.codename, this.client.getLanguageCodename(), upsert.variant);

        successful.push({
          id: item.id,
          contentTypeId: item.contentTypeId,
          name: upsert.item.name,
          title: upsert.item.name,
          slug: upsert.item.codename,
          content: (item.content ?? {}) as Record<string, unknown>,
          contentType: upsert.item.type.codename ?? item.contentTypeId,
          fields: item.content ?? {},
          status: 'draft',
          mediaAssets: item.mediaAssets,
          metadata: item.metadata ?? {},
        });
      } catch (error) {
        console.error('[KontentProvider] Failed to sync unified content item', {
          itemId: item.id,
          contentTypeId: item.contentTypeId,
          error: error instanceof Error ? error.message : error,
          body: (error as Error & { body?: unknown }).body,
        });
        const body = (error as Error & { body?: unknown }).body;
        const message = error instanceof Error ? error.message : 'Unknown error processing Kontent.ai item';
        const detailedMessage = body ? `${message} ⇒ ${JSON.stringify(body)}` : message;
        failed.push({
          item,
          error: detailedMessage,
        });
      } finally {
        processedItems += 1;
        this.logProgress('Content item', processedItems, totalItems);
      }
    });

    return formatUnifiedBundleSyncResult(this.id, {
      successful,
      failed,
    });
  }

  private prepareTypeMappings(contentTypes: ContentTypeExport[]): Map<string, KontentTypeMappingResult> {
    const mapper = new KontentTypeMapper({
      resolveTypeCodename: value => this.resolveTypeCodename(value),
    });
    const usedTypeCodenames = new Set<string>();
    const typeMappings = new Map<string, KontentTypeMappingResult>();
    const prepared: Array<{
      universal: UniversalContentType;
      exportKey?: string;
      codename: string;
    }> = [];

    for (const type of contentTypes) {
      const universal = this.fromContentTypeExport(type);
      const baseCodename = sanitizeCodename(universal.id || universal.name);
      let codename = baseCodename;
      if (usedTypeCodenames.has(codename)) {
        let counter = 1;
        let candidate = `${codename}_${counter}`;
        while (usedTypeCodenames.has(candidate)) {
          counter += 1;
          candidate = `${codename}_${counter}`;
        }
        codename = candidate;
      }
      usedTypeCodenames.add(codename);
      this.registerTypeMapping(universal, codename, type.key);
      prepared.push({ universal, exportKey: type.key, codename });
    }

    for (const entry of prepared) {
      let mapping = mapper.map(entry.universal);
      if (mapping.contentType.codename !== entry.codename) {
        mapping = {
          ...mapping,
          contentType: {
            ...mapping.contentType,
            codename: entry.codename,
          },
        };
      }
      typeMappings.set(entry.universal.id, mapping);
      this.registerTypeMapping(entry.universal, entry.codename, entry.exportKey);
    }

    return typeMappings;
  }

  private async syncComponents(components: ComponentExport[]): Promise<Map<string, string>> {
    const referenceMap = new Map<string, string>();
    const sharedMap = new Map<string, string>();
    const usedCodenames = new Set<string>();
    const language = this.client.getLanguageCodename();
    const operations: Array<() => Promise<void>> = [];

    for (const component of components) {
      const metadata = (component.metadata ?? {}) as Record<string, unknown> | undefined;
      const sharedId = typeof metadata?.sharedId === 'string' && metadata.sharedId.trim().length > 0
        ? metadata.sharedId.trim()
        : undefined;
      const cacheKey = sharedId ?? component.id;

      if (sharedId && sharedMap.has(sharedId)) {
        referenceMap.set(component.id, sharedMap.get(sharedId)!);
        continue;
      }

      if (referenceMap.has(component.id)) {
        continue;
      }

      const baseCodename = sanitizeCodename(
        sharedId ? `${component.type}_${sharedId}` : `${component.type}_${component.id}`
      );
      let codename = baseCodename;
      let counter = 1;
      while (usedCodenames.has(codename)) {
        const suffix = `_${counter++}`;
        const maxBaseLength = Math.max(1, MAX_CODENAME_LENGTH - suffix.length);
        const truncatedBase = baseCodename.slice(0, maxBaseLength);
        codename = sanitizeCodename(`${truncatedBase}${suffix}`);
      }
      usedCodenames.add(codename);

      const typeCodename =
        this.resolveTypeCodename(component.type) ?? sanitizeCodename(component.type);

      const payload = {
        name: component.props?.title ?? component.type ?? component.id,
        codename,
        type: { codename: typeCodename },
        external_id: component.id,
      };

      const variantElements: KontentVariantElement[] = [
        {
          element: { codename: 'title' },
          value: payload.name,
        },
        {
          element: { codename: 'payload' },
          value: JSON.stringify(component, null, 2),
        },
      ];

      const operationIndex = operations.length;
      operations.push(async () => {
        const created = await this.client.upsertContentItem(payload);
        await this.client.upsertVariant(created.codename, language, { elements: variantElements });
        if ((operationIndex + 1) % PROGRESS_INTERVAL === 0 || operationIndex === components.length - 1) {
          console.log(
            `[KontentProvider] Component sync progress ${operationIndex + 1}/${components.length}`
          );
        }
      });

      referenceMap.set(component.id, codename);
      if (sharedId) {
        sharedMap.set(sharedId, codename);
      }
    }

    if (operations.length > 0) {
      console.log(
        `[KontentProvider] Syncing ${operations.length} components with concurrency ${this.maxConcurrency}`
      );
      await this.processQueue(operations, task => task());
    }

    return referenceMap;
  }

  private registerTypeMapping(
    type: UniversalContentType,
    codename: string,
    exportKey?: string
  ): void {
    const candidates = [
      type.id,
      type.name,
      type.metadata?.contentType,
      exportKey,
    ];

    for (const raw of candidates) {
      const key = raw ? String(raw) : undefined;
      if (!key) continue;
      this.typeCodenameLookup.set(key, codename);
      this.typeCodenameLookup.set(key.toLowerCase(), codename);
    }
  }

  private resolveTypeCodename(value: string): string | undefined {
    if (!value) {
      return undefined;
    }
    return (
      this.typeCodenameLookup.get(value) ??
      this.typeCodenameLookup.get(value.toLowerCase?.() ?? value) ??
      undefined
    );
  }

  private fromContentTypeExport(type: ContentTypeExport): UniversalContentType {
    const now = new Date();
    const fields = Array.isArray(type.fields) ? type.fields : [];
    const normalisedFields = fields.map(field => ({
      layer: field.layer ?? 'common',
      type: field.type ?? 'text',
      id: field.id ?? field.key ?? sanitizeCodename(field.name ?? 'field'),
      name: field.name ?? field.id ?? 'Field',
      description: field.description,
      required: Boolean(field.required),
      defaultValue: field.defaultValue,
      validations: field.validations ?? [],
      platformSpecific: field.platformSpecific ?? {},
    }));

    return {
      id: type.id ?? type.key ?? sanitizeCodename(type.name),
      name: type.name ?? type.key ?? type.id ?? 'Content Type',
      version: '1.0.0',
      type: type.category === 'page' ? 'page' : 'component',
      description: type.metadata?.description as string | undefined,
      isRoutable: type.category === 'page',
      fields: normalisedFields,
      metadata: {
        createdAt: now,
        updatedAt: now,
        contentType: type.key ?? type.id ?? type.name,
        platformSpecific: type.metadata ?? {},
      },
      platformSpecific: type.metadata ?? {},
    };
  }

  private mapKontentTypeToUniversal(type: {
    name: string;
    codename: string;
    external_id?: string;
    elements: Array<{
      name: string;
      codename: string;
      type: string;
      guidelines?: string;
      is_required?: boolean;
      options?: Array<{ name: string; codename: string }>;
      allowed_content_types?: Array<{ codename: string }>;
    }>;
  }): UniversalContentType {
    const now = new Date();
    const fields = type.elements.map(element => ({
      id: element.codename,
      name: element.name,
      layer: 'common' as const,
      type: this.mapKontentElementType(element.type),
      description: element.guidelines,
      required: Boolean(element.is_required),
      platformSpecific: {
        options: element.options,
        allowedTypes: element.allowed_content_types?.map(entry => entry.codename),
      },
    }));

    const universal: UniversalContentType = {
      id: type.external_id ?? type.codename,
      name: type.name,
      version: '1.0.0',
      type: 'component',
      isRoutable: false,
      fields,
      metadata: {
        createdAt: now,
        updatedAt: now,
        contentType: type.codename,
      },
      platformSpecific: {},
    };

    this.registerTypeMapping(universal, type.codename, type.external_id);

    return universal;
  }

  private mapKontentElementType(type: string): UniversalContentType['fields'][number]['type'] {
    switch (type) {
      case 'text':
        return 'text';
      case 'rich_text':
        return 'richText';
      case 'number':
        return 'number';
      case 'date_time':
        return 'date';
      case 'asset':
        return 'media';
      case 'modular_content':
        return 'component';
      case 'multiple_choice':
        return 'select';
      case 'json':
      default:
        return 'json';
    }
  }

  private initialiseConcurrency(config?: KontentClientConfig): void {
    this.maxConcurrency = DEFAULT_MAX_CONCURRENCY;
    const envValue = Number(process.env.KONTENT_MAX_CONCURRENCY);
    if (!Number.isNaN(envValue) && envValue > 0) {
      this.maxConcurrency = this.normaliseConcurrency(envValue);
    }
    if (typeof config?.maxConcurrency === 'number') {
      this.maxConcurrency = this.normaliseConcurrency(config.maxConcurrency);
    }
  }

  private normaliseConcurrency(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_MAX_CONCURRENCY;
    }
    return Math.max(1, Math.floor(value));
  }

  private async processQueue<T>(
    items: readonly T[],
    handler: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    const limit = Math.max(1, this.maxConcurrency);
    if (items.length === 0) {
      return;
    }

    if (limit <= 1) {
      for (let index = 0; index < items.length; index += 1) {
        await handler(items[index], index);
      }
      return;
    }

    for (let index = 0; index < items.length; index += limit) {
      const batch = items.slice(index, index + limit).map((item, offset) => handler(item, index + offset));
      await Promise.all(batch);
    }
  }

  private logProgress(scope: string, current: number, total: number): void {
    if (total === 0) return;
    if (current % PROGRESS_INTERVAL === 0 || current === total) {
      console.log(`[KontentProvider] ${scope} progress ${current}/${total}`);
    }
  }
}
