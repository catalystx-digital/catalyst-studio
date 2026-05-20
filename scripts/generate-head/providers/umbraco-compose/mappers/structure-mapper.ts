/**
 * Structure Mapper - Builds site structure from pages
 *
 * Creates the hierarchical site structure needed for navigation
 * and breadcrumbs from flat page list.
 */

import type { SnapshotPage, SnapshotStructureNode } from '@/lib/studio/headless/site-snapshot/types'
import { nanoid } from 'nanoid'

/**
 * Build site structure nodes from a list of pages.
 * Creates hierarchy based on URL paths.
 */
export function buildSiteStructure(pages: SnapshotPage[]): SnapshotStructureNode[] {
  if (pages.length === 0) {
    return []
  }

  // Sort pages by path depth (root first)
  const sortedPages = [...pages].sort((a, b) => {
    const depthA = a.fullPath === '/' ? 0 : a.fullPath.split('/').filter(Boolean).length
    const depthB = b.fullPath === '/' ? 0 : b.fullPath.split('/').filter(Boolean).length
    return depthA - depthB
  })

  const nodes: SnapshotStructureNode[] = []
  const pathToNodeId = new Map<string, string>()

  for (let i = 0; i < sortedPages.length; i++) {
    const page = sortedPages[i]
    const segments = page.fullPath === '/' ? [] : page.fullPath.split('/').filter(Boolean)
    const slug = segments[segments.length - 1] ?? ''

    // Find parent
    let parentId: string | null = null
    if (segments.length > 1) {
      const parentPath = '/' + segments.slice(0, -1).join('/')
      parentId = pathToNodeId.get(parentPath) ?? null
    }

    const nodeId = nanoid(12)
    pathToNodeId.set(page.fullPath, nodeId)

    nodes.push({
      id: nodeId,
      websitePageId: page.id,
      parentId,
      slug: slug || '/',
      fullPath: page.fullPath,
      position: i,
      isFolder: false,
      title: page.title
    })
  }

  // Ensure folder nodes exist for intermediate paths
  const folderNodes = ensureFolderNodes(nodes, pathToNodeId)

  return [...nodes, ...folderNodes]
}

/**
 * Create folder nodes for intermediate paths that don't have pages.
 */
function ensureFolderNodes(
  existingNodes: SnapshotStructureNode[],
  pathToNodeId: Map<string, string>
): SnapshotStructureNode[] {
  const folderNodes: SnapshotStructureNode[] = []
  const existingPaths = new Set(existingNodes.map(n => n.fullPath))

  for (const node of existingNodes) {
    const segments = node.fullPath === '/' ? [] : node.fullPath.split('/').filter(Boolean)

    // Check all ancestor paths
    for (let i = 1; i < segments.length; i++) {
      const ancestorPath = '/' + segments.slice(0, i).join('/')

      if (!existingPaths.has(ancestorPath) && !pathToNodeId.has(ancestorPath)) {
        // Create folder node
        const slug = segments[i - 1]
        const nodeId = nanoid(12)
        pathToNodeId.set(ancestorPath, nodeId)

        // Find parent
        let parentId: string | null = null
        if (i > 1) {
          const parentPath = '/' + segments.slice(0, i - 1).join('/')
          parentId = pathToNodeId.get(parentPath) ?? null
        }

        folderNodes.push({
          id: nodeId,
          websitePageId: null,
          parentId,
          slug,
          fullPath: ancestorPath,
          position: folderNodes.length,
          isFolder: true,
          title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
        })

        existingPaths.add(ancestorPath)
      }
    }
  }

  return folderNodes
}

/**
 * Find children of a structure node.
 */
export function findChildren(
  nodeId: string,
  structure: SnapshotStructureNode[]
): SnapshotStructureNode[] {
  return structure
    .filter(n => n.parentId === nodeId)
    .sort((a, b) => a.position - b.position)
}

/**
 * Find ancestors of a structure node (breadcrumb trail).
 */
export function findAncestors(
  nodeId: string,
  structure: SnapshotStructureNode[]
): SnapshotStructureNode[] {
  const ancestors: SnapshotStructureNode[] = []
  const nodeMap = new Map(structure.map(n => [n.id, n]))

  let current = nodeMap.get(nodeId)
  while (current?.parentId) {
    const parent = nodeMap.get(current.parentId)
    if (parent) {
      ancestors.unshift(parent)
      current = parent
    } else {
      break
    }
  }

  return ancestors
}

/**
 * Find a structure node by page ID.
 */
export function findNodeByPageId(
  pageId: string,
  structure: SnapshotStructureNode[]
): SnapshotStructureNode | null {
  return structure.find(n => n.websitePageId === pageId) ?? null
}

/**
 * Find a structure node by path.
 */
export function findNodeByPath(
  fullPath: string,
  structure: SnapshotStructureNode[]
): SnapshotStructureNode | null {
  return structure.find(n => n.fullPath === fullPath) ?? null
}
