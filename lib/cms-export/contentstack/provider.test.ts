import { ContentstackProvider } from './provider';
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import type { UniversalContentType } from '../types';

describe('ContentstackProvider unified export', () => {
  const createNotFoundError = () => {
    const err = new Error('Not found') as Error & { status?: number };
    err.status = 404;
    return err;
  };

  const basePage = (overrides: Partial<UnifiedContent> = {}): UnifiedContent => ({
    id: 'page-home',
    source: 'WebsitePage',
    type: 'page',
    title: 'Home',
    contentTypeId: 'page',
    content: {},
    metadata: { pathDepth: 0 },
    url: '/',
    parentId: undefined,
    components: [],
    publishedAt: null,
    status: 'published',
    templateKey: null,
    templateProps: null,
    ...overrides,
  });

  it('creates shared and inline components then wires modular blocks on pages', async () => {
    const provider = new ContentstackProvider({ stackApiKey: 'key', managementToken: 'token' }) as any;

    const createdEntries: Array<{ ct: string; uid: string; data: Record<string, unknown> }> = [];
    const publishedEntries: Array<{ ct: string; uid: string }> = [];

    const mockClient = {
      configure: jest.fn(),
      getEnvironment: jest.fn().mockReturnValue('development'),
      getLocale: jest.fn().mockReturnValue('en-us'),
      getContentType: jest.fn().mockImplementation(() => Promise.reject(createNotFoundError())),
      createContentType: jest.fn().mockResolvedValue({}),
      publishContentType: jest.fn().mockResolvedValue({}),
      getEntry: jest.fn().mockImplementation(() => Promise.reject(createNotFoundError())),
      createEntry: jest.fn().mockImplementation((ct: string, uid: string, data: Record<string, unknown>) => {
        createdEntries.push({ ct, uid, data });
        return { entry: { uid } };
      }),
      updateEntry: jest.fn().mockImplementation((ct: string, uid: string, data: Record<string, unknown>) => ({ entry: { uid, ...data } })),
      publishEntry: jest.fn().mockImplementation((ct: string, uid: string) => {
        publishedEntries.push({ ct, uid });
        return {};
      }),
    };

    provider.client = mockClient;
    provider.configured = true;
    provider.ensuredBaseTypes = false;

    const sharedComponent = {
      id: 'shared-hero-instance',
      type: 'hero_banner',
      isShared: true,
      sharedId: 'shared-hero',
      position: 0,
      properties: {
        title: 'Hero Section',
        displayOption: 'full',
      },
    };

    const localComponent = {
      id: 'cta-instance',
      type: 'cta_with_form',
      position: 1,
      properties: {
        title: 'CTA',
        displayOption: 'half',
        localOnly: true,
      },
    };

    const homePage = basePage({
      components: [sharedComponent],
      templateKey: 'Home Template',
    });

    const childPage = basePage({
      id: 'page-about',
      title: 'About',
      url: '/about',
      metadata: { pathDepth: 1 },
      parentId: 'page-home',
      components: [
        { ...sharedComponent, id: 'shared-hero-instance-2' },
        localComponent,
      ],
    });

    const bundle = {
      website: { id: 'site-1', name: 'Test Site' },
      contentTypes: [],
      unifiedContent: [childPage, homePage],
      componentUsage: [],
      components: [],
      folders: {
        root: [],
        totalFolders: 0,
        maxDepth: 0,
        pathMappings: {}
      },
      metadata: {
        exportDate: new Date().toISOString(),
        websiteId: 'site-1',
        version: '1.0.0'
      }
    };

    const result = await provider.syncUnifiedBundle(bundle);

    expect(mockClient.createContentType).toHaveBeenCalledTimes(3);
    const componentCreations = createdEntries.filter(entry => entry.ct === 'catalyst_component');
    expect(componentCreations).toHaveLength(2);
    expect(componentCreations[0].uid).toBe('shared-hero');
    expect(componentCreations[1].uid).toBe('cta-instance');
    expect(componentCreations[1].data.local_only).toBe(true);

    const pageCreations = createdEntries.filter(entry => entry.ct === 'catalyst_page');
    expect(pageCreations).toHaveLength(2);

    const homePayload = pageCreations.find(entry => entry.uid === 'page-home')!.data;
    expect(Array.isArray(homePayload.components)).toBe(true);
    const homeComponentRef = (homePayload.components as any[])[0].block[0];
    expect(homeComponentRef.uid).toBe('shared-hero');

    const aboutPayload = pageCreations.find(entry => entry.uid === 'page-about')!.data;
    expect(Array.isArray(aboutPayload.parent)).toBe(true);
    expect(aboutPayload.parent![0].uid).toBe('page-home');
    const childComponents = aboutPayload.components as any[];
    expect(childComponents[0].block[0].uid).toBe('shared-hero');
    expect(childComponents[1].block[0].uid).toBe('cta-instance');

    expect(homePayload.template_key).toBe('home_template');

    expect(publishedEntries.map(entry => entry.uid)).toEqual(
      expect.arrayContaining(['shared-hero', 'cta-instance', 'page-home', 'page-about'])
    );

    expect(result.successCount).toBe(2);
    const firstSuccess = result.details.find(detail => detail.action === 'created');
    expect(firstSuccess?.payload && typeof firstSuccess.payload === 'object').toBe(true);
    const metadata = (firstSuccess?.payload as any)?.metadata;
    expect(metadata?.contentstack?.entryUid).toBeDefined();
  });

  it('maps universal page types into Contentstack content type schema', async () => {
    const provider = new ContentstackProvider({ stackApiKey: 'key', managementToken: 'token' }) as any;

    const createdTypes: any[] = [];
    const mockClient = {
      configure: jest.fn(),
      createContentType: jest.fn().mockImplementation((definition: any) => {
        createdTypes.push(definition);
        return Promise.resolve({ content_type: definition });
      }),
    };

    provider.client = mockClient;
    provider.configured = true;
    provider.ensuredBaseTypes = true;

    const now = new Date();
    const universalType: UniversalContentType = {
      id: 'home',
      name: 'Home Page',
      description: 'Home template',
      version: '1.0',
      type: 'page',
      isRoutable: true,
      fields: [
        {
          id: 'title',
          name: 'Title',
          layer: 'primitive',
          type: 'text',
          required: true,
          metadata: { createdAt: now, updatedAt: now } as any,
        },
        {
          id: 'slug',
          name: 'Slug',
          layer: 'primitive',
          type: 'text',
          required: false,
          metadata: { createdAt: now, updatedAt: now } as any,
        },
        {
          id: 'hero_block',
          name: 'Hero Block',
          layer: 'common',
          type: 'component',
          required: false,
          platformSpecific: { allowedTypes: ['hero_section'] },
          metadata: { createdAt: now, updatedAt: now } as any,
        },
      ],
      metadata: { createdAt: now, updatedAt: now, platformSpecific: { provider: 'contentstack' } } as any,
    };

    await provider.createContentType(universalType);

    expect(mockClient.createContentType).toHaveBeenCalledTimes(1);
    const definition = createdTypes[0];
    expect(definition.uid).toBe('home');
    expect(definition.options).toMatchObject({ is_page: true, title: 'title' });
    expect(definition.options.url_pattern).toBe('/home/{{slug}}');
    const heroField = definition.schema.find((field: any) => field.uid === 'hero_block');
    expect(heroField).toBeDefined();
    expect(heroField.data_type).toBe('reference');
    expect(heroField.reference_to).toEqual(['hero_section']);

    const slugField = definition.schema.find((field: any) => field.uid === 'slug');
    expect(slugField?.data_type).toBe('text');

    const map = (provider as any).typeUidMap as Map<string, string>;
    expect(map.get('home')).toBe('home');
  });
});
