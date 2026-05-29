import type { SnapshotPage } from '@/lib/studio/headless/site-snapshot/types';
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCmsPresentationContext } from '../cms-presentation';

const mockRenderCMSComponents = jest.fn(async () => []);

jest.mock('@/lib/studio/components/cms/_factory/renderer.server', () => ({
  __esModule: true,
  renderCMSComponents: (...args: unknown[]) => mockRenderCMSComponents(...args),
}));

describe('PageRendererHelper', () => {
  beforeEach(() => {
    mockRenderCMSComponents.mockClear();
  });

  it('classifies institutional pages before agency wording like our work', () => {
    const page: SnapshotPage = {
      id: 'rch-home',
      title: 'Hospital home',
      fullPath: '/',
      templateKey: 'marketing/home-default',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          parentId: null,
          position: 0,
          props: {},
          content: {
            heading: 'Our work',
            body: 'The hospital supports health services for children.'
          },
          styles: {},
          metadata: {}
        }
      ],
      metadata: { importSource: 'https://www.rch.org.au/home/' },
      sharedComponentIds: []
    };

    expect(buildCmsPresentationContext(page).pageKind).toBe('institutional');
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
          heading: 'Stale props.content heading',
          subheading: 'Stale props.content subheading',
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
      content: {
        heading: 'Why teams choose Catalyst',
        items: [
          { title: 'Visual edits', description: 'Real-time collaboration in the canvas.' },
          { title: 'AI assisted', description: 'Jump-start hero copy and layouts.' }
        ]
      },
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
      content: {
        heading: 'Ready to transform your marketing site?',
        primaryAction: { label: 'Request demo', href: '#demo' }
      },
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
    expect(rootComponent).toHaveProperty('content');
    expect(rootComponent).not.toHaveProperty('text');

    const content = rootComponent.content as Record<string, unknown>;
    expect(content).toEqual(expect.objectContaining({
      heading: 'Launch faster with Catalyst'
    }));
    expect(content).not.toEqual(expect.objectContaining({
      heading: 'Stale props.content heading'
    }));
    expect(content).not.toHaveProperty('eyebrow');

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

  it('keeps empty canonical content instead of falling back to stale props.content', async () => {
    const page: SnapshotPage = {
      id: 'page-stale-props-content',
      title: 'Stale Props Content',
      fullPath: '/stale-props-content',
      templateKey: 'test',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {
            content: {
              heading: 'Stale heading'
            },
            text: JSON.stringify({ heading: 'Stale text heading' })
          },
          content: {},
          styles: {},
          metadata: {}
        }
      ],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    await PageRendererHelper({ page, sharedComponents: [], structure: undefined });

    const [componentsArg] = mockRenderCMSComponents.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>
    ];
    expect(componentsArg[0]).toHaveProperty('content');
    expect(componentsArg[0].content).toEqual({});
    expect(componentsArg[0]).not.toHaveProperty('text');
  });

  it('does not render a synthetic page title for imported pages', async () => {
    const page: SnapshotPage = {
      id: 'imported-page',
      title: 'Imported Home',
      fullPath: '/',
      templateKey: 'core/generic-default',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {},
          content: { heading: 'Source hero heading' },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {
        importSource: 'https://example.com/'
      },
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    const element = await PageRendererHelper({ page, sharedComponents: [], structure: undefined });
    const html = renderToStaticMarkup(element as unknown as React.ReactElement);

    expect(html).not.toContain('page-header');
    expect(html).not.toContain('Imported Home');
  });

  it('keeps the page title for non-imported pages', async () => {
    const page: SnapshotPage = {
      id: 'manual-page',
      title: 'Manual Page',
      fullPath: '/manual',
      templateKey: 'core/generic-default',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {},
          content: { heading: 'Manual hero heading' },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    const element = await PageRendererHelper({ page, sharedComponents: [], structure: undefined });
    const html = renderToStaticMarkup(element as unknown as React.ReactElement);

    expect(html).toContain('page-header');
    expect(html).toContain('Manual Page');
  });

  it('adds runtime-only CMS presentation attributes without mutating page content', async () => {
    const page: SnapshotPage = {
      id: 'presentation-page',
      title: 'Royal Hospital Services',
      fullPath: '/',
      templateKey: 'institutional/home',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'nav-1',
          type: 'navbar',
          parentId: null,
          position: 0,
          props: {},
          content: { links: [{ label: 'Patients', url: '/patients' }] },
          styles: {},
          metadata: {}
        },
        {
          id: 'hero-1',
          type: 'hero-with-image',
          parentId: null,
          position: 1,
          props: {},
          content: { heading: 'Hospital care' },
          styles: {},
          metadata: {}
        },
        {
          id: 'cards-1',
          type: 'card-grid',
          parentId: null,
          position: 2,
          props: {},
          content: {
            cards: [
              { title: 'Emergency' },
              { title: 'Clinics' },
              { title: 'Research' }
            ]
          },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {
        importSource: 'https://www.rch.org.au/home/'
      },
      sharedComponentIds: []
    };
    const original = JSON.parse(JSON.stringify(page));

    const { PageRendererHelper } = await import('../page-renderer');
    const element = await PageRendererHelper({ page, sharedComponents: [], structure: undefined });
    const html = renderToStaticMarkup(element as unknown as React.ReactElement);

    expect(html).toContain('data-cms-page-kind="institutional"');
    expect(html).toContain('data-cms-density="spacious"');
    expect(html).toContain('data-cms-tone="brand"');
    expect(html).toContain('data-cms-has-hero="true"');
    expect(html).toContain('data-cms-has-navigation="true"');
    expect(page).toEqual(original);
  });

  it('classifies digital agency imports as agency pages even when they have many cards', async () => {
    const page: SnapshotPage = {
      id: 'agency-page',
      title: 'Home',
      fullPath: '/',
      templateKey: 'imported/home',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'hero-1',
          type: 'hero-with-image',
          parentId: null,
          position: 0,
          props: {},
          content: {
            heading: 'Brighter digital experiences',
            subheading: 'A full service digital agency creating bright digital experiences.'
          },
          styles: {},
          metadata: {}
        },
        {
          id: 'projects-1',
          type: 'card-grid',
          parentId: null,
          position: 1,
          props: {},
          content: {
            heading: 'Some of our latest projects',
            cards: Array.from({ length: 10 }, (_, index) => ({ title: `Project ${index + 1}` }))
          },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {
        importSource: 'https://www.luminary.com/'
      },
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    const element = await PageRendererHelper({ page, sharedComponents: [], structure: undefined });
    const html = renderToStaticMarkup(element as unknown as React.ReactElement);

    expect(html).toContain('data-cms-page-kind="agency"');
    expect(html).toContain('theme-light');
  });

  it('does not classify a page as agency from a hard-coded source domain alone', () => {
    const page: SnapshotPage = {
      id: 'domain-only-page',
      title: 'Home',
      fullPath: '/',
      templateKey: 'imported/home',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          parentId: null,
          position: 0,
          props: {},
          content: {
            heading: 'Welcome',
            body: 'Helpful information for visitors.'
          },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {
        importSource: 'https://www.luminary.com/'
      },
      sharedComponentIds: []
    };

    expect(buildCmsPresentationContext(page).pageKind).toBe('generic');
  });

  it('does not classify a page as agency from agency wording in the source URL alone', () => {
    const page: SnapshotPage = {
      id: 'url-keyword-page',
      title: 'Home',
      fullPath: '/',
      templateKey: 'imported/home',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          parentId: null,
          position: 0,
          props: {},
          content: {
            heading: 'Welcome',
            body: 'Helpful information for visitors.'
          },
          styles: {},
          metadata: {}
        }
      ],
      metadata: {
        importSource: 'https://example-agency.test/portfolio'
      },
      sharedComponentIds: []
    };

    expect(buildCmsPresentationContext(page).pageKind).toBe('generic');
  });

  it('does not synthesize content from legacy props.text at render time', async () => {
    const page: SnapshotPage = {
      id: 'page-legacy-text',
      title: 'Legacy Text',
      fullPath: '/legacy-text',
      templateKey: 'test',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'blog-1',
          type: 'blog-list',
          parentId: null,
          position: 0,
          props: {
            text: JSON.stringify({
              heading: 'Legacy News',
              blogs: [{ title: 'Legacy Post', topic: 'Updates' }]
            })
          },
          content: {},
          styles: {},
          metadata: {}
        }
      ],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    await PageRendererHelper({ page, sharedComponents: [], structure: undefined });

    const [componentsArg] = mockRenderCMSComponents.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>
    ];
    expect(componentsArg[0].content).toEqual({});
    expect(componentsArg[0]).not.toHaveProperty('text');
  });

  it('throws for unknown component types instead of coercing to text-block', async () => {
    const page: SnapshotPage = {
      id: 'page-bad-type',
      title: 'Bad Type',
      fullPath: '/bad-type',
      templateKey: 'test',
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'bad-1',
          type: 'unknown-widget',
          parentId: null,
          position: 0,
          props: {},
          content: {},
          styles: {},
          metadata: {}
        }
      ],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    await expect(PageRendererHelper({ page, sharedComponents: [], structure: undefined }))
      .rejects
      .toThrow('[PageRendererHelper] Unknown component type encountered: unknown-widget');
  });

  it('throws when a page has no components', async () => {
    const page: SnapshotPage = {
      id: 'page-empty',
      title: 'Empty',
      fullPath: '/empty',
      templateKey: 'test',
      templateProps: {},
      regions: [],
      components: [],
      metadata: {},
      sharedComponentIds: []
    };

    const { PageRendererHelper } = await import('../page-renderer');
    await expect(PageRendererHelper({ page, sharedComponents: [], structure: undefined }))
      .rejects
      .toThrow('[PageRendererHelper] Page "page-empty" has no components to render.');
  });
});
