'use client'

/**
 * Comparison View Component
 * 
 * Provides side-by-side comparison of original website and detected components
 * with synchronized scrolling and visual highlighting.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Download,
  ExternalLink,
  Image as ImageIcon,
  Code,
  Eye,
  Layers,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComponentDetection } from '../services/review-service'
import { ReviewErrorBoundary } from './error-boundary'

export interface ComparisonViewProps {
  originalUrl: string
  components: ComponentDetection[]
  selectedComponentId?: string | null
  onComponentSelect?: (id: string) => void
  className?: string
}

interface ViewMode {
  type: 'screenshot' | 'iframe' | 'code'
  label: string
  icon: React.ReactNode
}

const VIEW_MODES: ViewMode[] = [
  { type: 'screenshot', label: 'Screenshot', icon: <ImageIcon className="h-4 w-4" /> },
  { type: 'iframe', label: 'Live View', icon: <Eye className="h-4 w-4" /> },
  { type: 'code', label: 'Source', icon: <Code className="h-4 w-4" /> }
]

export function ComparisonView({
  originalUrl,
  components,
  selectedComponentId,
  onComponentSelect,
  className
}: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode['type']>('screenshot')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [syncScroll, setSyncScroll] = useState(true)
  const [highlightedComponents, setHighlightedComponents] = useState<Set<string>>(new Set())
  
  const originalRef = useRef<HTMLDivElement>(null)
  const detectedRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Mock screenshot URL (in production, this would come from the screenshot service)
  const screenshotUrl = `/api/screenshots?url=${encodeURIComponent(originalUrl)}`

  // Handle synchronized scrolling
  const handleScroll = useCallback((source: 'original' | 'detected', event: React.UIEvent) => {
    if (!syncScroll) return

    const sourceElement = event.currentTarget as HTMLDivElement
    const targetRef = source === 'original' ? detectedRef : originalRef
    
    if (targetRef.current) {
      const scrollPercentage = sourceElement.scrollTop / 
        (sourceElement.scrollHeight - sourceElement.clientHeight)
      
      targetRef.current.scrollTop = scrollPercentage * 
        (targetRef.current.scrollHeight - targetRef.current.clientHeight)
    }
  }, [syncScroll])

  // Highlight component in view
  const highlightComponent = useCallback((componentId: string, highlight: boolean) => {
    setHighlightedComponents(prev => {
      const next = new Set(prev)
      if (highlight) {
        next.add(componentId)
      } else {
        next.delete(componentId)
      }
      return next
    })
  }, [])

  // Scroll to component
  const scrollToComponent = useCallback((componentId: string) => {
    const component = components.find(c => c.id === componentId)
    if (!component || !detectedRef.current) return

    // Find the component element in the detected view
    const element = detectedRef.current.querySelector(`[data-component-id="${componentId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [components])

  // Handle component selection
  useEffect(() => {
    if (selectedComponentId) {
      scrollToComponent(selectedComponentId)
      highlightComponent(selectedComponentId, true)
      
      // Remove highlight after animation
      const timer = setTimeout(() => {
        highlightComponent(selectedComponentId, false)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [selectedComponentId, scrollToComponent, highlightComponent])

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [viewMode])

  // Get components grouped by page location
  const componentsByLocation = React.useMemo(() => {
    const grouped: Record<string, ComponentDetection[]> = {}
    
    components.forEach(component => {
      const key = `${component.location.page}-${component.location.index}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(component)
    })
    
    return grouped
  }, [components])

  // Render original view based on mode
  const renderOriginalView = () => {
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading {viewMode}...</p>
          </div>
        </div>
      )
    }

    switch (viewMode) {
      case 'screenshot':
        return (
          <div className="h-full overflow-auto" ref={originalRef} onScroll={(e) => handleScroll('original', e)}>
            <img
              src={screenshotUrl}
              alt="Website screenshot"
              className="w-full"
              onError={(e) => {
                // Fallback to placeholder on error
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9iMTIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjEyMDAiIGZpbGw9IiNmNGY0ZjUiLz48dGV4dCB0ZXh0LWFuY2hvcj0ibWlkZGxlIiB4PSI0MDAiIHk9IjYwMCIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIyNCI+V2Vic2l0ZSBTY3JlZW5zaG90PC90ZXh0Pjwvc3ZnPg=='
              }}
            />
          </div>
        )
      
      case 'iframe':
        return (
          <div className="h-full">
            <iframe
              ref={iframeRef}
              src={originalUrl}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
              onLoad={() => setIsLoading(false)}
            />
            <div className="absolute top-2 right-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => window.open(originalUrl, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in new tab
              </Button>
            </div>
          </div>
        )
      
      case 'code':
        return (
          <ScrollArea className="h-full" ref={originalRef} onScroll={(e) => handleScroll('original', e)}>
            <pre className="p-4 text-xs">
              <code className="language-html">
                {`<!-- Source code view -->\n${components.map(c => c.originalHtml || '<!-- No HTML available -->').join('\n\n')}`}
              </code>
            </pre>
          </ScrollArea>
        )
      
      default:
        return null
    }
  }

  // Render detected components view
  const renderDetectedView = () => {
    return (
      <ScrollArea 
        className="h-full" 
        ref={detectedRef} 
        onScroll={(e) => handleScroll('detected', e)}
      >
        <div className="p-4 space-y-4">
          {Object.entries(componentsByLocation).map(([location, locationComponents]) => (
            <div key={location} className="space-y-3">
              {locationComponents.map(component => (
                <div
                  key={component.id}
                  data-component-id={component.id}
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer",
                    "hover:shadow-md hover:border-primary/50",
                    selectedComponentId === component.id && "border-primary shadow-lg",
                    highlightedComponents.has(component.id) && "animate-pulse bg-primary/5"
                  )}
                  onClick={() => onComponentSelect?.(component.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-medium">{component.type}</h4>
                      <Badge 
                        variant={
                          component.confidence >= 90 ? 'default' :
                          component.confidence >= 70 ? 'secondary' :
                          'destructive'
                        }
                        className="text-xs"
                      >
                        {Math.round(component.confidence)}%
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {component.status}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-2">
                    Mapping: {component.user_override || component.suggested_mapping}
                  </div>
                  
                  {/* Visual representation of component */}
                  <div className="bg-muted rounded p-3 min-h-[60px]">
                    <ComponentPreview component={component} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  return (
    <ReviewErrorBoundary>
      <div className={cn("flex flex-col h-full", className, isFullscreen && "fixed inset-0 z-50 bg-background")}>
      {/* Toolbar */}
      <div className="border-b p-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode['type'])}>
            <TabsList className="h-8">
              {VIEW_MODES.map(mode => (
                <TabsTrigger key={mode.type} value={mode.type} className="text-xs">
                  {mode.icon}
                  <span className="ml-1">{mode.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={syncScroll ? 'default' : 'outline'}
            onClick={() => setSyncScroll(!syncScroll)}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sync Scroll
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Original Website Panel */}
        <div className="flex-1 border-r flex flex-col">
          <div className="border-b p-2 bg-muted/30">
            <h3 className="text-sm font-medium">Original Website</h3>
          </div>
          <div className="flex-1 relative">
            {renderOriginalView()}
          </div>
        </div>
        
        {/* Detected Structure Panel */}
        <div className="flex-1 flex flex-col">
          <div className="border-b p-2 bg-muted/30">
            <h3 className="text-sm font-medium">Detected Structure</h3>
          </div>
          <div className="flex-1">
            {renderDetectedView()}
          </div>
        </div>
      </div>
    </div>
    </ReviewErrorBoundary>
  )
}

/**
 * Component Preview
 * Renders a simplified visual representation of detected component
 */
function ComponentPreview({ component }: { component: ComponentDetection }) {
  const renderPreview = () => {
    switch (component.type.toLowerCase()) {
      case 'header':
        return (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded" />
              <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-12 h-2 bg-muted-foreground/20 rounded" />
                ))}
              </div>
            </div>
            <div className="w-16 h-6 bg-primary/30 rounded" />
          </div>
        )
      
      case 'hero':
        return (
          <div className="space-y-2 text-center">
            <div className="w-3/4 h-3 bg-muted-foreground/30 rounded mx-auto" />
            <div className="w-1/2 h-2 bg-muted-foreground/20 rounded mx-auto" />
            <div className="w-20 h-6 bg-primary/30 rounded mx-auto mt-3" />
          </div>
        )
      
      case 'features':
        return (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <div className="w-6 h-6 bg-primary/20 rounded mx-auto" />
                <div className="w-full h-1 bg-muted-foreground/20 rounded" />
              </div>
            ))}
          </div>
        )
      
      case 'footer':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-1">
                  <div className="w-full h-2 bg-muted-foreground/30 rounded" />
                  <div className="w-3/4 h-1 bg-muted-foreground/20 rounded" />
                  <div className="w-3/4 h-1 bg-muted-foreground/20 rounded" />
                </div>
              ))}
            </div>
            <div className="w-full h-px bg-muted-foreground/20" />
            <div className="w-1/3 h-1 bg-muted-foreground/20 rounded mx-auto" />
          </div>
        )
      
      default:
        return (
          <div className="space-y-2">
            <div className="w-full h-2 bg-muted-foreground/20 rounded" />
            <div className="w-3/4 h-2 bg-muted-foreground/20 rounded" />
            <div className="w-1/2 h-2 bg-muted-foreground/20 rounded" />
          </div>
        )
    }
  }
  
  return (
    <div className="relative">
      {renderPreview()}
      {component.detectedProps && Object.keys(component.detectedProps).length > 0 && (
        <div className="absolute top-0 right-0">
          <Badge variant="secondary" className="text-xs">
            {Object.keys(component.detectedProps).length} props
          </Badge>
        </div>
      )}
    </div>
  )
}