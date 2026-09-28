import type React from 'react'
import { contrastTextColor } from '@/lib/studio/components/cms/_utils/color-contrast'
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
