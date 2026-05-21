import { ApiError } from '@/lib/api/errors'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function assertStudioWebsiteAccess(
  request: Request | undefined,
  websiteId: string
): Promise<void> {
  const authRequest = request ?? new Request('http://studio.local', {
    headers: await headers(),
  })
  const auth = await getAuthContext(authRequest)
  await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

  if (!auth.userId) {
    return
  }

  const membership = await (prisma as any).accountMembership.findUnique({
    where: {
      accountId_userId: {
        accountId: auth.accountId,
        userId: auth.userId,
      },
    },
    select: {
      role: true,
      websiteAccess: true,
      websiteIds: true,
    },
  })

  if (!membership) {
    throw new ApiError(401, 'Sign in required', 'UNAUTHORIZED')
  }

  if (membership.role === 'admin' || membership.role === 'owner') {
    return
  }

  if (
    membership.websiteAccess === 'specific' &&
    !membership.websiteIds.includes(websiteId)
  ) {
    throw new ApiError(403, 'Forbidden: Website access denied', 'FORBIDDEN')
  }
}

export function previewAccessErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { message: error.message, code: error.code } },
      { status: error.statusCode }
    )
  }

  console.error('[PreviewAccess] Unexpected access error:', error)
  return Response.json(
    { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
    { status: 500 }
  )
}
