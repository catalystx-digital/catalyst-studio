import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import {
  KontentTypeMappingResult,
  KontentVariantElement,
  KontentItemUpsertResult,
  KontentContentTypeElement,
} from '../types';
import { sanitizeCodename, asArray, coerceNumber, coerceBoolean, uniqueCodename } from '../utils';

interface TransformerOptions {
  languageCodename: string;
  componentReferences?: Map<string, string>;
}

type PageComponentInstance = {
  id: string;
  sharedId?: string;
  parentId?: string | null;
  position?: number;
};

type ComponentIndex = {
  byId: Map<string, PageComponentInstance>;
  bySharedId: Map<string, PageComponentInstance>;
};

export class KontentUnifiedContentTransformer {
  private language: string;
  private typeMappings: Map<string, KontentTypeMappingResult>;
  private generatedCodenames = new Map<string, string>();
  private componentReferences: Map<string, string>;
  private componentReferenceValues: Set<string>;

  constructor(typeMappings: Map<string, KontentTypeMappingResult>, options: TransformerOptions) {
    this.typeMappings = typeMappings;
    this.language = options.languageCodename;
    this.componentReferences = options.componentReferences ?? new Map();
    this.componentReferenceValues = new Set(this.componentReferences.values());
  }

  build(unified: UnifiedContent): KontentItemUpsertResult | null {
    const mapping = this.lookupTypeMapping(unified.contentTypeId);
    if (!mapping) {
      return null;
    }

    const codename = this.generateItemCodename(mapping.contentType.codename, unified);
    const name = unified.title || unified.metadata?.name || mapping.contentType.name;

    const elements: KontentVariantElement[] = [];

    // Title element
    elements.push({
      element: { codename: 'title' },
      value: name || unified.id,
    });

    for (const fieldMapping of mapping.fieldMappings) {
      const element = this.transformField(unified, fieldMapping);
      if (element) {
        elements.push(element);
      }
    }

    return {
      item: {
        id: unified.id,
        name: name || codename,
        codename,
        type: { codename: mapping.contentType.codename },
      },
      variant: { elements },
    };
  }

  private lookupTypeMapping(typeId: string): KontentTypeMappingResult | undefined {
    if (this.typeMappings.has(typeId)) {
      return this.typeMappings.get(typeId);
    }
    for (const [key, mapping] of this.typeMappings.entries()) {
      if (mapping.source.id === typeId || mapping.source.name === typeId) {
        return mapping;
      }
      if (mapping.contentType.codename === typeId) {
        return mapping;
      }
      if (mapping.contentType.external_id === typeId) {
        return mapping;
      }
    }
    return undefined;
  }

  private generateItemCodename(typeCodename: string, unified: UnifiedContent): string {
    const base = sanitizeCodename(`${typeCodename}_${unified.id || unified.title || 'item'}`);
    const key = `${typeCodename}:${unified.id}`;
    if (!this.generatedCodenames.has(key)) {
      this.generatedCodenames.set(key, base);
      return base;
    }
    const used = new Set(this.generatedCodenames.values());
    const unique = uniqueCodename(base, used);
    this.generatedCodenames.set(`${key}:${unique}`, unique);
    return unique;
  }

  private resolveFieldValue(unified: UnifiedContent, fieldId: string): unknown {
    const content = (unified.content ?? {}) as Record<string, unknown>;
    if (fieldId in content) {
      return content[fieldId];
    }
    const altByName = Object.keys(content).find(key => key.toLowerCase() === fieldId.toLowerCase());
    if (altByName) {
      return content[altByName];
    }
    return undefined;
  }

  private transformField(
    unified: UnifiedContent,
    mapping: { element: KontentContentTypeElement; universalField: { id: string; type: string } }
  ): KontentVariantElement | null {
    const { element, universalField } = mapping;
    const fieldId = universalField.id;
    const raw = this.resolveFieldValue(unified, fieldId);
    if (raw === undefined || raw === null) {
      if (element.is_required) {
        return {
          element: { codename: element.codename },
          value: element.type === 'multiple_choice' ? [] : '',
        };
      }
      return null;
    }

    switch (element.type) {
      case 'text':
      case 'rich_text': {
        const value =
          element.codename === 'payload'
            ? typeof raw === 'string' ? raw : JSON.stringify(raw)
            : this.asString(raw);
        return {
          element: { codename: element.codename },
          value,
        };
      }
      case 'number': {
        const numeric = coerceNumber(raw);
        if (numeric === null) {
          return null;
        }
        return { element: { codename: element.codename }, value: numeric };
      }
      case 'date_time': {
        const value = this.asString(raw);
        return { element: { codename: element.codename }, value };
      }
      case 'multiple_choice': {
        if (Array.isArray(raw)) {
          const options = raw
            .map(value => this.asString(value))
            .filter(Boolean)
            .map(value => ({ codename: sanitizeCodename(value, 'option') }));
          return { element: { codename: element.codename }, value: options };
        }
        if (typeof raw === 'boolean') {
          const value = coerceBoolean(raw) ? 'yes' : 'no';
          return { element: { codename: element.codename }, value: [{ codename: value }] };
        }
        if (typeof raw === 'string') {
          return {
            element: { codename: element.codename },
            value: [{ codename: sanitizeCodename(raw, 'option') }],
          };
        }
        return null;
      }
      case 'asset': {
        const assets = asArray(raw).map(value => {
          if (typeof value === 'string') {
            return { codename: sanitizeCodename(value, 'asset') };
          }
          if (value && typeof value === 'object') {
            const candidate = (value as { codename?: string; id?: string }).codename ?? (value as { id?: string }).id;
            if (candidate) {
              return { codename: sanitizeCodename(String(candidate), 'asset') };
            }
          }
          return null;
        });
        const filtered = assets.filter((value): value is { codename: string } => Boolean(value));
        if (filtered.length === 0) {
          return null;
        }
        return { element: { codename: element.codename }, value: filtered };
      }
      case 'modular_content': {
        const index = this.createComponentIndex(unified);
        const references = asArray(raw)
          .map(entry =>
            this.resolveModularContentEntry(unified, entry, index, {
              fieldId,
              elementCodename: element.codename,
            })
          )
          .filter((value): value is { codename: string } => Boolean(value));

        if (references.length === 0) {
          return null;
        }
        return { element: { codename: element.codename }, value: references };
      }
      case 'json':
      default: {
        const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
        return { element: { codename: element.codename }, value };
      }
    }
  }

  private asString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private createComponentIndex(unified: UnifiedContent): ComponentIndex {
    const rawComponents: PageComponentInstance[] = Array.isArray((unified as any).components)
      ? ((unified as any).components as PageComponentInstance[])
      : [];

    const byId = new Map<string, PageComponentInstance>();
    const bySharedId = new Map<string, PageComponentInstance>();

    for (const component of rawComponents) {
      if (!component || typeof component !== 'object') continue;
      if (component.id) {
        byId.set(component.id, component);
      }
      if (component.sharedId) {
        bySharedId.set(component.sharedId, component);
      }
    }

    return { byId, bySharedId };
  }

  private resolveModularContentEntry(
    unified: UnifiedContent,
    entry: unknown,
    index: ComponentIndex,
    context: { fieldId: string; elementCodename: string }
  ): { codename: string } | null {
    const candidates = this.extractComponentReferenceKeys(entry);
    if (candidates.length === 0) {
      console.warn('[KontentUnifiedContentTransformer] Unable to identify modular content reference', {
        contentId: unified.id,
        fieldId: context.fieldId,
        elementCodename: context.elementCodename,
        entry,
      });
      return null;
    }

    for (const candidate of candidates) {
      const codename = this.lookupComponentCodename(candidate, index);
      if (codename) {
        return { codename };
      }
    }

    console.warn('[KontentUnifiedContentTransformer] Missing component reference', {
      contentId: unified.id,
      fieldId: context.fieldId,
      elementCodename: context.elementCodename,
      candidates,
    });
    return null;
  }

  private extractComponentReferenceKeys(entry: unknown, depth = 0): string[] {
    if (entry === null || entry === undefined) {
      return [];
    }
    if (typeof entry === 'string' || typeof entry === 'number') {
      const candidate = String(entry).trim();
      return candidate ? [candidate] : [];
    }
    if (Array.isArray(entry)) {
      if (depth > 5) {
        return [];
      }
      return entry.flatMap(item => this.extractComponentReferenceKeys(item, depth + 1));
    }
    if (typeof entry === 'object') {
      if (depth > 5) {
        return [];
      }
      const obj = entry as Record<string, unknown>;
      const results = new Set<string>();
      const inspectKeys = [
        'id',
        'componentId',
        'component_id',
        'sharedId',
        'shared_id',
        'referenceId',
        'reference_id',
        'codename',
        'block',
        'component',
        'value',
        'item',
        'entry',
      ];

      for (const key of inspectKeys) {
        if (!(key in obj)) continue;
        const value = obj[key];
        const extracted = this.extractComponentReferenceKeys(value, depth + 1);
        for (const candidate of extracted) {
          if (candidate) {
            results.add(candidate);
          }
        }
      }

      return Array.from(results);
    }
    return [];
  }

  private lookupComponentCodename(candidate: string, index: ComponentIndex): string | null {
    const key = candidate.trim();
    if (!key) {
      return null;
    }
    const direct = this.componentReferences.get(key);
    if (direct) {
      return direct;
    }
    if (this.componentReferenceValues.has(key)) {
      return key;
    }

    const byId = index.byId.get(key);
    if (byId && byId.id) {
      const reference = this.componentReferences.get(byId.id);
      if (reference) {
        return reference;
      }
    }

    const byShared = index.bySharedId.get(key);
    if (byShared && byShared.id) {
      const reference = this.componentReferences.get(byShared.id);
      if (reference) {
        return reference;
      }
    }

    return null;
  }
}
