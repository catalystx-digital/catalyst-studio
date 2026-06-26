import { SitemapDiscoveryService } from '../sitemap-discovery.service';

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
