'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import type { ContentTypeWithParsedFields } from '@/lib/services/content-type-service'
import { usePermissions } from '@/lib/studio/hooks/use-permissions'
import { DeleteContentTypeDialog } from '@/lib/studio/components/content-types/delete-content-type-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CATEGORY_ORDER = ['page', 'component', 'folder']

const CATEGORY_BLUEPRINTS: Record<
  string,
  {
    label: string
    helper?: string
    empty: string
  }
> = {
  page: {
    label: 'Page Types',
    helper: 'Full pages and sitemap nodes',
    empty: 'No page types are registered for this site yet.',
  },
  component: {
    label: 'Component Types',
    helper: 'Reusable sections and content blocks',
    empty: 'No component types are registered for this site yet.',
  },
  folder: {
    label: 'Folder Types',
    helper: 'Structural folders and groupings',
    empty: 'No folder types are registered for this site yet.',
  },
}

const getDisplayName = (type: ContentTypeWithParsedFields) => {
  return type.name && type.name.trim().length > 0 ? type.name : 'Untitled type'
}

const getKeyValue = (type: ContentTypeWithParsedFields) => {
  const key = (type as unknown as Record<string, unknown>).key
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null
}

type ContentField = {
  id?: string
  name?: string
  label?: string
  type?: string
  detail?: string
  [key: string]: unknown
}

const isFieldArray = (value: unknown): value is ContentField[] => {
  return (
    Array.isArray(value) &&
    value.every((field) => typeof field === 'object' && field !== null && ('name' in (field as Record<string, unknown>) || 'label' in (field as Record<string, unknown>)))
  )
}

const getFieldList = (type: ContentTypeWithParsedFields) => {
  const raw = type.fields as unknown

  if (isFieldArray(raw)) {
    return raw
  }

  if (raw && typeof raw === 'object') {
    const candidateKeys = ['fields', '__fields', 'schema', 'properties']
    for (const key of candidateKeys) {
      const candidate = (raw as Record<string, unknown>)[key]
      if (isFieldArray(candidate)) {
        return candidate
      }
    }

    // Some datasets nest the actual array deeper, so scan values
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (isFieldArray(value)) {
        return value
      }
    }
  }

  return []
}

const getPluralName = (type: ContentTypeWithParsedFields) => {
  const plural = (type as unknown as Record<string, unknown>).pluralName
  return typeof plural === 'string' && plural.trim().length > 0 ? plural.trim() : null
}

const getDisplayField = (type: ContentTypeWithParsedFields) => {
  const displayField = (type as unknown as Record<string, unknown>).displayField
  return typeof displayField === 'string' && displayField.trim().length > 0 ? displayField.trim() : null
}

const getUpdatedAt = (type: ContentTypeWithParsedFields) => {
  const updatedAt = type.updatedAt
  if (!updatedAt) return null
  const timestamp = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

const formatFieldTypeLabel = (rawType?: string | null): string | null => {
  if (!rawType) return null
  if (rawType.startsWith('array<') && rawType.endsWith('>')) {
    const inner = rawType.slice(6, -1)
    return `Array (${formatFieldTypeLabel(inner) ?? inner})`
  }
  if (rawType.startsWith('object<') && rawType.endsWith('>')) {
    const detail = rawType.slice(7, -1)
    return detail ? `Object (${detail})` : 'Object'
  }
  if (/^[a-zA-Z0-9._-]+$/.test(rawType) && rawType.includes('.')) {
    return rawType
      .split(/[._-]/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' · ')
  }
  switch (rawType) {
    case 'text':
      return 'Text'
    case 'number':
      return 'Number'
    case 'boolean':
      return 'Boolean'
    case 'null':
      return 'Empty'
    case 'object':
      return 'Object'
    default:
      return rawType
  }
}

const matchesSearch = (type: ContentTypeWithParsedFields, term: string) => {
  if (!term) return true
  const needle = term.toLowerCase()
  const name = getDisplayName(type).toLowerCase()
  const description = typeof type.settings?.description === 'string' ? type.settings.description.toLowerCase() : ''
  const keyValue = getKeyValue(type)?.toLowerCase() ?? ''
  const fieldNames = getFieldList(type).map((field) => `${field.name ?? ''} ${field.type ?? ''}`.toLowerCase())

  if (name.includes(needle) || description.includes(needle) || keyValue.includes(needle)) {
    return true
  }

  return fieldNames.some((field) => field.includes(needle))
}

type CategoryEntry = {
  key: string
  label: string
  helper?: string
  items: ContentTypeWithParsedFields[]
}

const sortCategories = (entries: CategoryEntry[]) => {
  return entries.sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.key)
    const bIndex = CATEGORY_ORDER.indexOf(b.key)
    const normalizedA = aIndex === -1 ? CATEGORY_ORDER.length : aIndex
    const normalizedB = bIndex === -1 ? CATEGORY_ORDER.length : bIndex
    if (normalizedA !== normalizedB) {
      return normalizedA - normalizedB
    }
    return a.label.localeCompare(b.label)
  })
}

export default function ContentTypesBoardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const websiteId = searchParams?.get('websiteId') ?? null
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const contentTypeCatalog = useSiteBuilderStore((state) => state.contentTypeCatalog)
  const contentTypesAll = useSiteBuilderStore((state) => state.contentTypesAll)
  const contentTypesLoading = useSiteBuilderStore((state) => state.contentTypesLoading)
  const contentTypesLoaded = useSiteBuilderStore((state) => state.contentTypesLoaded)
  const contentTypesError = useSiteBuilderStore((state) => state.contentTypesError)
  const loadContentTypeCatalog = useSiteBuilderStore((state) => state.loadContentTypeCatalog)

  // Permissions
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canCreate = hasPermission('content_type:create')
  const canEdit = hasPermission('content_type:edit')
  const canDelete = hasPermission('content_type:delete')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contentTypeToDelete, setContentTypeToDelete] = useState<ContentTypeWithParsedFields | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [searchValue, setSearchValue] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const handleBack = useCallback(() => {
    const base = '/studio/site-builder'
    const query = websiteId ? `?websiteId=${encodeURIComponent(websiteId)}` : ''
    router.push(`${base}${query}`)
  }, [router, websiteId])

  useEffect(() => {
    if (!websiteId) {
      return
    }
    loadContentTypeCatalog(websiteId).catch((error) => {
      console.error('[ContentTypesBoardPage] Failed to load catalog', error)
    })
  }, [websiteId, loadContentTypeCatalog])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')
      if (event.key === 'Escape') {
        event.preventDefault()
        handleBack()
      }
      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleBack])

  const categoryEntries = useMemo(() => {
    const entries: CategoryEntry[] = Object.entries(contentTypeCatalog || {}).map(([key, bucket]) => ({
      key,
      label: CATEGORY_BLUEPRINTS[key]?.label || bucket.label || 'Uncategorized',
      helper: CATEGORY_BLUEPRINTS[key]?.helper,
      items: bucket.items || [],
    }))

    Object.entries(CATEGORY_BLUEPRINTS).forEach(([key, meta]) => {
      const existing = entries.find((entry) => entry.key === key)
      if (existing) {
        existing.label = meta.label
        existing.helper = meta.helper
      } else {
        entries.push({
          key,
          label: meta.label,
          helper: meta.helper,
          items: [],
        })
      }
    })

    return sortCategories(entries)
  }, [contentTypeCatalog])

  const toggleCategoryFilter = useCallback((categoryKey: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setSearchValue('')
    setSelectedCategories(new Set())
  }, [])

  const filteredCategories = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    const hasActiveFilter = selectedCategories.size > 0

    return categoryEntries
      .map((category) => {
        // If category filter is active, only include items from selected categories
        const categoryMatch = !hasActiveFilter || selectedCategories.has(category.key)
        const items = categoryMatch
          ? category.items.filter((type) => matchesSearch(type, term))
          : []
        return { ...category, items }
      })
      .filter((category) => {
        // If category filter is active, only show selected categories
        if (hasActiveFilter) {
          return selectedCategories.has(category.key)
        }
        // Otherwise show categories with items or those with blueprints
        return category.items.length > 0 || Boolean(CATEGORY_BLUEPRINTS[category.key])
      })
  }, [categoryEntries, searchValue, selectedCategories])

  const handleRetry = useCallback(() => {
    if (!websiteId) return
    loadContentTypeCatalog(websiteId, { force: true }).catch((error) => {
      console.error('[ContentTypesBoardPage] Retry failed', error)
    })
  }, [websiteId, loadContentTypeCatalog])

  const handleCreate = useCallback(() => {
    if (!websiteId) return
    router.push(`/studio/content-types/new?websiteId=${encodeURIComponent(websiteId)}`)
  }, [router, websiteId])

  const handleEdit = useCallback((contentType: ContentTypeWithParsedFields) => {
    if (!websiteId) return
    router.push(`/studio/content-types/${contentType.id}?websiteId=${encodeURIComponent(websiteId)}`)
  }, [router, websiteId])

  const handleDeleteClick = useCallback((contentType: ContentTypeWithParsedFields) => {
    setContentTypeToDelete(contentType)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!contentTypeToDelete || !websiteId) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/content-types/${contentTypeToDelete.id}?confirmed=true`, {
        method: 'DELETE',
        headers: {
          'x-website-id': websiteId,
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete content type')
      }

      toast.success(`Content type "${contentTypeToDelete.name}" deleted successfully`)
      setDeleteDialogOpen(false)
      setContentTypeToDelete(null)

      // Refresh the catalog
      loadContentTypeCatalog(websiteId, { force: true }).catch(() => {})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete content type')
    } finally {
      setIsDeleting(false)
    }
  }, [contentTypeToDelete, websiteId, loadContentTypeCatalog])

  if (!websiteId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="max-w-lg rounded-lg border bg-card p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Website ID required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Open the Site Builder from the dashboard and use the "View content types" button to reach this page.
          </p>
          <Button className="mt-6" onClick={() => router.push('/studio/site-builder')}>
            Back to Site Builder
          </Button>
        </div>
      </div>
    )
  }

  const hasNoData = contentTypesLoaded && contentTypesAll.length === 0 && !contentTypesLoading && !contentTypesError

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Header with Create button */}
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Content Types</h1>
            <p className="text-sm text-muted-foreground">Manage page, component, and folder types for your website</p>
          </div>
          {canCreate && (
            <Button onClick={handleCreate} disabled={permissionsLoading}>
              {permissionsLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Content Type
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="w-full rounded-lg border bg-card p-5 shadow-sm lg:w-72">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Search</p>
            <div className="mt-2 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by name, key, field..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Categories</p>
              <Button variant="link" className="p-0 h-auto text-xs" onClick={clearFilters}>
                Clear
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {categoryEntries.map((category) => {
                const isActive = selectedCategories.has(category.key)
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => toggleCategoryFilter(category.key)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition border',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    )}
                  >
                    {category.label}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="flex-1">
          {contentTypesLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="rounded-lg border bg-card p-5">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="mt-4 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!contentTypesLoading && contentTypesError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-sm">
              <p className="font-medium text-destructive">{contentTypesError}</p>
              <p className="mt-2 text-xs text-muted-foreground">We could not load the catalog. Check your connection and try again.</p>
              <Button variant="destructive" size="sm" className="mt-4" onClick={handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {hasNoData && (
            <div className="rounded-lg border bg-card p-6 text-sm">
              <p className="font-medium">No content types are registered for this site yet.</p>
              <p className="mt-2 text-xs text-muted-foreground">In the seeded demo everything works out-of-the-box: the Site Builder AI assistant can create custom page/component types on the fly (full CMS power). Standard types are usually populated by AI import or template seeding. Explore the visual editor first – then extend here.</p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">These types drive both the visual builder and headless GraphQL queries.</p>
            </div>
          )}

          {!contentTypesLoading && !contentTypesError && filteredCategories.length > 0 && (
            <div className="space-y-6">
              {filteredCategories.map((category) => {
                const isCollapsed = collapsedCategories[category.key]
                const categoryMeta = CATEGORY_BLUEPRINTS[category.key]
                const sortedItems = category.items.slice().sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
                return (
                  <div key={category.key} className="rounded-lg border bg-card p-5 shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedCategories((prev) => ({ ...prev, [category.key]: !prev[category.key] }))
                      }
                      className="flex w-full items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Category</p>
                        <h2 className="text-xl font-semibold">{category.label}</h2>
                        <p className="text-xs text-muted-foreground">
                          {category.items.length} {category.items.length === 1 ? 'type' : 'types'}
                        </p>
                        {categoryMeta?.helper && <p className="text-xs text-muted-foreground/70">{categoryMeta.helper}</p>}
                      </div>
                      {isCollapsed ? <ChevronRight className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    {!isCollapsed && (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {sortedItems.length === 0 && (
                          <div className="rounded-lg border bg-muted/50 p-6 text-sm text-muted-foreground">
                            {categoryMeta?.empty ?? 'No types are registered under this category yet.'}
                            <span className="block mt-1 text-[10px]">Try the AI assistant in Site Builder – it discovers and registers new types automatically in the demo.</span>
                          </div>
                        )}
                        {sortedItems.map((type) => {
                          const fields = getFieldList(type)
                          const previewFields = fields.slice(0, 6)
                          const remaining = Math.max(fields.length - previewFields.length, 0)
                          const description =
                            typeof type.settings?.description === 'string' && type.settings.description.trim().length > 0
                              ? type.settings.description
                              : null
                          const keyValue = getKeyValue(type)
                          const pluralName = getPluralName(type)
                          const displayField = getDisplayField(type)
                          const updatedAt = getUpdatedAt(type)
                          const metadata: string[] = []
                          if (pluralName) metadata.push(`Plural: ${pluralName}`)
                          if (displayField) metadata.push(`Display field: ${displayField}`)
                          if (fields.length > 0) metadata.push(`${fields.length} ${fields.length === 1 ? 'field' : 'fields'}`)
                          if (category.key === 'component' || category.key === 'folder') {
                            const componentCategory =
                              typeof type.settings?.componentCategory === 'string'
                                ? type.settings.componentCategory
                                : null
                            const source =
                              typeof type.settings?.source === 'string' ? type.settings.source : null
                            if (category.key === 'component' && componentCategory) {
                              metadata.push(`Library: ${componentCategory}`)
                            }
                            if (source) {
                              metadata.push(`Source: ${source}`)
                            }
                          }
                          if (updatedAt) metadata.push(`Updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}`)

                          return (
                            <article
                              key={type.id}
                              className="group rounded-lg border bg-card p-5 shadow-sm transition hover:shadow-md hover:border-primary/30"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-lg font-semibold">{getDisplayName(type)}</h3>
                                <Badge variant="secondary" className="text-xs">{category.label}</Badge>
                              </div>
                              {keyValue && (
                                <p className="mt-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Key: {keyValue}</p>
                              )}
                              {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
                              {metadata.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  {metadata.map((token) => (
                                    <span key={token} className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                                      {token}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {previewFields.length > 0 && (
                                <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                                    <span>Fields</span>
                                    <span className="text-[0.65rem]">
                                      {fields.length} total
                                    </span>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {previewFields.map((field, index) => {
                                      const fieldKey = field.id ?? field.name ?? `field-${index}`
                                      const fieldName =
                                        (typeof field.label === 'string' && field.label) ||
                                        (typeof field.name === 'string' && field.name) ||
                                        'Untitled field'
                                      const fieldTypeRaw =
                                        typeof field.type === 'string' && field.type.trim().length > 0 ? field.type : null
                                      const fieldTypeLabel = formatFieldTypeLabel(fieldTypeRaw)
                                      const fieldDetail =
                                        typeof field.detail === 'string' && field.detail.trim().length > 0
                                          ? field.detail
                                          : null
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                                        >
                                          <div className="text-sm">
                                            <p className="font-medium">{fieldName}</p>
                                            {field.name && field.label && field.label !== field.name && (
                                              <p className="text-xs uppercase tracking-wide text-muted-foreground/60">
                                                {field.name}
                                              </p>
                                            )}
                                            {fieldDetail && (
                                              <p className="text-xs text-muted-foreground">{fieldDetail}</p>
                                            )}
                                          </div>
                                          {fieldTypeLabel && (
                                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">
                                              {fieldTypeLabel}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                    {remaining > 0 && (
                                      <p className="text-xs text-muted-foreground">+{remaining} more fields</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {/* Action buttons - only for database content types, not registry-based */}
                              {(() => {
                                const isRegistryType = type.settings?.source === 'component-type-registry'
                                const isSystemDefault = type.settings?.source === 'system-default'
                                const isDatabaseType = !isRegistryType && !isSystemDefault
                                const showEdit = canEdit && isDatabaseType
                                const showDelete = canDelete && isDatabaseType
                                return (showEdit || showDelete) && (
                                  <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {showEdit && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEdit(type)
                                        }}
                                      >
                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                        Edit
                                      </Button>
                                    )}
                                    {showDelete && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteClick(type)
                                        }}
                                      >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        Delete
                                      </Button>
                                    )}
                                  </div>
                                )
                              })()}
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteContentTypeDialog
        contentType={contentTypeToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  )
}
