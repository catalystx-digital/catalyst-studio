"use client"

import React, { useMemo, useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DesignSystemProvider, useDesignSystem } from '@/lib/studio/design-system'
import type { ShadcnDesignSystemTokens, TypographyToken } from '@/lib/studio/design-system/shadcn-transformer'
import type { WebsiteDesignConcept } from '@/lib/generated/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Moon,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Sun,
  Trash2,
  Type,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { isStudioDesignConceptsEnabled } from '@/lib/studio/config/feature-flags'
import { DesignSystemPreviewPane } from '@/lib/studio/components/design-system/design-system-preview-pane'

// Variable grouping for UI organization
const VARIABLE_GROUPS = {
  brand: {
    name: 'Brand Colors',
    description: 'Primary brand identity colors for CTAs and key elements',
    variables: ['--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--ring']
  },
  surfaces: {
    name: 'Surfaces',
    description: 'Background, card, and popover colors',
    variables: ['--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground']
  },
  ui: {
    name: 'UI States',
    description: 'Muted, accent, and destructive states',
    variables: ['--muted', '--muted-foreground', '--accent', '--accent-foreground', '--destructive', '--destructive-foreground']
  },
  borders: {
    name: 'Borders & Input',
    description: 'Border and input field colors',
    variables: ['--border', '--input', '--radius']
  },
  charts: {
    name: 'Chart Colors',
    description: 'Data visualization palette',
    variables: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']
  }
} as const

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border bg-card">
            <CardContent className="space-y-4 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="border-border bg-card">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-32 text-center">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-foreground">No design system captured yet</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          We couldn&apos;t find any recorded tokens for this website. In the seeded demo, use the AI Canvas Assistant (sparkles) in Site Builder to trigger AI import or re-extraction of colors, typography, spacing, and more – everything works out of the box. Or visit the live Preview to see current rendered styles.
        </p>
        <p className="text-xs text-muted-foreground">Design tokens power the full CMS and GraphQL headless output too.</p>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40 bg-destructive/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Unable to load design system
        </CardTitle>
        <CardDescription className="text-destructive/80">{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}

function SectionHeading({
  title,
  description,
  icon
}: {
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function ExtractionBadges({
  extraction
}: {
  extraction: ShadcnDesignSystemTokens['extraction']
}) {
  const formattedDate = useMemo(() => {
    try {
      return new Date(extraction.timestamp).toLocaleString()
    } catch {
      return extraction.timestamp
    }
  }, [extraction.timestamp])

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">
        Captured {formattedDate}
      </Badge>
      <Badge variant="outline" className="capitalize">
        {extraction.source}
      </Badge>
      <Badge variant="outline">
        Confidence {(extraction.confidence * 100).toFixed(0)}%
      </Badge>
      <Badge variant="outline">
        {extraction.detectedCount} detected / {extraction.defaultCount} defaults
      </Badge>
    </div>
  )
}

// ============================================================
// NEW FORMAT COMPONENTS
// ============================================================

/**
 * Convert HSL string to hex for display and color picker
 */
function hslToHex(hsl: string): string {
  // Handle radius values (not HSL)
  if (hsl.includes('rem') || hsl.includes('px')) {
    return ''
  }

  try {
    const parts = hsl.trim().split(/\s+/)
    if (parts.length < 3) return '#000000'

    const h = parseFloat(parts[0]) || 0
    const s = parseFloat(parts[1]) / 100
    const l = parseFloat(parts[2]) / 100

    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
  } catch {
    return '#000000'
  }
}

/**
 * Convert hex color to HSL string for CSS variable
 */
function hexToHsl(hex: string): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return String(Math.round(h * 360)) + ' ' + String(Math.round(s * 100)) + '% ' + String(Math.round(l * 100)) + '%'
}


/**
 * Check if a variable is a color (vs radius)
 */
function isColorVariable(name: string): boolean {
  return !name.includes('radius')
}

/**
 * Get readable text color for a background
 */
function getContrastText(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/)
    if (parts.length < 3) return '#FFFFFF'
    const l = parseFloat(parts[2])
    return l > 50 ? '#0F172A' : '#F8FAFC'
  } catch {
    return '#FFFFFF'
  }
}

/**
 * Single CSS variable display/editor
 */
function VariableCard({
  name,
  value,
  onValueChange
}: {
  name: string
  value: string
  onValueChange?: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isColor = isColorVariable(name)
  const hexColor = isColor ? hslToHex(value) : ''
  const textColor = isColor ? getContrastText(value) : 'hsl(var(--foreground))'
  const displayName = name.replace('--', '')

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value
    const newHsl = hexToHsl(newHex)
    onValueChange?.(newHsl)
  }

  const cardContent = (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p
          className={cn('text-xs font-medium', !isColor && 'text-foreground')}
          style={isColor ? { color: textColor } : undefined}
        >
          {displayName}
        </p>
        <p
          className={cn('mt-0.5 font-mono text-[10px]', !isColor && 'text-muted-foreground')}
          style={isColor ? { color: `${textColor}99` } : undefined}
        >
          {value}
        </p>
      </div>
      {isColor && hexColor && (
        <Badge
          variant="outline"
          className="font-mono text-[9px]"
          style={{
            color: textColor,
            borderColor: `${textColor}40`,
            backgroundColor: `${textColor}15`
          }}
        >
          {hexColor}
        </Badge>
      )}
    </div>
  )

  if (isColor && onValueChange) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              'cursor-pointer rounded-xl border border-border p-3 transition-shadow hover:shadow-md'
            )}
            style={{ backgroundColor: hexColor }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsOpen(true)
              }
            }}
          >
            {cardContent}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <p className="text-sm font-medium">{displayName}</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={hexColor || '#000000'}
                onChange={handleColorChange}
                className="h-10 w-14 cursor-pointer rounded border border-border"
              />
              <div className="flex-1">
                <p className="font-mono text-xs text-muted-foreground">{hexColor}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{value}</p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border p-3 transition-shadow hover:shadow-md',
        isColor ? '' : 'bg-muted'
      )}
      style={isColor ? { backgroundColor: hexColor } : undefined}
    >
      {cardContent}
    </div>
  )
}

/**
 * Group of CSS variables
 */
function VariableGroup({
  name,
  description,
  variables,
  values,
  onValueChange
}: {
  name: string
  description: string
  variables: readonly string[]
  values: Record<string, string>
  onValueChange?: (varName: string, value: string) => void
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">{name}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {variables.map((varName) => (
          <VariableCard
            key={varName}
            name={varName}
            value={values[varName] ?? ''}
            onValueChange={onValueChange ? (value) => onValueChange(varName, value) : undefined}
          />
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Main CSS Variables Section
 */
function ShadcnVariablesSection({
  designSystem,
  websiteId,
  conceptId,
  onRefresh
}: {
  designSystem: ShadcnDesignSystemTokens
  websiteId?: string
  conceptId?: string | null
  onRefresh?: () => Promise<void>
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const variables = mode === 'dark' && designSystem.darkVariables
    ? designSystem.darkVariables
    : designSystem.variables

  const handleValueChange = useCallback(async (varName: string, value: string) => {
    if (!websiteId) {
      toast({
        title: 'Website required',
        description: 'Open this page from the site builder to edit colors.',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/website/' + websiteId + '/design-system/variables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId,
          mode,
          variable: varName,
          value
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update color')
      }

      toast({
        title: 'Color updated',
        description: varName.replace('--', '') + ' has been updated.'
      })

      await onRefresh?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update color'
      toast({
        title: 'Unable to update color',
        description: message,
        variant: 'destructive'
      })
    }
  }, [websiteId, conceptId, mode, toast, onRefresh])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          title="CSS Variables"
          description="shadcn-compatible design tokens extracted from the source website."
          icon={<Palette className="h-5 w-5 text-muted-foreground" />}
        />
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('light')}
            className="rounded-full"
          >
            <Sun className="mr-1.5 h-3.5 w-3.5" />
            Light
          </Button>
          <Button
            variant={mode === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('dark')}
            className="rounded-full"
          >
            <Moon className="mr-1.5 h-3.5 w-3.5" />
            Dark
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Object.entries(VARIABLE_GROUPS).map(([key, group]) => (
          <VariableGroup
            key={key}
            name={group.name}
            description={group.description}
            variables={group.variables}
            values={variables}
            onValueChange={websiteId ? handleValueChange : undefined}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Typography token display
 */
function TypographyTokenCard({ token }: { token: TypographyToken }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p
        className="truncate text-sm font-medium text-foreground"
        style={{
          fontFamily: token.fontStack || token.fontFamily,
          fontSize: token.fontSize,
          fontWeight: token.fontWeight as number,
          lineHeight: token.lineHeight || 'normal'
        }}
      >
        {token.name || token.fontFamily}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {token.fontFamily}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {token.fontSize}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          wt {token.fontWeight}
        </Badge>
        {token.lineHeight && (
          <Badge variant="outline" className="text-[10px]">
            lh {token.lineHeight}
          </Badge>
        )}
        {token.letterSpacing && (
          <Badge variant="outline" className="text-[10px]">
            ls {token.letterSpacing}
          </Badge>
        )}
      </div>
    </div>
  )
}

/**
 * Typography Section
 */
function NewTypographySection({
  typography
}: {
  typography: NonNullable<ShadcnDesignSystemTokens['typography']>
}) {
  const categories = [
    { key: 'heading', label: 'Headings', tokens: typography.heading },
    { key: 'body', label: 'Body Text', tokens: typography.body },
    { key: 'ui', label: 'UI Elements', tokens: typography.ui }
  ] as const

  const totalCount = typography.heading.length + typography.body.length + typography.ui.length

  if (totalCount === 0) return null

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Typography"
        description={`${totalCount} font styles captured from the source website.`}
        icon={<Type className="h-5 w-5 text-muted-foreground" />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {categories.map(({ key, label, tokens }) => (
          <Card key={key} className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">{label}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {tokens.length} style{tokens.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tokens.length === 0 ? (
                <p className="text-xs text-muted-foreground">No styles captured.</p>
              ) : (
                tokens.slice(0, 6).map((token, idx) => (
                  <TypographyTokenCard key={`${key}-${idx}`} token={token} />
                ))
              )}
              {tokens.length > 6 && (
                <p className="text-xs text-muted-foreground">+ {tokens.length - 6} more</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

/**
 * Spacing Section
 */
function NewSpacingSection({
  spacing
}: {
  spacing: NonNullable<ShadcnDesignSystemTokens['spacing']>
}) {
  if (spacing.scale.length === 0) return null

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Spacing Scale"
        description={`${spacing.scale.length} spacing values captured.${spacing.baseUnitPx ? ` Base unit: ${spacing.baseUnitPx}px.` : ''}`}
        icon={<Ruler className="h-5 w-5 text-muted-foreground" />}
      />
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            {spacing.scale.map((token, idx) => (
              <div
                key={`spacing-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2"
              >
                <div
                  className="rounded bg-primary/20"
                  style={{
                    width: Math.min(token.value, 48),
                    height: Math.min(token.value, 48)
                  }}
                />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {token.name || `${token.value}${token.unit}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {token.value}{token.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// ============================================================
// LEGACY COMPONENTS (kept for reference, no longer used)
// ============================================================

function DesignConceptSwitcher({
  websiteId,
  concepts,
  activeConceptId,
  onConceptChange,
  onRefresh
}: {
  websiteId?: string
  concepts: WebsiteDesignConcept[]
  activeConceptId: string | null
  onConceptChange: (conceptId: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const { toast } = useToast()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newConceptName, setNewConceptName] = useState(() => `Design Concept ${concepts.length + 1}`)
  const [duplicatePalette, setDuplicatePalette] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<WebsiteDesignConcept | null>(null)
  const [loadingConceptId, setLoadingConceptId] = useState<string | null>(null)

  useEffect(() => {
    setNewConceptName(`Design Concept ${concepts.length + 1}`)
  }, [concepts.length])

  const activeConcept = useMemo(
    () => concepts.find((concept) => concept.id === activeConceptId) ?? concepts[0] ?? null,
    [concepts, activeConceptId]
  )

  const disabledDeleteIds = concepts.length <= 1 ? new Set(concepts.map((concept) => concept.id)) : new Set<string>()

  const handleCreateConcept = async () => {
    if (!websiteId) {
      toast({
        title: 'Website required',
        description: 'Open this page from the site builder to manage concepts.',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/website/${websiteId}/design-system/concepts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newConceptName.trim() || undefined,
          duplicatePalette
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to create concept')
      }

      const data = await response.json()
      const conceptId = data.data?.concept?.id as string | undefined
      toast({
        title: 'Concept created',
        description: duplicatePalette
          ? 'Palette duplicated so you can tweak it independently.'
          : 'New concept shuffled a fresh palette for exploration.'
      })

      setIsCreateOpen(false)
      setDuplicatePalette(false)
      setNewConceptName(`Design Concept ${concepts.length + 2}`)

      if (conceptId) {
        onConceptChange(conceptId)
      }
      await onRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create concept'
      toast({
        title: 'Unable to create concept',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const startRename = (concept: WebsiteDesignConcept) => {
    setEditingConceptId(concept.id)
    setRenameValue(concept.name ?? '')
  }

  const handleRename = async (conceptId: string) => {
    if (!websiteId) return
    if (!renameValue.trim()) {
      toast({
        title: 'Enter a name',
        description: 'Concept names cannot be empty.',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoadingConceptId(conceptId)
      const response = await fetch(
        `/api/website/${websiteId}/design-system/concepts/${conceptId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: renameValue.trim() })
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to rename concept')
      }

      setEditingConceptId(null)
      setRenameValue('')
      await onRefresh()
      toast({
        title: 'Concept renamed',
        description: 'The new name is now visible across the studio.'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename concept'
      toast({
        title: 'Unable to rename concept',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setLoadingConceptId(null)
    }
  }

  const handleDeleteConcept = async () => {
    if (!websiteId || !pendingDelete) return

    try {
      const conceptId = pendingDelete.id
      setLoadingConceptId(conceptId)
      const response = await fetch(
        `/api/website/${websiteId}/design-system/concepts/${conceptId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete concept')
      }

      const fallbackConcept =
        concepts.find((concept) => concept.id !== conceptId) ?? null
      onConceptChange(fallbackConcept?.id ?? null)
      await onRefresh()
      toast({
        title: 'Concept deleted',
        description: 'Remaining concepts updated to reflect the change.'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete concept'
      toast({
        title: 'Unable to delete concept',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setPendingDelete(null)
      setLoadingConceptId(null)
    }
  }

  return (
    <div className="rounded-[28px] border border-border bg-card p-4 shadow-lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Design concept</p>
            <p className="text-sm text-muted-foreground">
              Stage alternative palettes and swap without leaving the studio.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New concept
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeConcept?.name ?? 'Design Concept'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeConcept?.isDefault ? 'Default' : 'Custom variation'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3 rounded-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Concepts</p>
            <div className="space-y-2">
              {concepts.map((concept) => {
                const isActive = concept.id === activeConceptId
                const isEditing = editingConceptId === concept.id
                const isDeleting = loadingConceptId === concept.id && pendingDelete?.id === concept.id

                return (
                  <div
                    key={concept.id}
                    className={cn(
                      'rounded-2xl border border-border bg-muted p-3 text-sm transition hover:border-primary/50',
                      isActive ? 'border-primary bg-accent' : ''
                    )}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={renameValue}
                          autoFocus
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void handleRename(concept.id)
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              setEditingConceptId(null)
                            }
                          }}
                          className="h-8 flex-1 rounded-xl"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-500"
                          onClick={() => void handleRename(concept.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => setEditingConceptId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onConceptChange(concept.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onConceptChange(concept.id)
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{concept.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {concept.isDefault ? 'Default concept' : 'Variant'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {isActive && (
                            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Active</Badge>
                          )}
                          {concept.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation()
                              startRename(concept)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={disabledDeleteIds.has(concept.id)}
                            className="h-8 w-8 text-destructive disabled:opacity-30"
                            onClick={(event) => {
                              event.stopPropagation()
                              setPendingDelete(concept)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>New design concept</DialogTitle>
            <DialogDescription>
              Clone the current concept and optionally shuffle a fresh palette to explore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newConceptName}
              onChange={(event) => setNewConceptName(event.target.value)}
              placeholder="Design Concept 2"
              className="rounded-2xl"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={duplicatePalette}
                onCheckedChange={(value) => setDuplicatePalette(Boolean(value))}
              />
              Duplicate palette without shuffling
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateConcept()}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create concept
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>Delete concept</DialogTitle>
            <DialogDescription>
              This removes the concept and its palette versions. Other concepts are unaffected.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingDelete?.isDefault
              ? 'The next concept in the list will become the default.'
              : 'You can recreate this concept later if needed.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={loadingConceptId === pendingDelete?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteConcept()}
              disabled={loadingConceptId === pendingDelete?.id}
            >
              {loadingConceptId === pendingDelete?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete concept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


function DesignSystemPageContent({ websiteId }: { websiteId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const designConceptsEnabled = isStudioDesignConceptsEnabled()
  const [showPreview, setShowPreview] = useState(true)
  const {
    designSystem,
    isLoaded,
    error,
    refetch,
    concepts,
    activeConceptId,
    setActiveConceptId
  } = useDesignSystem()
  const activeConcept = useMemo(
    () => concepts.find((concept) => concept.id === activeConceptId) ?? null,
    [concepts, activeConceptId]
  )

  const handleConceptChange = useCallback(
    (conceptId: string | null) => {
      setActiveConceptId(conceptId)
      if (!websiteId) {
        return
      }
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('websiteId', websiteId)
      if (conceptId) {
        params.set('conceptId', conceptId)
      } else {
        params.delete('conceptId')
      }
      router.replace(`/studio/design-system?${params.toString()}`)
    },
    [router, searchParams, setActiveConceptId, websiteId]
  )

  const showConceptSwitcher = designConceptsEnabled && concepts.length > 0

  if (!isLoaded) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => refetch()} />
  }

  if (!designSystem) {
    return <EmptyState />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          {designConceptsEnabled && activeConcept && (
            <Badge variant="secondary" className="w-fit rounded-full text-xs">
              Editing {activeConcept.name}
            </Badge>
          )}
          {designSystem.extraction && (
            <ExtractionBadges extraction={designSystem.extraction} />
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Preview toggle button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Show Preview
              </>
            )}
          </Button>
          {showConceptSwitcher && (
            <DesignConceptSwitcher
              websiteId={websiteId}
              concepts={concepts}
              activeConceptId={activeConceptId}
              onConceptChange={handleConceptChange}
              onRefresh={refetch}
            />
          )}
        </div>
      </div>

      <Separator />

      {/* Main content with optional preview pane */}
      <div className={cn(
        'grid gap-6',
        showPreview ? 'lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_500px]' : ''
      )}>
        {/* Editor Section */}
        <div className="space-y-6">
          {/* CSS Variables Section */}
          <ShadcnVariablesSection
            designSystem={designSystem}
            websiteId={websiteId}
            conceptId={activeConceptId}
            onRefresh={refetch}
          />

          {/* Typography Section */}
          {designSystem.typography && (
            <NewTypographySection typography={designSystem.typography} />
          )}

          {/* Spacing Section */}
          {designSystem.spacing && (
            <NewSpacingSection spacing={designSystem.spacing} />
          )}
        </div>

        {/* Live Preview Pane */}
        {showPreview && (
          <div className="sticky top-6">
            <DesignSystemPreviewPane
              designSystem={designSystem}
              className="h-fit"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DesignSystemStudioPageInner() {
  const searchParams = useSearchParams()
  const websiteId = searchParams?.get('websiteId') ?? undefined
  const designConceptsEnabled = isStudioDesignConceptsEnabled()
  const conceptId = designConceptsEnabled ? searchParams?.get('conceptId') ?? undefined : undefined

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Colors & Styles
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and customize the design tokens for your website.
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mx-auto max-w-[1600px]">
          <DesignSystemProvider websiteId={websiteId} conceptId={conceptId}>
            <DesignSystemPageContent websiteId={websiteId} />
          </DesignSystemProvider>
        </div>
      </div>
    </div>
  )
}

export default function DesignSystemStudioPage() {
  return (
    <>
      <Suspense fallback={<LoadingState />}>
        <DesignSystemStudioPageInner />
      </Suspense>
      <Toaster />
    </>
  )
}

// Note: DesignConceptSwitcher and ColorPaletteEditor are internal components
// and cannot be exported from page files in Next.js 15
