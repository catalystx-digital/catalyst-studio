'use client'

/**
 * Template Preview Component
 * 
 * Displays a preview of generated templates before saving them to the CMS.
 * Integrates with the template generation system from Story 11.3.
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Code, 
  Eye, 
  Save, 
  X,
  FileCode,
  Package,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CMSTemplate } from '../template-generator'
import { ComponentDetection } from '../services/review-service'
import { toast } from 'sonner'
import { ReviewErrorBoundary } from './error-boundary'

export interface TemplatePreviewProps {
  templates: CMSTemplate[]
  components: ComponentDetection[]
  onSave: (templates: CMSTemplate[]) => void
  onCancel: () => void
  className?: string
}

interface TemplateStats {
  total: number
  byCategory: Record<string, number>
  byType: Record<string, number>
  averageConfidence: number
}

export function TemplatePreview({
  templates,
  components,
  onSave,
  onCancel,
  className
}: TemplatePreviewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    templates.length > 0 ? templates[0].id : null
  )
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const [isSaving, setIsSaving] = useState(false)

  // Calculate template statistics
  const stats = useMemo<TemplateStats>(() => {
    const byCategory: Record<string, number> = {}
    const byType: Record<string, number> = {} // Keep empty for compatibility
    let totalConfidence = 0
    
    templates.forEach(template => {
      // Count by category
      byCategory[template.category] = (byCategory[template.category] || 0) + 1
      
      // Sum confidence
      if (template.metadata?.confidence) {
        totalConfidence += template.metadata.confidence as number
      }
    })
    
    return {
      total: templates.length,
      byCategory,
      byType, // Empty but present for interface compatibility
      averageConfidence: templates.length > 0 ? totalConfidence / templates.length : 0
    }
  }, [templates])

  // Get the currently selected template
  const currentTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplate)
  }, [templates, selectedTemplate])

  // Get the component that generated this template
  const sourceComponent = useMemo(() => {
    if (!currentTemplate) return null
    
    // Extract component ID from template ID (template-comp-123 -> comp-123)
    const componentId = currentTemplate.id.replace('template-', '')
    return components.find(c => c.id === componentId)
  }, [currentTemplate, components])

  // Handle save action
  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      // Simulate async save operation
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      onSave(templates)
      toast.success(`Successfully saved ${templates.length} templates!`)
    } catch (error) {
      toast.error('Failed to save templates. Please try again.')
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Copy template code to clipboard
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Template code copied to clipboard!')
  }

  // Export templates as JSON with memory optimization
  const exportTemplates = () => {
    try {
      // For large exports, use Blob API instead of data URI to avoid memory issues
      const dataStr = JSON.stringify(templates, null, 2)
      
      // Check if the data is large (>5MB)
      if (dataStr.length > 5 * 1024 * 1024) {
        // Use Blob for large data
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        
        const exportFileDefaultName = `templates-${Date.now()}.json`
        
        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', url)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()
        
        // Clean up the URL object to free memory
        setTimeout(() => URL.revokeObjectURL(url), 100)
        
        toast.success(`Large template export (${templates.length} templates) completed successfully!`)
      } else {
        // Use data URI for smaller exports
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
        
        const exportFileDefaultName = `templates-${Date.now()}.json`
        
        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', dataUri)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()
        
        toast.success('Templates exported successfully!')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export templates. The data might be too large.')
    }
  }

  // Generate template code with memory optimization for large templates
  const generateTemplateCode = (template: CMSTemplate): string => {
    // For large templates, use a more memory-efficient approach
    const fields = template.fields || []
    const metadata = template.metadata || {}
    
    // Check if template is large (more than 50 fields or large content)
    const isLargeTemplate = fields.length > 50 || 
      JSON.stringify(fields).length > 10000
    
    if (isLargeTemplate) {
      // Return a truncated preview for display with a note
      const truncatedFields = fields.slice(0, 10)
      return `// Template: ${template.name}
// Key: ${template.key}
// Category: ${template.category}
// NOTE: Large template (${fields.length} fields) - showing first 10 fields only in preview

export const ${template.name.replace(/-/g, '_')} = {
  id: '${template.id}',
  name: '${template.name}',
  key: '${template.key}',
  category: '${template.category}',
  fields: ${JSON.stringify(truncatedFields, null, 2)},
  // ... ${fields.length - 10} more fields truncated for preview
  metadata: ${JSON.stringify(metadata, null, 2)}
}`
    }
    
    // For normal templates, return full code
    return `// Template: ${template.name}
// Key: ${template.key}
// Category: ${template.category}

export const ${template.name.replace(/-/g, '_')} = {
  id: '${template.id}',
  name: '${template.name}',
  key: '${template.key}',
  category: '${template.category}',
  fields: ${JSON.stringify(fields, null, 2)},
  metadata: ${JSON.stringify(metadata, null, 2)}
}`
  }

  // Render template preview
  const renderTemplatePreview = (template: CMSTemplate) => {
    const fields = template.fields || []
    
    return (
      <div className="space-y-4">
        {/* Template Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{template.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {template.key}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{template.category}</Badge>
            {template.metadata?.confidence && (
              <Badge 
                variant={
                  template.metadata.confidence >= 90 ? 'default' :
                  template.metadata.confidence >= 70 ? 'secondary' :
                  'destructive'
                }
              >
                {Math.round(template.metadata.confidence as number)}% confidence
              </Badge>
            )}
          </div>
        </div>

        {/* Fields Display */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Template Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-sm font-medium min-w-[120px]">{field.name}:</span>
                  <span className="text-sm text-muted-foreground flex-1">
                    {field.type} {field.required ? '(required)' : '(optional)'}
                  </span>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No fields defined</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Source Component Info */}
        {sourceComponent && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Source Component</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Component Type:</span>
                  <span>{sourceComponent.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Page:</span>
                  <span className="truncate max-w-[200px]">{sourceComponent.location.page}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {sourceComponent.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Template Metadata */}
        {template.metadata && Object.keys(template.metadata).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(template.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <ReviewErrorBoundary>
      <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Template Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review generated templates before saving to CMS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportTemplates}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Templates ({templates.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="border-b p-4 bg-muted/30">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Templates</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Component Types</p>
            <p className="text-2xl font-bold">{Object.keys(stats.byType).length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Confidence</p>
            <p className="text-2xl font-bold">{Math.round(stats.averageConfidence)}%</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Template List */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-medium text-sm">Templates</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {templates.map(template => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    selectedTemplate === template.id && "border-primary bg-muted/50"
                  )}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{template.key}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                        {template.metadata?.confidence && (
                          <span className={cn(
                            "text-xs",
                            template.metadata.confidence >= 90 ? 'text-green-600' :
                            template.metadata.confidence >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          )}>
                            {Math.round(template.metadata.confidence as number)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Template Details */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'code')}>
              <TabsList>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code className="h-4 w-4 mr-2" />
                  Code
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {currentTemplate ? (
                viewMode === 'preview' ? (
                  renderTemplatePreview(currentTemplate)
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Template Code</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generateTemplateCode(currentTemplate))}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="bg-muted p-4 rounded-lg overflow-auto">
                      <code className="text-xs">
                        {generateTemplateCode(currentTemplate)}
                      </code>
                    </pre>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Select a template to view details
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Success Alert */}
      {templates.length > 0 && (
        <Alert className="m-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">{templates.length} templates</span> ready to be saved.
            These templates will be available in your CMS component library after saving.
          </AlertDescription>
        </Alert>
      )}
    </div>
    </ReviewErrorBoundary>
  )
}

// Add missing import
import { RefreshCw } from 'lucide-react'