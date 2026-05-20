'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/lib/studio/hooks/use-permissions'
import { FieldEditor, type ContentTypeField } from '@/lib/studio/components/content-types'
import { toast } from 'sonner'

interface ContentType {
  id: string
  name: string
  pluralName?: string
  icon?: string
  category: string
  fields: unknown
  settings?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const ICON_OPTIONS = [
  { value: 'file-text', label: 'Document' },
  { value: 'layout', label: 'Layout' },
  { value: 'image', label: 'Image' },
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'box', label: 'Box' },
  { value: 'folder', label: 'Folder' },
  { value: 'bookmark', label: 'Bookmark' },
  { value: 'star', label: 'Star' },
  { value: 'tag', label: 'Tag' },
]

export default function EditContentTypePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const contentTypeId = params?.id as string
  const websiteId = searchParams?.get('websiteId') ?? null

  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canEdit = hasPermission('content_type:edit')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [pluralName, setPluralName] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'page' | 'component' | 'folder'>('page')
  const [fields, setFields] = useState<ContentTypeField[]>([])

  // Load content type
  useEffect(() => {
    if (!contentTypeId || !websiteId) return

    const fetchContentType = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/content-types/${contentTypeId}`, {
          headers: {
            'x-website-id': websiteId,
          },
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load content type')
        }

        const response = await res.json()
        const ct = response.data as ContentType
        setContentType(ct)

        // Populate form
        setName(ct.name || '')
        setPluralName(ct.pluralName || '')
        setIcon(ct.icon || '')
        setDescription(
          typeof ct.settings?.description === 'string' ? ct.settings.description : ''
        )
        setCategory((ct.category as 'page' | 'component' | 'folder') || 'page')

        // Parse and set fields
        let parsedFields: ContentTypeField[] = []
        const fieldsData = ct.fields
        if (fieldsData) {
          let rawFields: unknown[] = []
          if (Array.isArray(fieldsData)) {
            rawFields = fieldsData
          } else if (typeof fieldsData === 'object' && 'fields' in fieldsData && Array.isArray((fieldsData as Record<string, unknown>).fields)) {
            rawFields = (fieldsData as Record<string, unknown>).fields as unknown[]
          }
          parsedFields = rawFields.map((f: unknown, idx: number) => {
            const field = f as Record<string, unknown>
            return {
              id: (field.id as string) || `field_${idx}`,
              name: (field.name as string) || '',
              label: (field.label as string) || (field.name as string) || '',
              type: (field.type as ContentTypeField['type']) || 'text',
              required: Boolean(field.required),
              defaultValue: field.defaultValue,
              validation: field.validation as ContentTypeField['validation'],
              helpText: field.helpText as string | undefined,
              placeholder: field.placeholder as string | undefined,
              options: field.options as ContentTypeField['options'],
              order: typeof field.order === 'number' ? field.order : idx,
            }
          })
        }
        setFields(parsedFields)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content type')
      } finally {
        setLoading(false)
      }
    }

    fetchContentType()
  }, [contentTypeId, websiteId])

  const handleBack = useCallback(() => {
    const base = '/studio/content-types'
    const query = websiteId ? `?websiteId=${encodeURIComponent(websiteId)}` : ''
    router.push(`${base}${query}`)
  }, [router, websiteId])

  const handleSave = useCallback(async () => {
    if (!contentTypeId || !websiteId) return

    try {
      setSaving(true)

      // Transform fields to API format
      const apiFields = fields.map((field, index) => ({
        id: field.id,
        name: field.name,
        label: field.label || field.name,
        type: field.type,
        required: field.required,
        defaultValue: field.defaultValue,
        validation: field.validation,
        helpText: field.helpText,
        placeholder: field.placeholder,
        options: field.options,
        order: index,
      }))

      const res = await fetch(`/api/content-types/${contentTypeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId,
        },
        body: JSON.stringify({
          name,
          pluralName,
          icon,
          description,
          category,
          fields: apiFields,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save content type')
      }

      toast.success('Content type saved successfully')
      handleBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save content type')
    } finally {
      setSaving(false)
    }
  }, [contentTypeId, websiteId, name, pluralName, icon, description, category, fields, handleBack])

  if (!websiteId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="max-w-lg rounded-lg border bg-card p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Website ID required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Please access this page from the Content Types list.
          </p>
          <Button className="mt-6" onClick={() => router.push('/studio/content-types')}>
            Back to Content Types
          </Button>
        </div>
      </div>
    )
  }

  if (loading || permissionsLoading) {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-destructive">Error</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-6" onClick={handleBack}>
            Back to Content Types
          </Button>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="max-w-lg rounded-lg border bg-card p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Permission Denied</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You don't have permission to edit content types.
          </p>
          <Button variant="outline" className="mt-6" onClick={handleBack}>
            Back to Content Types
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Edit Content Type</h1>
              <p className="text-sm text-muted-foreground">
                {contentType?.name || 'Content Type'}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the display name and metadata for this content type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Blog Post"
                />
                <p className="text-xs text-muted-foreground">
                  Must start with a capital letter
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pluralName">Plural Name</Label>
                <Input
                  id="pluralName"
                  value={pluralName}
                  onChange={(e) => setPluralName(e.target.value)}
                  placeholder="e.g., Blog Posts"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val as 'page' | 'component' | 'folder')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Page</SelectItem>
                    <SelectItem value="component">Component</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this content type..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fields Editor */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Fields</CardTitle>
            <CardDescription>
              Define the fields that content editors will fill in when creating content of this type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldEditor
              fields={fields}
              onChange={setFields}
              disabled={saving}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
