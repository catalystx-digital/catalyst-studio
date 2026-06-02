import {
  IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD,
  isImportComponentAutoApproved,
} from '../import-result-handler'

describe('ImportResultHandler approval threshold', () => {
  it('keeps source-backed components at the exact auto-approval confidence boundary', () => {
    expect(IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD).toBe(0.7)
    expect(isImportComponentAutoApproved({ confidence: 0.7 })).toBe(true)
  })

  it('drops components below the auto-approval confidence boundary', () => {
    expect(isImportComponentAutoApproved({ confidence: 0.699 })).toBe(false)
  })

  it('keeps components without explicit confidence for existing import compatibility', () => {
    expect(isImportComponentAutoApproved({})).toBe(true)
  })
})
