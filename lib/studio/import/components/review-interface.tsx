'use client'

/**
 * Review Interface Component
 * 
 * Main interface for reviewing and customizing imported website structures
 * before saving them as templates.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ReviewErrorBoundary, useErrorHandler } from './error-boundary'
import { 
  ChevronRight, 
  Check, 
  X, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Filter,
  Search,
  Undo,
  Redo,
  Save,
  Download,
  ChevronDown,
  ChevronUp,
  Layers,
  Layout,
  FileCode
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReviewState } from '../hooks/use-review-state'
import { DetectedStructure, ComponentDetection } from '../services/review-service'
import { CMSTemplate } from '../template-generator'

export interface ReviewInterfaceProps {
  importJobId: string
  detectedStructure: DetectedStructure
  originalUrl: string
  onSave: (templates: CMSTemplate[]) => void
  onCancel: () => void
}

interface FilterOptions {
  confidence: 'all' | 'high' | 'medium' | 'low'
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'modified'
  type: string | 'all'
  searchTerm: string
}

const CONFIDENCE_THRESHOLDS = {
  high: 90,
  medium: 70,
  low: 0
}

const TEMPLATE_MAPPINGS = [
  { value: 'hero-01', label: 'Hero Component v1' },
  { value: 'hero-02', label: 'Hero Component v2' },
  { value: 'header-default', label: 'Default Header' },
  { value: 'header-minimal', label: 'Minimal Header' },
  { value: 'features-grid', label: 'Features Grid' },
  { value: 'features-list', label: 'Features List' },
  { value: 'pricing-table', label: 'Pricing Table' },
  { value: 'testimonials-carousel', label: 'Testimonials Carousel' },
  { value: 'footer-default', label: 'Default Footer' },
  { value: 'custom', label: 'Custom Component' }
]

export function ReviewInterface({
  importJobId,
  detectedStructure,
  originalUrl,
  onSave,
  onCancel
}: ReviewInterfaceProps) {
  const {
    components,
    filter,
    selectedComponent,
    changeHistory,
    canUndo,
    canRedo,
    actions
  } = useReviewState(importJobId, detectedStructure)

  const [showOriginal, setShowOriginal] = useState(true)
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(0)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['header', 'main']))

  // Calculate statistics
  const stats = useMemo(() => {
    const total = components.length
    const approved = components.filter(c => c.status === 'approved').length
    const rejected = components.filter(c => c.status === 'rejected').length
    const modified = components.filter(c => c.status === 'modified').length
    const pending = components.filter(c => c.status === 'pending').length
    
    return {
      total,
      approved,
      rejected,
      modified,
      pending,
      progress: total > 0 ? ((approved + rejected + modified) / total) * 100 : 0
    }
  }, [components])

  // Filter components
  const filteredComponents = useMemo(() => {
    return components.filter(component => {
      // Filter by confidence
      if (filter.confidence !== 'all') {
        const threshold = CONFIDENCE_THRESHOLDS[filter.confidence]
        const nextThreshold = filter.confidence === 'high' ? 100 : 
                            filter.confidence === 'medium' ? CONFIDENCE_THRESHOLDS.high : 
                            CONFIDENCE_THRESHOLDS.medium
        
        if (component.confidence < threshold || component.confidence >= nextThreshold) {
          return false
        }
      }

      // Filter by status
      if (filter.status !== 'all' && component.status !== filter.status) {
        return false
      }

      // Filter by type
      if (filter.type !== 'all' && component.type !== filter.type) {
        return false
      }

      // Filter by search term
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        return (
          component.type.toLowerCase().includes(searchLower) ||
          component.suggested_mapping.toLowerCase().includes(searchLower) ||
          JSON.stringify(component.detectedProps).toLowerCase().includes(searchLower)
        )
      }

      return true
    })
  }, [components, filter])

  // Group components by location
  const componentsByLocation = useMemo(() => {
    const grouped: Record<string, ComponentDetection[]> = {}
    
    filteredComponents.forEach(component => {
      const location = component.location.page
      if (!grouped[location]) {
        grouped[location] = []
      }
      grouped[location].push(component)
    })

    return grouped
  }, [filteredComponents])

  // Handle bulk selection
  const handleBulkSelect = (componentId: string, checked: boolean) => {
    setBulkSelection(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(componentId)
      } else {
        next.delete(componentId)
      }
      return next
    })
  }

  const handleBulkApprove = () => {
    actions.bulkApprove(Array.from(bulkSelection))
    setBulkSelection(new Set())
  }

  const handleBulkReject = () => {
    actions.bulkReject(Array.from(bulkSelection))
    setBulkSelection(new Set())
  }

  // Handle save
  const handleSave = async () => {
    const approvedComponents = components.filter(
      c => c.status === 'approved' || c.status === 'modified'
    )
    
    // Generate templates from approved components
    const templates: CMSTemplate[] = approvedComponents.map(component => ({
      id: `template-${component.id}`,
      name: component.user_override || component.suggested_mapping,
      key: `${component.type}_${component.id}`,
      category: 'component' as any, // Will be properly typed when imported
      fields: Object.entries(component.detectedProps || {}).map(([name, value]) => ({
        name,
        type: typeof value === 'string' ? 'text' : 
              typeof value === 'number' ? 'number' :
              typeof value === 'boolean' ? 'boolean' :
              Array.isArray(value) ? 'array' : 'object',
        required: false,
        defaultValue: value
      })),
      metadata: {
        source: 'import',
        confidence: component.confidence
      }
    }))

    onSave(templates)
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'text-green-600'
    if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default'
      case 'rejected': return 'destructive'
      case 'modified': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <ReviewErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Review Interface Error:', error, errorInfo)
        // Could send to error tracking service here
      }}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Review Imported Structure</h2>
            <p className="text-sm text-muted-foreground mt-1">{originalUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => actions.undo()}
              disabled={!canUndo}
              title="Undo last action"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => actions.redo()}
              disabled={!canRedo}
              title="Redo last undone action"
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={stats.approved === 0 && stats.modified === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Templates ({stats.approved + stats.modified})
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Review Progress</span>
            <span>{Math.round(stats.progress)}%</span>
          </div>
          <Progress value={stats.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{stats.pending} pending</span>
            <span>{stats.approved} approved</span>
            <span>{stats.modified} modified</span>
            <span>{stats.rejected} rejected</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Original/Preview */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-medium">Original Website</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOriginal(!showOriginal)}
            >
              {showOriginal ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 p-4">
            {showOriginal ? (
              <div className="bg-muted rounded-lg h-full flex items-center justify-center">
                <p className="text-muted-foreground">Website preview/screenshot</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Confidence Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Overall</span>
                        <span className={getConfidenceColor(detectedStructure.confidence.overall)}>
                          {Math.round(detectedStructure.confidence.overall)}%
                        </span>
                      </div>
                      {Object.entries(detectedStructure.confidence.byType).slice(0, 5).map(([type, conf]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-muted-foreground">{type}</span>
                          <span className={getConfidenceColor(conf as number)}>
                            {Math.round(conf as number)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Component Tree */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Detected Components</h3>
              <div className="flex items-center gap-2">
                {bulkSelection.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {bulkSelection.size} selected
                    </span>
                    <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkReject}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <Select
                value={filter.confidence}
                onValueChange={(value) => actions.setFilter({ ...filter, confidence: value as any })}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">High (90%+)</SelectItem>
                  <SelectItem value="medium">Medium (70-89%)</SelectItem>
                  <SelectItem value="low">Low (&lt;70%)</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.status}
                onValueChange={(value) => actions.setFilter({ ...filter, status: value as any })}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Search components..."
                  value={filter.searchTerm}
                  onChange={(e) => actions.setFilter({ ...filter, searchTerm: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Component List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {Object.entries(componentsByLocation).map(([page, pageComponents]) => (
                <div key={page} className="border rounded-lg">
                  <button
                    className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    onClick={() => toggleSection(page)}
                  >
                    <div className="flex items-center gap-2">
                      <Layout className="h-4 w-4" />
                      <span className="font-medium text-sm">{page}</span>
                      <Badge variant="secondary" className="text-xs">
                        {pageComponents.length}
                      </Badge>
                    </div>
                    {expandedSections.has(page) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {expandedSections.has(page) && (
                    <div className="border-t">
                      {pageComponents.map((component) => (
                        <div
                          key={component.id}
                          className={cn(
                            "p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer",
                            selectedComponent === component.id && "bg-muted/50"
                          )}
                          onClick={() => actions.setSelectedComponent(component.id)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={bulkSelection.has(component.id)}
                              onCheckedChange={(checked) => 
                                handleBulkSelect(component.id, checked as boolean)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{component.type}</span>
                                <Badge 
                                  variant={getStatusBadgeVariant(component.status)}
                                  className="text-xs"
                                >
                                  {component.status}
                                </Badge>
                                <span className={cn(
                                  "text-xs",
                                  getConfidenceColor(component.confidence)
                                )}>
                                  {Math.round(component.confidence)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {component.suggested_mapping}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {component.status === 'pending' && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-11"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      actions.approveComponent(component.id)
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-11"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      actions.rejectComponent(component.id)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Component Details */}
        <div className="w-1/3 border-l flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-medium">Component Details</h3>
          </div>
          
          {selectedComponent ? (
            <ScrollArea className="flex-1">
              <ComponentDetails
                component={components.find(c => c.id === selectedComponent)!}
                onUpdateMapping={(mapping) => 
                  actions.updateMapping(selectedComponent, mapping)
                }
                onApprove={() => actions.approveComponent(selectedComponent)}
                onReject={() => actions.rejectComponent(selectedComponent)}
              />
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">
                Select a component to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </ReviewErrorBoundary>
  )
}

/**
 * Component Details Panel
 */
function ComponentDetails({
  component,
  onUpdateMapping,
  onApprove,
  onReject
}: {
  component: ComponentDetection
  onUpdateMapping: (mapping: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  const [notes, setNotes] = useState(component.reviewNotes || '')
  const [autoApproveSimilar, setAutoApproveSimilar] = useState(false)

  return (
    <div className="p-4 space-y-4">
      {/* Status and Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{component.type}</CardTitle>
            <Badge variant={
              component.status === 'approved' ? 'default' :
              component.status === 'rejected' ? 'destructive' :
              component.status === 'modified' ? 'secondary' :
              'outline'
            }>
              {component.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <span className={cn(
                "text-sm font-medium",
                component.confidence >= 90 ? 'text-green-600' :
                component.confidence >= 70 ? 'text-yellow-600' :
                'text-red-600'
              )}>
                {Math.round(component.confidence)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Location</span>
              <span className="text-sm">{component.location.page}</span>
            </div>

            {component.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={onApprove}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  className="flex-1"
                  onClick={onReject}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mapping Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Template Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Suggested Mapping</label>
              <p className="text-sm font-medium">{component.suggested_mapping}</p>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Override Mapping</label>
              <Select
                value={component.user_override || component.suggested_mapping}
                onValueChange={onUpdateMapping}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_MAPPINGS.map(mapping => (
                    <SelectItem key={mapping.value} value={mapping.value}>
                      {mapping.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-approve"
                checked={autoApproveSimilar}
                onCheckedChange={(checked) => setAutoApproveSimilar(checked as boolean)}
              />
              <label
                htmlFor="auto-approve"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Auto-approve similar components
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detected Properties */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detected Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <pre className="text-xs">
              {JSON.stringify(component.detectedProps, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Review Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Review Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this component..."
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>
    </div>
  )
}