import type { NextRequest } from 'next/server'

export function isAuthorizedInternalWorkflowRequest(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? ''
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1')
  const isLocalEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

  if (isLocalEnv && isLocalHost) {
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
