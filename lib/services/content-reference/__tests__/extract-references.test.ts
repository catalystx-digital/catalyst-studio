import { extractReferences, ExtractedReference } from '../extract-references';

describe('extractReferences', () => {
  describe('empty content', () => {
    it('should return empty array for null', () => {
      const result = extractReferences(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = extractReferences(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for primitive values', () => {
      expect(extractReferences('string')).toEqual([]);
      expect(extractReferences(123)).toEqual([]);
      expect(extractReferences(true)).toEqual([]);
    });

    it('should return empty array for empty object', () => {
      const result = extractReferences({});
      expect(result).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      const result = extractReferences([]);
      expect(result).toEqual([]);
    });
  });

  describe('media references', () => {
    it('should extract single media reference', () => {
      // NEW format: { mediaId, mediaType, ... }
      const content = {
        mediaId: 'media-123',
        mediaType: 'image',
        alt: 'Test image'
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        targetType: 'media',
        targetId: 'media-123',
        sourcePath: ''
      });
    });

    it('should extract multiple media references', () => {
      const content = {
        hero: {
          mediaId: 'media-1',
          mediaType: 'image'
        },
        gallery: [
          {
            mediaId: 'media-2',
            mediaType: 'image'
          },
          {
            mediaId: 'media-3',
            mediaType: 'video'
          }
        ]
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(3);
      expect(result[0].targetId).toBe('media-1');
      expect(result[1].targetId).toBe('media-2');
      expect(result[2].targetId).toBe('media-3');
    });
  });

  describe('page references', () => {
    it('should extract single page reference (internal link)', () => {
      // NEW format: { type: 'internal', pageId, path }
      const content = {
        type: 'internal',
        pageId: 'page-456',
        path: '/about'
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        targetType: 'page',
        targetId: 'page-456',
        sourcePath: ''
      });
    });

    it('should extract multiple page references', () => {
      const content = {
        links: [
          {
            type: 'internal',
            pageId: 'page-1',
            path: '/page-1'
          },
          {
            type: 'internal',
            pageId: 'page-2',
            path: '/page-2'
          }
        ]
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(2);
      expect(result[0].targetId).toBe('page-1');
      expect(result[1].targetId).toBe('page-2');
    });
  });

  describe('nested references', () => {
    it('should extract references from deeply nested objects', () => {
      const content = {
        sections: [
          {
            header: {
              logo: {
                mediaId: 'logo-media',
                mediaType: 'image'
              }
            }
          }
        ]
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(1);
      expect(result[0].targetId).toBe('logo-media');
      expect(result[0].sourcePath).toBe('sections[0].header.logo');
    });

    it('should extract references from nested arrays', () => {
      const content = {
        rows: [
          {
            columns: [
              {
                mediaId: 'col1-media',
                mediaType: 'image'
              },
              {
                mediaId: 'col2-media',
                mediaType: 'file'
              }
            ]
          }
        ]
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(2);
      expect(result[0].sourcePath).toBe('rows[0].columns[0]');
      expect(result[1].sourcePath).toBe('rows[0].columns[1]');
    });
  });

  describe('mixed references', () => {
    it('should extract both media and page references', () => {
      const content = {
        hero: {
          mediaId: 'hero-media',
          mediaType: 'image'
        },
        callToAction: {
          type: 'internal',
          pageId: 'contact-page',
          path: '/contact'
        }
      };

      const result = extractReferences(content);

      expect(result).toHaveLength(2);
      expect(result[0].targetType).toBe('media');
      expect(result[1].targetType).toBe('page');
    });
  });

  describe('source path tracking', () => {
    it('should track paths correctly for nested structures', () => {
      const content = {
        header: {
          nav: {
            items: [
              {
                type: 'internal',
                pageId: 'page-1',
                path: '/page-1'
              }
            ]
          }
        }
      };

      const result = extractReferences(content);

      expect(result[0].sourcePath).toBe('header.nav.items[0]');
    });
  });

  describe('edge cases', () => {
    it('should ignore media objects without mediaId', () => {
      const content = {
        mediaType: 'image'
        // Missing mediaId field
      };

      const result = extractReferences(content);
      expect(result).toEqual([]);
    });

    it('should ignore page objects without pageId', () => {
      const content = {
        type: 'internal',
        path: '/about'
        // Missing pageId field
      };

      const result = extractReferences(content);
      expect(result).toEqual([]);
    });

    it('should ignore objects with type but not internal', () => {
      const content = {
        type: 'external',
        url: 'https://example.com'
      };

      const result = extractReferences(content);
      expect(result).toEqual([]);
    });

    it('should handle non-string mediaId/pageId', () => {
      const content1 = {
        mediaId: 123, // Not a string
        mediaType: 'image'
      };

      const content2 = {
        type: 'internal',
        pageId: null, // Not a string
        path: '/about'
      };

      expect(extractReferences(content1)).toEqual([]);
      expect(extractReferences(content2)).toEqual([]);
    });
  });
});
