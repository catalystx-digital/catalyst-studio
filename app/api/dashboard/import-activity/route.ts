import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request)
    const activity = new ImportActivityReadService()
    const data = await activity.listForAccount(accountId, { limit: 12 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to load dashboard import activity', error)
    return NextResponse.json(
      { error: { message: 'Failed to load dashboard import activity' } },
      { status: 500 },
    )
  }
}
