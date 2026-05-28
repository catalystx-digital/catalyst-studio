import type { DesignSystemProcessingResult } from './design-system-service'
import type { ImportDetectionResult } from '../detection/types'
import type {
  DesignProfileConfidence,
  DesignProfileDiagnostic,
  DesignProfileEvidence,
  ImportDesignProfile,
} from '../types/design-profile.types'

function confidenceBucket(value: number | undefined): DesignProfileConfidence {
  if (value === undefined) return 'missing'
  if (value >= 0.75) return 'high'
  if (value >= 0.45) return 'medium'
  if (value > 0) return 'low'
  return 'missing'
}

function swatchEvidence(
  source: string,
  swatch?: { hex?: string; occurrences?: number; sampleSelectors?: string[] } | null
): DesignProfileEvidence | undefined {
  if (!swatch?.hex) return undefined
  const occurrences = swatch.occurrences ?? 0
  return {
    source,
    value: swatch.hex,
    confidence: occurrences >= 8 ? 'high' : occurrences >= 3 ? 'medium' : 'low',
    selector: swatch.sampleSelectors?.[0],
  }
}

function typographyEvidence(
  source: string,
  sample?: { fontFamily?: string; fontStack?: string; usageCount?: number; selector?: string } | null
): DesignProfileEvidence | undefined {
  const value = sample?.fontStack || sample?.fontFamily
  if (!value) return undefined
  const usageCount = sample.usageCount ?? 0
  return {
    source,
    value,
    confidence: usageCount >= 6 ? 'high' : usageCount >= 2 ? 'medium' : 'low',
    selector: sample.selector,
  }
}

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function getLogoEvidence(detections: ImportDetectionResult[]): DesignProfileEvidence | undefined {
  for (const detection of detections) {
    const metadataLogo = firstString(detection.pageMetadata?.logo)
    if (metadataLogo) {
      return { source: 'pageMetadata.logo', value: metadataLogo, confidence: 'medium' }
    }
    for (const component of detection.components ?? []) {
      const logo = component.content?.logo
      if (!logo || typeof logo !== 'object') continue
      const src = (logo as Record<string, unknown>).src
      if (typeof src === 'string') {
        return { source: `${component.type}.logo.src`, value: src, confidence: 'high' }
      }
      if (src && typeof src === 'object') {
        const url = firstString((src as Record<string, unknown>).url)
        if (url) {
          return { source: `${component.type}.logo.src.url`, value: url, confidence: 'high' }
        }
      }
    }
  }
  return undefined
}

function countImageEvidence(detections: ImportDetectionResult[]): DesignProfileEvidence[] {
  const evidence: DesignProfileEvidence[] = []
  const visit = (value: unknown, source: string): void => {
    if (!value || evidence.length >= 20) return
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value) || /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(value)) {
        evidence.push({ source, value, confidence: 'medium' })
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${source}[${index}]`))
      return
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      const url = firstString(record.url)
      if (url) {
        evidence.push({ source: `${source}.url`, value: url, confidence: 'high' })
      }
      for (const key of ['image', 'images', 'backgroundImage', 'src', 'logo', 'logos', 'cards', 'items']) {
        if (key in record) {
          visit(record[key], `${source}.${key}`)
        }
      }
    }
  }

  for (const detection of detections) {
    for (const component of detection.components ?? []) {
      visit(component.content, component.type)
    }
  }
  return evidence
}

function spacingDensity(baseUnitPx?: number | null): ImportDesignProfile['spacing']['density'] {
  if (typeof baseUnitPx !== 'number') return 'unknown'
  if (baseUnitPx <= 6) return 'compact'
  if (baseUnitPx <= 12) return 'comfortable'
  return 'spacious'
}

export function buildImportDesignProfile(input: {
  sourceUrl: string
  designSystemResult?: DesignSystemProcessingResult | null
  detections: ImportDetectionResult[]
}): ImportDesignProfile {
  const capture = input.designSystemResult?.probe?.capture
  const diagnostics: DesignProfileDiagnostic[] = []
  const confidence = input.designSystemResult?.metrics.confidence ?? 0

  if (!capture) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_MISSING_PROBE',
      severity: 'warning',
      message: 'Design profile could not use DOM probe evidence.',
    })
  }
  if (confidence > 0 && confidence < 0.35) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_LOW_CONFIDENCE',
      severity: 'warning',
      message: `Design profile confidence is low (${confidence.toFixed(2)}).`,
    })
  }

  const palette = capture?.palette
  const primary = swatchEvidence('domProbe.palette.primary', palette?.primary ?? palette?.colors.find(c => c.role === 'primary'))
  const secondary = swatchEvidence('domProbe.palette.secondary', palette?.secondary ?? palette?.colors.find(c => c.role === 'secondary'))
  const background = swatchEvidence('domProbe.palette.background', palette?.surface?.[0] ?? palette?.colors.find(c => c.role === 'background'))
  const foreground = swatchEvidence('domProbe.palette.text', palette?.colors.find(c => c.role === 'text'))

  if (!primary) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_MISSING_PRIMARY',
      severity: 'warning',
      message: 'No source-backed primary brand color was detected.',
    })
  }

  const headingSample = capture?.typography
    ?.filter(sample => sample.role === 'heading')
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))[0]
  const bodySample = capture?.typography
    ?.filter(sample => sample.role === 'body')
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))[0]

  const logo = getLogoEvidence(input.detections)
  if (!logo) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_MISSING_LOGO',
      severity: 'info',
      message: 'No source-backed logo evidence was detected.',
    })
  }

  const imageryEvidence = countImageEvidence(input.detections)
  if (imageryEvidence.length === 0) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_MISSING_IMAGERY',
      severity: 'info',
      message: 'No source-backed imagery evidence was detected in component content.',
    })
  }

  return {
    sourceUrl: input.sourceUrl,
    capturedAt: new Date().toISOString(),
    confidence,
    palette: {
      primary,
      secondary,
      background,
      foreground,
    },
    typography: {
      heading: typographyEvidence('domProbe.typography.heading', headingSample),
      body: typographyEvidence('domProbe.typography.body', bodySample),
    },
    spacing: {
      baseUnitPx: capture?.spacing?.baseUnitPx,
      density: spacingDensity(capture?.spacing?.baseUnitPx),
    },
    brandAssets: {
      logo,
      favicon: undefined,
    },
    imagery: {
      detectedCount: imageryEvidence.length,
      evidence: imageryEvidence.slice(0, 8),
    },
    diagnostics,
  }
}

export function getDesignProfileConfidence(profile: ImportDesignProfile): DesignProfileConfidence {
  return confidenceBucket(profile.confidence)
}
