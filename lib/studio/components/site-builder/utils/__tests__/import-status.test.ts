import { normalizeImportTrackerStatus } from '../import-status'

describe('normalizeImportTrackerStatus', () => {
  it.each([
    ['completed', 'completed'],
    ['COMPLETED', 'completed'],
    ['completed_with_warnings', 'completed_with_warnings'],
    ['COMPLETED_WITH_WARNINGS', 'completed_with_warnings'],
    ['Completed', 'completed'],
    ['failed', 'failed'],
    ['FAILED', 'failed'],
    ['cancelled', 'cancelled'],
    ['CANCELLED', 'cancelled'],
    ['processing', 'processing'],
    ['PROCESSING', 'processing'],
    ['running', 'running'],
    ['success', 'success'],
    ['partial_success', 'partial_success'],
    ['recoverable_stuck', 'recoverable_stuck'],
    ['pending', 'pending'],
    ['QUEUED', 'queued'],
    ['queued', 'queued'],
    ['PENDING', 'pending'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(normalizeImportTrackerStatus(raw)).toBe(expected)
  })

  it('trims whitespace before normalizing', () => {
    expect(normalizeImportTrackerStatus('  completed  ')).toBe('completed')
  })

  it('surfaces unknown for unknown or empty values', () => {
    expect(normalizeImportTrackerStatus('unknown-status')).toBe('unknown')
    expect(normalizeImportTrackerStatus('')).toBe('unknown')
    expect(normalizeImportTrackerStatus(null)).toBe('unknown')
    expect(normalizeImportTrackerStatus(undefined)).toBe('unknown')
  })
})
