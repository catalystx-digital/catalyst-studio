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

export function contrastTextColor(backgroundColor: string): string | undefined {
  const rgb = parseHexColor(backgroundColor) ?? parseRgbColor(backgroundColor)
  if (!rgb) {
    return undefined
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255

  return luminance > 0.55 ? '#111827' : '#ffffff'
}
