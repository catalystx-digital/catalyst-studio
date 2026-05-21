export type NormalizationIssueCode =
  | 'missing-required-field'
  | 'unknown-field'
  | 'unsupported-subcomponent'
  | 'normalizer-missing'
  | 'invalid-subcomponent'
  | 'media-src-missing'
  | 'invalid-value'
  | 'suspicious-value'
  | 'invalid_structure'

export interface NormalizationWarning {
  pageUrl?: string
  parentType: string
  field?: string
  childType?: string
  issue: NormalizationIssueCode
  message: string
  details?: Record<string, unknown>
}

export type NormalizationSeverity = 'fatal' | 'warning'

const FATAL_NORMALIZATION_ISSUES = new Set<NormalizationIssueCode>([
  'media-src-missing',
  'missing-required-field',
  'invalid-subcomponent',
  'unsupported-subcomponent',
  'normalizer-missing',
  'invalid-value',
  'unknown-field'
])

const warningBuffer: NormalizationWarning[] = []

export function recordNormalizationWarning(warning: NormalizationWarning): void {
  warningBuffer.push(warning)
}

export function consumeNormalizationWarnings(): NormalizationWarning[] {
  if (warningBuffer.length === 0) {
    return []
  }
  const copy = [...warningBuffer]
  warningBuffer.length = 0
  return copy
}

export function isFatalNormalizationIssue(issue: NormalizationIssueCode): boolean {
  return FATAL_NORMALIZATION_ISSUES.has(issue)
}

export function getNormalizationWarningSeverity(warning: Pick<NormalizationWarning, 'issue'>): NormalizationSeverity {
  return isFatalNormalizationIssue(warning.issue) ? 'fatal' : 'warning'
}

export function isFatalNormalizationWarning(warning: Pick<NormalizationWarning, 'issue'>): boolean {
  return getNormalizationWarningSeverity(warning) === 'fatal'
}
