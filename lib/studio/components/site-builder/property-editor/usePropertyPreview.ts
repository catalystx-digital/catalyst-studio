import { useCallback, useRef, useEffect } from 'react'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'

interface PreviewState {
  componentId: string
  originalValues: Record<string, any>
  previewValues: Record<string, any>
}

export const usePropertyPreview = () => {
  const { nodes, updateNode, optimisticUpdate } = useSiteBuilderStore()
  const previewStateRef = useRef<PreviewState | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  // Cleanup on unmount to prevent memory leaks and race conditions
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])
  
  const previewChanges = useCallback((componentId: string, propertyName: string, value: any) => {
    if (!previewStateRef.current || previewStateRef.current.componentId !== componentId) {
      const node = nodes.find(n => n.id === componentId)
      if (!node) return
      
      previewStateRef.current = {
        componentId,
        originalValues: { ...node.data },
        previewValues: { ...node.data }
      }
    }
    
    previewStateRef.current.previewValues[propertyName] = value
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && previewStateRef.current) {
        updateNode(componentId, {
          data: {
            ...previewStateRef.current.previewValues
          }
        })
      }
    }, 300)
  }, [nodes, updateNode])
  
  const revertChanges = useCallback(() => {
    if (!previewStateRef.current) return
    
    const { componentId, originalValues } = previewStateRef.current
    
    updateNode(componentId, {
      data: originalValues
    })
    
    previewStateRef.current = null
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [updateNode])
  
  const applyChanges = useCallback(async () => {
    if (!previewStateRef.current) return
    
    const { componentId, previewValues } = previewStateRef.current
    
    try {
      await optimisticUpdate(
        async () => {
          const response = await fetch(`/api/studio/site-builder/components/${componentId}/properties`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: previewValues
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to save properties')
          }
          
          return await response.json()
        },
        () => {
          revertChanges()
        }
      )
      
      previewStateRef.current = null
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to apply property changes:', error)
      }
      revertChanges()
      throw error
    }
  }, [optimisticUpdate, revertChanges])
  
  const hasChanges = useCallback(() => {
    if (!previewStateRef.current) return false
    
    const { originalValues, previewValues } = previewStateRef.current
    return JSON.stringify(originalValues) !== JSON.stringify(previewValues)
  }, [])
  
  return {
    previewChanges,
    revertChanges,
    applyChanges,
    hasChanges
  }
}