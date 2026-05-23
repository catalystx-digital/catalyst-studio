import { RelationshipManager, RelationshipErrorCode } from '../../managers/relationship-manager';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';

describe('RelationshipManager', () => {
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    relationshipManager = new RelationshipManager();
  });

  describe('buildRelationshipsFromUnified', () => {
    it('should build parent-child relationships', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'parent-1',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Parent Folder',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'child-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Child Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'parent-1'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual({
        sourceId: 'child-1',
        targetId: 'parent-1',
        relationshipType: 'parent-child',
        isValid: true
      });
    });

    it('should build component reference relationships', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page with Components',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          components: [
            {
              id: 'comp-1',
              type: 'navigation',
              position: 0,
              properties: {},
              isShared: true,
              sharedId: 'shared-nav-1'
            },
            {
              id: 'comp-2',
              type: 'text',
              position: 1,
              properties: {},
              isShared: false
            }
          ]
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual({
        sourceId: 'page-1',
        targetId: 'shared-nav-1',
        relationshipType: 'reference',
        isValid: true
      });
    });

    it('should detect circular dependencies', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'item-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Item 1',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'item-2'
        },
        {
          id: 'item-2',
          source: 'WebsitePage',
          type: 'page',
          title: 'Item 2',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'item-1'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);

      // Both relationships should be marked as invalid due to circular dependency
      expect(relationships).toHaveLength(2);
      expect(relationships.every(r => !r.isValid)).toBe(true);
    });

    it('should handle complex hierarchy with mixed content types', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'root-folder',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Root',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'sub-folder',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Sub Folder',
          contentTypeId: 'folder',
          content: {},
          status: 'published',
          parentId: 'root-folder'
        },
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page 1',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'sub-folder'
        },
        {
          id: 'data-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Data Item',
          contentTypeId: 'product',
          content: { name: 'Product', price: 99 },
          status: 'published'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);

      expect(relationships).toHaveLength(2);
      
      // Check sub-folder -> root-folder relationship
      const subFolderRel = relationships.find(r => r.sourceId === 'sub-folder');
      expect(subFolderRel).toBeDefined();
      expect(subFolderRel?.targetId).toBe('root-folder');
      expect(subFolderRel?.isValid).toBe(true);

      // Check page-1 -> sub-folder relationship  
      const pageRel = relationships.find(r => r.sourceId === 'page-1');
      expect(pageRel).toBeDefined();
      expect(pageRel?.targetId).toBe('sub-folder');
      expect(pageRel?.isValid).toBe(true);
    });

    it('should respect structureParentId when parentId is missing', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'structure-folder',
          source: 'WebsiteStructure',
          type: 'folder',
          title: 'Structure Folder',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'structured-page',
          source: 'WebsitePage',
          type: 'page',
          title: 'Structured Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          structureParentId: 'structure-folder'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual({
        sourceId: 'structured-page',
        targetId: 'structure-folder',
        relationshipType: 'parent-child',
        isValid: true
      });
    });
  });

  describe('validateRelationships', () => {
    it('should validate correct relationships', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'folder-1',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Folder',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'folder-1'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);
      const validation = relationshipManager.validateRelationships(relationships, unifiedContent);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect missing parent references', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'missing-parent'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);
      const validation = relationshipManager.validateRelationships(relationships, unifiedContent);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].code).toBe(RelationshipErrorCode.ERR_ORPHANED_CONTENT);
      expect(validation.errors[0].sourceId).toBe('page-1');
    });

    it('should detect invalid parent types', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'data-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Data Item',
          contentTypeId: 'product',
          content: {},
          status: 'published'
        },
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'data-1'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);
      const validation = relationshipManager.validateRelationships(relationships, unifiedContent);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === RelationshipErrorCode.ERR_INVALID_REF)).toBe(true);
    });

    it('should detect cross-source parent relationships as warnings', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'data-parent',
          source: 'WebsitePage',
          type: 'folder', // Artificially make it a valid parent type
          title: 'Data Parent',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'page-child',
          source: 'WebsitePage',
          type: 'page',
          title: 'Page Child',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'data-parent'
        }
      ];

      const relationships = relationshipManager.buildRelationshipsFromUnified(unifiedContent);
      const validation = relationshipManager.validateRelationships(relationships, unifiedContent);

      expect(validation.valid).toBe(true); // Valid but has warnings
      expect(validation.warnings.some(w => w.code === 'CROSS_SOURCE_PARENT')).toBe(true);
    });
  });

  describe('getDependencyOrder', () => {
    it('should order items with parents after children', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'child-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Child Page',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'parent-1'
        },
        {
          id: 'parent-1',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Parent Folder',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'grandchild-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Grandchild',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'child-1'
        }
      ];

      const ordered = relationshipManager.getDependencyOrder(unifiedContent);

      const parentIndex = ordered.findIndex(item => item.id === 'parent-1');
      const childIndex = ordered.findIndex(item => item.id === 'child-1');
      const grandchildIndex = ordered.findIndex(item => item.id === 'grandchild-1');

      expect(parentIndex).toBeLessThan(childIndex);
      expect(childIndex).toBeLessThan(grandchildIndex);
    });

    it('should handle items without dependencies first', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'dependent-item',
          source: 'WebsitePage',
          type: 'page',
          title: 'Dependent Item',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'independent-item'
        },
        {
          id: 'independent-item',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Independent Item',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        },
        {
          id: 'another-independent',
          source: 'WebsitePage',
          type: 'page',
          title: 'Another Independent',
          contentTypeId: 'product',
          content: {},
          status: 'published'
        }
      ];

      const ordered = relationshipManager.getDependencyOrder(unifiedContent);

      // Independent items should come before dependent items
      const independentIndex = ordered.findIndex(item => item.id === 'independent-item');
      const anotherIndependentIndex = ordered.findIndex(item => item.id === 'another-independent');
      const dependentIndex = ordered.findIndex(item => item.id === 'dependent-item');

      expect(independentIndex).toBeLessThan(dependentIndex);
      expect(anotherIndependentIndex).toBeLessThan(dependentIndex);
    });

    it('should handle circular dependencies by adding them to the end', () => {
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'item-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Item 1',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'item-2'
        },
        {
          id: 'item-2',
          source: 'WebsitePage',
          type: 'page',
          title: 'Item 2',
          contentTypeId: 'page',
          content: {},
          status: 'published',
          parentId: 'item-1'
        },
        {
          id: 'independent-item',
          source: 'WebsitePage',
          type: 'folder',
          title: 'Independent',
          contentTypeId: 'folder',
          content: {},
          status: 'published'
        }
      ];

      const ordered = relationshipManager.getDependencyOrder(unifiedContent);

      // All items should be included
      expect(ordered).toHaveLength(3);
      
      // Independent item should come first
      expect(ordered[0].id).toBe('independent-item');
      
      // Circular dependent items should be at the end
      const lastTwoIds = ordered.slice(1).map(item => item.id).sort();
      expect(lastTwoIds).toEqual(['item-1', 'item-2']);
    });
  });

  describe('content ID mapping', () => {
    it('should store and retrieve content ID mappings', () => {
      const originalId = 'original-123';
      const optimizelyId = 'optimizely-456';

      relationshipManager.updateContentIdMapping(originalId, optimizelyId);
      
      const retrieved = relationshipManager.getOptimizelyId(originalId);
      expect(retrieved).toBe(optimizelyId);
    });

    it('should return undefined for unmapped IDs', () => {
      const retrieved = relationshipManager.getOptimizelyId('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      // Set up some data
      relationshipManager.updateContentIdMapping('id1', 'opt1');
      
      const unifiedContent: UnifiedContent[] = [
        {
          id: 'test-item',
          source: 'WebsitePage',
          type: 'page',
          title: 'Test',
          contentTypeId: 'page',
          content: {},
          status: 'published'
        }
      ];
      
      // Build relationships to populate caches
      relationshipManager.buildRelationshipsFromUnified(unifiedContent);
      
      // Verify data exists
      expect(relationshipManager.getOptimizelyId('id1')).toBe('opt1');
      
      // Clear caches
      relationshipManager.clearCaches();
      
      // Verify data is cleared
      expect(relationshipManager.getOptimizelyId('id1')).toBeUndefined();
    });
  });
})
