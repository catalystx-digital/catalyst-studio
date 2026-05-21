import {
  normalizePageStageStatus,
  normalizeRunStatus,
} from '@/lib/studio/import/services/import-run-service'

describe('import run lifecycle normalization', () => {
  it('preserves durable page lifecycle states', () => {
    expect(normalizePageStageStatus('detected')).toBe('detected')
    expect(normalizePageStageStatus('normalized')).toBe('normalized')
    expect(normalizePageStageStatus('staged')).toBe('staged')
    expect(normalizePageStageStatus('committed')).toBe('committed')
  })

  it('preserves completed-with-warnings run status', () => {
    expect(normalizeRunStatus('completed_with_warnings')).toBe('completed_with_warnings')
    expect(normalizeRunStatus('partial_success')).toBe('completed_with_warnings')
  })

  it('keeps legacy aliases compatible', () => {
    expect(normalizePageStageStatus('pending')).toBe('discovered')
    expect(normalizePageStageStatus('redirect')).toBe('redirect_created')
    expect(normalizeRunStatus('running')).toBe('importing')
  })
})
