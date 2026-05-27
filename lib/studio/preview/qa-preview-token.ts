import { createHmac, timingSafeEqual } from 'crypto'
import {
  normalizePreviewPath as normalizePreviewPathValue,
} from '@/lib/studio/preview/preview-path'

const QA_PREVIEW_PURPOSE = 'qa-preview'
const MAX_TTL_SECONDS = 60 * 60

export type QaPreviewTokenErrorCode =
  | 'SECRET_MISSING'
  | 'MALFORMED_TOKEN'
  | 'INVALID_SIGNATURE'
  | 'INVALID_PAYLOAD'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_SCOPE_MISMATCH'

export class QaPreviewTokenError extends Error {
  constructor(
    public readonly code: QaPreviewTokenErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'QaPreviewTokenError'
  }
}

export interface QaPreviewTokenPayload {
  purpose: typeof QA_PREVIEW_PURPOSE
  websiteId: string
  path: string
  issuedAt: number
  expiresAt: number
}

interface CreateQaPreviewTokenInput {
  websiteId: string
  path?: string | null
  ttlSeconds?: number
  expiresAt?: number
  now?: number
}

interface VerifyQaPreviewTokenInput {
  websiteId: string
  path?: string | null
  now?: number
}

function requireSecret(secret = process.env.QA_PREVIEW_TOKEN_SECRET): string {
  if (!secret?.trim()) {
    throw new QaPreviewTokenError('SECRET_MISSING', 'QA preview token secret is not configured')
  }

  return secret
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function parsePayload(encodedPayload: string): QaPreviewTokenPayload {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (
      !payload ||
      payload.purpose !== QA_PREVIEW_PURPOSE ||
      typeof payload.websiteId !== 'string' ||
      typeof payload.path !== 'string' ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      throw new Error('Invalid payload shape')
    }

    return payload
  } catch {
    throw new QaPreviewTokenError('INVALID_PAYLOAD', 'QA preview token payload is invalid')
  }
}

export const normalizePreviewPath = normalizePreviewPathValue

export function createQaPreviewToken(
  input: CreateQaPreviewTokenInput,
  secretInput?: string
): string {
  const secret = requireSecret(secretInput)
  const now = input.now ?? Date.now()
  const ttlSeconds = input.ttlSeconds ?? MAX_TTL_SECONDS / 4
  const expiresAt = input.expiresAt ?? now + ttlSeconds * 1000

  if (!input.websiteId.trim()) {
    throw new QaPreviewTokenError('INVALID_PAYLOAD', 'websiteId is required')
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new QaPreviewTokenError('INVALID_PAYLOAD', 'QA preview token expiry must be in the future')
  }

  if (expiresAt - now > MAX_TTL_SECONDS * 1000) {
    throw new QaPreviewTokenError('INVALID_PAYLOAD', 'QA preview token TTL cannot exceed 60 minutes')
  }

  const payload: QaPreviewTokenPayload = {
    purpose: QA_PREVIEW_PURPOSE,
    websiteId: input.websiteId,
    path: normalizePreviewPath(input.path),
    issuedAt: now,
    expiresAt,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`
}

export function verifyQaPreviewToken(
  token: string,
  expected: VerifyQaPreviewTokenInput,
  secretInput?: string
): QaPreviewTokenPayload {
  const secret = requireSecret(secretInput)
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new QaPreviewTokenError('MALFORMED_TOKEN', 'QA preview token is malformed')
  }

  const [encodedPayload, encodedSignature] = parts
  const expectedSignature = Buffer.from(signPayload(encodedPayload, secret), 'base64url')
  const actualSignature = Buffer.from(encodedSignature, 'base64url')

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new QaPreviewTokenError('INVALID_SIGNATURE', 'QA preview token signature is invalid')
  }

  const payload = parsePayload(encodedPayload)
  const now = expected.now ?? Date.now()

  if (payload.expiresAt <= now) {
    throw new QaPreviewTokenError('TOKEN_EXPIRED', 'QA preview token has expired')
  }

  if (payload.expiresAt - payload.issuedAt > MAX_TTL_SECONDS * 1000) {
    throw new QaPreviewTokenError('INVALID_PAYLOAD', 'QA preview token TTL exceeds 60 minutes')
  }

  const expectedPath = normalizePreviewPath(expected.path)
  if (payload.websiteId !== expected.websiteId || normalizePreviewPath(payload.path) !== expectedPath) {
    throw new QaPreviewTokenError('TOKEN_SCOPE_MISMATCH', 'QA preview token scope does not match this preview')
  }

  return payload
}
