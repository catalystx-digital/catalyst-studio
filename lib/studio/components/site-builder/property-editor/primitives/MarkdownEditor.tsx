'use client'

/**
 * MarkdownEditor - Markdown content editor with preview
 *
 * Features:
 * - Markdown text input
 * - Live preview toggle
 * - Basic toolbar for common Markdown syntax
 * - Syntax highlighting hints
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Image,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
} from 'lucide-react'
import {
  PrimitiveEditor,
  CharacterCount,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

// Simple markdown to HTML converter for preview
// In production, use a library like marked, remark, or markdown-it
function parseMarkdown(markdown: string): string {
  if (!markdown) return ''

  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gim, '<hr />')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Line breaks
    .replace(/\n/g, '<br />')

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>')

  return html
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  title: string
  onClick: () => void
}

function ToolbarButton({ icon, title, onClick }: ToolbarButtonProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onClick()
    },
    [onClick]
  )

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  )
}

export function MarkdownEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [localValue, setLocalValue] = React.useState(value ?? '')
  const [activeTab, setActiveTab] = React.useState<string>('write')

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      debouncedOnChange(newValue)
    },
    [debouncedOnChange]
  )

  // Handle blur - flush debounce
  const handleBlur = React.useCallback(() => {
    flush()
  }, [flush])

  // Insert text at cursor position
  const insertText = React.useCallback(
    (before: string, after: string = '', placeholder: string = '') => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = localValue.substring(start, end) || placeholder

      const newValue =
        localValue.substring(0, start) +
        before +
        selectedText +
        after +
        localValue.substring(end)

      setLocalValue(newValue)
      onChange(newValue)

      // Reset cursor position
      setTimeout(() => {
        const newCursorPos = start + before.length + selectedText.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      }, 0)
    },
    [localValue, onChange]
  )

  // Toolbar actions
  const toolbarActions = {
    bold: () => insertText('**', '**', 'bold text'),
    italic: () => insertText('*', '*', 'italic text'),
    strikethrough: () => insertText('~~', '~~', 'strikethrough'),
    h1: () => insertText('# ', '', 'Heading 1'),
    h2: () => insertText('## ', '', 'Heading 2'),
    h3: () => insertText('### ', '', 'Heading 3'),
    bulletList: () => insertText('- ', '', 'list item'),
    numberedList: () => insertText('1. ', '', 'list item'),
    quote: () => insertText('> ', '', 'quote'),
    code: () => insertText('`', '`', 'code'),
    codeBlock: () => insertText('```\n', '\n```', 'code block'),
    link: () => insertText('[', '](url)', 'link text'),
    image: () => insertText('![', '](image-url)', 'alt text'),
    hr: () => insertText('\n---\n', '', ''),
  }

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const charCount = localValue?.length ?? 0
  const isOverLimit = schema.maxLength ? charCount > schema.maxLength : false
  const rows = schema.rows ?? 10

  // Parse markdown for preview
  const previewHtml = React.useMemo(() => parseMarkdown(localValue), [localValue])

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className={cn('rounded-md border', error && 'border-destructive')}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center border-b bg-muted/50">
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger
                value="write"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Write
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Toolbar - only visible in write mode */}
            {activeTab === 'write' && !isDisabled && (
              <div className="flex flex-wrap items-center gap-0.5 px-2">
                <Separator orientation="vertical" className="mx-1 h-6" />

                <ToolbarButton
                  icon={<Bold className="h-4 w-4" />}
                  title="Bold (**text**)"
                  onClick={toolbarActions.bold}
                />
                <ToolbarButton
                  icon={<Italic className="h-4 w-4" />}
                  title="Italic (*text*)"
                  onClick={toolbarActions.italic}
                />
                <ToolbarButton
                  icon={<Strikethrough className="h-4 w-4" />}
                  title="Strikethrough (~~text~~)"
                  onClick={toolbarActions.strikethrough}
                />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <ToolbarButton
                  icon={<Heading1 className="h-4 w-4" />}
                  title="Heading 1 (# )"
                  onClick={toolbarActions.h1}
                />
                <ToolbarButton
                  icon={<Heading2 className="h-4 w-4" />}
                  title="Heading 2 (## )"
                  onClick={toolbarActions.h2}
                />
                <ToolbarButton
                  icon={<Heading3 className="h-4 w-4" />}
                  title="Heading 3 (### )"
                  onClick={toolbarActions.h3}
                />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <ToolbarButton
                  icon={<List className="h-4 w-4" />}
                  title="Bullet List (- item)"
                  onClick={toolbarActions.bulletList}
                />
                <ToolbarButton
                  icon={<ListOrdered className="h-4 w-4" />}
                  title="Numbered List (1. item)"
                  onClick={toolbarActions.numberedList}
                />
                <ToolbarButton
                  icon={<Quote className="h-4 w-4" />}
                  title="Quote (> text)"
                  onClick={toolbarActions.quote}
                />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <ToolbarButton
                  icon={<Code className="h-4 w-4" />}
                  title="Inline Code (`code`)"
                  onClick={toolbarActions.code}
                />
                <ToolbarButton
                  icon={<Link2 className="h-4 w-4" />}
                  title="Link ([text](url))"
                  onClick={toolbarActions.link}
                />
                <ToolbarButton
                  icon={<Image className="h-4 w-4" />}
                  title="Image (![alt](url))"
                  onClick={toolbarActions.image}
                />
                <ToolbarButton
                  icon={<Minus className="h-4 w-4" />}
                  title="Horizontal Rule (---)"
                  onClick={toolbarActions.hr}
                />
              </div>
            )}
          </div>

          <TabsContent value="write" className="relative mt-0">
            <Textarea
              ref={textareaRef}
              id={id}
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isDisabled}
              placeholder={schema.placeholder || 'Write your content in Markdown...'}
              rows={rows}
              className={cn(
                'resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0',
                isOverLimit && 'text-destructive'
              )}
              aria-invalid={!!error}
              aria-describedby={
                error
                  ? `${id}-error`
                  : schema.description
                    ? `${id}-description`
                    : undefined
              }
            />

            {/* Character count */}
            {schema.maxLength && (
              <div className="absolute bottom-2 right-3">
                <CharacterCount count={charCount} maxLength={schema.maxLength} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <div
              className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[150px]"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            {!previewHtml && (
              <div className="p-3 min-h-[150px] text-muted-foreground text-sm italic">
                Nothing to preview yet...
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Markdown syntax help */}
      <div className="mt-1 text-xs text-muted-foreground">
        Supports Markdown: **bold**, *italic*, [links](url), `code`, and more.
      </div>
    </PrimitiveEditor>
  )
}
