import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request)
    const requestedJobId = request.nextUrl.searchParams.get('jobId')
    const websiteId = request.nextUrl.searchParams.get('websiteId')
    const activity = new ImportActivityReadService()
    const data = await activity.listForAccount(accountId, { requestedJobId, websiteId, limit: 25, includePageStages: true })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to load studio import activity', error)
    return NextResponse.json(
      { error: { message: 'Failed to load import activity' } },
      { status: 500 },
    )
  }
}
