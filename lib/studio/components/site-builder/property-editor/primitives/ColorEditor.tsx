'use client'

/**
 * ColorEditor - Color picker editor
 *
 * Features:
 * - HEX, RGB, HSL format support
 * - Preset color palette
 * - Transparency/alpha support
 * - Eye dropper (if browser supports)
 *
 * Refactored from ColorPropertyField.tsx to match new EditorProps interface
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Palette, Copy, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { PrimitiveEditor, useDebouncedCallback, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

const DEFAULT_PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C0C0C0',
  '#800000', '#008000', '#000080', '#808000', '#800080',
  '#008080', '#FFA500', '#A52A2A', '#DDA0DD', '#F0E68C',
]

type ColorFormat = 'hex' | 'rgb' | 'hsl'

// Color conversion utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function formatToString(
  format: ColorFormat,
  r: number,
  g: number,
  b: number,
  a?: number
): string {
  switch (format) {
    case 'hex':
      return rgbToHex(r, g, b)
    case 'rgb':
      return a !== undefined && a < 1
        ? `rgba(${r}, ${g}, ${b}, ${a})`
        : `rgb(${r}, ${g}, ${b})`
    case 'hsl': {
      const { h, s, l } = rgbToHsl(r, g, b)
      return a !== undefined && a < 1
        ? `hsla(${h}, ${s}%, ${l}%, ${a})`
        : `hsl(${h}, ${s}%, ${l}%)`
    }
    default:
      return rgbToHex(r, g, b)
  }
}

function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Handle transparent
  if (color === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  // Handle hex
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color)
    if (rgb) return { ...rgb, a: 1 }
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    }
  }

  return null
}

function detectFormat(color: string): ColorFormat {
  if (color.startsWith('#')) return 'hex'
  if (color.startsWith('rgb')) return 'rgb'
  if (color.startsWith('hsl')) return 'hsl'
  return 'hex'
}

export function ColorEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | null>) {
  const id = useFieldId(schema, providedId)
  const [isOpen, setIsOpen] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value ?? '#000000')
  const [format, setFormat] = React.useState<ColorFormat>('hex')
  const [alpha, setAlpha] = React.useState(1)
  const [copied, setCopied] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const allowAlpha = schema.allowAlpha ?? true

  // Sync with external value
  React.useEffect(() => {
    if (value) {
      setLocalValue(value)
      setFormat(detectFormat(value))
      const parsed = parseColor(value)
      if (parsed) {
        setAlpha(parsed.a)
      }
    }
  }, [value])

  // Debounced onChange
  const [debouncedOnChange] = useDebouncedCallback(onChange, 300)

  // Handle native color picker change
  const handleColorPickerChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value
      const rgb = hexToRgb(hex)
      if (rgb) {
        const formatted = formatToString(format, rgb.r, rgb.g, rgb.b, allowAlpha ? alpha : undefined)
        setLocalValue(formatted)
        debouncedOnChange(formatted)
      }
    },
    [format, alpha, allowAlpha, debouncedOnChange]
  )

  // Handle text input change
  const handleTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      debouncedOnChange(newValue)
    },
    [debouncedOnChange]
  )

  // Handle preset color click
  const handlePresetClick = React.useCallback(
    (color: string) => {
      const rgb = hexToRgb(color)
      if (rgb) {
        const formatted = formatToString(format, rgb.r, rgb.g, rgb.b, allowAlpha ? alpha : undefined)
        setLocalValue(formatted)
        onChange(formatted)
      }
    },
    [format, alpha, allowAlpha, onChange]
  )

  // Handle format change
  const handleFormatChange = React.useCallback(
    (newFormat: ColorFormat) => {
      setFormat(newFormat)
      const parsed = parseColor(localValue)
      if (parsed) {
        const formatted = formatToString(newFormat, parsed.r, parsed.g, parsed.b, allowAlpha ? parsed.a : undefined)
        setLocalValue(formatted)
        onChange(formatted)
      }
    },
    [localValue, allowAlpha, onChange]
  )

  // Handle alpha change
  const handleAlphaChange = React.useCallback(
    (values: number[]) => {
      const newAlpha = values[0]
      setAlpha(newAlpha)
      const parsed = parseColor(localValue)
      if (parsed) {
        const formatted = formatToString(format, parsed.r, parsed.g, parsed.b, newAlpha)
        setLocalValue(formatted)
        onChange(formatted)
      }
    },
    [localValue, format, onChange]
  )

  // Handle transparent
  const handleTransparent = React.useCallback(() => {
    setLocalValue('transparent')
    setAlpha(0)
    onChange('transparent')
  }, [onChange])

  // Handle copy
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(localValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [localValue])

  // Handle clear
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
    },
    [onChange]
  )

  // Get display color for preview
  const displayColor = React.useMemo(() => {
    if (localValue === 'transparent') {
      return 'repeating-conic-gradient(#CCC 0% 25%, white 0% 50%) 50% / 10px 10px'
    }
    return localValue
  }, [localValue])

  // Get hex value for native color picker
  const hexValue = React.useMemo(() => {
    const parsed = parseColor(localValue)
    if (parsed) {
      return rgbToHex(parsed.r, parsed.g, parsed.b)
    }
    return '#000000'
  }, [localValue])

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={isDisabled}
            className={cn(
              'w-full justify-start gap-2',
              error && 'border-destructive'
            )}
            aria-invalid={!!error}
          >
            <div
              className="h-5 w-5 rounded border border-border flex-shrink-0"
              style={{ background: displayColor }}
            />
            <span className="flex-1 text-left font-mono text-xs truncate">
              {localValue || 'Select color'}
            </span>
            {localValue && !schema.required && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <Palette className="h-4 w-4 flex-shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80" align="start">
          <Tabs
            value={format}
            onValueChange={(v) => handleFormatChange(v as ColorFormat)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hex">HEX</TabsTrigger>
              <TabsTrigger value="rgb">RGB</TabsTrigger>
              <TabsTrigger value="hsl">HSL</TabsTrigger>
            </TabsList>

            <TabsContent value={format} className="space-y-4 pt-4">
              {/* Color picker and input */}
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={hexValue}
                  onChange={handleColorPickerChange}
                  disabled={isDisabled}
                  className="h-12 w-20 p-1 cursor-pointer"
                />
                <Input
                  value={localValue}
                  onChange={handleTextChange}
                  disabled={isDisabled}
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  disabled={isDisabled}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Alpha slider */}
              {allowAlpha && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Opacity</span>
                    <span>{Math.round(alpha * 100)}%</span>
                  </div>
                  <Slider
                    value={[alpha]}
                    onValueChange={handleAlphaChange}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={isDisabled}
                  />
                </div>
              )}

              {/* Preset colors */}
              <div className="space-y-2">
                <div className="text-xs font-medium">Preset Colors</div>
                <div className="grid grid-cols-10 gap-1">
                  {DEFAULT_PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handlePresetClick(color)}
                      disabled={isDisabled}
                      className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Transparent button */}
              {allowAlpha && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTransparent}
                  disabled={isDisabled}
                  className="w-full"
                >
                  Set Transparent
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </PrimitiveEditor>
  )
}
