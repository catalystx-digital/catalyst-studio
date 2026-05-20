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
