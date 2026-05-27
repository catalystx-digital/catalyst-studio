import type { NextRequest } from 'next/server'

function isLocalHostHeader(host: string): boolean {
  const normalized = host.trim().toLowerCase()
  if (normalized === '::1') return true
  const hostname = normalized.startsWith('[')
    ? normalized.slice(1, normalized.indexOf(']'))
    : normalized.split(':')[0]
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function isAuthorizedInternalWorkflowRequest(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? ''
  const isLocalHost = isLocalHostHeader(host)
  const isLocalEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  const isVercelRuntime = Boolean(process.env.VERCEL_URL)

  if (isLocalHost && (isLocalEnv || !isVercelRuntime)) {
    return true
  }

  const workflowSecret = process.env.WORKFLOW_INTERNAL_SECRET
  const workflowHeader = request.headers.get('x-workflow-internal')
  if (workflowSecret && workflowHeader === workflowSecret) {
    return true
  }

  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const bypassToken = request.nextUrl.searchParams.get('x-vercel-protection-bypass')
  if (bypassSecret && bypassToken === bypassSecret) {
    return true
  }

  return false
}
