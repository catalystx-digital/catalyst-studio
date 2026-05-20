'use client'

/**
 * RichTextEditor - Formatted HTML content editor
 *
 * Features:
 * - Basic formatting toolbar (bold, italic, underline)
 * - Heading levels
 * - Lists (ordered, unordered)
 * - Links
 * - HTML preview toggle
 *
 * Note: This is a basic implementation using contenteditable.
 * For production, consider integrating a library like TipTap, Slate, or Lexical.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Unlink,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  PrimitiveEditor,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

interface ToolbarButtonProps {
  command: string
  icon: React.ReactNode
  title: string
  active?: boolean
  onClick?: () => void
}

function ToolbarButton({ command, icon, title, active, onClick }: ToolbarButtonProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (onClick) {
        onClick()
      } else {
        document.execCommand(command, false)
      }
    },
    [command, onClick]
  )

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={handleClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const editorRef = React.useRef<HTMLDivElement>(null)
  const [showPreview, setShowPreview] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value ?? '')

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(value ?? '')
    if (editorRef.current && editorRef.current.innerHTML !== (value ?? '')) {
      editorRef.current.innerHTML = value ?? ''
    }
  }, [value])

  // Handle content changes
  const handleInput = React.useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    setLocalValue(html)
    onChange(html)
  }, [onChange])

  // Handle paste - clean up pasted HTML
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  // Format commands
  const execCommand = React.useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }, [handleInput])

  // Insert link
  const insertLink = React.useCallback(() => {
    const url = window.prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }, [execCommand])

  // Remove link
  const removeLink = React.useCallback(() => {
    execCommand('unlink')
  }, [execCommand])

  // Format heading
  const formatHeading = React.useCallback((level: number) => {
    execCommand('formatBlock', `h${level}`)
  }, [execCommand])

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className={cn('rounded-md border', error && 'border-destructive')}>
        {/* Toolbar */}
        {!isDisabled && (
          <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/50 p-1">
            {/* Text formatting */}
            <ToolbarButton
              command="bold"
              icon={<Bold className="h-4 w-4" />}
              title="Bold (Ctrl+B)"
            />
            <ToolbarButton
              command="italic"
              icon={<Italic className="h-4 w-4" />}
              title="Italic (Ctrl+I)"
            />
            <ToolbarButton
              command="underline"
              icon={<Underline className="h-4 w-4" />}
              title="Underline (Ctrl+U)"
            />
            <ToolbarButton
              command="strikeThrough"
              icon={<Strikethrough className="h-4 w-4" />}
              title="Strikethrough"
            />

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Headings */}
            <ToolbarButton
              command=""
              icon={<Heading1 className="h-4 w-4" />}
              title="Heading 1"
              onClick={() => formatHeading(1)}
            />
            <ToolbarButton
              command=""
              icon={<Heading2 className="h-4 w-4" />}
              title="Heading 2"
              onClick={() => formatHeading(2)}
            />
            <ToolbarButton
              command=""
              icon={<Heading3 className="h-4 w-4" />}
              title="Heading 3"
              onClick={() => formatHeading(3)}
            />

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Lists */}
            <ToolbarButton
              command="insertUnorderedList"
              icon={<List className="h-4 w-4" />}
              title="Bullet List"
            />
            <ToolbarButton
              command="insertOrderedList"
              icon={<ListOrdered className="h-4 w-4" />}
              title="Numbered List"
            />

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Links */}
            <ToolbarButton
              command=""
              icon={<Link2 className="h-4 w-4" />}
              title="Insert Link"
              onClick={insertLink}
            />
            <ToolbarButton
              command=""
              icon={<Unlink className="h-4 w-4" />}
              title="Remove Link"
              onClick={removeLink}
            />

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Other formatting */}
            <ToolbarButton
              command="formatBlock"
              icon={<Quote className="h-4 w-4" />}
              title="Block Quote"
              onClick={() => execCommand('formatBlock', 'blockquote')}
            />
            <ToolbarButton
              command="formatBlock"
              icon={<Code className="h-4 w-4" />}
              title="Code Block"
              onClick={() => execCommand('formatBlock', 'pre')}
            />

            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-8 gap-1"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span className="text-xs">Edit</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    <span className="text-xs">Preview</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Editor / Preview */}
        {showPreview ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[150px]"
            dangerouslySetInnerHTML={{ __html: localValue }}
          />
        ) : (
          <div
            ref={editorRef}
            id={id}
            contentEditable={!isDisabled}
            onInput={handleInput}
            onPaste={handlePaste}
            className={cn(
              'prose prose-sm dark:prose-invert max-w-none p-3 min-h-[150px] focus:outline-none',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            role="textbox"
            aria-multiline="true"
            aria-label={schema.label || schema.name}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${id}-error`
                : schema.description
                  ? `${id}-description`
                  : undefined
            }
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: localValue }}
          />
        )}
      </div>
    </PrimitiveEditor>
  )
}
