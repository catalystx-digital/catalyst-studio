import { test, expect } from '@playwright/test';

const SAMPLE_SITEMAP = {
  nodes: [
    {
      id: 'node-1',
      type: 'page',
      position: { x: 0, y: 0 },
      data: {
        label: 'Home',
        metadata: { status: 'published', contentTypeId: 'ct-1' },
        fullPath: 'home',
        components: [],
      },
    },
  ],
  edges: [],
  websiteId: 'test-site',
};

const SAMPLE_DESIGN_SYSTEM = {
  success: true,
  data: {
    website: { id: 'test-site', name: 'Test Site' },
    concepts: [{ id: 'concept-alpha', name: 'Alpha', isDefault: true }],
    activeConcept: { id: 'concept-alpha' },
    designSystem: null,
  },
};

const toJsonResponse = (payload: unknown) => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

test.describe('Site Builder chat persistence', () => {
  test('records append-only transcript requests', async ({ page }) => {
    const websiteId = 'test-site';
    const assistantSessionId = `studio-site-builder-assistant-${websiteId}`;
    const transcriptState = {
      revision: 'rev-0',
      messages: [] as Array<Record<string, unknown>>,
    };
    const aiMessagesEndpoint = `**/api/ai-context/${assistantSessionId}/messages*`;
    const deleteRequests: string[] = [];
    const postRequests: string[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/ai-context/') && request.url().includes('/messages')) {
        if (request.method() === 'DELETE') {
          deleteRequests.push(request.url());
        }
        if (request.method() === 'POST') {
          postRequests.push(request.url());
        }
      }
    });

    await page.route('**/api/chat', (route) => {
      const body = [
        'event: completion',
        'data: {"id":"mock","type":"response","response":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}',
        '',
        'data: [DONE]',
        '',
      ].join('\n');
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body,
      });
    });

    await page.route(`**/api/ai-context/${assistantSessionId}?**`, (route) => {
      route.fulfill({ status: 404, body: JSON.stringify({ error: { message: 'Not found' } }) });
    });

    await page.route(aiMessagesEndpoint, async (route, request) => {
      if (request.method() === 'DELETE') {
        route.fulfill(toJsonResponse({ data: { success: true } }));
        return;
      }

      const payload = request.postDataJSON() as {
        message: Record<string, unknown>;
      };
      transcriptState.messages.push(payload.message);
      transcriptState.revision = `rev-${transcriptState.messages.length}`;

      route.fulfill(
        toJsonResponse({
          data: {
            id: 'ctx-1',
            websiteId,
            accountId: 'acct-1',
            sessionId: assistantSessionId,
            messages: transcriptState.messages,
            metadata: {
              revision: transcriptState.revision,
              totalMessages: transcriptState.messages.length,
              tokens: transcriptState.messages.length * 5,
            },
            summary: null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    });

    await page.route('**/api/studio/sitemap/**', (route) => route.fulfill(toJsonResponse(SAMPLE_SITEMAP)));
    await page.route('**/api/studio/site-builder/global-components**', (route) =>
      route.fulfill(toJsonResponse([])),
    );
    await page.route('**/api/studio/site-builder/components**', (route) =>
      route.fulfill(toJsonResponse({ items: [], total: 0 })),
    );
    await page.route('**/api/content-types**', (route) => route.fulfill(toJsonResponse({ data: [] })));
    await page.route('**/api/studio/import/jobs/**', (route) =>
      route.fulfill(toJsonResponse({ id: 'job-1', status: 'completed' })),
    );
    await page.route('**/api/website/test-site/design-system**', (route) =>
      route.fulfill(toJsonResponse(SAMPLE_DESIGN_SYSTEM)),
    );

    await page.goto(
      `/studio/site-builder?websiteId=${websiteId}&websiteName=Test%20Site&conceptId=concept-alpha&importJobId=job-1`,
    );

    await expect(page.getByPlaceholder('Search pages...')).toBeVisible();
    expect(deleteRequests).toHaveLength(0);

    await page.getByRole('button', { name: /assistant/i }).click();

    const input = page.getByPlaceholder(/assistant/i);
    await input.fill('Track append-only writes');
    await page.getByRole('button', { name: /^Send$/i }).click();

    await expect.poll(() => postRequests.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(deleteRequests).toHaveLength(0);
  });
});
