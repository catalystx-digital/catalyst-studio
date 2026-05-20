import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { MediaRepository } from '@/lib/studio/media/media-repository'
import { UniversalMediaService } from '@/lib/studio/media/universal-media-service'
import { mapToMediaLibraryItem, type MediaLibraryItem } from '@/lib/studio/media/types'

const querySchema = z.object({
  websiteId: z.string().min(1),
  search: z.string().optional(),
  contentType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const parseResult = querySchema.safeParse({
      websiteId: url.searchParams.get('websiteId'),
      search: url.searchParams.get('search') ?? undefined,
      contentType: url.searchParams.get('contentType') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined
    })

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { websiteId, search, contentType, limit, cursor } = parseResult.data

    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await assertWebsiteOwnership(prisma, auth.accountId, websiteId)

    const repository = new MediaRepository(prisma)
    const mediaService = new UniversalMediaService()

    const { items, nextCursor } = await repository.listMediaForWebsite(websiteId, {
      search,
      contentType,
      limit,
      cursor
    })

    if (items.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null })
    }

    const assets = await mediaService.getAssetsForWebsiteByIds(
      websiteId,
      new Set(items.map(item => item.id))
    )

    const responseItems: MediaLibraryItem[] = items.map(item => mapToMediaLibraryItem(item, assets.get(item.id)))

    return NextResponse.json({
      items: responseItems,
      nextCursor: nextCursor ?? null
    })
  } catch (error) {
    console.error('Failed to load media assets', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
