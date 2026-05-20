'use client'

/**
 * LinkEditor - Universal link editor (union type)
 *
 * Features:
 * - Type selector: Internal | External | Email | Phone | Anchor
 * - Render appropriate sub-editor based on type
 * - Storage formats (aligned with ValueObjectRegistry SmartLink schema):
 *   - external: { type: 'external', url: string, label?, openInNewTab? }
 *   - internal: { type: 'internal', pageId: string, path: string, label? }
 *   - email: { type: 'email', href: string, label? }
 *   - phone: { type: 'phone', href: string, label? }
 *   - anchor: { type: 'anchor', href: string, label? }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  ExternalLink,
  FileText,
  Hash,
  Mail,
  Phone,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { PrimitiveEditor, useDebouncedCallback, useFieldId } from './PrimitiveEditor'
import { ExternalUrlEditor } from './ExternalUrlEditor'
import { InternalLinkEditor } from './InternalLinkEditor'
import { EmailEditor } from './EmailEditor'
import { PhoneEditor } from './PhoneEditor'
import type { EditorProps } from './types'
import type { LinkValue, InternalLinkValue } from '../schema/types'

type LinkType = 'external' | 'internal' | 'email' | 'phone' | 'anchor'

const LINK_TYPE_CONFIG: Record<
  LinkType,
  { label: string; icon: React.ElementType }
> = {
  external: { label: 'URL', icon: ExternalLink },
  internal: { label: 'Page', icon: FileText },
  email: { label: 'Email', icon: Mail },
  phone: { label: 'Phone', icon: Phone },
  anchor: { label: 'Anchor', icon: Hash },
}

interface LinkEditorProps extends EditorProps<LinkValue | null> {
  /** Pages available for internal link selection */
  pages?: Array<{ id: string; title: string; path: string; depth?: number }>
  /** Callback to load pages */
  onLoadPages?: () => Promise<Array<{ id: string; title: string; path: string; depth?: number }>>
}

export function LinkEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  pages,
  onLoadPages,
}: LinkEditorProps) {
  const id = useFieldId(schema, providedId)

  // Get allowed link types from schema, default to all
  const allowedTypes: LinkType[] = (schema.linkTypes as LinkType[]) ?? [
    'external',
    'internal',
    'email',
    'phone',
    'anchor',
  ]

  // Determine current type from value
  const currentType: LinkType = value?.type ?? allowedTypes[0]

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Handle type change - output schema-aligned formats
  const handleTypeChange = React.useCallback(
    (newType: string) => {
      const type = newType as LinkType
      // Create new value with new type (schema-aligned format)
      switch (type) {
        case 'external':
          onChange({ type: 'external', url: '' })
          break
        case 'internal':
          onChange(null) // Will be populated by InternalLinkEditor
          break
        case 'email':
          onChange({ type: 'email', href: '' })
          break
        case 'phone':
          onChange({ type: 'phone', href: '' })
          break
        case 'anchor':
          onChange({ type: 'anchor', href: '' })
          break
      }
    },
    [onChange]
  )

  // Handle value change for string-based types (schema-aligned format)
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      switch (currentType) {
        case 'external':
          // External uses 'url' field per ExternalLinkSchema
          onChange({ type: 'external', url: newValue })
          break
        case 'email':
          // Email uses 'href' field per EmailLinkSchema
          onChange({ type: 'email', href: newValue })
          break
        case 'phone':
          // Phone uses 'href' field per PhoneLinkSchema
          onChange({ type: 'phone', href: newValue })
          break
        case 'anchor':
          // Anchor uses 'href' field per AnchorLinkSchema
          onChange({ type: 'anchor', href: newValue })
          break
      }
    },
    [currentType, onChange]
  )

  // Handle internal link change
  const handleInternalChange = React.useCallback(
    (link: InternalLinkValue | null) => {
      onChange(link)
    },
    [onChange]
  )

  // Get string value for current type (supports both old and new formats)
  const stringValue = React.useMemo(() => {
    if (!value) return ''
    if (value.type === 'internal') return ''

    // New schema-aligned format uses 'url' for external, 'href' for email/phone/anchor
    if (value.type === 'external') {
      return (value as { url?: string; value?: string }).url ??
             (value as { value?: string }).value ?? ''
    }
    // Email, phone, anchor use 'href' in new format, 'value' in old format
    return (value as { href?: string; value?: string }).href ??
           (value as { value?: string }).value ?? ''
  }, [value])

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <Tabs
        value={currentType}
        onValueChange={handleTypeChange}
        className="w-full"
      >
        <TabsList className={cn('grid w-full', `grid-cols-${allowedTypes.length}`)}>
          {allowedTypes.map((type) => {
            const config = LINK_TYPE_CONFIG[type]
            const Icon = config.icon
            return (
              <TabsTrigger
                key={type}
                value={type}
                disabled={isDisabled}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{config.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* External URL */}
        {allowedTypes.includes('external') && (
          <TabsContent value="external" className="mt-3">
            <ExternalUrlEditor
              value={stringValue}
              onChange={handleValueChange}
              schema={{
                ...schema,
                name: `${schema.name}-external`,
                label: undefined,
                description: undefined,
              }}
              disabled={isDisabled}
            />
          </TabsContent>
        )}

        {/* Internal Page */}
        {allowedTypes.includes('internal') && (
          <TabsContent value="internal" className="mt-3">
            <InternalLinkEditor
              value={value?.type === 'internal' ? value : null}
              onChange={handleInternalChange}
              schema={{
                ...schema,
                name: `${schema.name}-internal`,
                label: undefined,
                description: undefined,
              }}
              disabled={isDisabled}
              pages={pages}
              onLoadPages={onLoadPages}
            />
          </TabsContent>
        )}

        {/* Email */}
        {allowedTypes.includes('email') && (
          <TabsContent value="email" className="mt-3">
            <EmailEditor
              value={stringValue}
              onChange={handleValueChange}
              schema={{
                ...schema,
                name: `${schema.name}-email`,
                label: undefined,
                description: undefined,
              }}
              disabled={isDisabled}
            />
          </TabsContent>
        )}

        {/* Phone */}
        {allowedTypes.includes('phone') && (
          <TabsContent value="phone" className="mt-3">
            <PhoneEditor
              value={stringValue}
              onChange={handleValueChange}
              schema={{
                ...schema,
                name: `${schema.name}-phone`,
                label: undefined,
                description: undefined,
              }}
              disabled={isDisabled}
            />
          </TabsContent>
        )}

        {/* Anchor */}
        {allowedTypes.includes('anchor') && (
          <TabsContent value="anchor" className="mt-3">
            <AnchorEditor
              value={stringValue}
              onChange={handleValueChange}
              schema={{
                ...schema,
                name: `${schema.name}-anchor`,
                label: undefined,
                description: undefined,
              }}
              disabled={isDisabled}
            />
          </TabsContent>
        )}
      </Tabs>
    </PrimitiveEditor>
  )
}

/**
 * AnchorEditor - Anchor link input (internal component)
 */
function AnchorEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(value ?? '')

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value
      // Ensure it starts with #
      if (newValue && !newValue.startsWith('#')) {
        newValue = `#${newValue}`
      }
      setLocalValue(newValue)
      debouncedOnChange(newValue)
    },
    [debouncedOnChange]
  )

  // Handle blur
  const handleBlur = React.useCallback(() => {
    flush()
  }, [flush])

  return (
    <div className="relative">
      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={isDisabled}
        placeholder={schema.placeholder ?? '#section-id'}
        className={cn(
          'pl-10',
          error && 'border-destructive focus-visible:ring-destructive'
        )}
        aria-invalid={!!error}
      />
    </div>
  )
}
