import { transformToReactFlow } from '../to-react-flow';
import { TreeNode } from '@/lib/types/site-structure.types';

describe('transformToReactFlow', () => {
  it('should transform a simple tree node to React Flow format', () => {
    const treeNode: TreeNode = {
      id: 'node-1',
      slug: 'home',
      title: 'Home Page',
      children: [],
      websiteId: 'test',
      contentItemId: 'content-1',
      parentId: null,
      fullPath: '/home',
      pathDepth: 1,
      position: 0,
      weight: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = transformToReactFlow(treeNode);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes[0]).toMatchObject({
      id: 'node-1',
      type: 'page',
      data: {
        label: 'Home Page',
        slug: 'home',
        fullPath: 'home',
        hasContent: true
      }
    });
  });

  it('should handle nested tree structure', () => {
    const treeNode: TreeNode = {
      id: 'parent',
      slug: 'parent',
      title: 'Parent',
      children: [
        {
          id: 'child-1',
          slug: 'child-1',
          title: 'Child 1',
          children: [],
          websiteId: 'test',
          contentItemId: 'content-2',
          parentId: 'parent',
          fullPath: '/parent/child-1',
          pathDepth: 2,
          position: 0,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'child-2',
          slug: 'child-2',
          title: 'Child 2',
          children: [],
          websiteId: 'test',
          contentItemId: null,
          parentId: 'parent',
          fullPath: '/parent/child-2',
          pathDepth: 2,
          position: 1,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      websiteId: 'test',
      contentItemId: null,
      parentId: null,
      fullPath: '/parent',
      pathDepth: 1,
      position: 0,
      weight: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = transformToReactFlow(treeNode);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    
    // Check parent node
    expect(result.nodes[0]).toMatchObject({
      id: 'parent',
      data: {
        label: 'Parent',
        slug: 'parent',
        hasContent: false
      }
    });

    // Check edges
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        source: 'parent',
        target: 'child-1',
        type: 'smoothstep'
      })
    );
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        source: 'parent',
        target: 'child-2',
        type: 'smoothstep'
      })
    );
  });

  it('should handle invalid nodes gracefully', () => {
    const treeNode: TreeNode = {
      id: '',
      slug: '',
      title: 'Invalid',
      children: [],  // Invalid parent won't process children
      websiteId: 'test',
      contentItemId: null,
      parentId: null,
      fullPath: '',
      pathDepth: 0,
      position: 0,
      weight: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = transformToReactFlow(treeNode);

    expect(consoleSpy).toHaveBeenCalled();
    expect(result.nodes).toHaveLength(0);  // No valid nodes processed
    expect(result.edges).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('should handle array of root nodes', () => {
    const treeNodes: TreeNode[] = [
      {
        id: 'root-1',
        slug: 'root-1',
        title: 'Root 1',
        children: [],
        websiteId: 'test',
        contentItemId: null,
        parentId: null,
        fullPath: '/root-1',
        pathDepth: 1,
        position: 0,
        weight: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'root-2',
        slug: 'root-2',
        title: 'Root 2',
        children: [],
        websiteId: 'test',
        contentItemId: null,
        parentId: null,
        fullPath: '/root-2',
        pathDepth: 1,
        position: 1,
        weight: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = transformToReactFlow(treeNodes);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes.map(n => n.id)).toEqual(['root-1', 'root-2']);
  });
});