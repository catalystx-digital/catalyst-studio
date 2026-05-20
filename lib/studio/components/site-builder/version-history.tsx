import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, RotateCcw, GitBranch, User, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Node, Edge } from 'reactflow'

export interface Version {
  id: string
  timestamp: Date
  author: string
  message: string
  nodes: Node[]
  edges: Edge[]
  changes: {
    added: number
    modified: number
    deleted: number
  }
}

interface VersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  currentNodes: Node[]
  currentEdges: Edge[]
  onRestore: (version: Version) => void
}

const STORAGE_KEY = 'sitemapVersionHistory'
const MAX_VERSIONS = 20

const isQuotaExceededError = (error: unknown) => {
  if (typeof window === 'undefined') return false

  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: number; name?: string }
    return (
      err.code === 22 ||
      err.code === 1014 ||
      err.name === 'QUOTA_EXCEEDED_ERR'
    )
  }

  return false
}

export function VersionHistory({ isOpen, onClose, currentNodes, currentEdges, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

  const persistVersions = useCallback((next: Version[]) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return next
    }

    let versionsToStore = next

    while (true) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(versionsToStore))
        return versionsToStore
      } catch (error) {
        if (!isQuotaExceededError(error)) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to persist version history; continuing without storage.', error)
          }
          return versionsToStore
        }

        if (versionsToStore.length <= 1) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('Version history storage quota exceeded; unable to persist additional entries.', error)
          }
          return versionsToStore
        }

        if (process.env.NODE_ENV === 'development') {
        console.warn('Version history storage quota exceeded. Dropping oldest version entry.', error)
        }
        versionsToStore = versionsToStore.slice(1)
      }
    }
  }, [])

  // Load version history from localStorage
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.localStorage) {
      return
    }

    try {
      const storedVersions = window.localStorage.getItem(STORAGE_KEY)
      if (!storedVersions) {
        return
      }

      const parsed = JSON.parse(storedVersions) as Version[]
      setVersions(parsed.map((v) => ({
        ...v,
        timestamp: new Date(v.timestamp)
      })))
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to load version history from storage; resetting history.', error)
      }
      setVersions([])
    }
  }, [isOpen])

  // Auto-save version every significant change
  useEffect(() => {
    const saveVersion = () => {
      const lastVersion = versions[versions.length - 1]
      const hasChanges = !lastVersion || 
        JSON.stringify(lastVersion.nodes) !== JSON.stringify(currentNodes) ||
        JSON.stringify(lastVersion.edges) !== JSON.stringify(currentEdges)

      if (hasChanges) {
        const newVersion: Version = {
          id: `v-${Date.now()}`,
          timestamp: new Date(),
          author: 'Current User',
          message: 'Auto-saved',
          nodes: currentNodes,
          edges: currentEdges,
          changes: calculateChanges(lastVersion, currentNodes, currentEdges)
        }

        const updatedVersions = [...versions, newVersion].slice(-MAX_VERSIONS) // Keep last 20 versions
        const persisted = persistVersions(updatedVersions)
        setVersions(persisted)
      }
    }

    const timer = setTimeout(saveVersion, 5000) // Auto-save after 5 seconds of inactivity
    return () => clearTimeout(timer)
  }, [currentNodes, currentEdges, versions, persistVersions])

  const calculateChanges = (lastVersion: Version | undefined, nodes: Node[], edges: Edge[]) => {
    if (!lastVersion) {
      return { added: nodes.length, modified: 0, deleted: 0 }
    }

    const oldNodeIds = new Set(lastVersion.nodes.map(n => n.id))
    const newNodeIds = new Set(nodes.map(n => n.id))

    const added = nodes.filter(n => !oldNodeIds.has(n.id)).length
    const deleted = lastVersion.nodes.filter(n => !newNodeIds.has(n.id)).length
    const modified = nodes.filter(n => {
      const oldNode = lastVersion.nodes.find(on => on.id === n.id)
      return oldNode && JSON.stringify(oldNode) !== JSON.stringify(n)
    }).length

    return { added, modified, deleted }
  }

  const handleRestore = (version: Version) => {
    onRestore(version)
    onClose()
  }

  const toggleExpanded = (versionId: string) => {
    const newExpanded = new Set(expandedVersions)
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId)
    } else {
      newExpanded.add(versionId)
    }
    setExpandedVersions(newExpanded)
  }

  const createManualSave = (message: string) => {
    const newVersion: Version = {
      id: `v-${Date.now()}`,
      timestamp: new Date(),
      author: 'Current User',
      message,
      nodes: currentNodes,
      edges: currentEdges,
      changes: calculateChanges(versions[versions.length - 1], currentNodes, currentEdges)
    }

    const updatedVersions = [...versions, newVersion].slice(-MAX_VERSIONS)
    const persisted = persistVersions(updatedVersions)
    setVersions(persisted)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gray-900/95 backdrop-blur-xl border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#FF5500]" />
            Version History
            <span className="text-sm text-gray-400">({versions.length} versions)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {versions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No version history yet. Changes are auto-saved every 5 seconds.
            </p>
          ) : (
            [...versions].reverse().map((version, index) => (
              <div
                key={version.id}
                className={`border rounded-lg transition-all ${
                  selectedVersion === version.id
                    ? 'border-[#FF5500] bg-[#FF5500]/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <button
                  onClick={() => toggleExpanded(version.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {expandedVersions.has(version.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-sm">
                            {version.message}
                          </span>
                          {index === 0 && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                              Latest
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.author}
                          </span>
                          <span>
                            {formatDistanceToNow(version.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          {version.changes.added > 0 && (
                            <span className="text-xs text-green-400">
                              +{version.changes.added} added
                            </span>
                          )}
                          {version.changes.modified > 0 && (
                            <span className="text-xs text-blue-400">
                              ~{version.changes.modified} modified
                            </span>
                          )}
                          {version.changes.deleted > 0 && (
                            <span className="text-xs text-red-400">
                              -{version.changes.deleted} deleted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {index > 0 && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestore(version)
                        }}
                        className="bg-white/10 border-white/20 hover:bg-white/20"
                        variant="outline"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                </button>
                
                {expandedVersions.has(version.id) && (
                  <div className="px-6 pb-3 space-y-2">
                    <div className="text-xs text-gray-400">
                      <p>Nodes: {version.nodes.length}</p>
                      <p>Connections: {version.edges.length}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          // Preview version (could open in modal)
                          setSelectedVersion(version.id)
                        }}
                        className="bg-white/10 border-white/20 hover:bg-white/20"
                        variant="outline"
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          // Compare with current
                          if (process.env.NODE_ENV === 'development') {
                          console.log('Compare versions')
                          }
                        }}
                        className="bg-white/10 border-white/20 hover:bg-white/20"
                        variant="outline"
                      >
                        Compare
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            Versions are auto-saved every 5 seconds when changes are detected
          </p>
          <Button
            onClick={() => {
              const message = prompt('Save version with message:')
              if (message) createManualSave(message)
            }}
            className="bg-gradient-to-r from-[#FF5500] to-[#FF6600] hover:from-[#FF6600] hover:to-[#FF7700]"
          >
            Save Version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
