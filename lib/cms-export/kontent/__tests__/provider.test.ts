import type { UnifiedExportBundle } from '@/lib/services/export/types';
import { KontentProvider } from '../../kontent';

class FakeKontentClient {
  configure = jest.fn();
  getLanguageCodename = jest.fn(() => 'default');
  upsertContentType = jest.fn(async (definition: any) => definition);
  upsertContentItem = jest.fn(async (input: any) => ({
    id: input.external_id ?? 'item-1',
    codename: input.codename ?? 'generated_codename',
    name: input.name,
    type: input.type,
  }));
  upsertVariant = jest.fn(async () => undefined);
  getContentType = jest.fn(async () => null);
}

describe('KontentProvider', () => {
  const bundle: UnifiedExportBundle = {
    website: { id: 'site-1', name: 'Test Site' },
    contentTypes: [
      {
        id: 'page',
        key: 'page',
        name: 'Page',
        pluralName: 'Pages',
        category: 'page',
        fields: [
          {
            id: 'summary',
            name: 'Summary',
            type: 'richText',
            layer: 'common',
          },
          {
            id: 'components',
            name: 'Components',
            type: 'component-list',
            layer: 'common',
            platformSpecific: {
              allowedTypes: ['navbar'],
            },
          },
        ],
        metadata: {},
      },
      {
        id: 'navbar',
        key: 'navbar',
        name: 'navbar',
        pluralName: 'navbars',
        category: 'component',
        fields: [],
        metadata: {},
      },
    ],
    unifiedContent: [
      {
        id: 'page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'Home',
        contentTypeId: 'page',
        content: { summary: '<p>Welcome</p>' },
        metadata: {},
        mediaAssets: [],
        status: 'draft',
        websiteId: 'site-1',
        components: [
          {
            id: 'navbar-1',
            type: 'navbar',
            position: 0,
            parentId: null,
            properties: { title: 'Main Nav' },
            isShared: false,
          },
        ],
      },
    ],
    componentUsage: [],
    components: [
      {
        id: 'navbar-1',
        type: 'navbar',
        category: 'navigation',
        props: { title: 'Main Nav' },
        content: { title: 'Main Nav' },
        metadata: {
          pageId: 'page-1',
          position: 0,
          parentId: null,
          isShared: false,
        },
      },
    ],
    folders: {
      root: [],
      totalFolders: 0,
      maxDepth: 0,
      pathMappings: {},
    },
    metadata: {
      exportDate: new Date().toISOString(),
      websiteId: 'site-1',
      version: '1',
    },
  };

  it('syncs bundle and calls API', async () => {
    const fakeClient = new FakeKontentClient();
    const provider = new KontentProvider(undefined, fakeClient as any);

    const result = await provider.syncUnifiedBundle(bundle, {});

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(fakeClient.upsertContentType).toHaveBeenCalled();
    expect(fakeClient.upsertContentItem).toHaveBeenCalled();
  });

  it('creates content types and items during sync', async () => {
    const fakeClient = new FakeKontentClient();
    const provider = new KontentProvider(undefined, fakeClient as any);

    const result = await provider.syncUnifiedBundle(bundle);

    expect(result.successCount).toBe(1);
    expect(fakeClient.upsertContentType).toHaveBeenCalledWith(expect.objectContaining({ codename: 'page' }));
    expect(fakeClient.upsertContentType).toHaveBeenCalledWith(expect.objectContaining({ codename: 'navbar' }));
    expect(fakeClient.upsertContentItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: { codename: 'page' }, external_id: 'page-1' })
    );
    expect(fakeClient.upsertContentItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: { codename: 'navbar' }, external_id: 'navbar-1' })
    );
    expect(fakeClient.upsertVariant).toHaveBeenCalledWith(
      expect.stringMatching(/page_/),
      'default',
      expect.objectContaining({
        elements: expect.any(Array),
      })
    );
    expect(fakeClient.upsertVariant).toHaveBeenCalledWith(
      expect.stringMatching(/navbar/),
      'default',
      expect.objectContaining({
        elements: expect.arrayContaining([
          expect.objectContaining({ element: { codename: 'payload' } }),
        ]),
      })
    );

    const pageTypeCall = fakeClient.upsertContentType.mock.calls.find(
      ([payload]) => payload.codename === 'page'
    );
    expect(pageTypeCall).toBeDefined();
    const pageElements = (pageTypeCall?.[0].elements ?? []) as Array<Record<string, unknown>>;
    const componentsField = pageElements.find(element => element.codename === 'components');
    expect(componentsField?.allowed_content_types).toEqual([{ codename: 'navbar' }]);
  });
});
