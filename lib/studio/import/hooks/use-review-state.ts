/**
 * useReviewState Hook
 * 
 * Custom hook for managing review interface state including
 * component filtering, selection, and modification tracking.
 */

import { useState, useCallback, useEffect } from 'react'
import { ComponentDetection, DetectedStructure } from '../services/review-service'

export interface FilterOptions {
  confidence: 'all' | 'high' | 'medium' | 'low'
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'modified'
  type: string | 'all'
  searchTerm: string
}

export interface Change {
  id: string
  timestamp: Date
  type: 'approve' | 'reject' | 'modify' | 'bulk'
  componentIds: string[]
  previousState: any
  newState: any
}

export function useReviewState(importJobId: string, initialStructure?: DetectedStructure) {
  // Component state
  const [components, setComponents] = useState<ComponentDetection[]>(
    initialStructure?.components || []
  )
  
  // Filter state
  const [filter, setFilter] = useState<FilterOptions>({
    confidence: 'all',
    status: 'all',
    type: 'all',
    searchTerm: ''
  })
  
  // Selection state
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  
  // History for undo/redo
  const [changeHistory, setChangeHistory] = useState<Change[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Load initial data
  useEffect(() => {
    if (initialStructure) {
      setComponents(initialStructure.components)
    }
  }, [initialStructure])

  // Helper to record a change
  const recordChange = useCallback((
    type: Change['type'],
    componentIds: string[],
    previousState: any,
    newState: any
  ) => {
    const change: Change = {
      id: `change-${Date.now()}`,
      timestamp: new Date(),
      type,
      componentIds,
      previousState,
      newState
    }
    
    setChangeHistory(prev => {
      // If we're not at the end of history, remove future changes
      const newHistory = historyIndex < prev.length - 1 
        ? prev.slice(0, historyIndex + 1)
        : prev
      
      return [...newHistory, change]
    })
    
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  // Undo functionality
  const undo = useCallback(() => {
    if (historyIndex < 0) return
    
    const change = changeHistory[historyIndex]
    
    setComponents(prev => {
      const updated = [...prev]
      change.componentIds.forEach(id => {
        const index = updated.findIndex(c => c.id === id)
        if (index !== -1 && change.previousState[id]) {
          updated[index] = change.previousState[id]
        }
      })
      return updated
    })
    
    setHistoryIndex(prev => prev - 1)
  }, [changeHistory, historyIndex])

  // Redo functionality
  const redo = useCallback(() => {
    if (historyIndex >= changeHistory.length - 1) return
    
    const change = changeHistory[historyIndex + 1]
    
    setComponents(prev => {
      const updated = [...prev]
      change.componentIds.forEach(id => {
        const index = updated.findIndex(c => c.id === id)
        if (index !== -1 && change.newState[id]) {
          updated[index] = change.newState[id]
        }
      })
      return updated
    })
    
    setHistoryIndex(prev => prev + 1)
  }, [changeHistory, historyIndex])

  // Bulk approve
  const bulkApprove = useCallback((ids: string[]) => {
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      
      ids.forEach(id => {
        const index = updated.findIndex(c => c.id === id)
        if (index !== -1) {
          previousState[id] = { ...updated[index] }
          updated[index] = { ...updated[index], status: 'approved' }
          newState[id] = { ...updated[index] }
        }
      })
      
      return updated
    })
    
    recordChange('bulk', ids, previousState, newState)
  }, [recordChange])

  // Bulk reject
  const bulkReject = useCallback((ids: string[]) => {
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      
      ids.forEach(id => {
        const index = updated.findIndex(c => c.id === id)
        if (index !== -1) {
          previousState[id] = { ...updated[index] }
          updated[index] = { ...updated[index], status: 'rejected' }
          newState[id] = { ...updated[index] }
        }
      })
      
      return updated
    })
    
    recordChange('bulk', ids, previousState, newState)
  }, [recordChange])

  // Update mapping
  const updateMapping = useCallback((id: string, mapping: string) => {
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      const index = updated.findIndex(c => c.id === id)
      
      if (index !== -1) {
        previousState[id] = { ...updated[index] }
        updated[index] = {
          ...updated[index],
          user_override: mapping,
          status: updated[index].status === 'pending' ? 'modified' : updated[index].status
        }
        newState[id] = { ...updated[index] }
      }
      
      return updated
    })
    
    recordChange('modify', [id], previousState, newState)
  }, [recordChange])

  // Approve single component
  const approveComponent = useCallback((id: string) => {
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      const index = updated.findIndex(c => c.id === id)
      
      if (index !== -1) {
        previousState[id] = { ...updated[index] }
        updated[index] = { ...updated[index], status: 'approved' }
        newState[id] = { ...updated[index] }
      }
      
      return updated
    })
    
    recordChange('approve', [id], previousState, newState)
  }, [recordChange])

  // Reject single component
  const rejectComponent = useCallback((id: string) => {
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      const index = updated.findIndex(c => c.id === id)
      
      if (index !== -1) {
        previousState[id] = { ...updated[index] }
        updated[index] = { ...updated[index], status: 'rejected' }
        newState[id] = { ...updated[index] }
      }
      
      return updated
    })
    
    recordChange('reject', [id], previousState, newState)
  }, [recordChange])

  // Auto-approve similar components
  const autoApproveSimilar = useCallback((referenceId: string, threshold: number = 0.9) => {
    const reference = components.find(c => c.id === referenceId)
    if (!reference) return
    
    const similarIds: string[] = []
    const previousState: Record<string, ComponentDetection> = {}
    const newState: Record<string, ComponentDetection> = {}
    
    setComponents(prev => {
      const updated = [...prev]
      
      updated.forEach((component, index) => {
        if (
          component.id !== referenceId &&
          component.type === reference.type &&
          component.status === 'pending' &&
          component.confidence >= reference.confidence * threshold
        ) {
          previousState[component.id] = { ...component }
          updated[index] = { ...component, status: 'approved' }
          newState[component.id] = { ...updated[index] }
          similarIds.push(component.id)
        }
      })
      
      return updated
    })
    
    if (similarIds.length > 0) {
      recordChange('bulk', similarIds, previousState, newState)
    }
  }, [components, recordChange])

  // Update review notes
  const updateNotes = useCallback((id: string, notes: string) => {
    setComponents(prev => {
      const updated = [...prev]
      const index = updated.findIndex(c => c.id === id)
      
      if (index !== -1) {
        updated[index] = { ...updated[index], reviewNotes: notes }
      }
      
      return updated
    })
  }, [])

  return {
    components,
    filter,
    selectedComponent,
    setSelectedComponent,
    changeHistory,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < changeHistory.length - 1,
    actions: {
      undo,
      redo,
      bulkApprove,
      bulkReject,
      updateMapping,
      approveComponent,
      rejectComponent,
      autoApproveSimilar,
      updateNotes,
      setFilter,
      setSelectedComponent
    }
  }
}