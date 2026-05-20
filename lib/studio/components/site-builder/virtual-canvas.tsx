import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Node, Edge, useReactFlow, useViewport } from 'reactflow'

interface VirtualCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (nodes: Node[]) => void
  viewportBounds?: { x: number; y: number; width: number; height: number }
}

export function VirtualCanvas({ 
  nodes, 
  edges, 
  onNodesChange,
  viewportBounds 
}: VirtualCanvasProps) {
  const { getViewport, setViewport } = useReactFlow()
  const viewport = useViewport()
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set())
  const [renderQueue, setRenderQueue] = useState<Node[]>([])
  const renderBatchSize = 10
  const renderDelay = 16 // ~60fps
  const bufferSize = 200 // pixels outside viewport to preload

  // Calculate which nodes are visible in viewport
  const calculateVisibleNodes = useCallback(() => {
    const { x, y, zoom } = viewport
    const viewWidth = window.innerWidth / zoom
    const viewHeight = window.innerHeight / zoom
    
    // Add buffer for smoother scrolling
    const minX = -x / zoom - bufferSize
    const maxX = minX + viewWidth + bufferSize * 2
    const minY = -y / zoom - bufferSize
    const maxY = minY + viewHeight + bufferSize * 2

    const newVisibleNodes = new Set<string>()
    const nodesToRender: Node[] = []

    nodes.forEach(node => {
      const nodeX = node.position.x
      const nodeY = node.position.y
      const nodeWidth = node.width || 200
      const nodeHeight = node.height || 100

      // Check if node is within viewport bounds
      if (
        nodeX + nodeWidth >= minX &&
        nodeX <= maxX &&
        nodeY + nodeHeight >= minY &&
        nodeY <= maxY
      ) {
        newVisibleNodes.add(node.id)
        
        // Add to render queue if not already visible
        if (!visibleNodes.has(node.id)) {
          nodesToRender.push(node)
        }
      }
    })

    setVisibleNodes(newVisibleNodes)
    
    // Progressive rendering for new nodes
    if (nodesToRender.length > 0) {
      setRenderQueue(prev => [...prev, ...nodesToRender])
    }

    // Update nodes with visibility flag
    const updatedNodes = nodes.map(node => ({
      ...node,
      hidden: !newVisibleNodes.has(node.id)
    }))

    onNodesChange(updatedNodes)
  }, [viewport, nodes, visibleNodes, onNodesChange])

  // Progressive rendering of nodes
  useEffect(() => {
    if (renderQueue.length === 0) return

    const timer = setTimeout(() => {
      const batch = renderQueue.slice(0, renderBatchSize)
      setRenderQueue(prev => prev.slice(renderBatchSize))
      
      // Trigger re-render for batch
      const updatedNodes = nodes.map(node => {
        if (batch.some(b => b.id === node.id)) {
          return { ...node, data: { ...node.data, rendered: true } }
        }
        return node
      })
      
      onNodesChange(updatedNodes)
    }, renderDelay)

    return () => clearTimeout(timer)
  }, [renderQueue, nodes, onNodesChange])

  // Debounced viewport change handler
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateVisibleNodes()
    }, 100)

    return () => clearTimeout(timer)
  }, [viewport, calculateVisibleNodes])

  // Performance metrics
  const [metrics, setMetrics] = useState({
    visibleNodes: 0,
    totalNodes: 0,
    fps: 60,
    renderTime: 0
  })

  useEffect(() => {
    setMetrics({
      visibleNodes: visibleNodes.size,
      totalNodes: nodes.length,
      fps: 60, // Would need actual FPS calculation
      renderTime: renderQueue.length * renderDelay
    })
  }, [visibleNodes, nodes, renderQueue])

  // Panel UI moved to PerformanceStatsPanel - this component now only handles virtualization logic
  return null
}

// Export metrics for external panel
export function useVirtualCanvasMetrics(nodes: Node[], visibleNodes: Set<string>, renderQueueLength: number) {
  return {
    visibleNodes: visibleNodes.size,
    totalNodes: nodes.length,
    renderQueueLength,
  }
}