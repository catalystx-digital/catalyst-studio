import {
  hasPopulatedContent,
  getNodeType,
  getNodeLabel,
  getNodeComponents,
  getNodeMetadata,
  PopulatedTreeNode
} from '../populated-tree';

describe('populated-tree helper functions', () => {
  describe('hasPopulatedContent', () => {
    it('should return true when websitePageId is present', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(hasPopulatedContent(node)).toBe(true);
    });

    it('should return false when websitePageId is null', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(hasPopulatedContent(node)).toBe(false);
    });

    it('should return false when websitePageId is undefined', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: undefined,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(hasPopulatedContent(node)).toBe(false);
    });
  });

  describe('getNodeType', () => {
    it('should return contentType.category when present', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { category: 'custom' as any }
      };
      expect(getNodeType(node)).toBe('custom');
    });

    it('should return "page" when websitePage.type is "page"', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: null,
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeType(node)).toBe('page');
    });

    it('should return "folder" when no websitePageId and no contentType', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeType(node)).toBe('folder');
    });

    it('should return "page" when websitePageId exists but type is not specified', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeType(node)).toBe('page');
    });
  });

  describe('getNodeLabel', () => {
    it('should return node title when available', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test-slug',
        title: 'Node Title',
        websiteId: 'web1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeLabel(node)).toBe('Node Title');
    });

    it('should return websitePage.title when node title is empty', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test-slug',
        title: '',
        websiteId: 'web1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page Title',
          content: null,
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeLabel(node)).toBe('Page Title');
    });

    it('should return slug when no titles are available', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test-slug',
        title: '',
        websiteId: 'web1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeLabel(node)).toBe('test-slug');
    });
  });

  describe('getNodeComponents', () => {
    it('should return components array from websitePage.content object', () => {
      const components = [{ id: '1', type: 'hero' }];
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: { components },
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeComponents(node)).toEqual([
        expect.objectContaining({
          id: '1',
          type: 'hero',
          content: {},
        }),
      ]);
    });

    it('should parse JSON string content', () => {
      const components = [{ id: '1', type: 'hero' }];
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: JSON.stringify({ components }),
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeComponents(node)).toEqual([
        expect.objectContaining({
          id: '1',
          type: 'hero',
          content: {},
        }),
      ]);
    });

    it('should return empty array when no websitePageId', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeComponents(node)).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: 'invalid json' as any,
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeComponents(node)).toEqual([]);
    });

    it('should handle content as direct array', () => {
      const components = [{ id: '1', type: 'hero' }];
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: components as any,
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeComponents(node)).toEqual([
        expect.objectContaining({
          id: '1',
          type: 'hero',
          content: {},
        }),
      ]);
    });

    it('should not promote stale props.content into canonical component content', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: {
            components: [
              {
                id: '1',
                type: 'hero',
                props: {
                  content: { heading: 'Legacy props.content heading' },
                },
                content: {},
              },
            ],
          },
          metadata: null,
          type: 'page'
        }
      };

      const [component] = getNodeComponents(node) as Array<Record<string, any>>;
      expect(component.content).toEqual({});
      expect(component.props).not.toHaveProperty('content');
    });
  });

  describe('getNodeMetadata', () => {
    it('should return metadata from websitePage', () => {
      const metadata = { seoTitle: 'Test SEO', keywords: ['test'] };
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: null,
          metadata,
          type: 'page'
        }
      };
      expect(getNodeMetadata(node)).toEqual(metadata);
    });

    it('should return undefined when no websitePageId', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(getNodeMetadata(node)).toBeUndefined();
    });

    it('should return undefined when websitePage has no metadata', () => {
      const node: PopulatedTreeNode = {
        id: '1',
        slug: 'test',
        title: 'Test',
        websiteId: 'web1',
        websitePageId: 'page1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: {
          title: 'Page',
          content: null,
          metadata: null,
          type: 'page'
        }
      };
      expect(getNodeMetadata(node)).toBeNull();
    });
  });
});
