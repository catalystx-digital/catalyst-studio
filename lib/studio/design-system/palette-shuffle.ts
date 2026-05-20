import seedrandom from 'seedrandom'
import { converter, differenceCiede2000, formatHex } from 'culori'
import { hex as contrastHex } from 'wcag-contrast'
import type { DesignSystem, TokenColor } from '@/lib/studio/import/types/design-system.types'

const toOklch = converter('oklch')
const toRgb = converter('rgb')
const deltaE = differenceCiede2000()

type PaletteCategoryKey = keyof DesignSystem['palette']

const CATEGORY_BOUNDS: Record<
  PaletteCategoryKey,
  { hue: number; chroma: number; luminance: number; clampChroma?: number }
> = {
  primary: { hue: 10, chroma: 0.03, luminance: 0.04 },
  secondary: { hue: 14, chroma: 0.04, luminance: 0.02 },
  accent: { hue: 18, chroma: 0.05, luminance: 0.05 },
  neutral: { hue: 6, chroma: 0.02, luminance: 0.03, clampChroma: 0.04 },
  surface: { hue: 4, chroma: 0.015, luminance: 0.03, clampChroma: 0.03 }
}

const MAX_GENERATION_ATTEMPTS = 10
const MIN_DELTA_E = 4
const MAX_DELTA_E = 20
const MIN_CONTRAST_RATIO = 4.5

export interface PaletteShuffleOptions {
  conceptId: string
  palette: DesignSystem['palette']
  seed?: string
  maxAttempts?: number
  backgrounds?: string[]
}

export interface PaletteShuffleResult {
  palette: DesignSystem['palette']
  seed: string
  deltaMap: Record<string, number>
}

export function shufflePalette({
  conceptId,
  palette,
  seed,
  maxAttempts = MAX_GENERATION_ATTEMPTS,
  backgrounds
}: PaletteShuffleOptions): PaletteShuffleResult {
  const resolvedSeed = seed ?? `${conceptId}:${Date.now()}`
  const rng = seedrandom(resolvedSeed)

  // Handle undefined or empty palette gracefully
  if (!palette || Object.keys(palette).length === 0) {
    return {
      palette: palette ?? ({} as DesignSystem['palette']),
      seed: resolvedSeed,
      deltaMap: {}
    }
  }

  const contrastBackgrounds = backgrounds?.length ? backgrounds : deriveBackgrounds(palette)
  const updatedPalette = {} as DesignSystem['palette']
  const deltaMap: Record<string, number> = {}

  for (const category of Object.keys(palette) as PaletteCategoryKey[]) {
    const tokens = palette[category]
    const bounds = CATEGORY_BOUNDS[category]
    if (!tokens) {
      updatedPalette[category] = []
      continue
    }

    const ordering = computeOrdering(tokens)
    const previousLValues: number[] = []

    updatedPalette[category] = tokens.map((token, index) => {
      const normalizedHex = normalizeHex(token.value)
      if (!normalizedHex) {
        previousLValues[index] = toOklch('#000000')?.l ?? 0.5
        return token
      }

      const baseColor = toOklch(normalizedHex)
      if (!baseColor) {
        previousLValues[index] = toOklch('#000000')?.l ?? 0.5
        return token
      }

      let attempt = 0
      let applied: TokenColor | null = null
      let lastDelta = 0

      while (attempt < maxAttempts && !applied) {
        const candidate = buildCandidateColor({
          base: baseColor,
          category,
          index,
          ordering,
          previousLValues,
          bounds,
          rng,
          attempt,
          maxAttempts
        })

        if (!candidate) {
          attempt++
          continue
        }

        const candidateHex = formatHex(candidate)
        if (!candidateHex) {
          attempt++
          continue
        }

        const delta = Math.abs(
          deltaE(normalizedHex, candidateHex) ?? Number.NaN
        )
        if (!Number.isFinite(delta) || delta < MIN_DELTA_E || delta > MAX_DELTA_E) {
          attempt++
          continue
        }

        if (!passesContrast(candidateHex, contrastBackgrounds)) {
          attempt++
          continue
        }

        const adjustedHex = enforceLuminanceHierarchy(
          candidateHex,
          category,
          ordering.direction,
          previousLValues,
          index
        )

        applied = {
          ...token,
          value: adjustedHex,
          hex: adjustedHex,
          rgba: hexToRgba(adjustedHex),
          source: 'shuffle',
          confidence: 0.75,
          generatorSeed: resolvedSeed
        }
        lastDelta = delta
      }

      if (!applied) {
        applied = { ...token, generatorSeed: resolvedSeed }
        lastDelta = 0
      }

      const appliedOklch = toOklch(applied.value ?? '#000000')
      previousLValues[index] = appliedOklch?.l ?? previousLValues[index - 1] ?? 0.5
      deltaMap[`${category}-${index}`] = lastDelta
      return applied
    })
  }

  return {
    palette: updatedPalette,
    seed: resolvedSeed,
    deltaMap
  }
}

function deriveBackgrounds(palette: DesignSystem['palette']): string[] {
  const surfaces = [...(palette.surface || []), ...(palette.neutral || [])]
  const normalized = surfaces
    .map((token) => normalizeHex(token.value))
    .filter((value): value is string => Boolean(value))
  if (normalized.length === 0) {
    return ['#FFFFFF', '#0F172A']
  }
  return normalized
}

function passesContrast(hexValue: string, backgrounds: string[]): boolean {
  return backgrounds.some((bg) => {
    try {
      const ratio = contrastHex(hexValue, bg)
      return Number.isFinite(ratio) && ratio >= MIN_CONTRAST_RATIO
    } catch {
      return false
    }
  })
}

function buildCandidateColor({
  base,
  category,
  index,
  ordering,
  previousLValues,
  bounds,
  rng,
  attempt,
  maxAttempts
}: {
  base: ReturnType<typeof toOklch>
  category: PaletteCategoryKey
  index: number
  ordering: { direction: 'asc' | 'desc' }
  previousLValues: number[]
  bounds: { hue: number; chroma: number; luminance: number; clampChroma?: number }
  rng: seedrandom.PRNG
  attempt: number
  maxAttempts: number
}) {
  if (!base) return null
  const attemptScale = maxAttempts > 1 ? 1 + attempt / (maxAttempts - 1) : 1
  const hueShift =
    category === 'accent'
      ? accentHueShift(base.h ?? 0, rng) * attemptScale
      : jitter(rng, bounds.hue * attemptScale)
  const chromaShift = jitter(rng, bounds.chroma * attemptScale)
  const luminanceShift = jitter(rng, bounds.luminance * attemptScale)

  const currentL = base.l ?? 0.5
  const parentL = index === 0 ? currentL : previousLValues[index - 1] ?? currentL
  const directionFactor = ordering.direction === 'asc' ? 1 : -1
  const steppedL =
    index === 0
      ? clamp01(currentL + luminanceShift)
      : clamp01(parentL + directionFactor * 0.015 + luminanceShift / 2)

  const candidate = {
    mode: 'oklch' as const,
    l: clamp01(steppedL),
    c: clampChroma((base.c ?? 0.05) + chromaShift, bounds.clampChroma),
    h: normalizeHue((base.h ?? 0) + hueShift)
  }

  const rgbCandidate = toRgb(candidate)
  if (!rgbCandidate) {
    return null
  }

  return candidate
}

function computeOrdering(tokens: TokenColor[]) {
  if (tokens.length < 2) {
    return { direction: 'asc' as const }
  }

  const first = toOklch(normalizeHex(tokens[0].value) ?? '#000000')
  const last = toOklch(
    normalizeHex(tokens[tokens.length - 1].value) ?? '#000000'
  )
  if (!first || !last) {
    return { direction: 'asc' as const }
  }

  return {
    direction: (last.l ?? 0) >= (first.l ?? 0) ? ('asc' as const) : ('desc' as const)
  }
}

function enforceLuminanceHierarchy(
  hexValue: string,
  category: PaletteCategoryKey,
  direction: 'asc' | 'desc',
  previousLValues: number[],
  index: number
): string {
  if (index === 0) {
    return hexValue
  }

  const current = toOklch(hexValue)
  const prior = previousLValues[index - 1]
  if (!current || prior === undefined) {
    return hexValue
  }

  const desired =
    direction === 'asc'
      ? Math.max(current.l ?? 0, prior + 0.01)
      : Math.min(current.l ?? 0, prior - 0.01)

  const adjusted = {
    mode: 'oklch' as const,
    l: clamp01(desired),
    c: current.c,
    h: current.h
  }
  return formatHex(adjusted) ?? hexValue
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function clampChroma(value: number, clampValue = 0.4): number {
  return Math.max(0, Math.min(clampValue, value))
}

function accentHueShift(baseHue: number, rng: seedrandom.PRNG): number {
  const targetAngles = [baseHue + 180, baseHue + 150, baseHue - 150]
  const picked = targetAngles[Math.floor(rng() * targetAngles.length)]
  const difference = normalizeHue(picked) - normalizeHue(baseHue)
  const direction = difference >= 0 ? 1 : -1
  const magnitude = Math.min(18, Math.abs(difference))
  return direction * (8 + rng() * (magnitude - 8))
}

function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  let hue = value % 360
  if (hue < 0) {
    hue += 360
  }
  return hue
}

function jitter(rng: seedrandom.PRNG, range: number): number {
  if (range === 0) return 0
  return (rng() * 2 - 1) * range
}

function normalizeHex(value?: string | null): string | null {
  if (!value) return null
  let hex = value.trim().replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }
  return `#${hex.toUpperCase()}`
}

function hexToRgba(value: string): string {
  const normalized = normalizeHex(value) ?? '#000000'
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 1)`
}
