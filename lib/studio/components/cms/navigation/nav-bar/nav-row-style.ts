import type React from 'react'
import type { NavBarRowStyle } from './nav-bar.types'

export function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const color = value.trim()
  if (!color || /[;{}]/.test(color)) {
    return false
  }
  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*[\d.\s,%]+\)$/i.test(color) ||
    /^hsla?\(\s*[\d.\s,%degturnrad]+\)$/i.test(color) ||
    /^var\(--[a-z0-9-_]+\)$/i.test(color)
  )
}

function parseHexColor(color: string): { r: number; g: number; b: number } | undefined {
  const value = color.trim()
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!match) {
    return undefined
  }

  const hex = match[1]
  const normalized = hex.length === 3 || hex.length === 4
    ? hex.slice(0, 3).split('').map(char => `${char}${char}`).join('')
    : hex.slice(0, 6)

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  }
}

function parseRgbColor(color: string): { r: number; g: number; b: number } | undefined {
  const match = color.trim().match(/^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i)
  if (!match) {
    return undefined
  }

  return {
    r: Math.max(0, Math.min(255, Number(match[1]))),
    g: Math.max(0, Math.min(255, Number(match[2]))),
    b: Math.max(0, Math.min(255, Number(match[3])))
  }
}

function contrastTextColor(backgroundColor: string): string | undefined {
  const rgb = parseHexColor(backgroundColor) ?? parseRgbColor(backgroundColor)
  if (!rgb) {
    return undefined
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.55 ? '#111827' : '#ffffff'
}

export function rowStyleToCss(style: NavBarRowStyle | undefined): React.CSSProperties | undefined {
  if (!style || typeof style !== 'object') {
    return undefined
  }
  const backgroundColor = isSafeCssColor((style as Record<string, unknown>).backgroundColor)
    ? ((style as Record<string, string>).backgroundColor.trim())
    : undefined
  const textColorValue = (style as Record<string, unknown>).textColor ?? (style as Record<string, unknown>).color
  const color = isSafeCssColor(textColorValue)
    ? String(textColorValue).trim()
    : backgroundColor
      ? contrastTextColor(backgroundColor)
      : undefined
  const borderColor = isSafeCssColor((style as Record<string, unknown>).borderColor)
    ? ((style as Record<string, string>).borderColor.trim())
    : undefined

  const css: React.CSSProperties = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(color ? { color } : {}),
    ...(borderColor ? { borderColor } : {})
  }

  return Object.keys(css).length > 0 ? css : undefined
}

export function normalizeStyleLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toLowerCase()
}
