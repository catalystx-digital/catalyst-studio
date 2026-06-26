/**
 * Internal API Utilities for Vercel Workflows
 *
 * Provides utilities for making server-to-server API calls within workflows.
 * Handles Vercel deployment protection bypass and URL construction.
 *
 * @module internal-api
 */

/**
 * Get the base URL for internal API calls.
 * Uses VERCEL_URL in production, localhost in development.
 */
export function getInternalApiBaseUrl(): string {
  // In production, use the Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // In local development, use localhost with the dev port
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Build a full internal API URL with Vercel deployment protection bypass.
 *
 * When running on Vercel with deployment protection enabled (e.g., Vercel Authentication),
 * workflow steps run in an isolated runtime and their HTTP calls to the same deployment
 * are blocked by the edge protection. The bypass token allows authenticated automation.
 *
 * @param path - The API path (e.g., '/api/internal/import-job')
 * @returns Full URL with bypass token if in production
 *
 * @see https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 */
export function getInternalApiUrl(path: string): string {
  const baseUrl = getInternalApiBaseUrl();
  const url = new URL(path, baseUrl);

  // Add bypass token for Vercel deployment protection (only in production)
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret && process.env.VERCEL_URL) {
    url.searchParams.set('x-vercel-protection-bypass', bypassSecret);
  }

  return url.toString();
}

export function getInternalApiHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  const internalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const workflowSecret = process.env.WORKFLOW_INTERNAL_SECRET;
  if (workflowSecret) {
    internalHeaders['x-workflow-internal'] = workflowSecret;
  }

  return internalHeaders;
}

/**
 * Make a POST request to an internal API route.
 * Handles error responses and returns typed data.
 *
 * @param path - The API path (e.g., '/api/internal/import-job')
 * @param body - The request body (will be JSON stringified)
 * @returns Parsed JSON response
 * @throws Error if the request fails or returns non-ok status
 *
 * @example
 * ```typescript
 * const result = await callInternalApi<{ data: JobData }>(
 *   '/api/internal/import-job',
 *   { action: 'updateProgress', jobId, progress: 50, message: 'Processing...' }
 * );
 * ```
 */
export async function callInternalApi<T>(
  path: string,
  body: object
): Promise<T> {
  const url = getInternalApiUrl(path);

  const response = await fetch(url, {
    method: 'POST',
    headers: getInternalApiHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorMessage: string;

    try {
      const errorJson = JSON.parse(errorText) as { message?: string; error?: string };
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || `API call failed: ${response.status}`;
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
