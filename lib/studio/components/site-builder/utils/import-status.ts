import { ImportTrackerStatus } from '@/lib/studio/stores/import-tracker-store'

const DEFAULT_STATUS: ImportTrackerStatus = 'unknown'
const STATUS_MAP: Record<string, ImportTrackerStatus> = {
  pending: 'pending',
  processing: 'processing',
  running: 'running',
  success: 'success',
  partial_success: 'partial_success',
  completed: 'completed',
  completed_with_warnings: 'completed_with_warnings',
  failed: 'failed',
  cancelled: 'cancelled',
  queued: 'queued',
  recoverable_stuck: 'recoverable_stuck',
  unknown: 'unknown',
}

/**
 * Normalises raw import status strings (case-insensitive) into tracker-friendly enums.
 */
export function normalizeImportTrackerStatus(status: string | null | undefined): ImportTrackerStatus {
  if (!status) {
    return DEFAULT_STATUS
  }

  const normalized = status.trim().toLowerCase()
  return STATUS_MAP[normalized] ?? DEFAULT_STATUS
}
