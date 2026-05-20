'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PageTypeOption } from '@/lib/studio/stores/site-builder-store'

const EMPTY_PAGE_TYPES: PageTypeOption[] = []

function isSamePageType(a: PageTypeOption, b: PageTypeOption) {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.description === b.description &&
    a.key === b.key &&
    a.isHome === b.isHome
  )
}

function fingerprintPageTypes(types: PageTypeOption[]): string {
  if (types.length === 0) {
    return '[]'
  }

  return JSON.stringify(
    types.map((type) => ({
      id: type.id ?? '',
      name: type.name ?? '',
      description: type.description ?? '',
      key: type.key ?? '',
      isHome: Boolean(type.isHome),
    }))
  )
}

interface AddPagePanelProps {
  open: boolean
  onClose: () => void
  pageTypes: PageTypeOption[]
  defaultSelectionId?: string | null
  forceHomeSelection?: boolean
  onConfirm: (payload: {
    contentTypeId?: string
    pageTypeName: string
    title: string
    isHome: boolean
  }) => void
}

export function AddPagePanel({
  open,
  onClose,
  pageTypes,
  defaultSelectionId,
  forceHomeSelection = false,
  onConfirm,
}: AddPagePanelProps) {
  const previousOrderedTypesRef = useRef<PageTypeOption[]>(EMPTY_PAGE_TYPES)
  const orderedTypes = useMemo(() => {
    if (!pageTypes || pageTypes.length === 0) {
      previousOrderedTypesRef.current = EMPTY_PAGE_TYPES
      return EMPTY_PAGE_TYPES
    }

    const sorted = [...pageTypes].sort((a, b) => {
      if (a.isHome && !b.isHome) return -1
      if (!a.isHome && b.isHome) return 1
      return a.name.localeCompare(b.name)
    })

    const previous = previousOrderedTypesRef.current
    if (
      previous.length === sorted.length &&
      previous.every((prevType, index) => isSamePageType(prevType, sorted[index]))
    ) {
      return previous
    }

    previousOrderedTypesRef.current = sorted
    return sorted
  }, [pageTypes])

  const fallbackTypeId = orderedTypes[0]?.id ?? ''
  const [selectedTypeId, setSelectedTypeId] = useState<string>(defaultSelectionId ?? fallbackTypeId)
  const [title, setTitle] = useState<string>('')
  const [titleEdited, setTitleEdited] = useState(false)

  const orderedTypesFingerprint = useMemo(() => fingerprintPageTypes(orderedTypes), [orderedTypes])

  const wasOpenRef = useRef(false)
  const lastPreferredRef = useRef<string>(defaultSelectionId ?? fallbackTypeId)
  const lastFingerprintRef = useRef<string>(orderedTypesFingerprint)

  useEffect(() => {
    const preferredId = defaultSelectionId ?? fallbackTypeId

    if (!open) {
      wasOpenRef.current = false
      lastPreferredRef.current = preferredId
      lastFingerprintRef.current = orderedTypesFingerprint
      return
    }

    const reopened = !wasOpenRef.current
    const hasPreferredChanged = lastPreferredRef.current !== preferredId
    const hasTypesChanged = lastFingerprintRef.current !== orderedTypesFingerprint

    if (reopened || hasPreferredChanged || hasTypesChanged) {
      if (preferredId) {
        setSelectedTypeId((current) => (current === preferredId ? current : preferredId))
      } else {
        setSelectedTypeId((current) => current)
      }

      const selected = orderedTypes.find((type) => type.id === preferredId)
      const nextTitle = selected ? suggestedTitle(selected.name) : 'New Page'
      setTitle((current) => (current === nextTitle ? current : nextTitle))
      setTitleEdited(false)

      lastPreferredRef.current = preferredId
      lastFingerprintRef.current = orderedTypesFingerprint
    }

    wasOpenRef.current = true
  }, [open, defaultSelectionId, fallbackTypeId, orderedTypes, orderedTypesFingerprint])

  const selectedType = orderedTypes.find((type) => type.id === selectedTypeId)
  const isHomeSelection = selectedType?.isHome ?? false

  const canSelectType = (type: PageTypeOption) => {
    if (!forceHomeSelection) return true
    return type.isHome
  }

  const handleTypeClick = (type: PageTypeOption) => {
    if (!canSelectType(type)) {
      return
    }
    setSelectedTypeId(type.id)
    if (!titleEdited) {
      setTitle(suggestedTitle(type.name))
    }
  }

  const handleSubmit = () => {
    if (!selectedType) return

    const payload: { pageTypeName: string; title: string; isHome: boolean; contentTypeId?: string } = {
      pageTypeName: selectedType.name,
      title: title.trim(),
      isHome: Boolean(selectedType.isHome),
    }

    if (selectedType.id) {
      payload.contentTypeId = selectedType.id
    }

    onConfirm(payload)
  }

  const disableConfirm = !selectedType || title.trim().length === 0

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[80] bg-black/40 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-[81] h-full w-full max-w-[360px] border-l border-gray-800 bg-slate-950 shadow-xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-white">Add Page</h2>
              <p className="text-sm text-gray-400">Choose a page type and title before inserting it into the sitemap.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
              <span className="sr-only">Close add page panel</span>
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 px-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Page type</Label>
                {forceHomeSelection && (
                  <Badge variant="outline" className="border-orange-500/60 bg-orange-500/10 text-orange-200">
                    Home required first
                  </Badge>
                )}
              </div>
              <ScrollArea className="max-h-[220px] rounded-md border border-gray-800 bg-gray-900/40">
                <div className="p-1">
                  {orderedTypes.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-400">
                      No page types available yet.
                    </div>
                  ) : (
                    orderedTypes.map((type) => {
                      const isSelected = type.id === selectedTypeId
                      const disabled = !canSelectType(type)
                      return (
                        <button
                          key={`${type.id}-${type.isHome ? 'home' : 'page'}`}
                          type="button"
                          onClick={() => handleTypeClick(type)}
                          disabled={disabled}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                            disabled && 'cursor-not-allowed opacity-50',
                            isSelected
                              ? 'bg-primary/20 text-white'
                              : 'text-gray-300 hover:bg-gray-800'
                          )}
                        >
                          <span className="text-sm font-medium">{type.name}</span>
                          {type.isHome && <Badge variant="secondary">Home</Badge>}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="page-title" className="text-gray-300">
                Page title
              </Label>
              <Input
                id="page-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setTitleEdited(true)
                }}
                placeholder={selectedType ? `${selectedType.name} page` : 'New page'}
                className="bg-gray-900 text-white"
              />
            </div>

            {isHomeSelection && (
              <p className="text-xs text-orange-200">
                Only one Home page is allowed per site. This page will become the first entry in your sitemap.
              </p>
            )}

            <div className="mt-auto flex justify-end gap-2 border-t border-gray-800 pt-4">
              <Button variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={disableConfirm}>
                Create page
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function suggestedTitle(typeName: string): string {
  if (!typeName) return 'New Page'
  const normalized = typeName.trim()
  if (normalized.length === 0) return 'New Page'
  if (normalized.toLowerCase() === 'home') {
    return 'Home'
  }
  if (/page$/i.test(normalized)) {
    return normalized
  }
  return `${normalized} Page`
}
