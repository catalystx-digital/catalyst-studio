import type { SnapshotPage } from '@/lib/studio/headless/site-snapshot/types';
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance';
import { renderToStaticMarkup } from 'react-dom/server';

const mockRenderCMSComponents = jest.fn(async () => []);

jest.mock('@/lib/studio/components/cms/_factory/renderer.server', () => ({
  __esModule: true,
  renderCMSComponents: (...args: unknown[]) => mockRenderCMSComponents(...args),
}));

describe('PageRendererHelper', () => {
  beforeEach(() => {
    mockRenderCMSComponents.mockClear();
  });

  it('maps marketing home components into CMS props with region-aware nesting', async () => {
    const hero: ComponentInstance = {
      id: 'hero-1',
      type: 'hero-banner',
      parentId: null,
      position: 0,
      props: {
        theme: 'dark',
        content: {
          heading: 'Launch faster with Catalyst',
          subheading: 'Ship marketing sites without bottlenecks',
          eyebrow: 'Marketing Home'
        }
      },
      content: {
        heading: 'Launch faster with Catalyst',
        subheading: 'Ship marketing sites without bottlenecks'
      },
      styles: {},
      metadata: {
        blueprint: 'marketing/home-default'
      }
    };

    const feature: ComponentInstance = {
      id: 'feature-1',
      type: 'feature-grid',
      parentId: 'hero-1',
      position: 1,
      props: {
        region: 'features',
        content: {
          heading: 'Why teams choose Catalyst',
          items: [
            { title: 'Visual edits', description: 'Real-time collaboration in the canvas.' },
            { title: 'AI assisted', description: 'Jump-start hero copy and layouts.' }
          ]
        }
      },
      content: {},
      styles: {},
      metadata: {}
    };

    const cta: ComponentInstance = {
      id: 'cta-1',
      type: 'cta-banner',
      parentId: 'hero-1',
      position: 2,
      props: {
        region: 'cta',
        content: {
          heading: 'Ready to transform your marketing site?',
          primaryAction: { label: 'Request demo', href: '#demo' }
        }
      },
      content: {},
      styles: {},
      metadata: {}
    };

    const page: SnapshotPage = {
      id: 'page-1',
      title: 'Marketing Home',
      fullPath: '/',
      templateKey: 'marketing/home-default',
      templateProps: {},
      regions: [],
      components: [hero, feature, cta],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');

    const element = await PageRendererHelper({
      page,
      sharedComponents: [],
      structure: undefined,
      fallback: null,
      onMetrics: undefined
    });

    renderToStaticMarkup(element as unknown as React.ReactElement);

    expect(mockRenderCMSComponents).toHaveBeenCalledTimes(1);
    const [componentsArg] = mockRenderCMSComponents.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>
    ];
    expect(Array.isArray(componentsArg)).toBe(true);
    expect(componentsArg).toHaveLength(1);

    const [rootComponent] = componentsArg;
    expect(rootComponent).toHaveProperty('id', 'hero-1');
    expect(rootComponent).toHaveProperty('type', 'hero-banner');
    expect(rootComponent).toHaveProperty('theme', 'dark');
    expect(rootComponent).not.toHaveProperty('onLoad');
    expect(rootComponent).not.toHaveProperty('onError');
    expect(rootComponent).not.toHaveProperty('onInteraction');

    const content = rootComponent.content as Record<string, unknown>;
    expect(content).toBeDefined();
    expect(content).toHaveProperty('heading', 'Launch faster with Catalyst');

    const areas = (content.areas ?? {}) as Record<string, unknown>;
    expect(Array.isArray(areas.features)).toBe(true);
    expect(Array.isArray(areas.cta)).toBe(true);

    const featureArea = areas.features as Array<Record<string, unknown>>;
    expect(featureArea[0]).toHaveProperty('type', 'feature-grid');
    expect((featureArea[0].content as Record<string, unknown>).heading).toBe('Why teams choose Catalyst');

    const ctaArea = areas.cta as Array<Record<string, unknown>>;
    expect(ctaArea[0]).toHaveProperty('type', 'cta-banner');
    expect((ctaArea[0].content as Record<string, unknown>).heading).toBe('Ready to transform your marketing site?');
    expect(ctaArea[0]).not.toHaveProperty('onInteraction');

    const metadata = rootComponent.metadata as Record<string, unknown>;
    expect(metadata.position).toBe(0);
  });
});
