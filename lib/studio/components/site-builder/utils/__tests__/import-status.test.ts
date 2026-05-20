import { normalizeImportTrackerStatus } from '../import-status'

describe('normalizeImportTrackerStatus', () => {
  it.each([
    ['completed', 'completed'],
    ['COMPLETED', 'completed'],
    ['Completed', 'completed'],
    ['failed', 'failed'],
    ['FAILED', 'failed'],
    ['cancelled', 'cancelled'],
    ['CANCELLED', 'cancelled'],
    ['processing', 'processing'],
    ['PROCESSING', 'processing'],
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

  it('defaults to pending for unknown or empty values', () => {
    expect(normalizeImportTrackerStatus('unknown-status')).toBe('pending')
    expect(normalizeImportTrackerStatus('')).toBe('pending')
    expect(normalizeImportTrackerStatus(null)).toBe('pending')
    expect(normalizeImportTrackerStatus(undefined)).toBe('pending')
  })
})
