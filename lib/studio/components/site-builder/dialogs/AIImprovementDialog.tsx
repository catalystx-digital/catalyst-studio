'use client'

import React, { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Loader2, Wand2, FileText, Layout, Palette } from 'lucide-react'
import { toast } from 'sonner'

export interface AIImprovementDialogProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  nodeLabel: string
  onImprove?: (options: AIImprovementOptions) => Promise<void>
}

export interface AIImprovementOptions {
  nodeId: string
  improvementType: 'content' | 'structure' | 'design' | 'all'
  customInstructions: string
  preserveExisting: boolean
}

const IMPROVEMENT_TYPES = [
  {
    id: 'content',
    label: 'Content',
    description: 'Improve text, headings, and copy',
    icon: FileText,
  },
  {
    id: 'structure',
    label: 'Structure',
    description: 'Reorganize sections and layout',
    icon: Layout,
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Enhance visual styling and polish',
    icon: Palette,
  },
  {
    id: 'all',
    label: 'Full Improvement',
    description: 'Apply all improvements at once',
    icon: Wand2,
  },
] as const

/**
 * SB-CTX-03: AI Improvement Dialog
 *
 * Dialog for AI-powered page improvements.
 * Allows users to select improvement type and provide custom instructions.
 */
export function AIImprovementDialog({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  onImprove,
}: AIImprovementDialogProps) {
  const [improvementType, setImprovementType] = useState<AIImprovementOptions['improvementType']>('content')
  const [customInstructions, setCustomInstructions] = useState('')
  const [preserveExisting, setPreserveExisting] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleImprove = useCallback(async () => {
    if (!onImprove) {
      toast.info('AI improvement will be available in a future update')
      onClose()
      return
    }

    setIsProcessing(true)
    try {
      await onImprove({
        nodeId,
        improvementType,
        customInstructions,
        preserveExisting,
      })
      toast.success(`AI improvements applied to "${nodeLabel}"`)
      onClose()
    } catch (error) {
      console.error('AI improvement failed:', error)
      toast.error('Failed to apply AI improvements. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [nodeId, nodeLabel, improvementType, customInstructions, preserveExisting, onImprove, onClose])

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      // Reset state on close
      setImprovementType('content')
      setCustomInstructions('')
      setPreserveExisting(true)
      onClose()
    }
  }, [isProcessing, onClose])

  const selectedType = IMPROVEMENT_TYPES.find(t => t.id === improvementType)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Improve via AI
          </DialogTitle>
          <DialogDescription>
            Use AI to enhance &quot;{nodeLabel}&quot;. Choose what aspects to improve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Improvement Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Improvement Type</Label>
            <RadioGroup
              value={improvementType}
              onValueChange={(value) => setImprovementType(value as AIImprovementOptions['improvementType'])}
              className="grid grid-cols-2 gap-3"
            >
              {IMPROVEMENT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = improvementType === type.id
                return (
                  <label
                    key={type.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                  >
                    <RadioGroupItem value={type.id} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-medium text-sm">{type.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="customInstructions" className="text-sm font-medium">
              Custom Instructions (Optional)
            </Label>
            <Textarea
              id="customInstructions"
              placeholder="Add specific instructions for the AI, e.g., 'Make the tone more professional' or 'Focus on call-to-action buttons'"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isProcessing}
            />
          </div>

          {/* Preserve Existing Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="preserveExisting"
              checked={preserveExisting}
              onCheckedChange={(checked) => setPreserveExisting(checked as boolean)}
              disabled={isProcessing}
            />
            <Label
              htmlFor="preserveExisting"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Preserve existing content structure (recommended)
            </Label>
          </div>

          {/* Preview hint */}
          {selectedType && (
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{selectedType.label}:</strong>{' '}
                {selectedType.id === 'content' && 'AI will improve text quality, fix grammar, and enhance messaging.'}
                {selectedType.id === 'structure' && 'AI will reorganize sections for better flow and user experience.'}
                {selectedType.id === 'design' && 'AI will suggest visual improvements and styling enhancements.'}
                {selectedType.id === 'all' && 'AI will apply comprehensive improvements across content, structure, and design.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImprove}
            disabled={isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Improving...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Apply Improvements
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AIImprovementDialog
