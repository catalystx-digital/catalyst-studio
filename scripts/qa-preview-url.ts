#!/usr/bin/env tsx

import path from 'path'
import dotenv from 'dotenv'
import { createQaPreviewToken, normalizePreviewPath } from '../lib/studio/preview/qa-preview-token'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true })

interface Args {
  websiteId: string
  previewPath: string
  baseUrl: string
  ttlSeconds: number
  sourceUrl?: string
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return undefined
  }

  return process.argv[index + 1]
}

function parseArgs(): Args {
  const websiteId = readArg('--website-id')
  if (!websiteId) {
    throw new Error('--website-id is required')
  }

  const ttlSeconds = Number(readArg('--ttl-seconds') ?? '900')
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 3600) {
    throw new Error('--ttl-seconds must be between 1 and 3600')
  }

  return {
    websiteId,
    previewPath: normalizePreviewPath(readArg('--path') ?? '/'),
    baseUrl: readArg('--base-url') ?? 'http://localhost:3000',
    ttlSeconds,
    sourceUrl: readArg('--source-url'),
  }
}

function encodePreviewPath(previewPath: string): string {
  if (previewPath === '/') {
    return ''
  }

  return `/${previewPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`
}

async function main() {
  const args = parseArgs()
  const token = createQaPreviewToken({
    websiteId: args.websiteId,
    path: args.previewPath,
    ttlSeconds: args.ttlSeconds,
  })

  const previewUrl = new URL(
    `/studio/preview/site/${encodeURIComponent(args.websiteId)}${encodePreviewPath(args.previewPath)}`,
    args.baseUrl
  )
  previewUrl.searchParams.set('previewToken', token)

  const dataUrl = new URL('/api/studio/preview/data', args.baseUrl)
  dataUrl.searchParams.set('websiteId', args.websiteId)
  dataUrl.searchParams.set('path', args.previewPath)
  dataUrl.searchParams.set('previewToken', token)

  console.log(JSON.stringify({
    websiteId: args.websiteId,
    path: args.previewPath,
    ttlSeconds: args.ttlSeconds,
    ...(args.sourceUrl ? { sourceUrl: args.sourceUrl } : {}),
    previewUrl: previewUrl.toString(),
    dataUrl: dataUrl.toString(),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
