import { ApiError } from '@/lib/api/errors'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import {
  QaPreviewTokenError,
  verifyQaPreviewToken,
} from '@/lib/studio/preview/qa-preview-token'

export type PreviewReadAccessMode = 'session' | 'qa-token'

export interface PreviewReadAccessOptions {
  previewToken?: string | null
  path?: string | null
}

export async function authorizePreviewRead(
  request: Request | undefined,
  websiteId: string,
  options: PreviewReadAccessOptions = {}
): Promise<{ mode: PreviewReadAccessMode }> {
  const previewToken = options.previewToken?.trim()

  if (previewToken) {
    try {
      verifyQaPreviewToken(previewToken, {
        websiteId,
        path: options.path,
      })
    } catch (error) {
      if (error instanceof QaPreviewTokenError) {
        const statusCode = error.code === 'TOKEN_SCOPE_MISMATCH' ? 403 : 401
        const code = statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED'
        throw new ApiError(statusCode, error.message, code)
      }

      throw error
    }

    return { mode: 'qa-token' }
  }

  const authRequest = request ?? new Request('http://studio.local', {
    headers: await headers(),
  })
  const auth = await getAuthContext(authRequest)
  await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

  if (!auth.userId) {
    return { mode: 'session' }
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
    return { mode: 'session' }
  }

  if (
    membership.websiteAccess === 'specific' &&
    !membership.websiteIds.includes(websiteId)
  ) {
    throw new ApiError(403, 'Forbidden: Website access denied', 'FORBIDDEN')
  }

  return { mode: 'session' }
}

export async function assertStudioWebsiteAccess(
  request: Request | undefined,
  websiteId: string,
  options: PreviewReadAccessOptions = {}
): Promise<void> {
  await authorizePreviewRead(request, websiteId, options)
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
