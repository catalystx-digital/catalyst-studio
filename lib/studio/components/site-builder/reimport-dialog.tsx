'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface PageInfo {
  pageId: string
  title: string
  importSource: string
  lastReimportedAt?: string
  sourceNotFoundAt?: string
}

interface ReImportResult {
  url: string
  status: 'updated' | 'created' | 'unchanged' | 'source-not-found' | 'source-moved' | 'source-error' | 'source-timeout' | 'skipped' | 'failed'
  pageId?: string
  error?: string
  changes?: {
    componentsAdded: number
    componentsRemoved: number
    componentsUpdated: number
  }
}

interface ReImportSummary {
  updated: number
  created: number
  unchanged: number
  sourceNotFound: number
  failed: number
  skipped: number
  totalComponentsAdded: number
  totalComponentsRemoved: number
}

interface ReImportDialogProps {
  isOpen: boolean
  onClose: () => void
  websiteId: string
  pages: PageInfo[]
  onComplete?: (result: { success: boolean; summary: ReImportSummary }) => void
}

type DialogState = 'confirm' | 'processing' | 'complete'

export function ReImportDialog({
  isOpen,
  onClose,
  websiteId,
  pages,
  onComplete
}: ReImportDialogProps) {
  const [state, setState] = useState<DialogState>('confirm')
  const [preserveCustomizations, setPreserveCustomizations] = useState(false)
  const [skipSharedComponents, setSkipSharedComponents] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState('')
  const [results, setResults] = useState<ReImportResult[]>([])
  const [summary, setSummary] = useState<ReImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setState('confirm')
      setProgress(0)
      setCurrentPage('')
      setResults([])
      setSummary(null)
      setError(null)
    }
  }, [isOpen])

  const handleReImport = async () => {
    setState('processing')
    setProgress(0)
    setError(null)

    try {
      const urls = pages.map(p => p.importSource)

      const response = await fetch('/api/studio/import/reimport', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteId,
          urls,
          options: {
            preserveCustomizations,
            skipDesignSystem: true,
            skipSharedComponents,
            createIfNotExists: true
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Re-import failed')
      }

      const data = await response.json()

      setResults(data.results || [])
      setSummary(data.summary || null)
      setProgress(100)
      setState('complete')

      onComplete?.({
        success: data.status === 'completed',
        summary: data.summary
      })

    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Re-import error:', err)
      }
      setError(err instanceof Error ? err.message : 'Re-import failed')
      setState('complete')
    }
  }

  const handleClose = () => {
    if (state === 'processing') {
      // Don't allow closing during processing
      return
    }
    onClose()
  }

  const getStatusIcon = (status: ReImportResult['status']) => {
    switch (status) {
      case 'updated':
      case 'created':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'unchanged':
        return <CheckCircle2 className="h-4 w-4 text-gray-400" />
      case 'source-not-found':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'failed':
      case 'source-error':
      case 'source-timeout':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusLabel = (status: ReImportResult['status']) => {
    switch (status) {
      case 'updated': return 'Updated'
      case 'created': return 'Created'
      case 'unchanged': return 'No changes'
      case 'source-not-found': return 'Source 404'
      case 'source-moved': return 'Redirected'
      case 'source-error': return 'Server error'
      case 'source-timeout': return 'Timeout'
      case 'skipped': return 'Skipped'
      case 'failed': return 'Failed'
      default: return status
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Re-import from Source
          </DialogTitle>
          <DialogDescription>
            {state === 'confirm' && `Re-import ${pages.length} page${pages.length === 1 ? '' : 's'} from their original source.`}
            {state === 'processing' && 'Re-importing pages...'}
            {state === 'complete' && 'Re-import complete'}
          </DialogDescription>
        </DialogHeader>

        {state === 'confirm' && (
          <>
            <div className="space-y-4">
              {/* Page list */}
              <div>
                <Label className="text-sm font-medium">Pages to re-import:</Label>
                <ScrollArea className="h-32 mt-2 border rounded-md p-2">
                  {pages.map(page => (
                    <div key={page.pageId} className="flex items-center gap-2 py-1 text-sm">
                      <span className="font-medium truncate">{page.title}</span>
                      {page.sourceNotFoundAt && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                          404
                        </span>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {/* Options */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preserve"
                    checked={preserveCustomizations}
                    onCheckedChange={(checked) => setPreserveCustomizations(checked === true)}
                  />
                  <Label htmlFor="preserve" className="text-sm font-normal cursor-pointer">
                    Preserve local customizations where possible
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipShared"
                    checked={skipSharedComponents}
                    onCheckedChange={(checked) => setSkipSharedComponents(checked === true)}
                  />
                  <Label htmlFor="skipShared" className="text-sm font-normal cursor-pointer">
                    Skip shared component detection
                  </Label>
                </div>
              </div>

              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  This will fetch the latest content from the source URLs and update your pages.
                  {!preserveCustomizations && ' Any local changes will be replaced.'}
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleReImport}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-import {pages.length} page{pages.length === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </>
        )}

        {state === 'processing' && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm text-muted-foreground">
                Processing {pages.length} page{pages.length === 1 ? '' : 's'}...
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {currentPage && (
              <p className="text-xs text-center text-muted-foreground truncate">
                {currentPage}
              </p>
            )}
          </div>
        )}

        {state === 'complete' && (
          <>
            <div className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : summary ? (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {summary.updated + summary.created}
                      </div>
                      <div className="text-xs text-green-700">Updated</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">
                        {summary.unchanged}
                      </div>
                      <div className="text-xs text-gray-700">Unchanged</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {summary.failed + summary.sourceNotFound}
                      </div>
                      <div className="text-xs text-red-700">Failed</div>
                    </div>
                  </div>

                  {/* Component changes */}
                  {(summary.totalComponentsAdded > 0 || summary.totalComponentsRemoved > 0) && (
                    <div className="text-sm text-muted-foreground text-center">
                      Components: +{summary.totalComponentsAdded} / -{summary.totalComponentsRemoved}
                    </div>
                  )}

                  {/* Detailed results */}
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center justify-between py-2 border-b last:border-0',
                          result.status === 'failed' && 'bg-red-50'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(result.status)}
                          <span className="text-sm truncate">
                            {pages.find(p => p.importSource === result.url)?.title || result.url}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            result.status === 'updated' && 'bg-green-100 text-green-700',
                            result.status === 'created' && 'bg-blue-100 text-blue-700',
                            result.status === 'unchanged' && 'bg-gray-100 text-gray-700',
                            result.status === 'failed' && 'bg-red-100 text-red-700',
                            result.status === 'source-not-found' && 'bg-yellow-100 text-yellow-700'
                          )}>
                            {getStatusLabel(result.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </>
              ) : null}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ReImportDialog
