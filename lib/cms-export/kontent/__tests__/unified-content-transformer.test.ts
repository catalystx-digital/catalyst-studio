import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import { KontentUnifiedContentTransformer } from '../../kontent/transformers/unified-content-transformer';
import type { KontentTypeMappingResult } from '../../kontent/types';

const mapping: KontentTypeMappingResult = {
  source: {
    id: 'page',
    name: 'Page',
    version: '1.0.0',
    type: 'page',
    isRoutable: true,
    fields: [
      {
        id: 'summary',
        name: 'Summary',
        type: 'richText',
        layer: 'common',
      },
      {
        id: 'tags',
        name: 'Tags',
        type: 'select',
        layer: 'common',
      },
    ],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    platformSpecific: {},
  },
  contentType: {
    name: 'Page',
    codename: 'page',
    elements: [
      { name: 'Summary', codename: 'summary', type: 'rich_text' },
      { name: 'Tags', codename: 'tags', type: 'multiple_choice' },
    ],
  },
  fieldMappings: [
    {
      universalField: {
        id: 'summary',
        name: 'Summary',
        type: 'richText',
        layer: 'common',
      },
      element: { name: 'Summary', codename: 'summary', type: 'rich_text' },
    },
    {
      universalField: {
        id: 'tags',
        name: 'Tags',
        type: 'select',
        layer: 'common',
      },
      element: { name: 'Tags', codename: 'tags', type: 'multiple_choice' },
    },
  ],
};

describe('KontentUnifiedContentTransformer', () => {
  it('produces variant payloads from unified content', () => {
    const transformer = new KontentUnifiedContentTransformer(new Map([['page', mapping]]), {
      languageCodename: 'default',
      componentReferences: new Map(),
    });

    const unified: UnifiedContent = {
      id: 'page-1',
      source: 'WebsitePage',
      type: 'page',
      title: 'Home',
      contentTypeId: 'page',
      content: {
        summary: '<p>Hello Kontent</p>',
        tags: ['Featured', 'Hero'],
      },
      metadata: {},
      mediaAssets: [],
      status: 'draft',
      websiteId: 'site-1',
    };

    const result = transformer.build(unified);
    expect(result).not.toBeNull();
    expect(result?.item.codename).toContain('page');
    expect(result?.variant.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: { codename: 'summary' },
          value: '<p>Hello Kontent</p>',
        }),
        expect.objectContaining({
          element: { codename: 'tags' },
          value: [
            { codename: 'featured' },
            { codename: 'hero' },
          ],
        }),
      ])
    );
  });

  it('maps modular content references using field payload component ids', () => {
    const modularMapping: KontentTypeMappingResult = {
      ...mapping,
      contentType: {
        ...mapping.contentType,
        elements: [
          ...mapping.contentType.elements,
          { name: 'Layout', codename: 'layout', type: 'modular_content' },
        ],
      },
      fieldMappings: [
        ...mapping.fieldMappings,
        {
          universalField: {
            id: 'layout',
            name: 'Layout',
            type: 'component',
            layer: 'common',
          },
          element: { name: 'Layout', codename: 'layout', type: 'modular_content' },
        },
      ],
    };

    const componentReferences = new Map<string, string>([
      ['cmp-hero', 'hero_component'],
      ['cmp-cta', 'cta_component'],
    ]);

    const transformer = new KontentUnifiedContentTransformer(new Map([['page', modularMapping]]), {
      languageCodename: 'default',
      componentReferences,
    });

    const unified: UnifiedContent = {
      id: 'page-layout',
      source: 'WebsitePage',
      type: 'page',
      title: 'Layout Test',
      contentTypeId: 'page',
      content: {
        summary: '<p>Summary</p>',
        tags: [],
        layout: ['cmp-cta', 'cmp-hero'],
      },
      metadata: {},
      mediaAssets: [],
      status: 'draft',
      websiteId: 'site-1',
      components: [
        {
          id: 'cmp-hero',
          type: 'hero',
          parentId: null,
          position: 1,
          properties: {},
          isShared: true,
          sharedId: 'shared-hero',
        },
        {
          id: 'cmp-cta',
          type: 'cta',
          parentId: null,
          position: 0,
          properties: {},
          isShared: false,
        },
      ],
    };

    const result = transformer.build(unified);
    expect(result).not.toBeNull();
    const layoutElement = result?.variant.elements.find(entry => entry.element.codename === 'layout');
    expect(layoutElement?.value).toEqual([
      { codename: 'cta_component' },
      { codename: 'hero_component' },
    ]);
  });

  it('resolves modular content references using shared ids when present', () => {
    const modularMapping: KontentTypeMappingResult = {
      ...mapping,
      contentType: {
        ...mapping.contentType,
        elements: [
          ...mapping.contentType.elements,
          { name: 'Layout', codename: 'layout', type: 'modular_content' },
        ],
      },
      fieldMappings: [
        ...mapping.fieldMappings,
        {
          universalField: {
            id: 'layout',
            name: 'Layout',
            type: 'component',
            layer: 'common',
          },
          element: { name: 'Layout', codename: 'layout', type: 'modular_content' },
        },
      ],
    };

    const componentReferences = new Map<string, string>([['cmp-hero', 'hero_component']]);

    const transformer = new KontentUnifiedContentTransformer(new Map([['page', modularMapping]]), {
      languageCodename: 'default',
      componentReferences,
    });

    const unified: UnifiedContent = {
      id: 'page-shared',
      source: 'WebsitePage',
      type: 'page',
      title: 'Shared Reference',
      contentTypeId: 'page',
      content: {
        summary: '<p>Summary</p>',
        tags: [],
        layout: ['shared-hero'],
      },
      metadata: {},
      mediaAssets: [],
      status: 'draft',
      websiteId: 'site-1',
      components: [
        {
          id: 'cmp-hero',
          type: 'hero',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-hero',
        },
      ],
    };

    const result = transformer.build(unified);
    expect(result).not.toBeNull();
    const layoutElement = result?.variant.elements.find(entry => entry.element.codename === 'layout');
    expect(layoutElement?.value).toEqual([{ codename: 'hero_component' }]);
  });
});
