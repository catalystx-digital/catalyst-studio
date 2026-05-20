import { prisma } from '@/lib/prisma'
import type { MediaIngestWarningEntry } from './media-resolution'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export async function loadLatestMediaIngestWarnings(websiteId: string): Promise<MediaIngestWarningEntry[]> {
  if (!websiteId) {
    return []
  }

  const job = await prisma.importJob.findFirst({
    where: { websiteId },
    orderBy: { createdAt: 'desc' },
    select: { detectionResults: true }
  })

  if (!job || !job.detectionResults || !isRecord(job.detectionResults)) {
    return []
  }

  const rawWarnings = job.detectionResults['mediaWarnings']
  if (!Array.isArray(rawWarnings)) {
    return []
  }

  const normalized: MediaIngestWarningEntry[] = []
  for (const entry of rawWarnings) {
    if (!isRecord(entry)) {
      continue
    }
    const url = typeof entry.url === 'string' ? entry.url : ''
    const reason = typeof entry.reason === 'string' ? entry.reason : ''
    if (!url && !reason) {
      continue
    }
    normalized.push({
      url,
      reason: reason || 'unknown',
      normalizedUrl: typeof entry.normalizedUrl === 'string' ? entry.normalizedUrl : undefined,
      pageUrl: typeof entry.pageUrl === 'string' ? entry.pageUrl : undefined,
      componentType: typeof entry.componentType === 'string' ? entry.componentType : undefined,
      fieldPath: typeof entry.fieldPath === 'string' ? entry.fieldPath : undefined
    })
  }

  return normalized
}
