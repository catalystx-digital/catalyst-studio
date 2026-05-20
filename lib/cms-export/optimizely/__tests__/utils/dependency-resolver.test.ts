import { DependencyResolver } from '../../utils/dependency-resolver';
import { RelationshipManager } from '../../managers/relationship-manager';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import type { CompiledType } from '../../schema/types';

// Mock RelationshipManager
jest.mock('../../managers/relationship-manager');

describe('DependencyResolver', () => {
  let dependencyResolver: DependencyResolver;
  let mockRelationshipManager: jest.Mocked<RelationshipManager>;

  beforeEach(() => {
    mockRelationshipManager = new RelationshipManager() as jest.Mocked<RelationshipManager>;
    dependencyResolver = new DependencyResolver(mockRelationshipManager);
  });

  const createMockContent = (id: string, type: 'folder' | 'page' | 'data', parentId?: string): UnifiedContent => ({
    id,
    source: 'WebsitePage',
    type,
    title: `${type} ${id}`,
    contentTypeId: type,
    content: {},
    status: 'published',
    parentId
  });

  describe('createDependencyGraph', () => {
    it('should create dependency graph with correct levels', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('root', 'folder'),
        createMockContent('child1', 'page', 'root'),
        createMockContent('child2', 'page', 'root'),
        createMockContent('grandchild', 'page', 'child1')
      ];

      // Mock relationship manager to return parent-child relationships
      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'child1', targetId: 'root', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'child2', targetId: 'root', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'grandchild', targetId: 'child1', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);

      expect(graph.nodes.size).toBe(4);
      expect(graph.levels).toHaveLength(3);
      
      // Level 0: root (no dependencies)
      expect(graph.levels[0]).toHaveLength(1);
      expect(graph.levels[0][0].id).toBe('root');
      
      // Level 1: child1, child2 (depend on root)
      expect(graph.levels[1]).toHaveLength(2);
      const level1Ids = graph.levels[1].map(n => n.id).sort();
      expect(level1Ids).toEqual(['child1', 'child2']);
      
      // Level 2: grandchild (depends on child1)
      expect(graph.levels[2]).toHaveLength(1);
      expect(graph.levels[2][0].id).toBe('grandchild');
    });

    it('should detect and break circular dependencies', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('item1', 'page', 'item2'),
        createMockContent('item2', 'page', 'item1')
      ];

      // Mock circular dependency
      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'item1', targetId: 'item2', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'item2', targetId: 'item1', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);

      expect(graph.hasCycles).toBe(true);
      expect(graph.cycleBreakers.length).toBeGreaterThan(0);
      expect(graph.nodes.size).toBe(2);
    });

    it('should handle empty content gracefully', () => {
      const unifiedContent: UnifiedContent[] = [];
      
      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);

      expect(graph.nodes.size).toBe(0);
      expect(graph.levels).toHaveLength(0);
      expect(graph.hasCycles).toBe(false);
      expect(graph.cycleBreakers).toHaveLength(0);
    });

    it('should handle complex hierarchy with multiple levels', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('root', 'folder'),
        createMockContent('level1a', 'folder', 'root'),
        createMockContent('level1b', 'folder', 'root'),
        createMockContent('level2a', 'page', 'level1a'),
        createMockContent('level2b', 'page', 'level1a'),
        createMockContent('level2c', 'page', 'level1b'),
        createMockContent('level3', 'page', 'level2a')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'level1a', targetId: 'root', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'level1b', targetId: 'root', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'level2a', targetId: 'level1a', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'level2b', targetId: 'level1a', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'level2c', targetId: 'level1b', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'level3', targetId: 'level2a', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);

      expect(graph.levels).toHaveLength(4);
      expect(graph.levels[0]).toHaveLength(1); // root
      expect(graph.levels[1]).toHaveLength(2); // level1a, level1b
      expect(graph.levels[2]).toHaveLength(3); // level2a, level2b, level2c
      expect(graph.levels[3]).toHaveLength(1); // level3
    });
  });

  describe('getCreationOrder', () => {
    it('should return items ordered by dependency levels', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('child', 'page', 'parent'),
        createMockContent('parent', 'folder'),
        createMockContent('grandchild', 'page', 'child')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'child', targetId: 'parent', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'grandchild', targetId: 'child', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const order = dependencyResolver.getCreationOrder(graph);

      expect(order).toHaveLength(3);
      
      const parentIndex = order.findIndex(item => item.id === 'parent');
      const childIndex = order.findIndex(item => item.id === 'child');
      const grandchildIndex = order.findIndex(item => item.id === 'grandchild');

      expect(parentIndex).toBeLessThan(childIndex);
      expect(childIndex).toBeLessThan(grandchildIndex);
    });

    it('should prioritize folders over pages over data within same level', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('page1', 'page'),
        createMockContent('folder1', 'folder'),
        createMockContent('data1', 'data')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const order = dependencyResolver.getCreationOrder(graph);

      expect(order).toHaveLength(3);
      expect(order[0].type).toBe('folder');
      expect(order[1].type).toBe('page');
      expect(order[2].type).toBe('data');
    });

    it('should sort items with same type alphabetically', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('zebra', 'page'),
        createMockContent('apple', 'page'),
        createMockContent('banana', 'page')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const order = dependencyResolver.getCreationOrder(graph);

      expect(order.map(item => item.id)).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('validateDependencyGraph', () => {
    it('should validate correct dependency graph', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('parent', 'folder'),
        createMockContent('child', 'page', 'parent')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'child', targetId: 'parent', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const validation = dependencyResolver.validateDependencyGraph(graph);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('child', 'page', 'missing-parent')
      ];

      // Mock relationship that references non-existent parent
      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'child', targetId: 'missing-parent', relationshipType: 'parent-child', isValid: true }
      ]);

      // Create graph but manually add invalid dependency to test validation
      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      
      // Manually add invalid dependency to test detection
      const childNode = graph.nodes.get('child');
      if (childNode) {
        childNode.dependencies.push('missing-parent');
      }

      const validation = dependencyResolver.validateDependencyGraph(graph);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.includes('Missing dependency') && 
        issue.includes('missing-parent')
      )).toBe(true);
    });

    it('should warn about broken circular dependencies', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('item1', 'page', 'item2'),
        createMockContent('item2', 'page', 'item1')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'item1', targetId: 'item2', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'item2', targetId: 'item1', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const validation = dependencyResolver.validateDependencyGraph(graph);

      expect(validation.isValid).toBe(true); // Valid after cycle breaking
      expect(validation.warnings.some(warning => 
        warning.includes('Circular dependencies broken')
      )).toBe(true);
    });
  });

  describe('getBatchedCreationOrder', () => {
    it('should create batches with specified batch size', () => {
      const unifiedContent: UnifiedContent[] = Array.from({ length: 15 }, (_, i) =>
        createMockContent(`item-${i}`, 'page')
      );

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const batches = dependencyResolver.getBatchedCreationOrder(graph, 5);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(5);
      expect(batches[2]).toHaveLength(5);
    });

    it('should respect dependency levels when creating batches', () => {
      const unifiedContent: UnifiedContent[] = [
        createMockContent('parent1', 'folder'),
        createMockContent('parent2', 'folder'),
        createMockContent('child1', 'page', 'parent1'),
        createMockContent('child2', 'page', 'parent2')
      ];

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([
        { sourceId: 'child1', targetId: 'parent1', relationshipType: 'parent-child', isValid: true },
        { sourceId: 'child2', targetId: 'parent2', relationshipType: 'parent-child', isValid: true }
      ]);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      const batches = dependencyResolver.getBatchedCreationOrder(graph, 10);

      expect(batches).toHaveLength(2);
      
      // First batch should contain parents
      const firstBatchIds = batches[0].map(item => item.id);
      expect(firstBatchIds).toContain('parent1');
      expect(firstBatchIds).toContain('parent2');
      
      // Second batch should contain children
      const secondBatchIds = batches[1].map(item => item.id);
      expect(secondBatchIds).toContain('child1');
      expect(secondBatchIds).toContain('child2');
    });

    it('should handle empty graph', () => {
      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue([]);

      const graph = dependencyResolver.createDependencyGraph([]);
      const batches = dependencyResolver.getBatchedCreationOrder(graph, 5);

      expect(batches).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should update maxDepth configuration', () => {
      dependencyResolver.configure({ maxDepth: 10 });
      
      // Create deep hierarchy to test max depth
      const unifiedContent: UnifiedContent[] = Array.from({ length: 15 }, (_, i) =>
        createMockContent(`item-${i}`, 'page', i > 0 ? `item-${i-1}` : undefined)
      );

      const relationships = Array.from({ length: 14 }, (_, i) => ({
        sourceId: `item-${i+1}`,
        targetId: `item-${i}`,
        relationshipType: 'parent-child' as const,
        isValid: true
      }));

      mockRelationshipManager.buildRelationshipsFromUnified.mockReturnValue(relationships);

      const graph = dependencyResolver.createDependencyGraph(unifiedContent);
      
      // Should respect maxDepth limit
      const maxLevel = Math.max(...Array.from(graph.nodes.values()).map(node => node.level));
      expect(maxLevel).toBeLessThanOrEqual(10);
    });

    it('should update timeout configuration', () => {
      // Test that configure method accepts timeout
      expect(() => {
        dependencyResolver.configure({ timeout: 2000 });
      }).not.toThrow();
    });

    it('should enforce reasonable bounds on configuration', () => {
      // Test bounds enforcement
      dependencyResolver.configure({ maxDepth: -5, timeout: 500 });
      
      // Should still work without throwing (bounds are enforced internally)
      const graph = dependencyResolver.createDependencyGraph([]);
      expect(graph.nodes.size).toBe(0);
    });
  });

  describe('createTypeDependencyGraph', () => {
    const createCompiledType = (partial: Partial<CompiledType>): CompiledType => ({
      key: partial.key || 'type',
      name: partial.name || partial.key || 'type',
      baseType: partial.baseType || 'component',
      fields: partial.fields || [],
      mayContainTypes: partial.mayContainTypes
    } as CompiledType);

    it('should order compiled types by dependencies', () => {
      const folderType = createCompiledType({ key: 'tree_folder', name: 'Tree Folder', baseType: 'page' });
      const componentType = createCompiledType({ key: 'content_block', name: 'Content Block', baseType: 'component' });
      const pageType = createCompiledType({
        key: 'landing_page',
        name: 'Landing Page',
        baseType: 'page',
        mayContainTypes: ['content_block'],
        fields: [
          { name: 'blocks', valueType: 'array<contentReference>', required: false, description: 'Blocks', allowedTypes: ['content_block'] }
        ] as any
      });

      const graph = dependencyResolver.createTypeDependencyGraph([pageType, componentType, folderType]);
      const ordered = dependencyResolver.getCreationOrder(graph, {
        priority: node => {
          const type = node.content as CompiledType;
          if (type.key.includes('folder')) return 0;
          return type.baseType === 'page' ? 1 : 2;
        },
        tieBreaker: (a, b) => (a.content as CompiledType).key.localeCompare((b.content as CompiledType).key)
      });

      expect(ordered.map(type => type.key)).toEqual(['tree_folder', 'content_block', 'landing_page']);
      expect(graph.levels.length).toBeGreaterThan(0);
    });

    it('should surface missing dependencies in metadata', () => {
      const pageType = createCompiledType({
        key: 'missing_dep_page',
        name: 'Missing Page',
        baseType: 'page',
        mayContainTypes: ['unknown_component']
      });

      const graph = dependencyResolver.createTypeDependencyGraph([pageType]);
      const missing = (graph.metadata as any)?.missingDependencies;
      expect(missing).toBeDefined();
      expect(missing?.missing_dep_page).toContain('unknown_component');
    });

    it('ignores wildcard containment when building dependencies', () => {
      const componentType = createCompiledType({ key: 'content_block', baseType: 'component' });
      const pageType = createCompiledType({
        key: 'wildcard_page',
        name: 'Wildcard Page',
        baseType: 'page',
        mayContainTypes: ['*', 'content_block']
      });

      const graph = dependencyResolver.createTypeDependencyGraph([pageType, componentType]);
      const node = graph.nodes.get('wildcard_page');
      expect(node?.dependencies).toEqual(['content_block']);
    });
  });
})
