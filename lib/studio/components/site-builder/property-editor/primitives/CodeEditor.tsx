'use client'

/**
 * CodeEditor - Code with syntax highlighting editor
 *
 * Features:
 * - Language-specific placeholder/hints
 * - Line numbers
 * - Monospace font
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plaintext', label: 'Plain Text' },
]

const LANGUAGE_PLACEHOLDERS: Record<string, string> = {
  javascript: '// Enter JavaScript code...',
  typescript: '// Enter TypeScript code...',
  html: '<!-- Enter HTML code -->',
  css: '/* Enter CSS styles */',
  json: '{\n  \n}',
  python: '# Enter Python code...',
  sql: '-- Enter SQL query...',
  markdown: '# Enter Markdown...',
  plaintext: 'Enter code...',
}

export function CodeEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(value ?? '')
  const [language, setLanguage] = React.useState(schema.language ?? 'plaintext')
  const [copied, setCopied] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const rows = schema.rows ?? 10

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Sync language from schema
  React.useEffect(() => {
    if (schema.language) {
      setLanguage(schema.language)
    }
  }, [schema.language])

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

  // Handle blur
  const handleBlur = React.useCallback(() => {
    flush()
  }, [flush])

  // Handle copy
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(localValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [localValue])

  // Handle Tab key for indentation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const target = e.currentTarget
        const start = target.selectionStart
        const end = target.selectionEnd

        // Insert tab character
        const newValue =
          localValue.substring(0, start) + '  ' + localValue.substring(end)
        setLocalValue(newValue)
        debouncedOnChange(newValue)

        // Move cursor after tab
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2
        })
      }
    },
    [localValue, debouncedOnChange]
  )

  const placeholder = LANGUAGE_PLACEHOLDERS[language] ?? 'Enter code...'

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex justify-between items-center">
          {/* Language selector (if not fixed by schema) */}
          {!schema.language && (
            <Select
              value={language}
              onValueChange={setLanguage}
              disabled={isDisabled}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {schema.language && (
            <span className="text-xs text-muted-foreground capitalize">
              {schema.language}
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={isDisabled || !localValue}
            title="Copy code"
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {/* Editor */}
        <Textarea
          id={id}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={rows}
          placeholder={placeholder}
          className={cn(
            'font-mono text-sm resize-none',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!error}
          spellCheck={false}
        />
      </div>
    </PrimitiveEditor>
  )
}
