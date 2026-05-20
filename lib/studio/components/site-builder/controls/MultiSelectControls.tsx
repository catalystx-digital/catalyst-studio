import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { DeleteConfirmationDialog } from '../dialogs/DeleteConfirmationDialog'

interface MultiSelectControlsProps {
  onSelectionChange?: (selectedIds: string[]) => void
}

export const MultiSelectControls: React.FC<MultiSelectControlsProps> = ({
  onSelectionChange
}) => {
  const [, setSelectionMode] = useState<'single' | 'multi'>('single')
  const [isRectangleSelecting, setIsRectangleSelecting] = useState(false)
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number } | null>(null)
  const [rectangleEnd, setRectangleEnd] = useState<{ x: number; y: number } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [copiedNodes, setCopiedNodes] = useState<string[]>([])
  const { 
    selectedNodes, 
    setSelectedNodes, 
    clearSelection,
    nodes,
    deleteNodes,
    updateNode
  } = useSiteBuilderStore()


  const prevSelectionRef = useRef<string[]>(selectedNodes)

  useEffect(() => {
    if (!onSelectionChange) {
      prevSelectionRef.current = selectedNodes
      return
    }

    const prev = prevSelectionRef.current
    const selectionChanged =
      prev.length !== selectedNodes.length ||
      prev.some((id, index) => id !== selectedNodes[index])

    if (selectionChanged) {
      prevSelectionRef.current = selectedNodes
      onSelectionChange(selectedNodes)
    }
  }, [onSelectionChange, selectedNodes])

  // Handle keyboard shortcuts
  const showToast = useCallback((message: string) => {
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-2'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }, [])

  const selectAllAtLevel = useCallback(() => {
    if (selectedNodes.length === 0) {
      const rootNodes = nodes.filter(n => !n.data?.parentId)
      setSelectedNodes(rootNodes.map(n => n.id))
    } else {
      const firstNode = nodes.find(n => n.id === selectedNodes[0])
      if (firstNode) {
        const siblings = nodes.filter(n => n.data?.parentId === firstNode.data?.parentId)
        setSelectedNodes(siblings.map(n => n.id))
      }
    }
  }, [nodes, selectedNodes, setSelectedNodes])

  const handleCopy = useCallback(() => {
    setCopiedNodes([...selectedNodes])
    showToast('Copied ' + selectedNodes.length + ' component(s)')
  }, [selectedNodes, showToast])

  const handleCut = useCallback(() => {
    setCopiedNodes([...selectedNodes])
    selectedNodes.forEach(nodeId => {
      updateNode(nodeId, {
        style: { opacity: 0.5 }
      })
    })
    showToast('Cut ' + selectedNodes.length + ' component(s)')
  }, [selectedNodes, updateNode, showToast])

  const handlePaste = useCallback(() => {
    showToast('Pasted ' + copiedNodes.length + ' component(s)')
    setCopiedNodes([])
  }, [copiedNodes, showToast])

  const handleDelete = useCallback(() => {
    deleteNodes(selectedNodes)
    clearSelection()
    setShowDeleteDialog(false)
    showToast('Deleted ' + selectedNodes.length + ' component(s)')
  }, [deleteNodes, selectedNodes, clearSelection, showToast])

  const selectNodesInRectangle = useCallback((endX: number, endY: number) => {
    if (!rectangleStart) return

    const rect = {
      left: Math.min(rectangleStart.x, endX),
      right: Math.max(rectangleStart.x, endX),
      top: Math.min(rectangleStart.y, endY),
      bottom: Math.max(rectangleStart.y, endY)
    }

    const nodeElements = document.querySelectorAll('[data-node-id]')
    const selectedIds: string[] = []

    nodeElements.forEach((element) => {
      const nodeRect = element.getBoundingClientRect()
      if (
        nodeRect.left < rect.right &&
        nodeRect.right > rect.left &&
        nodeRect.top < rect.bottom &&
        nodeRect.bottom > rect.top
      ) {
        const nodeId = element.getAttribute('data-node-id')
        if (nodeId) selectedIds.push(nodeId)
      }
    })

    setSelectedNodes(selectedIds)
  }, [rectangleStart, setSelectedNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input or contenteditable region
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl/Cmd + A: Select all at current level
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAllAtLevel()
      }
      
      // Ctrl/Cmd + Click: Toggle selection
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        setSelectionMode('multi')
      }
      
      // Escape: Clear selection
      if (e.key === 'Escape') {
        clearSelection()
        setSelectionMode('single')
      }
      
      // Delete/Backspace: Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.length > 0) {
        e.preventDefault()
        setShowDeleteDialog(true)
      }
      
      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNodes.length > 0) {
        e.preventDefault()
        handleCopy()
      }
      
      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedNodes.length > 0) {
        e.preventDefault()
        handleCut()
      }
      
      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedNodes.length > 0) {
        e.preventDefault()
        handlePaste()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setSelectionMode('single')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedNodes, copiedNodes, selectAllAtLevel, clearSelection, handleCopy, handleCut, handlePaste])

  // Handle rectangle selection
  useEffect(() => {
    if (!isRectangleSelecting) return

    const handleMouseMove = (e: MouseEvent) => {
      setRectangleEnd({ x: e.clientX, y: e.clientY })
      selectNodesInRectangle(e.clientX, e.clientY)
    }

    const handleMouseUp = () => {
      setIsRectangleSelecting(false)
      setRectangleStart(null)
      setRectangleEnd(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isRectangleSelecting, rectangleStart, selectNodesInRectangle])

  

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (selectedNodes.includes(nodeId)) {
        setSelectedNodes(selectedNodes.filter(id => id !== nodeId))
      } else {
        setSelectedNodes([...selectedNodes, nodeId])
      }
    } else if (e.shiftKey && selectedNodes.length > 0) {
      // Range selection
      handleRangeSelection(nodeId)
    } else {
      // Single selection
      setSelectedNodes([nodeId])
    }
  }

  const handleRangeSelection = (endNodeId: string) => {
    if (selectedNodes.length === 0) return

    const startNodeId = selectedNodes[selectedNodes.length - 1]
    const startIndex = nodes.findIndex(n => n.id === startNodeId)
    const endIndex = nodes.findIndex(n => n.id === endNodeId)

    if (startIndex === -1 || endIndex === -1) return

    const [minIndex, maxIndex] = startIndex < endIndex 
      ? [startIndex, endIndex] 
      : [endIndex, startIndex]

    const rangeNodes = nodes.slice(minIndex, maxIndex + 1)
    const rangeIds = rangeNodes.map(n => n.id)
    
    // Merge with existing selection
    const newSelection = Array.from(new Set([...selectedNodes, ...rangeIds]))
    setSelectedNodes(newSelection)
  }

  const startRectangleSelection = (e: React.MouseEvent) => {
    setIsRectangleSelecting(true)
    setRectangleStart({ x: e.clientX, y: e.clientY })
    setRectangleEnd({ x: e.clientX, y: e.clientY })
  }

  


  return (
    <>
      {/* Selection HUD intentionally hidden to simplify the toolbar */}

      {/* Rectangle Selection Overlay */}
      {isRectangleSelecting && rectangleStart && rectangleEnd && (
        <div
          className="fixed border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
          style={{
            left: Math.min(rectangleStart.x, rectangleEnd.x),
            top: Math.min(rectangleStart.y, rectangleEnd.y),
            width: Math.abs(rectangleEnd.x - rectangleStart.x),
            height: Math.abs(rectangleEnd.y - rectangleStart.y)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        nodeIds={selectedNodes}
        onConfirm={handleDelete}
      />

    </>
  )
}

export default MultiSelectControls
