import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

const querySchema = z.object({
  websiteId: z.string().min(1),
  type: z.enum(['image', 'video']).optional(),
  search: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const parseResult = querySchema.safeParse({
      websiteId: url.searchParams.get('websiteId'),
      type: url.searchParams.get('type') ?? undefined,
      search: url.searchParams.get('search') ?? undefined
    })

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { websiteId, type, search } = parseResult.data

    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await assertWebsiteOwnership(prisma, auth.accountId, websiteId)

    // Build content type filter based on type parameter
    const contentTypeFilter = type === 'image'
      ? { startsWith: 'image/' }
      : type === 'video'
      ? { startsWith: 'video/' }
      : undefined

    const media = await prisma.websiteMedia.findMany({
      where: {
        websiteId,
        ...(contentTypeFilter && { contentType: contentTypeFilter }),
        ...(search && {
          OR: [
            { storageKey: { contains: search, mode: 'insensitive' } },
            { metadata: { path: ['filename'], string_contains: search } }
          ]
        })
      },
      select: {
        id: true,
        contentType: true,
        storageKey: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    const items = media.map(m => {
      const metadata = m.metadata as any
      return {
        id: m.id,
        ref: m.id,  // Single ID pattern per PRD
        type: m.contentType.startsWith('image/') ? 'image' : m.contentType.startsWith('video/') ? 'video' : 'media',
        title: metadata?.filename || m.storageKey.split('/').pop() || 'Untitled',
        thumbnail: m.storageKey,  // Storage layer handles URL
        contentType: m.contentType
      }
    })

    return NextResponse.json({ media: items })
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}
