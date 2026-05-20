'use client'

import React, { forwardRef, useMemo } from 'react'
import { DesignSystemCanvasInjector } from '@/lib/studio/components/site-builder/design-system-canvas-injector'
import { ProposalDesignConceptPreview } from '@/lib/studio/site-builder/proposal/types'
import { cn } from '@/lib/utils'

interface DesignConceptPreviewProps {
  concept: ProposalDesignConceptPreview
  mode?: 'full' | 'compact' | 'embed'
  showSampleCard?: boolean
}

const MODE_DIMENSIONS = {
  full: { width: 800, height: 600, showNarrative: true, gridCols: 'grid-cols-3', sectionCount: 3 },
  compact: { width: 560, height: 360, showNarrative: false, gridCols: 'grid-cols-2', sectionCount: 2 },
  embed: { width: 420, height: 260, showNarrative: false, gridCols: 'grid-cols-2', sectionCount: 0 }
} as const

const FALLBACK_PALETTE = {
  primary: '#FF6B2C',
  secondary: '#4B5582',
  accent: '#7BCF94',
  neutral: '#F8FAFC',
  surface: '#0B1120'
}

const buildCustomVariables = (concept: ProposalDesignConceptPreview) => ({
  'ds-primary': concept.palette.primary,
  'ds-secondary': concept.palette.secondary,
  'ds-accent': concept.palette.accent,
  'ds-neutral': concept.palette.neutral,
  'ds-surface': concept.palette.surface,
  'ds-surface-foreground': '#F8FAFC',
  'ds-font-heading': concept.typography.heading,
  'ds-font-body': concept.typography.body
})

const clampHex = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback
  const normalized = value.startsWith('#') ? value : `#${value}`
  if (/^#([0-9A-Fa-f]{6})$/.test(normalized)) {
    return normalized.toUpperCase()
  }
  if (/^#([0-9A-Fa-f]{3})$/.test(normalized)) {
    return (
      '#' +
      normalized
        .slice(1)
        .split('')
        .map((char) => char + char)
        .join('')
        .toUpperCase()
    )
  }
  return fallback
}

const hexToRgb = (hex: string) => {
  const canonical = clampHex(hex, '#000000')
  const match = canonical.match(/^#([0-9A-F]{6})$/i)
  if (!match) return null
  const value = match[1]
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  }
}

const channelToHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase()

const adjustHexBrightness = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const adjust = (channel: number) => Math.min(255, Math.max(0, channel + 255 * amount))
  const r = adjust(rgb.r)
  const g = adjust(rgb.g)
  const b = adjust(rgb.b)
  return `#${channelToHex(Math.round(r))}${channelToHex(Math.round(g))}${channelToHex(Math.round(b))}`
}

const getReadableTextColor = (hex: string) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#FFFFFF'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#0B1220' : '#FFFFFF'
}

const buildSampleTheme = (concept: ProposalDesignConceptPreview) => {
  const palette = {
    primary: clampHex(concept.palette.primary, FALLBACK_PALETTE.primary),
    secondary: clampHex(concept.palette.secondary, FALLBACK_PALETTE.secondary),
    accent: clampHex(concept.palette.accent, FALLBACK_PALETTE.accent),
    neutral: clampHex(concept.palette.neutral, FALLBACK_PALETTE.neutral),
    surface: clampHex(concept.palette.surface, FALLBACK_PALETTE.surface)
  }

  const heroBg = adjustHexBrightness(palette.primary, 0.05)
  const heroAccent = adjustHexBrightness(palette.primary, 0.25)
  const cardBg = adjustHexBrightness(palette.surface, 0.15)
  const navBg = adjustHexBrightness(palette.surface, -0.05)
  const footerBg = adjustHexBrightness(palette.surface, -0.15)

  return {
    ...palette,
    navBg,
    navText: getReadableTextColor(navBg),
    heroBg,
    heroAccent,
    heroText: getReadableTextColor(heroBg),
    heroTextMuted: adjustHexBrightness(getReadableTextColor(heroBg) === '#0B1220' ? '#000000' : '#FFFFFF', -0.25),
    cardBg,
    cardBorder: adjustHexBrightness(cardBg, 0.25),
    footerBg,
    footerText: getReadableTextColor(footerBg),
    badgeBg: adjustHexBrightness(palette.accent, 0.1),
    badgeText: getReadableTextColor(adjustHexBrightness(palette.accent, 0.1)),
    surfacePanel: adjustHexBrightness(palette.surface, 0.25),
    textSecondary: adjustHexBrightness(palette.neutral, -0.2)
  }
}

const ConceptSampleLayout = ({ theme, conceptName, headingFont, bodyFont }: { theme: ReturnType<typeof buildSampleTheme>; conceptName: string; headingFont: string; bodyFont: string }) => {
  const colorSwatches = [
    { label: 'Primary', color: theme.primary },
    { label: 'Secondary', color: theme.secondary },
    { label: 'Accent', color: theme.accent },
    { label: 'Background', color: theme.surface },
    { label: 'Text', color: theme.neutral }
  ]

  return (
    <div
      className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/3 text-white shadow-2xl"
      style={{ backgroundColor: theme.surface }}
    >
      {/* Website Navigation */}
      <nav
        className="flex items-center justify-between px-5 py-3 text-sm font-semibold"
        style={{ backgroundColor: theme.navBg, color: theme.navText }}
      >
        <span style={{ fontFamily: headingFont }}>{conceptName}</span>
        <div className="flex gap-4 text-xs">
          <span>Home</span>
          <span style={{ color: theme.accent }}>About</span>
          <span>Services</span>
          <span>Contact</span>
        </div>
      </nav>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5 text-[#0B1220]" style={{ color: theme.neutral }}>
        {/* Hero Section */}
        <div
          className="space-y-3 rounded-2xl border px-5 py-6"
          style={{
            backgroundImage: `linear-gradient(135deg, ${theme.heroBg}, ${theme.heroAccent})`,
            color: theme.heroText,
            borderColor: adjustHexBrightness(theme.heroBg, -0.25)
          }}
        >
          <span className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.heroTextMuted }}>
            Welcome to our website
          </span>
          <p className="text-2xl font-semibold" style={{ fontFamily: headingFont }}>{conceptName}</p>
          <p className="text-sm" style={{ color: theme.heroTextMuted, fontFamily: bodyFont }}>
            Delivering excellence through innovative solutions and dedicated service.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
              style={{ backgroundColor: theme.primary, color: getReadableTextColor(theme.primary) }}
            >
              Get Started
            </button>
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ color: theme.secondary, borderColor: theme.secondary }}
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Color Palette Swatches */}
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
        >
          <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: theme.textSecondary }}>
            Color Palette
          </p>
          <div className="flex gap-3 flex-wrap">
            {colorSwatches.map((swatch) => (
              <div key={swatch.label} className="flex flex-col items-center gap-1">
                <div
                  className="h-8 w-8 rounded-lg border border-white/20 shadow-sm"
                  style={{ backgroundColor: swatch.color }}
                />
                <span className="text-[9px] uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                  {swatch.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Typography Samples */}
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="space-y-2 rounded-2xl border p-4"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: getReadableTextColor(theme.cardBg) }}
          >
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: theme.textSecondary }}>
              Heading Font
            </p>
            <p className="text-lg font-semibold" style={{ fontFamily: headingFont }}>
              {headingFont.split(',')[0]}
            </p>
            <p className="text-xl font-bold" style={{ fontFamily: headingFont }}>
              Aa Bb Cc 123
            </p>
          </div>
          <div
            className="space-y-2 rounded-2xl border p-4"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: getReadableTextColor(theme.cardBg) }}
          >
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: theme.textSecondary }}>
              Body Font
            </p>
            <p className="text-lg font-semibold" style={{ fontFamily: bodyFont }}>
              {bodyFont.split(',')[0]}
            </p>
            <p className="text-sm" style={{ fontFamily: bodyFont }}>
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>
      </div>

      {/* Website Footer */}
      <footer
        className="flex items-center justify-between px-5 py-3 text-xs"
        style={{ backgroundColor: theme.footerBg, color: theme.footerText }}
      >
        <span>{conceptName}</span>
        <div className="flex gap-3">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </div>
      </footer>
    </div>
  )
}

const descriptorCards = (concept: ProposalDesignConceptPreview) => [
  {
    key: 'palette',
    label: 'Palette',
    content: (
      <div className="flex items-center gap-2">
        {[concept.palette.primary, concept.palette.accent, concept.palette.surface].map((color) => (
          <span
            key={`${concept.id}-${color}`}
            className="h-3 w-10 rounded-full border border-white/20"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    )
  },
  {
    key: 'typography',
    label: 'Typography',
    content: (
      <div>
        <p
          className="text-base font-semibold leading-tight"
          style={{ fontFamily: concept.typography.heading }}
        >
          {concept.typography.heading.split(',')[0] ?? concept.typography.heading}
        </p>
        <p className="text-xs text-white/60 mt-1">{concept.typography.body.split(',')[0]}</p>
      </div>
    )
  },
  {
    key: 'usage',
    label: 'Use cases',
    content: (
      <p className="text-sm text-white/70">
        {concept.positioningNote ?? 'Optimized for hero, campaign, and launch sequences.'}
      </p>
    )
  }
]

export const DesignConceptPreview = forwardRef<HTMLDivElement, DesignConceptPreviewProps>(
  ({ concept, mode = 'full', showSampleCard = false }, ref) => {
    const preset = MODE_DIMENSIONS[mode]
    const customVariables = buildCustomVariables(concept)
    const sections = preset.sectionCount ? descriptorCards(concept).slice(0, preset.sectionCount) : []
    const theme = useMemo(() => buildSampleTheme(concept), [concept])

    return (
      <DesignSystemCanvasInjector
        websiteId={concept.id}
        customVariables={customVariables}
        enablePrintStyles={false}
      >
        <div
          ref={ref}
          className={cn(
            'rounded-[32px] overflow-hidden border border-white/10 shadow-[0_45px_110px_rgba(1,4,14,0.7)] bg-[#050915] flex flex-col text-white',
            mode === 'full' ? 'text-base' : mode === 'compact' ? 'text-sm' : 'text-xs'
          )}
          style={{
            width: `${preset.width}px`,
            height: `${preset.height}px`,
            fontFamily: customVariables['ds-font-body']
          }}
        >
          <div className={cn('relative flex-1', mode === 'embed' ? 'px-4 py-4' : 'px-9 py-7')}>
            {showSampleCard ? (
              <ConceptSampleLayout
                theme={theme}
                conceptName={concept.name}
                headingFont={concept.typography.heading}
                bodyFont={concept.typography.body}
              />
            ) : (
              <div
                className="h-full w-full rounded-[28px] border border-white/10 p-5"
                style={{
                  background: `radial-gradient(circle at 20% -10%, ${customVariables['ds-accent']}80, transparent 55%), linear-gradient(135deg, ${customVariables['ds-primary']} 0%, ${customVariables['ds-secondary']} 100%)`
                }}
              >
                <p className="uppercase text-[11px] tracking-[0.35em] text-white/70 mb-3">Catalyst Concept</p>
                <h3
                  className={cn(
                    mode === 'full' ? 'text-4xl' : mode === 'compact' ? 'text-3xl' : 'text-2xl',
                    'font-semibold drop-shadow-xl'
                  )}
                  style={{ fontFamily: customVariables['ds-font-heading'] }}
                >
                  {concept.name}
                </h3>
                {preset.showNarrative ? (
                  <p className="text-white/90 max-w-xl leading-relaxed mt-4">
                    {concept.positioningNote ??
                      `Signature hero direction blending ${concept.typography.heading.split(',')[0]} type with ${concept.palette.primary} accents.`}
                  </p>
                ) : (
                  <p className="text-white/85 max-w-sm mt-3 text-sm">
                    Palette tuned for slide embeds and compact previews.
                  </p>
                )}
                <div className="absolute bottom-5 right-6 text-[10px] uppercase tracking-[0.35em] text-white/70">
                  Seed {concept.generatorSeed?.slice(0, 8) ?? 'N/A'}
                </div>
              </div>
            )}
          </div>

          {preset.sectionCount > 0 && (
            <div className={cn('bg-[#0B0F1F] px-7 py-5 grid gap-4', preset.gridCols)}>
              {sections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">{section.label}</p>
                  <div className="mt-3">{section.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DesignSystemCanvasInjector>
    )
  }
)

DesignConceptPreview.displayName = 'DesignConceptPreview'
