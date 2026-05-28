import type { ImportDetectionResult } from '../../detection/types'
import type { ImportDesignProfile, PresentationSkeletonSelection } from '../../types/design-profile.types'
import { normalizePath, isHomePath } from '../../utils/path-utils'

function isHomepageCandidate(pageUrl: string, _detection: ImportDetectionResult): boolean {
  const path = normalizePath(pageUrl)
  return (
    isHomePath(path) ||
    path === '/home' ||
    path === '/index'
  )
}

function countComponents(detection: ImportDetectionResult, types: string[]): number {
  const wanted = new Set(types)
  return (detection.components ?? []).filter(component => wanted.has(String(component.type))).length
}

function buildContentCorpus(detection: ImportDetectionResult): string {
  const pieces: string[] = [
    detection.pageMetadata?.pageType,
    detection.pageMetadata?.primaryPurpose,
    detection.pageMetadata?.targetAudience,
    detection.pageMetadata?.visualStyle,
    detection.pageMetadata?.title,
    detection.pageMetadata?.description,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const component of detection.components ?? []) {
    try {
      pieces.push(JSON.stringify(component.content))
    } catch {
      // Ignore non-serializable content; detection content should normally be JSON-safe.
    }
  }

  return pieces.join(' ').toLowerCase()
}

export function selectPresentationSkeleton(input: {
  pageUrl: string
  detection: ImportDetectionResult
  designProfile?: ImportDesignProfile | null
}): PresentationSkeletonSelection {
  if (!isHomepageCandidate(input.pageUrl, input.detection)) {
    const path = normalizePath(input.pageUrl)
    return {
      key: 'unknown',
      confidence: 0,
      reason: `No homepage presentation skeleton selected for non-home path ${path}.`,
      diagnostics: [],
    }
  }

  const hasHero = countComponents(input.detection, ['hero-with-image', 'hero-simple', 'hero-banner', 'hero-split', 'hero-carousel']) > 0
  const hasLogoCloud = countComponents(input.detection, ['logo-cloud']) > 0
  const cardGridCount = countComponents(input.detection, ['card-grid', 'feature-grid', 'feature-list'])
  const pageType = input.detection.pageMetadata?.pageType
  const corpus = buildContentCorpus(input.detection)
  const hasAgencySignals =
    /agency|studio|digital strategy|ux design|web development|product design|portfolio|case stud|client services/.test(corpus)
  const hasInstitutionalSignals =
    /hospital|education|school|university|government|public sector|council|community health|patient|student/.test(corpus)

  if (hasAgencySignals || (hasLogoCloud && cardGridCount > 0)) {
    return {
      key: 'agency-home',
      confidence: hasHero ? 0.82 : 0.64,
      reason: 'Homepage has agency/brand signals or social-proof layout evidence.',
      diagnostics: [],
    }
  }

  if (hasInstitutionalSignals) {
    return {
      key: 'institutional-home',
      confidence: hasHero ? 0.78 : 0.6,
      reason: 'Homepage has institutional/content-rich signals.',
      diagnostics: [],
    }
  }

  if (cardGridCount > 0) {
    return {
      key: 'service-business-home',
      confidence: hasHero ? 0.74 : 0.58,
      reason: 'Homepage has service/card-grid section evidence.',
      diagnostics: [],
    }
  }

  return {
    key: 'unknown',
    confidence: 0.35,
    reason: 'Homepage evidence was insufficient for a curated presentation skeleton.',
    diagnostics: [{
      code: 'DESIGN_PROFILE_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Presentation skeleton selection was low confidence; design-fit will avoid structural changes.',
    }],
  }
}
