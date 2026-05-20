import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const { accountId } = await getAuthContext(request)
    const activity = new ImportActivityReadService()
    const progress = await activity.getProgressSnapshot(accountId, jobId)

    if (!progress) {
      return NextResponse.json({ error: 'Import job not found' }, { status: 404 })
    }

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error fetching job progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job progress' },
      { status: 500 },
    )
  }
}
