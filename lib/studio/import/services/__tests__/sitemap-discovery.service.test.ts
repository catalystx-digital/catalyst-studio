import { SitemapDiscoveryService } from '../sitemap-discovery.service';

/**
 * Put an environment variable back exactly as it was.
 *
 * `process.env.X = saved` is not that: when the variable was unset, Node
 * coerces the undefined to the literal string "undefined" and the key is now
 * set. Harmless for the boolean flags, which are compared against 'true', but
 * DECISION_MODEL_API_KEY="undefined" then leaks into every later test file
 * sharing this worker and reads as a configured key.
 */
function restoreEnv(key: string, saved: string | undefined): void {
  if (saved === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = saved;
  }
}

describe('SitemapDiscoveryService', () => {
  const service = new SitemapDiscoveryService();
  const originalFetch = (global as any).fetch;

  const makeResponse = (status: number, body: string, contentType: string = 'text/xml') =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() === 'content-type') return contentType;
          return null;
        },
      },
      text: async () => body,
      arrayBuffer: async () => Buffer.from(body),
      body: {
        getReader: () => {
          let consumed = false;
          return {
            read: async () => {
              if (consumed) return { done: true, value: undefined };
              consumed = true;
              return { done: false, value: Buffer.from(body) };
            },
          };
        },
      },
    } as any);

  beforeEach(() => {
    if (!(global as any).fetch) {
      (global as any).fetch = jest.fn();
    }
    const responses: Record<string, { status: number; body: string; contentType?: string }> = {
      // Platform detection fetch.
      'https://example.com/': { status: 200, body: '<html><head></head><body>home</body></html>', contentType: 'text/html' },
      // Primary sitemap.
      'https://example.com/sitemap.xml': {
        status: 200,
        body: `
          <urlset>
            <url><loc>https://example.com/valid/</loc></url>
            <url><loc>https://example.com/compact/</loc></url>
            <url><loc>https://example.com/encoded%2Fpath/</loc></url>
          </urlset>
        `,
      },
      // Reachability probes.
      'https://example.com/valid/': { status: 200, body: '<html>ok</html>', contentType: 'text/html' },
      'https://example.com/compact/': {
        status: 200,
        body: '<html><body><h1>Page not found</h1><p>Error: 404</p></body></html>',
      },
      'https://example.com/encoded/path/': { status: 200, body: '<html>ok</html>', contentType: 'text/html' },
    };

    const fetchMock = jest.spyOn(global, 'fetch' as any);
    fetchMock.mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString();
      const hit = responses[url];
      if (!hit) {
        return makeResponse(404, 'not found', 'text/html');
      }
      return makeResponse(hit.status, hit.body, hit.contentType);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    delete process.env.IMPORT_SKIP_REACHABILITY;
    delete process.env.IMPORT_SKIP_REACHABILITY_MIN_URLS;
    if (originalFetch) {
      (global as any).fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }
  });

  it('always includes the site root first and filters unreachable entries', async () => {
    const result = await service.expandUrlsForImport('https://example.com/', 5);

    expect(result.urls[0]).toBe('https://example.com/');
    expect(result.urls).toContain('https://example.com/valid/');
    expect(result.urls).toContain('https://example.com/encoded/path/');
    expect(result.urls.some((u) => u.includes('compact'))).toBe(false);
  });

  it('drops intranet-looking paths by default', async () => {
    const intranetService = new SitemapDiscoveryService();
    (global.fetch as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString();
      if (url === 'https://example.com/') {
        return makeResponse(200, '<html>home</html>', 'text/html');
      }
      if (url === 'https://example.com/sitemap.xml') {
        return makeResponse(
          200,
          `<urlset>
             <url><loc>https://example.com/intranet/secret/</loc></url>
             <url><loc>https://example.com/valid/</loc></url>
           </urlset>`
        );
      }
      if (url === 'https://example.com/valid/') {
        return makeResponse(200, '<html>ok</html>', 'text/html');
      }
      if (url === 'https://example.com/intranet/secret/') {
        return makeResponse(200, '<html>Page not found</html>', 'text/html');
      }
      throw new Error(`Unexpected fetch for ${url}`);
    });

    const result = await intranetService.expandUrlsForImport('https://example.com/', 5);
    expect(result.urls[0]).toBe('https://example.com/');
    expect(result.urls).toContain('https://example.com/valid/');
    expect(result.urls.some((u) => u.includes('/intranet/'))).toBe(false);
  });

  it('drops an internal path the hardcoded rule misses, once the decision model is on', async () => {
    // The old rule recognises only /intranet/ and one site-specific path, so
    // /staff-portal/ is published today. This is the gap the question closes.
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;

    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    // A canned "internal" for every URL would make the assertion below pass
    // even if discovery dropped the whole site, so this stand-in answers from
    // the URL in the state the way the real model would: internal for the
    // staff portal, public for everything else.
    setDecisionClient({
      async askRaw(state: string) {
        const internal = state.includes('/staff-portal/');
        const probability = internal ? 0.92 : 0.02;
        return {
          answers: {
            'page.isInternal': { value: probability, probability, confidence: null },
          },
          usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 },
        };
      },
    });

    try {
      const staffService = new SitemapDiscoveryService();
      (global.fetch as any).mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input?.toString();
        if (url === 'https://example.com/') {
          return makeResponse(200, '<html>home</html>', 'text/html');
        }
        if (url === 'https://example.com/sitemap.xml') {
          return makeResponse(
            200,
            `<urlset>
               <url><loc>https://example.com/staff-portal/</loc></url>
               <url><loc>https://example.com/valid/</loc></url>
             </urlset>`
          );
        }
        return makeResponse(200, '<html>ok</html>', 'text/html');
      });

      const result = await staffService.expandUrlsForImport('https://example.com/', 5);
      expect(result.urls.some((u) => u.includes('/staff-portal/'))).toBe(false);
      // The internal page is dropped and nothing else is: the site root and a
      // genuinely public page both survive.
      expect(result.urls[0]).toBe('https://example.com/');
      expect(result.urls).toContain('https://example.com/valid/');
      expect(result.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://example.com/staff-portal/',
            reason: 'private-path',
          }),
        ])
      );
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
    }
  });

  it('keeps publishing that same path while the model is in shadow mode', async () => {
    const { setDecisionClient, createFakeDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;

    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'true';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    setDecisionClient(
      createFakeDecisionClient({
        'page.isInternal': { value: 0.92, probability: 0.92 },
      })
    );

    try {
      const shadowService = new SitemapDiscoveryService();
      (global.fetch as any).mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input?.toString();
        if (url === 'https://example.com/') {
          return makeResponse(200, '<html>home</html>', 'text/html');
        }
        if (url === 'https://example.com/sitemap.xml') {
          return makeResponse(
            200,
            `<urlset><url><loc>https://example.com/staff-portal/</loc></url></urlset>`
          );
        }
        return makeResponse(200, '<html>ok</html>', 'text/html');
      });

      const result = await shadowService.expandUrlsForImport('https://example.com/', 5);
      // Shadow records the disagreement; the old rule still governs.
      expect(result.urls.some((u) => u.includes('/staff-portal/'))).toBe(true);
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
    }
  });

  it('continues past soft-404 pages to fill the max URLs cap', async () => {
    const serviceWithCap = new SitemapDiscoveryService();
    (global.fetch as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString();
      if (url === 'https://example.com/') {
        return makeResponse(200, '<html>home</html>', 'text/html');
      }
      if (url === 'https://example.com/sitemap.xml') {
        return makeResponse(
          200,
          `<urlset>
             <url><loc>https://example.com/valid-a/</loc></url>
             <url><loc>https://example.com/soft404/</loc></url>
             <url><loc>https://example.com/valid-b/</loc></url>
             <url><loc>https://example.com/valid-c/</loc></url>
           </urlset>`
        );
      }
      if (url === 'https://example.com/soft404/') {
        return makeResponse(200, '<html><body><h1>Error: 404</h1></body></html>');
      }
      if (url === 'https://example.com/valid-a/' || url === 'https://example.com/valid-b/' || url === 'https://example.com/valid-c/') {
        return makeResponse(200, '<html>ok</html>', 'text/html');
      }
      throw new Error(`Unexpected fetch for ${url}`);
    });

    const result = await serviceWithCap.expandUrlsForImport('https://example.com/', 3);
    expect(result.urls[0]).toBe('https://example.com/');
    expect(result.urls).toContain('https://example.com/valid-a/');
    expect(result.urls).toContain('https://example.com/valid-b/');
    expect(result.urls.length).toBe(3);
  });

  it('still filters unreachable URLs for small imports when fast mode is enabled', async () => {
    process.env.IMPORT_SKIP_REACHABILITY = '1';
    const serviceWithFastMode = new SitemapDiscoveryService();
    (global.fetch as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString();
      if (url === 'https://example.com/') {
        return makeResponse(200, '<html>home</html>', 'text/html');
      }
      if (url === 'https://example.com/sitemap.xml') {
        return makeResponse(
          200,
          `<urlset>
             <url><loc>https://example.com/valid-a/</loc></url>
             <url><loc>https://example.com/forbidden/</loc></url>
             <url><loc>https://example.com/valid-b/</loc></url>
           </urlset>`
        );
      }
      if (url === 'https://example.com/forbidden/') {
        return makeResponse(403, 'forbidden', 'text/html');
      }
      if (url === 'https://example.com/valid-a/' || url === 'https://example.com/valid-b/') {
        return makeResponse(200, 'ok', 'text/html');
      }
      throw new Error(`Unexpected fetch for ${url}`);
    });

    const result = await serviceWithFastMode.expandUrlsForImport('https://example.com/', 3);

    expect(result.urls).toEqual([
      'https://example.com/',
      'https://example.com/valid-a/',
      'https://example.com/valid-b/'
    ]);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://example.com/forbidden/',
          reason: 'http-403'
        })
      ])
    );
  });

  it('preserves namespaced image metadata from sitemap entries', async () => {
    const imageService = new SitemapDiscoveryService();
    (global.fetch as any).mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString();
      if (url === 'https://example.com/') {
        return makeResponse(200, '<html>home</html>', 'text/html');
      }
      if (url === 'https://example.com/sitemap.xml') {
        return makeResponse(
          200,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
             <url>
               <loc>https://example.com/gallery/</loc>
               <lastmod>2026-06-20</lastmod>
               <image:image>
                 <image:loc>https://cdn.example.com/gallery.jpg</image:loc>
               </image:image>
             </url>
           </urlset>`
        );
      }
      if (url === 'https://example.com/gallery/') {
        return makeResponse(200, '<html>gallery</html>', 'text/html');
      }
      return makeResponse(404, 'not found', 'text/html');
    });

    const result = await imageService.expandUrlsForImport('https://example.com/', 2);

    expect(result.urls).toContain('https://example.com/gallery/');
    expect(result.sitemapMetaByUrl.get('https://example.com/gallery/')).toEqual(
      expect.objectContaining({
        lastmod: '2026-06-20',
        images: ['https://cdn.example.com/gallery.jpg'],
      }),
    );
  });
});
