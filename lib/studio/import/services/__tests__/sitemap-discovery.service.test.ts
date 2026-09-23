import { SitemapDiscoveryService, extractNavigationUrls, spreadEntries, isAssetUrl, isLikelyAttachmentPageUrl } from '../sitemap-discovery.service';

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

  it.each(['https://x.com/photo.jpg/', 'https://x.com/doc.pdf/', 'https://x.com/photo.jpg', 'https://x.com/app.js', 'https://x.com/style.css'])(
    'recognises asset URL %s', (url) => expect(isAssetUrl(url)).toBe(true),
  );

  it.each(['01-jpg/', '01-03_x1-jpg/', 'fig2-jpg-4/', 'photo-png-12/', 'fig-15-osx-fullscreen-696px-mp4/', 'annual-report-pdf/', ...['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff'].map(ext => `photo-${ext}`)])(
    'recognises likely attachment %s', (path) => expect(isLikelyAttachmentPageUrl(`https://example.com/${path}`)).toBe(true),
  );

  it.each(['/blog/', '/about', '/about-us/', '/mp4-guide/', '/jpg-compression-guide', '/photography', '/photo-tif/', '/site-map/', '/top-10/', '/site-map-2/', '/web-design-2024/', '/road-map/', '/learn-node-js/', '/intro-to-sql/'])(
    'keeps ordinary page %s', (path) => expect(isLikelyAttachmentPageUrl(`https://example.com${path}`)).toBe(false),
  );

  it('extracts same-host header and navigation links with top-level links before dropdowns', () => {
    const html = `<header><a href="/header/">Header</a><nav><ul>
      <li><a href="/first/">First</a><ul><li><a href="/nested/">Nested</a></li></ul></li>
      <li><a href="/second/">Second</a></li>
    </ul></nav></header><div role="navigation"><a href="/role/">Role</a>
      <a href="/first/">Duplicate</a><a href="https://other.example/page">External</a>
      <a href="mailto:team@example.com">Mail</a><a href="tel:123">Phone</a>
      <a href="#section">Fragment</a><a href="javascript:void(0)">Script</a>
    </div><main><a href="/content/">Content</a></main>`;

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual([
      'https://example.com/header/',
      'https://example.com/first/',
      'https://example.com/second/',
      'https://example.com/role/',
      'https://example.com/nested/',
    ]);
  });

  it('keeps distinct query strings when deduplicating menu and import URLs', async () => {
    const html = '<nav><a href="/page?id=one">One</a><a href="/page?id=two">Two</a></nav>';
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') return makeResponse(200, html, 'text/html');
      if (input === 'https://example.com/sitemap.xml') return makeResponse(200, '<urlset></urlset>');
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual([
      'https://example.com/page?id=one',
      'https://example.com/page?id=two',
    ]);
    const result = await service.expandUrlsForImport('https://example.com/', 3);
    expect(result.urls).toEqual([
      'https://example.com/',
      'https://example.com/page?id=one',
      'https://example.com/page?id=two',
    ]);
  });

  it('keeps ordinary two-letter sections unless the link has hreflang', () => {
    const html = '<nav><a href="/us/">About us</a><a href="/it/">IT services</a><a href="/fr/" hreflang="fr">French</a></nav>';

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual([
      'https://example.com/us/',
      'https://example.com/it/',
    ]);
  });

  it('excludes exact utility paths but keeps their descendants', () => {
    const html = '<nav><a href="/register/">Register</a><a href="/register/heritage-buildings/">Heritage buildings</a><a href="/SEARCH">Search</a><a href="/search/guides/">Guides</a></nav>';

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual([
      'https://example.com/register/heritage-buildings/',
      'https://example.com/search/guides/',
    ]);
  });

  it('ignores content headers but keeps nav and navigation roles outside footers', () => {
    const html = '<article><header><a href="/author/">Author</a></header></article>'
      + '<section><header><a href="/section-author/">Section author</a></header></section>'
      + '<aside><header><a href="/aside-author/">Aside author</a></header></aside>'
      + '<main><header><a href="/main-author/">Main author</a></header></main>'
      + '<main><nav><a href="/main-nav/">Main nav</a></nav><div role="navigation"><a href="/main-role/">Main role</a></div></main>'
      + '<header><a href="/site/">Site</a></header>';

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual([
      'https://example.com/main-nav/',
      'https://example.com/main-role/',
      'https://example.com/site/',
    ]);
  });

  it('ignores navigation inside a footer so it cannot fill the page cap', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') {
        return makeResponse(200, '<footer><nav><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a><a href="/cookies/">Cookies</a></nav></footer><main><a href="/story/">Story</a></main>', 'text/html');
      }
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/story/</loc></url><url><loc>https://example.com/guide/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    expect(extractNavigationUrls('<footer><nav><a href="/privacy/">Privacy</a></nav></footer>', 'https://example.com')).toEqual([]);
    const result = await service.expandUrlsForImport('https://example.com/', 3);
    expect(result.urls).toEqual(['/', '/guide/', '/story/'].map(path => `https://example.com${path}`));
  });

  it('uses sitemap URL spelling for a matching menu path', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') {
        return makeResponse(200, '<header><nav><a href="/About/">About</a><a href="/about">About again</a></nav></header>', 'text/html');
      }
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/about/</loc></url><url><loc>https://example.com/story/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    expect(extractNavigationUrls('<nav><a href="/About/">About</a><a href="/about">Duplicate</a></nav>', 'https://example.com')).toEqual(['https://example.com/About/']);
    const result = await service.expandUrlsForImport('https://example.com/', 4);
    expect(result.urls).toEqual(['/', '/about/', '/story/'].map(path => `https://example.com${path}`));
  });

  it('prefers content over header utility and language links', async () => {
    const utilityPaths = [
      'login', 'log-in', 'signin', 'sign-in', 'logout', 'register', 'signup', 'sign-up',
      'account', 'my-account', 'cart', 'basket', 'checkout', 'search', 'wp-login.php', 'wp-admin',
    ];
    const html = `<header><nav>
      ${utilityPaths.map(path => `<a href="/${path}/">${path}</a>`).join('')}
      <a href="/fr/" hreflang="fr">French</a><a href="/article/">Article</a><a href="/guide/">Guide</a>
      <a href="/en-au/" hreflang="en-AU">English</a><a href="/translated/" hreflang="fr">Translated</a>
    </nav></header>`;
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') return makeResponse(200, html, 'text/html');
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/login/</loc></url><url><loc>https://example.com/article/</loc></url><url><loc>https://example.com/guide/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    expect(extractNavigationUrls(html, 'https://example.com')).toEqual(['https://example.com/article/', 'https://example.com/guide/']);
    const result = await service.expandUrlsForImport('https://example.com/', 4);
    expect(result.urls).toEqual(['/', '/article/', '/guide/', '/login/'].map(path => `https://example.com${path}`));
  });

  it('spreads the first capped entries across a full permutation', () => {
    const entries = Array.from({ length: 20 }, (_, index) => index);
    const spread = spreadEntries(entries, 5);

    expect(spread.slice(0, 5)).toEqual([0, 4, 8, 12, 16]);
    expect(spread).toHaveLength(entries.length);
    expect(new Set(spread).size).toBe(entries.length);
    expect(spreadEntries([0, 1, 2], 3)).toEqual([0, 1, 2]);
    expect(spreadEntries([0, 1, 2], 5)).toEqual([0, 1, 2]);
  });

  it('puts menu articles before spread sitemap pages under a six-page cap', async () => {
    const machinePaths = Array.from({ length: 100 }, (_, index) => `/08-${String(index + 1).padStart(2, '0')}/`);
    const articles = ['/article-a/', '/article-b/', '/article-c/', '/article-d/', '/article-e/'];
    const paths = [...machinePaths, ...articles];
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') {
        return makeResponse(200, '<header><nav><a href="/article-c/">C</a><a href="/article-a/">A</a><a href="/article-e/">E</a></nav></header>', 'text/html');
      }
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, `<urlset>${paths.map(path => `<url><loc>https://example.com${path}</loc></url>`).join('')}</urlset>`);
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    const result = await service.expandUrlsForImport('https://example.com/', 6);

    expect(result.urls).toEqual(['/', '/article-c/', '/article-a/', '/article-e/', '/08-01/', '/08-17/'].map(path => `https://example.com${path}`));
  });

  it('spreads sitemap pages when the home HTML has no navigation', async () => {
    const paths = Array.from({ length: 18 }, (_, index) => `/08-${String(index + 1).padStart(2, '0')}/`);
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, `<urlset>${paths.map(path => `<url><loc>https://example.com${path}</loc></url>`).join('')}</urlset>`);
      }
      return makeResponse(200, '<html><main>No menu</main></html>', 'text/html');
    });

    const result = await service.expandUrlsForImport('https://example.com/', 6);

    expect(result.urls).toEqual(['/', '/08-01/', '/08-04/', '/08-07/', '/08-10/', '/08-13/'].map(path => `https://example.com${path}`));
  });

  it('skips media and attachment child sitemaps without using the five-child limit', async () => {
    const mediaSitemaps = ['image-sitemap-index-1.xml', 'video-sitemap-1.xml', 'attachment-sitemap.xml'];
    const pageSitemaps = Array.from({ length: 5 }, (_, index) => `sitemap-${index + 1}.xml`);
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, `<sitemapindex>${[...mediaSitemaps, ...pageSitemaps]
          .map(name => `<sitemap><loc>https://example.com/${name}</loc></sitemap>`).join('')}</sitemapindex>`);
      }
      if (input === 'https://example.com/image-sitemap-index-1.xml') {
        return makeResponse(200, '<sitemapindex><sitemap><loc>https://example.com/image-sitemap-1.xml</loc></sitemap></sitemapindex>');
      }
      if (mediaSitemaps.some(name => input.endsWith(name)) || input === 'https://example.com/image-sitemap-1.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/image3/</loc></url></urlset>');
      }
      const pageNumber = input.match(/\/sitemap-(\d+)\.xml$/)?.[1];
      if (pageNumber) {
        return makeResponse(200, `<urlset><url><loc>https://example.com/article-${pageNumber}/</loc></url></urlset>`);
      }
      if (input === 'https://example.com/' || /\/article-\d+\/$/.test(input) || input === 'https://example.com/image3/') {
        return makeResponse(200, '<html>ok</html>', 'text/html');
      }
      return makeResponse(404, 'not found', 'text/html');
    });

    const result = await service.expandUrlsForImport('https://example.com/', 6);
    const fetched = (global.fetch as jest.Mock).mock.calls.map(([input]) => input);

    expect(result.urls).toEqual(['/', ...Array.from({ length: 5 }, (_, index) => `/article-${index + 1}/`)]
      .map(path => `https://example.com${path}`));
    expect(fetched).toContain('https://example.com/sitemap-5.xml');
    for (const name of [...mediaSitemaps, 'image-sitemap-1.xml']) {
      expect(fetched).not.toContain(`https://example.com/${name}`);
    }
  });

  it('rejects asset and attachment links from the menu before filling the cap', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/') {
        return makeResponse(200, '<nav><a href="/photo.jpg">Asset</a><a href="/photo-jpg/">Attachment</a><a href="/story/">Story</a></nav>', 'text/html');
      }
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/a/</loc></url><url><loc>https://example.com/b/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    const result = await service.expandUrlsForImport('https://example.com/', 4);

    expect(result.urls).toEqual(['/', '/story/', '/a/', '/b/'].map(path => `https://example.com${path}`));
    expect(result.skipped).toEqual(expect.arrayContaining([
      { url: 'https://example.com/photo.jpg', reason: 'asset-url' },
      { url: 'https://example.com/photo-jpg/', reason: 'likely-attachment-page' },
    ]));
  });

  it('filters attachments before a six-page sitemap cap and records reasons', async () => {
    const paths = ['/01-jpg/', '/01-03_x1-jpg/', '/blog/', '/about', '/jpg-compression-guide', '/photography', '/stories/'];
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, `<urlset>${paths.map(path => `<url><loc>https://example.com${path}</loc></url>`).join('')}</urlset>`);
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });
    const result = await service.expandUrlsForImport('https://example.com/', 6);
    expect(result.urls).toEqual(['/', '/about', '/blog/', '/jpg-compression-guide', '/photography', '/stories/'].map(path => `https://example.com${path}`));
    expect(result.skipped).toEqual(paths.slice(0, 2).map(path => ({ url: `https://example.com${path}`, reason: 'likely-attachment-page' })));
  });

  it.each([
    ['published', [0.1, 0.2, 0.9, 0.9], ['/', '/z/', '/deep/article/', '/a/']],
    ['absent', [undefined, undefined, undefined, undefined], ['/', '/a/', '/z/', '/deep/article/']],
    ['uniform', [0.9, 0.9, 0.9, 0.9], ['/', '/a/', '/z/', '/deep/article/']],
    ['one missing', [0.1, undefined, 0.9, undefined], ['/', '/a/', '/z/', '/deep/article/']],
  ] as Array<[string, Array<number | undefined>, string[]]>)(
    'orders sitemap entries with %s priorities', async (_label, priorities, expected) => {
      const paths = ['/', '/a/', '/z/', '/deep/article/'];
      (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
        if (input === 'https://example.com/sitemap.xml') {
          return makeResponse(200, `<urlset>${[3, 2, 1, 0].map(index => `<url><loc>https://example.com${paths[index]}</loc>${priorities[index] === undefined ? '' : `<priority>${priorities[index]}</priority>`}</url>`).join('')}</urlset>`);
        }
        return makeResponse(200, '<html>ok</html>', 'text/html');
      });
      const result = await service.expandUrlsForImport('https://example.com/', 4);
      expect(result.urls).toEqual(expected.map(path => `https://example.com${path}`));
    },
  );

  it.each([false, true])('records attachment skips in reachability filtering (fast=%s)', async (fast) => {
    process.env.IMPORT_SKIP_REACHABILITY = fast ? '1' : '0';
    const result = await (service as any).filterReachableUrls(['https://example.com/01-jpg/'], 50);
    expect(result).toEqual({ reachable: [], skipped: [{ url: 'https://example.com/01-jpg/', reason: 'likely-attachment-page' }] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records attachment skips for crawl seeds and extracted links', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeResponse(200, '<html><a href="/01-03_x1-jpg/">attachment</a><a href="/about">About</a></html>', 'text/html'));
    const result = await service.expandUrlsFromCrawl(['https://example.com/01-jpg/', 'https://example.com/'], { maxUrls: 6, followLinks: true, linkScope: 'same_domain' });
    expect(result.urls).toEqual(['https://example.com/', 'https://example.com/about']);
    expect(result.skipped).toEqual(expect.arrayContaining(['01-jpg/', '01-03_x1-jpg/'].map(path => ({ url: `https://example.com/${path}`, reason: 'likely-attachment-page' }))));
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
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;

    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
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
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('stops model private checks after one failure and keeps later public URLs', async () => {
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;
    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
    const askRaw = jest.fn().mockRejectedValue(new Error('connection failed'));
    setDecisionClient({ askRaw });
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/a/</loc></url><url><loc>https://example.com/b/</loc></url><url><loc>https://example.com/photo.jpg</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    try {
      const result = await service.expandUrlsForImport('https://example.com/', 2);
      expect(askRaw).toHaveBeenCalledTimes(1);
      expect(result.urls).toEqual(['https://example.com/a/', 'https://example.com/b/']);
      expect(result.skipped).toEqual(expect.arrayContaining([
        { url: 'https://example.com/', reason: 'private-check-failed' },
        { url: 'https://example.com/photo.jpg', reason: 'asset-url' }
      ]));
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('does not inject a priority path excluded by a failed sitemap private check', async () => {
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;
    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
    setDecisionClient({
      async askRaw(state: string) {
        if (state.includes('/staff-portal/')) throw new Error('connection failed');
        return {
          answers: { 'page.isInternal': { value: 0.02, probability: 0.02, confidence: null } },
          usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 },
        };
      },
    });
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/staff-portal/</loc></url><url><loc>https://example.com/valid/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    try {
      const result = await service.expandUrlsForImport('https://example.com/', { maxUrls: 5, priorityPaths: ['/STAFF-PORTAL'] });
      expect(result.urls).toEqual(['https://example.com/', 'https://example.com/valid/']);
      expect(result.injectedPriorityUrls).toEqual([]);
      expect(result.skipped).toContainEqual({ url: 'https://example.com/staff-portal/', reason: 'private-check-failed' });
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('records a first private-check failure during priority injection', async () => {
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;
    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
    setDecisionClient({
      async askRaw(state: string) {
        if (state.includes('/priority')) throw new Error('connection failed');
        return {
          answers: { 'page.isInternal': { value: 0.92, probability: 0.92, confidence: null } },
          usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 },
        };
      },
    });
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') return makeResponse(200, '<urlset></urlset>');
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const result = await service.expandUrlsForImport('https://example.com/', { maxUrls: 5, priorityPaths: ['/priority', '/intranet/secret'] });
      expect(result.urls).not.toContain('https://example.com/priority');
      expect(result.skipped).toContainEqual({ url: 'https://example.com/priority', reason: 'private-check-failed' });
      expect(result.skipped).toContainEqual({ url: 'https://example.com/intranet/secret', reason: 'private-path' });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"private-check-failed":1'));
    } finally {
      warn.mockRestore();
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('does not inject a duplicate priority path after its private check fails', async () => {
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;
    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
    const askRaw = jest.fn(async (state: string) => {
      if (state.includes('/staff-portal')) throw new Error('connection failed');
      return {
        answers: { 'page.isInternal': { value: 0.02, probability: 0.02, confidence: null } },
        usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 },
      };
    });
    setDecisionClient({ askRaw });
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') return makeResponse(200, '<urlset></urlset>');
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    try {
      const result = await service.expandUrlsForImport('https://example.com/', {
        maxUrls: 5,
        priorityPaths: ['/staff-portal', '/STAFF-PORTAL/'],
      });
      expect(result.urls).toEqual(['https://example.com/']);
      expect(result.injectedPriorityUrls).toEqual([]);
      expect(result.skipped).toEqual([{ url: 'https://example.com/staff-portal', reason: 'private-check-failed' }]);
      expect(askRaw).toHaveBeenCalledTimes(2);
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('counts a private sitemap URL once when also supplied as a priority path', async () => {
    const { setDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;
    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'false';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
    setDecisionClient({
      async askRaw(state: string) {
        const probability = state.includes('/staff-portal') ? 0.92 : 0.02;
        return {
          answers: { 'page.isInternal': { value: probability, probability, confidence: null } },
          usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 },
        };
      },
    });
    (global.fetch as jest.Mock).mockImplementation(async (input: string) => {
      if (input === 'https://example.com/sitemap.xml') {
        return makeResponse(200, '<urlset><url><loc>https://example.com/staff-portal/</loc></url></urlset>');
      }
      return makeResponse(200, '<html>ok</html>', 'text/html');
    });

    try {
      const result = await service.expandUrlsForImport('https://example.com/', {
        maxUrls: 5,
        priorityPaths: ['/STAFF-PORTAL'],
      });
      expect(result.urls).toEqual(['https://example.com/']);
      expect(result.skipped).toEqual([{ url: 'https://example.com/staff-portal/', reason: 'private-path' }]);
    } finally {
      setDecisionClient(null);
      restoreEnv('DECISION_MODEL_ENABLED', savedEnabled);
      restoreEnv('DECISION_MODEL_SHADOW', savedShadow);
      restoreEnv('DECISION_MODEL_API_KEY', savedKey);
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
    }
  });

  it('keeps publishing that same path while the model is in shadow mode', async () => {
    const { setDecisionClient, createFakeDecisionClient } = await import('@/lib/studio/decisions');
    const savedEnabled = process.env.DECISION_MODEL_ENABLED;
    const savedShadow = process.env.DECISION_MODEL_SHADOW;
    const savedKey = process.env.DECISION_MODEL_API_KEY;
    const savedQuestions = process.env.DECISION_MODEL_QUESTIONS;

    process.env.DECISION_MODEL_ENABLED = 'true';
    process.env.DECISION_MODEL_SHADOW = 'true';
    process.env.DECISION_MODEL_API_KEY = 'test-key';
    process.env.DECISION_MODEL_QUESTIONS = 'page.isInternal';
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
      restoreEnv('DECISION_MODEL_QUESTIONS', savedQuestions);
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
