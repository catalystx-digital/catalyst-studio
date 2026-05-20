'use client'

import React, { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/lib/studio/hooks/use-permissions'
import { FieldEditor, type ContentTypeField } from '@/lib/studio/components/content-types'
import { toast } from 'sonner'

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

export default function NewContentTypePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const websiteId = searchParams?.get('websiteId') ?? null

  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canCreate = hasPermission('content_type:create')

  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [pluralName, setPluralName] = useState('')
  const [icon, setIcon] = useState('file-text')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'page' | 'component' | 'folder'>('page')
  const [fields, setFields] = useState<ContentTypeField[]>([])

  // Auto-generate plural name
  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-pluralize if plural name is empty or was auto-generated
    if (!pluralName || pluralName === name + 's' || pluralName === name + 'es') {
      if (value.endsWith('s') || value.endsWith('x') || value.endsWith('z') ||
          value.endsWith('ch') || value.endsWith('sh')) {
        setPluralName(value + 'es')
      } else if (value.endsWith('y') && !/[aeiou]y$/i.test(value)) {
        setPluralName(value.slice(0, -1) + 'ies')
      } else {
        setPluralName(value + 's')
      }
    }
  }

  const handleBack = useCallback(() => {
    const base = '/studio/content-types'
    const query = websiteId ? `?websiteId=${encodeURIComponent(websiteId)}` : ''
    router.push(`${base}${query}`)
  }, [router, websiteId])

  const handleCreate = useCallback(async () => {
    if (!websiteId) {
      toast.error('Website ID is required')
      return
    }

    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    if (!/^[A-Z]/.test(name)) {
      toast.error('Name must start with a capital letter')
      return
    }

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

      const res = await fetch('/api/content-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId,
        },
        body: JSON.stringify({
          websiteId,
          name,
          pluralName,
          icon,
          description,
          category,
          fields: apiFields,
          relationships: [],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create content type')
      }

      toast.success('Content type created successfully')
      handleBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create content type')
    } finally {
      setSaving(false)
    }
  }, [websiteId, name, pluralName, icon, description, category, fields, handleBack])

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

  if (permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!canCreate) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="max-w-lg rounded-lg border bg-card p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Permission Denied</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You don't have permission to create content types.
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
              <h1 className="text-2xl font-semibold">Create Content Type</h1>
              <p className="text-sm text-muted-foreground">
                Define a new page, component, or folder type
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Content Type
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
        {/* Basic Information */}
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
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Blog Post"
                />
                <p className="text-xs text-muted-foreground">
                  Must start with a capital letter
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pluralName">Plural Name *</Label>
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
                <Label htmlFor="icon">Icon *</Label>
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
                <Label htmlFor="category">Category *</Label>
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

        {/* Fields */}
        <Card>
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
