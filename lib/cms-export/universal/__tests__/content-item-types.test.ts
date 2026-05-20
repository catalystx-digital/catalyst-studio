import {
  UniversalContentItem,
  ContentFilter,
  PaginationOptions,
  ContentValidationResult,
  ContentStatus,
  ContentRelationship
} from '../types';

describe('UniversalContentItem Types', () => {
  describe('UniversalContentItem', () => {
    it('should accept valid content item structure', () => {
      const validItem: UniversalContentItem = {
        id: 'item-1',
        contentTypeId: 'article',
        title: 'Test Article',
        slug: 'test-article',
        content: {
          body: 'Article content',
          summary: 'Brief summary'
        },
        metadata: { author: 'Test Author' },
        status: 'published',
        relationships: [
          {
            type: 'parent',
            targetId: 'category-1',
            targetType: 'category'
          }
        ],
        publishedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        version: '1.0',
        platformSpecific: { optimizelyId: 'opt-123' }
      };

      expect(validItem.id).toBe('item-1');
      expect(validItem.status).toBe('published');
      expect(validItem.relationships?.length).toBe(1);
    });

    it('should accept minimal content item structure', () => {
      const minimalItem: UniversalContentItem = {
        id: 'item-2',
        contentTypeId: 'page',
        title: 'Simple Page',
        slug: 'simple-page',
        content: {},
        status: 'draft'
      };

      expect(minimalItem.id).toBe('item-2');
      expect(minimalItem.metadata).toBeUndefined();
      expect(minimalItem.relationships).toBeUndefined();
    });

    it('should enforce content status types', () => {
      const statuses: ContentStatus[] = ['draft', 'published', 'archived'];
      
      statuses.forEach(status => {
        const item: UniversalContentItem = {
          id: 'test',
          contentTypeId: 'test',
          title: 'Test',
          slug: 'test',
          content: {},
          status
        };
        expect(item.status).toBe(status);
      });
    });
  });

  describe('ContentRelationship', () => {
    it('should accept valid relationship structures', () => {
      const relationships: ContentRelationship[] = [
        {
          type: 'parent',
          targetId: 'parent-1'
        },
        {
          type: 'child',
          targetId: 'child-1',
          targetType: 'article'
        },
        {
          type: 'reference',
          targetId: 'ref-1',
          metadata: { order: 1 }
        },
        {
          type: 'component',
          targetId: 'comp-1',
          targetType: 'hero',
          metadata: { slot: 'header' }
        }
      ];

      relationships.forEach(rel => {
        expect(rel.targetId).toBeTruthy();
        expect(['parent', 'child', 'reference', 'component']).toContain(rel.type);
      });
    });
  });

  describe('ContentFilter', () => {
    it('should accept comprehensive filter options', () => {
      const filter: ContentFilter = {
        contentTypeId: 'article',
        status: ['published', 'draft'],
        ids: ['id1', 'id2'],
        slug: 'test-slug',
        search: 'keyword',
        metadata: { category: 'tech' },
        createdAfter: new Date('2024-01-01'),
        createdBefore: new Date('2024-12-31'),
        updatedAfter: new Date('2024-01-01'),
        updatedBefore: new Date('2024-12-31'),
        publishedAfter: new Date('2024-01-01'),
        publishedBefore: new Date('2024-12-31'),
        hasRelationship: {
          type: 'parent',
          targetId: 'cat-1'
        }
      };

      expect(filter.contentTypeId).toBe('article');
      expect(filter.status).toContain('published');
      expect(filter.hasRelationship?.type).toBe('parent');
    });

    it('should accept minimal filter options', () => {
      const minimalFilter: ContentFilter = {};
      expect(minimalFilter).toBeDefined();
    });

    it('should accept single status or array', () => {
      const singleStatus: ContentFilter = {
        status: 'published'
      };
      
      const multiStatus: ContentFilter = {
        status: ['published', 'draft']
      };

      expect(singleStatus.status).toBe('published');
      expect(multiStatus.status).toContain('published');
      expect(multiStatus.status).toContain('draft');
    });
  });

  describe('PaginationOptions', () => {
    it('should require limit field', () => {
      const pagination: PaginationOptions = {
        limit: 10
      };
      
      expect(pagination.limit).toBe(10);
      expect(pagination.offset).toBeUndefined();
    });

    it('should accept all pagination options', () => {
      const fullPagination: PaginationOptions = {
        limit: 20,
        offset: 40,
        cursor: 'cursor-token',
        orderBy: {
          field: 'createdAt',
          direction: 'desc'
        }
      };

      expect(fullPagination.limit).toBe(20);
      expect(fullPagination.offset).toBe(40);
      expect(fullPagination.cursor).toBe('cursor-token');
      expect(fullPagination.orderBy?.direction).toBe('desc');
    });

    it('should enforce orderBy direction types', () => {
      const ascPagination: PaginationOptions = {
        limit: 10,
        orderBy: { field: 'title', direction: 'asc' }
      };
      
      const descPagination: PaginationOptions = {
        limit: 10,
        orderBy: { field: 'title', direction: 'desc' }
      };

      expect(ascPagination.orderBy?.direction).toBe('asc');
      expect(descPagination.orderBy?.direction).toBe('desc');
    });
  });

  describe('ContentValidationResult', () => {
    it('should handle valid result', () => {
      const validResult: ContentValidationResult = {
        valid: true
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toBeUndefined();
      expect(validResult.warnings).toBeUndefined();
    });

    it('should handle validation errors', () => {
      const errorResult: ContentValidationResult = {
        valid: false,
        errors: [
          {
            field: 'title',
            code: 'REQUIRED_FIELD',
            message: 'Title is required',
            severity: 'error'
          },
          {
            code: 'INVALID_STATUS',
            message: 'Invalid content status',
            severity: 'error'
          }
        ]
      };

      expect(errorResult.valid).toBe(false);
      expect(errorResult.errors?.length).toBe(2);
      expect(errorResult.errors?.[0].field).toBe('title');
      expect(errorResult.errors?.[1].field).toBeUndefined();
    });

    it('should handle warnings', () => {
      const warningResult: ContentValidationResult = {
        valid: true,
        warnings: [
          {
            field: 'metadata',
            code: 'MISSING_METADATA',
            message: 'Consider adding metadata for better SEO'
          }
        ]
      };

      expect(warningResult.valid).toBe(true);
      expect(warningResult.warnings?.length).toBe(1);
    });

    it('should handle both errors and warnings', () => {
      const mixedResult: ContentValidationResult = {
        valid: false,
        errors: [
          {
            field: 'slug',
            code: 'DUPLICATE_SLUG',
            message: 'Slug already exists',
            severity: 'error'
          }
        ],
        warnings: [
          {
            field: 'description',
            code: 'SHORT_DESCRIPTION',
            message: 'Description is too short'
          }
        ]
      };

      expect(mixedResult.valid).toBe(false);
      expect(mixedResult.errors?.length).toBe(1);
      expect(mixedResult.warnings?.length).toBe(1);
    });

    it('should enforce severity types', () => {
      const result: ContentValidationResult = {
        valid: false,
        errors: [
          {
            code: 'ERROR1',
            message: 'Error message',
            severity: 'error'
          },
          {
            code: 'WARNING_AS_ERROR',
            message: 'Warning treated as error',
            severity: 'warning'
          }
        ]
      };

      expect(result.errors?.[0].severity).toBe('error');
      expect(result.errors?.[1].severity).toBe('warning');
    });
  });
});