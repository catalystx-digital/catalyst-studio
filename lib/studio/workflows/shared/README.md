# Shared Workflow Infrastructure

This module contains shared utilities for Vercel Workflow SDK workflows.
Used by both the Import Website workflow and the Greenfield workflow.

## Pattern: AI Step = Atomic, Surrounding = Discrete

When building workflows with AI generation steps, follow this pattern:

### AI Generation Step: Treat as ATOMIC

AI generation operations (LLM calls, page creation) should be treated as a **single atomic step**:

- **One step** for the entire AI generation phase
- Use **ProgressHeartbeat** for periodic progress updates during long runs
- Don't break into sub-steps (tool calls are not durable and will replay)

```typescript
async function generatePagesStep(context: GenerationContext): Promise<GeneratedPages[]> {
  "use step";

  const heartbeat = new ProgressHeartbeat({
    websiteId: context.websiteId,
    sessionId: context.sessionId,
    jobId: context.jobId,
  });

  try {
    heartbeat.start({ processed: 0, total: context.pages.length });

    const results: GeneratedPages[] = [];
    for (let i = 0; i < context.pages.length; i++) {
      const page = await generateSinglePage(context.pages[i]);
      results.push(page);
      heartbeat.updateCounts(i + 1, context.pages.length);
    }

    return results;
  } finally {
    heartbeat.stop(); // ALWAYS cleanup
  }
}
```

### Setup/Teardown Steps: Use DISCRETE Steps

Non-AI operations (database reads/writes, validation) should use **separate discrete steps**:

- Each database operation can be its own step
- Enables fine-grained resume on failure
- Individual steps are durable and won't replay

```typescript
// Discrete step for saving results
async function persistResultsStep(results: GeneratedPages[]): Promise<void> {
  "use step";
  await callInternalApi('/api/internal/persist', { results });
}

// Discrete step for updating progress
async function updateProgressStep(jobId: string, progress: number): Promise<void> {
  "use step";
  await callInternalApi('/api/internal/job', { action: 'updateProgress', jobId, progress });
}
```

## Modules

### progress-heartbeat.ts

Provides `ProgressHeartbeat` class for periodic progress updates during long-running operations.

**When to use**: During AI generation steps that may take 30+ seconds.

```typescript
import { ProgressHeartbeat } from '@/lib/studio/workflows/shared';

const heartbeat = new ProgressHeartbeat({
  websiteId,
  sessionId,
  accountId,
  jobId,
});

try {
  heartbeat.start({ processed: 0, total: 4 });
  // ... do work, periodically call heartbeat.updateCounts()
} finally {
  heartbeat.stop();
}
```

### internal-api.ts

Provides `getInternalApiUrl()` and `callInternalApi()` for server-to-server API calls within workflows.

**Why needed**: Prisma cannot be bundled in Vercel Workflow steps. All database operations must go through internal API routes.

```typescript
import { callInternalApi, getInternalApiHeaders, getInternalApiUrl } from '@/lib/studio/workflows/shared';

// Option 1: Using the helper (recommended for simple POST)
const result = await callInternalApi<{ success: boolean }>(
  '/api/internal/import-job',
  { action: 'updateProgress', jobId, progress: 50 }
);

// Option 2: Manual fetch (for complex scenarios)
const response = await fetch(getInternalApiUrl('/api/internal/design-system'), {
  method: 'POST',
  headers: getInternalApiHeaders(),
  body: JSON.stringify({ websiteId, targetUrl }),
});
```

## Vercel Deployment Protection

When running on Vercel with deployment protection enabled, workflow steps run in an isolated runtime. The `getInternalApiUrl()` function automatically adds the `x-vercel-protection-bypass` query parameter when `VERCEL_AUTOMATION_BYPASS_SECRET` is set.

The bypass token only gets the request through Vercel's edge protection. Mutating internal app APIs require `x-workflow-internal: $WORKFLOW_INTERNAL_SECRET`; use `callInternalApi()` or `getInternalApiHeaders()` so callers send that header consistently.

See: [Vercel Docs - Protection Bypass Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VERCEL_URL` | Auto-set by Vercel in production | Auto |
| `WORKFLOW_INTERNAL_SECRET` | Secret sent in `x-workflow-internal` for mutating internal APIs | Production |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret for bypassing Vercel deployment protection only | Production when deployment protection is enabled |
| `PORT` | Development server port (default: 3000) | No |
