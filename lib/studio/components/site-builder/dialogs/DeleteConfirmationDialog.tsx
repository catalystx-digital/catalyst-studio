'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Trash2, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { GlobalBadge } from '../global-components/GlobalBadge'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  nodeIds: string[]
  onConfirm: () => void
  onCancel?: () => void
}

interface ImpactItem {
  id: string
  title: string
  type: 'page' | 'component' | 'section'
  isGlobal?: boolean
  childCount?: number
  usageCount?: number
  status?: 'published' | 'draft'
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  nodeIds,
  onConfirm,
  onCancel
}) => {
  const [confirmText, setConfirmText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [impactAnalysis, setImpactAnalysis] = useState<{
    items: ImpactItem[]
    totalChildPages: number
    totalComponents: number
    affectedPages: number
    hasGlobalComponents: boolean
    hasPublishedContent: boolean
  } | null>(null)
  const [forceDelete, setForceDelete] = useState(false)
  
  const { nodes, globalComponents, getImpactAnalysis } = useSiteBuilderStore()

  // Count child pages in sitemap hierarchy (not components within page)
  const countChildPages = useCallback((nodeId: string, allNodes: typeof nodes): number => {
    let count = 0
    for (const node of allNodes) {
      if (node.data?.parentId === nodeId) {
        count++
        count += countChildPages(node.id, allNodes)
      }
    }
    return count
  }, [nodes])

  // Count components within a page
  const countPageComponents = useCallback((nodeId: string, allNodes: typeof nodes): number => {
    const node = allNodes.find(n => n.id === nodeId)
    if (!node) return 0
    // Components are stored in node.data.components array
    const components = node.data?.components
    return Array.isArray(components) ? components.length : 0
  }, [])

  const analyzeImpact = useCallback(async () => {
    setIsAnalyzing(true)
    
    // Simulate impact analysis (in real implementation, this would query the backend)
    const items: ImpactItem[] = []
    let totalChildPages = 0
    let totalComponents = 0
    const affectedPages = new Set<string>()
    let hasGlobalComponents = false
    let hasPublishedContent = false

    for (const nodeId of nodeIds) {
      const node = nodes.find(n => n.id === nodeId)
      if (!node) continue

      // Check if node is global
      const isGlobal = globalComponents.has(nodeId)
      if (isGlobal) {
        hasGlobalComponents = true
        
        // Get impact analysis for global component
        try {
          const impact = await getImpactAnalysis(nodeId)
          impact.affectedPages.forEach(page => affectedPages.add(page.id))
          if (impact.publishedCount > 0) hasPublishedContent = true
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
          console.error('Failed to get impact analysis:', error)
          }
        }
      }

      // Count child pages in sitemap hierarchy
      const childPageCount = countChildPages(nodeId, nodes)
      totalChildPages += childPageCount

      // Count components within this page
      const componentCount = countPageComponents(nodeId, nodes)
      totalComponents += componentCount

      // Check if published
      if (node.data?.metadata?.status === 'published') {
        hasPublishedContent = true
      }

      items.push({
        id: nodeId,
        title: node.data?.label || 'Untitled',
        type: (node.data?.metadata?.pageType || 'component') as 'page' | 'component' | 'section',
        isGlobal,
        childCount: componentCount, // Now shows component count, not child page count
        usageCount: isGlobal ? affectedPages.size : undefined,
        status: node.data?.metadata?.status as 'published' | 'draft' | undefined
      })
    }

    setImpactAnalysis({
      items,
      totalChildPages,
      totalComponents,
      affectedPages: affectedPages.size,
      hasGlobalComponents,
      hasPublishedContent
    })
    
    setIsAnalyzing(false)
  }, [nodeIds, nodes, globalComponents, getImpactAnalysis, countChildPages, countPageComponents])
 
  // Analyze impact when dialog opens or selection changes
  useEffect(() => {
    if (isOpen && nodeIds.length > 0) {
      analyzeImpact()
    }
  }, [isOpen, nodeIds, analyzeImpact])

  const handleConfirm = () => {
    // Require typing "DELETE" for destructive operations
    if (impactAnalysis?.hasGlobalComponents || impactAnalysis?.hasPublishedContent) {
      if (confirmText !== 'DELETE') {
        return
      }
    }
    
    onConfirm()
    handleClose()
  }

  const handleClose = () => {
    setConfirmText('')
    setImpactAnalysis(null)
    setForceDelete(false)
    onClose()
  }

  const getSeverityColor = () => {
    if (!impactAnalysis) return 'text-gray-500'
    if (impactAnalysis.hasGlobalComponents) return 'text-red-500'
    if (impactAnalysis.hasPublishedContent) return 'text-orange-500'
    if (impactAnalysis.totalComponents > 5 || impactAnalysis.totalChildPages > 0) return 'text-yellow-500'
    return 'text-blue-500'
  }

  const getSeverityIcon = () => {
    if (!impactAnalysis) return Info
    if (impactAnalysis.hasGlobalComponents || impactAnalysis.hasPublishedContent) return AlertTriangle
    if (impactAnalysis.totalComponents > 0 || impactAnalysis.totalChildPages > 0) return AlertCircle
    return Info
  }

  const SeverityIcon = getSeverityIcon()
  const requiresConfirmation = impactAnalysis?.hasGlobalComponents || impactAnalysis?.hasPublishedContent

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            {nodeIds.length === 1 
              ? 'Are you sure you want to delete this component?'
              : `Are you sure you want to delete ${nodeIds.length} components?`}
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
              Analyzing impact...
            </div>
          </div>
        ) : impactAnalysis ? (
          <div className="space-y-4">
            {/* Impact Summary */}
            <div className={cn(
              'p-4 rounded-lg border',
              impactAnalysis.hasGlobalComponents ? 'bg-red-50 border-red-200' :
              impactAnalysis.hasPublishedContent ? 'bg-orange-50 border-orange-200' :
              (impactAnalysis.totalComponents > 0 || impactAnalysis.totalChildPages > 0) ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            )}>
              <div className="flex items-start gap-3">
                <SeverityIcon className={cn('w-5 h-5 mt-0.5', getSeverityColor())} />
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-sm">Impact Analysis</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {impactAnalysis.totalComponents > 0 && (
                      <li>• This page has {impactAnalysis.totalComponents} component{impactAnalysis.totalComponents !== 1 ? 's' : ''}</li>
                    )}
                    {impactAnalysis.totalChildPages > 0 && (
                      <li>• {impactAnalysis.totalChildPages} child page{impactAnalysis.totalChildPages !== 1 ? 's' : ''} will also be deleted</li>
                    )}
                    {impactAnalysis.hasGlobalComponents && (
                      <li className="text-red-600 font-medium">
                        • Affects {impactAnalysis.affectedPages} page{impactAnalysis.affectedPages !== 1 ? 's' : ''} using global components
                      </li>
                    )}
                    {impactAnalysis.hasPublishedContent && (
                      <li className="text-orange-600 font-medium">
                        • Contains published content
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Components List */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {impactAnalysis.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.isGlobal && <GlobalBadge size="sm" />}
                    {item.status === 'published' && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                        Published
                      </span>
                    )}
                  </div>
                  {item.childCount ? (
                    <span className="text-xs text-gray-500">
                      {item.childCount} component{item.childCount !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Confirmation Input for Destructive Operations */}
            {requiresConfirmation && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>
            )}

            {/* Force Delete Option for Protected Components */}
            {impactAnalysis.hasGlobalComponents && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="force-delete"
                  checked={forceDelete}
                  onCheckedChange={(checked) => setForceDelete(checked as boolean)}
                />
                <label
                  htmlFor="force-delete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Force delete (ignore global component protection)
                </label>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onCancel?.()
              handleClose()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              isAnalyzing || 
              (requiresConfirmation && confirmText !== 'DELETE')
            }
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete {nodeIds.length > 1 ? `${nodeIds.length} Components` : 'Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Soft delete with undo notification
export const UndoNotification: React.FC<{
  message: string
  onUndo: () => void
  duration?: number
}> = ({ message, onUndo, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true)
  const [timeLeft, setTimeLeft] = useState(duration / 1000)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsVisible(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const timeout = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [duration])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-lg">
        <span className="text-sm">{message}</span>
        <button
          onClick={onUndo}
          className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
        >
          Undo ({timeLeft}s)
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default DeleteConfirmationDialog
