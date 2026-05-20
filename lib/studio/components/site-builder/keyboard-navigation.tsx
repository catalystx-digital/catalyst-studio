import React, { useEffect, useCallback, useRef } from 'react'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { DeleteConfirmationDialog } from './dialogs/DeleteConfirmationDialog'
import { toast } from 'sonner'

interface KeyboardNavigationProps {
  onOpenSectionPicker?: () => void
  onOpenKeyboardHelp?: () => void
}

export const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  onOpenSectionPicker,
  onOpenKeyboardHelp
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [copiedNodes, setCopiedNodes] = React.useState<string[]>([])
  const [cutNodes, setCutNodes] = React.useState<string[]>([])
  
  const {
    nodes,
    edges,
    selectedNodes,
    setSelectedNodes,
    clearSelection,
    deleteNodes,
    addNode,
    moveNode,
    updateNode,
    undo,
    redo,
    canUndo,
    canRedo
  } = useSiteBuilderStore()

  const focusedNodeRef = useRef<string | null>(null)
  const lastActionRef = useRef<string>('')

  // Navigate through the tree structure
  const navigateTree = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (selectedNodes.length === 0) {
      // Select first node if none selected
      const firstNode = nodes[0]
      if (firstNode) {
        setSelectedNodes([firstNode.id])
        focusedNodeRef.current = firstNode.id
      }
      return
    }

    const currentNodeId = selectedNodes[selectedNodes.length - 1]
    const currentNode = nodes.find(n => n.id === currentNodeId)
    if (!currentNode) return

    let targetNodeId: string | null = null

    switch (direction) {
      case 'up': {
        // Find previous sibling or parent
        const siblings = nodes.filter(n => n.data?.parentId === currentNode.data?.parentId)
        const currentIndex = siblings.findIndex(n => n.id === currentNodeId)
        if (currentIndex > 0) {
          targetNodeId = siblings[currentIndex - 1].id
        } else if (currentNode.data?.parentId) {
          targetNodeId = currentNode.data.parentId
        }
        break
      }
      case 'down': {
        // Find next sibling or first child
        const children = nodes.filter(n => n.data?.parentId === currentNodeId)
        if (children.length > 0) {
          targetNodeId = children[0].id
        } else {
          const siblings = nodes.filter(n => n.data?.parentId === currentNode.data?.parentId)
          const currentIndex = siblings.findIndex(n => n.id === currentNodeId)
          if (currentIndex < siblings.length - 1) {
            targetNodeId = siblings[currentIndex + 1].id
          }
        }
        break
      }
      case 'left': {
        // Navigate to parent
        if (currentNode.data?.parentId) {
          targetNodeId = currentNode.data.parentId
        }
        break
      }
      case 'right': {
        // Navigate to first child
        const children = nodes.filter(n => n.data?.parentId === currentNodeId)
        if (children.length > 0) {
          targetNodeId = children[0].id
        }
        break
      }
    }

    if (targetNodeId) {
      setSelectedNodes([targetNodeId])
      focusedNodeRef.current = targetNodeId
      
      // Scroll node into view
      const nodeElement = document.querySelector(`[data-node-id="${targetNodeId}"]`)
      nodeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedNodes, nodes, setSelectedNodes])

  // Reorder nodes (pages) with Alt+Up/Down by swapping weight values
  // ISS-SB-001 FIX: Swap weights instead of visual positions to persist order
  // ISS-SB-048 FIX: Allow reordering root nodes (no parentId) by treating null/undefined parentId as same level
  const reorderComponent = useCallback((direction: 'up' | 'down') => {
    if (selectedNodes.length !== 1) return

    const nodeId = selectedNodes[0]
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Get siblings sorted by weight (or index if no weight)
    // For root nodes (no parentId), get all other root nodes as siblings
    const currentParentId = node.data?.parentId ?? null
    const siblings = nodes
      .filter(n => (n.data?.parentId ?? null) === currentParentId)
      .sort((a, b) => {
        const weightA = (a.data as any)?.weight ?? 0
        const weightB = (b.data as any)?.weight ?? 0
        return weightA - weightB
      })

    const currentIndex = siblings.findIndex(n => n.id === nodeId)
    if (currentIndex === -1) return

    let targetIndex = currentIndex
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      targetIndex = currentIndex + 1
    }

    if (targetIndex !== currentIndex) {
      const targetNode = siblings[targetIndex]
      if (targetNode) {
        // Get current weights (default to index if not set)
        const currentWeight = (node.data as any)?.weight ?? currentIndex
        const targetWeight = (targetNode.data as any)?.weight ?? targetIndex

        // Swap weights - this will persist through the save pipeline
        // Note: We spread node.data to preserve all existing properties since updateNode uses Object.assign
        const updatedNodeData = { ...node.data, weight: targetWeight }
        const updatedTargetData = { ...targetNode.data, weight: currentWeight }

        updateNode(nodeId, { data: updatedNodeData })
        updateNode(targetNode.id, { data: updatedTargetData })

        toast.success(`Moved ${direction === 'up' ? 'up' : 'down'}`)
      }
    }
  }, [selectedNodes, nodes, updateNode])

  // Copy selected nodes
  const copyNodes = useCallback(() => {
    if (selectedNodes.length === 0) return
    
    setCopiedNodes([...selectedNodes])
    setCutNodes([])
    // Standard clipboard behavior - no toast needed
  }, [selectedNodes])

  // Cut selected nodes
  const cutSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) return
    
    setCutNodes([...selectedNodes])
    setCopiedNodes([])
    
    // Mark nodes as cut visually - this provides sufficient feedback
    selectedNodes.forEach(nodeId => {
      updateNode(nodeId, {
        style: { opacity: 0.5 }
      })
    })
  }, [selectedNodes, updateNode])

  // Paste nodes
  const pasteNodes = useCallback(() => {
    const nodesToPaste = copiedNodes.length > 0 ? copiedNodes : cutNodes
    if (nodesToPaste.length === 0) return

    const targetParentId = selectedNodes.length > 0 ? selectedNodes[0] : null
    
    nodesToPaste.forEach(nodeId => {
      const sourceNode = nodes.find(n => n.id === nodeId)
      if (!sourceNode) return

      if (cutNodes.includes(nodeId)) {
        // Move node
        moveNode(nodeId, targetParentId)
        updateNode(nodeId, { style: { opacity: 1 } })
      } else {
        // Copy node
        const newNodeData = {
          ...sourceNode.data,
          label: `${sourceNode.data?.label} (Copy)`,
          id: undefined // Let the system generate a new ID
        } as any
        addNode(targetParentId, newNodeData)
      }
    })

    if (cutNodes.length > 0) {
      setCutNodes([])
    }
    // Visual appearance of new/moved components is sufficient feedback
  }, [copiedNodes, cutNodes, selectedNodes, nodes, moveNode, updateNode, addNode])

  // Select all at current level
  const selectAllAtLevel = useCallback(() => {
    if (selectedNodes.length === 0) {
      // Select all root nodes
      const rootNodes = nodes.filter(n => !n.data?.parentId)
      setSelectedNodes(rootNodes.map(n => n.id))
    } else {
      // Select all siblings
      const firstNode = nodes.find(n => n.id === selectedNodes[0])
      if (firstNode) {
        const siblings = nodes.filter(n => n.data?.parentId === firstNode.data?.parentId)
        setSelectedNodes(siblings.map(n => n.id))
      }
    }
    
    // Visual multi-selection highlight is sufficient feedback
  }, [selectedNodes, nodes, setSelectedNodes])

  // Toggle selection of a node
  const toggleNodeSelection = useCallback(() => {
    if (focusedNodeRef.current) {
      if (selectedNodes.includes(focusedNodeRef.current)) {
        setSelectedNodes(selectedNodes.filter(id => id !== focusedNodeRef.current))
      } else {
        setSelectedNodes([...selectedNodes, focusedNodeRef.current])
      }
    }
  }, [selectedNodes, setSelectedNodes])

  // Delete selected nodes with confirmation
  const handleDelete = useCallback(() => {
    if (selectedNodes.length === 0) return
    setShowDeleteDialog(true)
  }, [selectedNodes])

  const confirmDelete = useCallback(() => {
    deleteNodes(selectedNodes)
    clearSelection()
    setShowDeleteDialog(false)
    toast.success(`Deleted ${selectedNodes.length} component${selectedNodes.length > 1 ? 's' : ''}`)
  }, [selectedNodes, deleteNodes, clearSelection])

  // Main keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      
      // Don't handle if user is typing in an input or contenteditable region
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable
      ) {
        return
      }

      // Navigation keys
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            navigateTree('up')
            break
          case 'ArrowDown':
            e.preventDefault()
            navigateTree('down')
            break
          case 'ArrowLeft':
            e.preventDefault()
            navigateTree('left')
            break
          case 'ArrowRight':
            e.preventDefault()
            navigateTree('right')
            break
          case 'Enter':
            e.preventDefault()
            if (selectedNodes.length === 1) {
              // Open property editor for selected node
              const event = new CustomEvent('openPropertyEditor', { 
                detail: { nodeId: selectedNodes[0] } 
              })
              window.dispatchEvent(event)
            }
            break
          case 'Escape':
            e.preventDefault()
            clearSelection()
            // Visual deselection is sufficient feedback
            break
          case ' ':
            e.preventDefault()
            toggleNodeSelection()
            break
          case 'Delete':
          case 'Backspace':
            e.preventDefault()
            handleDelete()
            break
          case '?':
            e.preventDefault()
            onOpenKeyboardHelp?.()
            break
        }
      }

      // Alt + Arrow keys for reordering
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            reorderComponent('up')
            break
          case 'ArrowDown':
            e.preventDefault()
            reorderComponent('down')
            break
        }
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault()
            selectAllAtLevel()
            break
          case 'c':
            e.preventDefault()
            copyNodes()
            break
          case 'x':
            e.preventDefault()
            cutSelectedNodes()
            break
          case 'v':
            e.preventDefault()
            pasteNodes()
            break
          case 'z':
            e.preventDefault()
            if (e.shiftKey && canRedo) {
              redo()
            } else if (!e.shiftKey && canUndo) {
              undo()
            }
            // Visual change is sufficient feedback for undo/redo
            break
          case 'y':
            e.preventDefault()
            if (canRedo) {
              redo()
            }
            // Visual change is sufficient feedback for redo
            break
          case 'n':
            e.preventDefault()
            onOpenSectionPicker?.()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    navigateTree,
    reorderComponent,
    selectAllAtLevel,
    toggleNodeSelection,
    copyNodes,
    cutSelectedNodes,
    pasteNodes,
    handleDelete,
    clearSelection,
    selectedNodes,
    canUndo,
    canRedo,
    undo,
    redo,
    onOpenSectionPicker,
    onOpenKeyboardHelp
  ])

  // Update ARIA live region for screen readers
  useEffect(() => {
    if (lastActionRef.current) {
      const announcement = document.getElementById('keyboard-nav-announcement')
      if (announcement) {
        announcement.textContent = lastActionRef.current
        lastActionRef.current = ''
      }
    }
  }, [selectedNodes])

  return (
    <>
      {/* ARIA live region for screen reader announcements */}
      <div
        id="keyboard-nav-announcement"
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        nodeIds={selectedNodes}
        onConfirm={confirmDelete}
      />

      {/* Visual focus indicator */}
      {focusedNodeRef.current && (
        <style jsx global>{`
          [data-node-id="${focusedNodeRef.current}"] {
            outline: 2px solid #FF5500;
            outline-offset: 2px;
          }
        `}</style>
      )}
    </>
  )
}

export default KeyboardNavigation
