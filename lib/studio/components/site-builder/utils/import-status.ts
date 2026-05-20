import { ImportTrackerStatus } from '@/lib/studio/stores/import-tracker-store'

const DEFAULT_STATUS: ImportTrackerStatus = 'pending'
const STATUS_MAP: Record<string, ImportTrackerStatus> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  queued: 'queued',
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
