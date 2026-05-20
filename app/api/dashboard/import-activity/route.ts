import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/prisma';

const ACTIVE_STATUSES = ['pending', 'processing', 'queued'] as const;

type ProgressStage =
  | 'initializing'
  | 'fetching'
  | 'analyzing'
  | 'generating'
  | 'creating'
  | 'queued'
  | 'cancelled'
  | 'failed'
  | 'completed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function mapStage(status: string, progress: number): ProgressStage {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'queued') return 'queued';
  if (progress <= 0) return 'initializing';
  if (progress <= 30) return 'fetching';
  if (progress <= 60) return 'analyzing';
  if (progress <= 90) return 'generating';
  return 'creating';
}


function deriveState(status: string): 'active' | 'queued' | 'completed' {
  if (status === 'queued') return 'queued';
  if (status === 'completed' || status === 'failed' || status === 'cancelled') return 'completed';
  return 'active';
}
export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request);

    // Use raw query to extract just the progress value from detectionResults JSON
    // This avoids fetching the entire large JSON blob that can exceed 5MB limit
    // PostgreSQL JSON operators: ->> extracts value as text, ::int casts to integer
    const jobs = await prisma.$queryRaw<
      Array<{
        id: string;
        websiteId: string;
        url: string;
        status: string;
        progress: number | null;
        errorMessage: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        website_id: string | null;
        website_name: string | null;
        website_icon: unknown;
        website_updatedAt: Date | null;
        website_createdAt: Date | null;
      }>
    >`
      SELECT
        ij.id,
        ij."websiteId",
        ij.url,
        ij.status,
        (ij."detectionResults"->>'progress')::int as progress,
        ij."errorMessage",
        ij."startedAt",
        ij."completedAt",
        ij."createdAt",
        ij."updatedAt",
        w.id as website_id,
        w.name as website_name,
        w.icon as website_icon,
        w."updatedAt" as "website_updatedAt",
        w."createdAt" as "website_createdAt"
      FROM "ImportJob" ij
      LEFT JOIN "Website" w ON ij."websiteId" = w.id
      WHERE w."accountId" = ${accountId}::uuid
        AND ij.status IN ('pending', 'processing', 'queued')
      ORDER BY ij."updatedAt" DESC, ij."createdAt" DESC
      LIMIT 12
    `;

    const activity = jobs.map((job) => {
      // Use actual progress from database query (extracted from detectionResults JSON)
      // Fall back to status-based progress only if database progress is null
      const statusProgressFallback: Record<string, number> = {
        pending: 0,
        queued: 5,
        processing: 10, // Minimal fallback - actual progress should come from DB
        completed: 100,
        failed: 0,
        cancelled: 0,
      };
      const progress = job.progress ?? statusProgressFallback[job.status] ?? 0;
      const stage = mapStage(job.status, progress);

      // Raw query returns flat structure, serialize icon if present
      const serializedIcon = job.website_icon !== undefined ? JSON.parse(JSON.stringify(job.website_icon)) : null;

      return {
        id: job.id,
        websiteId: job.websiteId,
        status: job.status,
        progress,
        stage,
        message: null, // Not needed for dashboard list
        state: deriveState(job.status),
        url: job.url,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt ? job.startedAt.toISOString() : null,
        updatedAt: job.updatedAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : null,
        queuePosition: null, // Not needed for dashboard list
        estimatedStartSeconds: null, // Not needed for dashboard list
        website: job.website_id
          ? {
              id: job.website_id,
              name: job.website_name,
              icon: serializedIcon,
              metadata: null, // Excluded to avoid 5MB limit
              updatedAt: job.website_updatedAt ? job.website_updatedAt.toISOString() : null,
              createdAt: job.website_createdAt ? job.website_createdAt.toISOString() : null,
            }
          : null,
      };
    });

    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error('Failed to load dashboard import activity', error);
    return NextResponse.json(
      { error: { message: 'Failed to load dashboard import activity' } },
      { status: 500 },
    );
  }
}
