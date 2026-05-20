import { XMLParser } from 'fast-xml-parser';
import * as zlib from 'zlib';
import { SitemapConfig, LoggingConfig } from '../config';

/**
 * File extensions that indicate non-HTML assets.
 * These URLs should be skipped during import as they cannot be parsed for components.
 */
const ASSET_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'avif',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'rtf',
  // Media
  'mp4', 'mp3', 'avi', 'mov', 'wmv', 'wav', 'flac', 'ogg', 'webm', 'm4a', 'm4v',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  // Data files
  'json', 'csv', 'dat', 'sql',
  // Web assets (styles, scripts, fonts)
  'js', 'css', 'woff', 'woff2', 'ttf', 'eot', 'otf', 'map',
  // Other
  'exe', 'dmg', 'apk', 'ipa', 'msi'
]);

/**
 * Check if a URL points to a non-HTML asset based on file extension.
 * These URLs should be filtered out before expensive LLM processing.
 */
export function isAssetUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    // Get extension from pathname, handling query strings
    const pathWithoutQuery = pathname.split('?')[0];
    const lastSegment = pathWithoutQuery.split('/').pop() || '';
    const dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex === -1) return false;
    const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
    return ASSET_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

export interface SitemapMetadata {
  priority?: number;
  changefreq?: string;
  lastmod?: string;
  images?: string[];
}

export interface ExpandedImportUrls {
  urls: string[];
  sitemapMetaByUrl: Map<string, SitemapMetadata>;
  detectedPlatform: string | null;
  skipped?: Array<{ url: string; reason: string }>;
  /** Priority URLs that were injected (not found in sitemap) */
  injectedPriorityUrls?: string[];
}

export interface ExpandUrlsOptions {
  /** Maximum URLs to return */
  maxUrls?: number;
  /** Priority paths/URLs to guarantee inclusion (even if not in sitemap) */
  priorityPaths?: string[];
}

/**
 * Options for the expandUrlsFromCrawl method.
 * Used by the import planner for multi-start BFS crawling.
 */
export interface CrawlOptions {
  /** Maximum URLs to discover */
  maxUrls: number;
  /** Whether to follow links from pages */
  followLinks: boolean;
  /** Scope for link following: 'same_path' | 'same_domain' | 'none' */
  linkScope: 'same_path' | 'same_domain' | 'none';
  /** Pre-existing visited set (for cross-session dedup) */
  visited?: Set<string>;
}

export class SitemapDiscoveryService {
  async expandUrlsForImport(inputUrl: string, maxUrlsOrOptions: number | ExpandUrlsOptions = 20): Promise<ExpandedImportUrls> {
    // Handle both old signature (maxUrls: number) and new signature (options object)
    const options: ExpandUrlsOptions = typeof maxUrlsOrOptions === 'number'
      ? { maxUrls: maxUrlsOrOptions }
      : maxUrlsOrOptions;
    const maxUrls = options.maxUrls ?? 20;
    const priorityPaths = options.priorityPaths ?? [];

    const metadataByUrl = new Map<string, SitemapMetadata>();
    let detectedPlatform: string | null = null;
    const injectedPriorityUrls: string[] = [];

    try {
      const url = new URL(inputUrl);
      const isRoot = url.pathname === '/' || url.pathname === '';

      if (SitemapConfig.disabled) {
        return { urls: [inputUrl], sitemapMetaByUrl: metadataByUrl, detectedPlatform };
      }

      // For non-root URLs (subsections), crawl links from the page instead of sitemap
      if (!isRoot) {
        return this.expandUrlsFromSubsection(inputUrl, maxUrls);
      }

      const origin = `${url.protocol}//${url.host}`;

      try {
        detectedPlatform = await this.detectPlatform(origin);
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({ event: 'platform.detected', origin, platform: detectedPlatform }));
        }
      } catch {
        detectedPlatform = null;
      }

      const candidates = this.buildInitialCandidateSet(origin, detectedPlatform);
      const skipped: Array<{ url: string; reason: string }> = [];

      try {
        const robotsUrl = `${origin}/robots.txt`;
        const robotsTxt = await this.safeFetchText(robotsUrl);
        if (robotsTxt) {
          const robotSitemaps = this.extractSitemapsFromRobots(robotsTxt);
          for (const sm of robotSitemaps) {
            candidates.add(sm);
          }
        }
      } catch {
        // Ignore robots fetch errors and fall back to default candidates.
      }

      const discoveredMap = new Map<string, { url: string; priority?: number; changefreq?: string; lastmod?: string; images?: string[] }>();
      const visitedSitemaps = new Set<string>();
      // For large imports, discover ALL sitemap URLs first, then filter during reachability check
      // This ensures we don't miss URLs that appear later in the sitemap
      const discoveryCap = Math.max(maxUrls * 15, 15000);

      const fetchSitemapUrls = async (sitemapUrl: string, depth: number = 0) => {
        if (visitedSitemaps.has(sitemapUrl) || depth > 2 || discoveredMap.size >= discoveryCap) {
          return;
        }
        visitedSitemaps.add(sitemapUrl);
        const xml = await this.safeFetchSitemap(sitemapUrl);
        if (!xml) {
          return;
        }

        const parsed = this.parseSitemap(xml);
        if (parsed.type === 'index') {
          for (const child of parsed.sitemaps.slice(0, 5)) {
            if (discoveredMap.size >= discoveryCap) {
              break;
            }
            await fetchSitemapUrls(child, depth + 1);
          }
        } else {
          for (const entry of parsed.entries) {
            try {
              // Many legacy sitemaps emit relative <loc> entries (e.g., "/home/"); resolve against site origin.
              const u = new URL(entry.url, origin);
              if (u.host === url.host) {
                // Skip asset URLs (images, PDFs, etc.) - they waste expensive LLM tokens
                const fullUrl = u.toString();
                if (isAssetUrl(fullUrl)) {
                  skipped.push({ url: fullUrl, reason: 'asset-url' });
                  continue;
                }
                const key = `${u.host}${u.pathname}`.toLowerCase();
                const candidate = {
                  url: u.toString(),
                  priority: entry.priority,
                  changefreq: entry.changefreq,
                  lastmod: entry.lastmod,
                  images: entry.images,
                };
                const prev = discoveredMap.get(key);
                if (!prev) {
                  discoveredMap.set(key, candidate);
                } else if (this.shouldReplaceCandidate(prev, candidate)) {
                  discoveredMap.set(key, candidate);
                }
                if (discoveredMap.size >= discoveryCap) {
                  break;
                }
              }
            } catch {
              // Ignore malformed URLs and continue processing.
            }
          }
        }
      };

      try {
        const homeHtml = await this.safeFetchText(origin + '/');
        if (homeHtml) {
          const linkMatches = Array.from(homeHtml.matchAll(/<link[^>]+rel=["']sitemap["'][^>]*>/gi));
          for (const match of linkMatches) {
            const tag = match[0];
            const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
            if (!href) {
              continue;
            }
            try {
              const linkUrl = new URL(href, origin).toString();
              candidates.add(linkUrl);
            } catch {
              // Ignore invalid sitemap link references.
            }
          }
        }
      } catch {
        // Ignore homepage fetch failures; fall back to default candidates.
      }

      for (const sm of candidates) {
        if (discoveredMap.size >= discoveryCap) {
          break;
        }
        await fetchSitemapUrls(sm);
      }

      const entries = Array.from(discoveredMap.values());
      const homeUrl = this.selectHomeUrl(entries, origin);

      const sorted = entries.sort((a, b) => this.compareEntries(a.url, b.url, homeUrl));
      const ordered = [homeUrl, ...sorted.map((entry) => entry.url).filter((entryUrl) => entryUrl !== homeUrl)];
      const normalizedUrls = this.normalizeAndDedupeUrls(ordered);
      const { reachable, skipped: skippedUrls } = await this.filterReachableUrls(normalizedUrls, maxUrls);
      skipped.push(...skippedUrls);
      let urls = reachable.slice(0, maxUrls);

      // Inject priority URLs that are missing from discovered results
      if (priorityPaths.length > 0) {
        const { urls: urlsWithPriority, injected } = await this.injectPriorityUrls(
          urls,
          priorityPaths,
          origin,
          maxUrls
        );
        urls = urlsWithPriority;
        injectedPriorityUrls.push(...injected);
      }

      for (const entry of entries) {
        metadataByUrl.set(entry.url, {
          priority: entry.priority,
          changefreq: entry.changefreq,
          lastmod: entry.lastmod,
          images: entry.images,
        });
      }

      if (LoggingConfig.observe) {
        console.log(
          JSON.stringify({
            event: 'sitemap.ordered',
            origin,
            platform: detectedPlatform,
            urlsCount: urls.length,
            homeUrl,
            injectedPriorityUrls: injectedPriorityUrls.length,
          }),
        );
      }

      if (urls.length === 0) {
        return { urls: [inputUrl], sitemapMetaByUrl: metadataByUrl, detectedPlatform, skipped, injectedPriorityUrls };
      }

      return { urls, sitemapMetaByUrl: metadataByUrl, detectedPlatform, skipped, injectedPriorityUrls };
    } catch {
      return { urls: [inputUrl], sitemapMetaByUrl: metadataByUrl, detectedPlatform, skipped: [] };
    }
  }

  private buildInitialCandidateSet(origin: string, detectedPlatform: string | null): Set<string> {
    const candidates = new Set<string>([
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/wp-sitemap.xml`,
      `${origin}/page-sitemap.xml`,
      `${origin}/post-sitemap.xml`,
      `${origin}/product-sitemap.xml`,
      `${origin}/category-sitemap.xml`,
      `${origin}/news-sitemap.xml`,
      `${origin}/sitemap-news.xml`,
    ]);

    const commonLangs = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'ja', 'zh'];
    commonLangs.forEach((lang) => candidates.add(`${origin}/${lang}/sitemap.xml`));

    const platform = (detectedPlatform || '').toLowerCase();
    if (platform === 'wordpress') {
      candidates.add(`${origin}/wp-sitemap.xml`);
      candidates.add(`${origin}/sitemap_index.xml`);
    }
    if (platform === 'shopify') {
      candidates.add(`${origin}/sitemap.xml`);
      candidates.add(`${origin}/sitemap_products_1.xml`);
      candidates.add(`${origin}/sitemap_pages.xml`);
      candidates.add(`${origin}/sitemap_blogs.xml`);
      candidates.add(`${origin}/sitemap_articles.xml`);
      candidates.add(`${origin}/sitemap_collections_1.xml`);
    }
    if (platform === 'generic' || platform === 'headless') {
      candidates.add(`${origin}/sitemap-index.xml`);
    }

    return candidates;
  }

  private shouldReplaceCandidate(
    previous: { url: string; priority?: number; lastmod?: string },
    candidate: { url: string; priority?: number; lastmod?: string },
  ): boolean {
    const prevIsHttp = previous.url.startsWith('http://');
    const candIsHttps = candidate.url.startsWith('https://');
    const prevPriority = previous.priority ?? 0;
    const candidatePriority = candidate.priority ?? 0;
    const prevLastmod = previous.lastmod ? Date.parse(previous.lastmod) : 0;
    const candidateLastmod = candidate.lastmod ? Date.parse(candidate.lastmod) : 0;

    return (candIsHttps && prevIsHttp) || candidatePriority > prevPriority || candidateLastmod > prevLastmod;
  }

  private compareEntries(aUrl: string, bUrl: string, homeUrl: string): number {
    if (aUrl === homeUrl) {
      return -1;
    }
    if (bUrl === homeUrl) {
      return 1;
    }
    const depth = (value: string) => {
      try {
        const parsed = new URL(value);
        return parsed.pathname.split('/').filter(Boolean).length;
      } catch {
        return 0;
      }
    };
    const aDepth = depth(aUrl);
    const bDepth = depth(bUrl);
    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }
    return aUrl.localeCompare(bUrl);
  }

  private normalizeAndDedupeUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const decodedPath = decodeURIComponent(parsed.pathname);
        const normalizedUrl = `${parsed.protocol}//${parsed.host}${decodedPath}${parsed.search}`;
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl);
          normalized.push(normalizedUrl);
        }
      } catch {
        // Ignore invalid/undecodable URLs.
      }
    }

    return normalized;
  }

  private async filterReachableUrls(urls: string[], maxUrls: number): Promise<{ reachable: string[]; skipped: Array<{ url: string; reason: string }> }> {
    const reachable: string[] = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    // FAST MODE: Skip reachability checks for large imports (set IMPORT_SKIP_REACHABILITY=1)
    const skipReachability = process.env.IMPORT_SKIP_REACHABILITY === '1' || process.env.IMPORT_SKIP_REACHABILITY === 'true';
    if (skipReachability) {
      console.log('[DISCOVERY] Fast mode: skipping reachability checks');
      for (const url of urls) {
        if (this.isLikelyPrivate(url)) {
          skipped.push({ url, reason: 'private-path' });
          continue;
        }
        // Even in fast mode, skip asset URLs to avoid wasting LLM tokens
        if (isAssetUrl(url)) {
          skipped.push({ url, reason: 'asset-url' });
          continue;
        }
        reachable.push(url);
        if (reachable.length >= maxUrls) {
          break;
        }
      }
      return { reachable, skipped };
    }

    // Standard mode: check reachability (slow for large sitemaps)
    let checked = 0;
    const total = Math.min(urls.length, maxUrls * 2); // Estimate
    for (const url of urls) {
      if (this.isLikelyPrivate(url)) {
        skipped.push({ url, reason: 'private-path' });
        continue;
      }
      checked++;
      if (checked % 100 === 0) {
        console.log(`[DISCOVERY] Checking reachability: ${checked}/${total} URLs...`);
      }
      const reachability = await this.isReachable(url);
      if (reachability.ok) {
        reachable.push(url);
      } else {
        skipped.push({ url, reason: reachability.reason ?? 'unreachable' });
      }
      if (reachable.length >= maxUrls) {
        break;
      }
    }

    return { reachable, skipped };
  }

  /**
   * Inject priority URLs that are missing from the discovered results.
   * Priority URLs are added at the beginning (after home page) to ensure they're processed first.
   */
  private async injectPriorityUrls(
    existingUrls: string[],
    priorityPaths: string[],
    origin: string,
    maxUrls: number
  ): Promise<{ urls: string[]; injected: string[] }> {
    const injected: string[] = [];
    const existingPathsLower = new Set(
      existingUrls.map(u => {
        try {
          return new URL(u).pathname.toLowerCase().replace(/\/$/, '');
        } catch {
          return '';
        }
      })
    );

    const skipReachability = process.env.IMPORT_SKIP_REACHABILITY === '1' || process.env.IMPORT_SKIP_REACHABILITY === 'true';

    for (const priorityPath of priorityPaths) {
      // Normalize priority path
      let normalizedPath: string;
      try {
        if (priorityPath.startsWith('http://') || priorityPath.startsWith('https://')) {
          normalizedPath = new URL(priorityPath).pathname.toLowerCase().replace(/\/$/, '');
        } else {
          normalizedPath = priorityPath.toLowerCase().replace(/\/$/, '');
          if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
          }
        }
      } catch {
        normalizedPath = priorityPath.toLowerCase().replace(/\/$/, '');
      }

      // Check if already in discovered URLs
      if (existingPathsLower.has(normalizedPath)) {
        continue;
      }

      // Build full URL
      const fullUrl = `${origin}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;

      // Skip private URLs
      if (this.isLikelyPrivate(fullUrl)) {
        console.log(`[DISCOVERY] Skipping private priority URL: ${fullUrl}`);
        continue;
      }

      // Verify reachability (unless in fast mode)
      if (!skipReachability) {
        const reachability = await this.isReachable(fullUrl);
        if (!reachability.ok) {
          console.log(`[DISCOVERY] Priority URL not reachable: ${fullUrl} (${reachability.reason})`);
          continue;
        }
      }

      injected.push(fullUrl);
      existingPathsLower.add(normalizedPath);
      console.log(`[DISCOVERY] Injected priority URL: ${fullUrl}`);
    }

    if (injected.length === 0) {
      return { urls: existingUrls, injected };
    }

    // Insert injected URLs after home page (position 1) to prioritize them
    const result = [...existingUrls];
    // Find insert position (after home page if present)
    const insertPosition = result.length > 0 ? 1 : 0;
    result.splice(insertPosition, 0, ...injected);

    // Trim to maxUrls if needed
    return { urls: result.slice(0, maxUrls), injected };
  }

  private isLikelyPrivate(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      return path.includes('/intranet/') || path.includes('/picu_intranet/');
    } catch {
      return false;
    }
  }

  private async isReachable(url: string, timeoutMs: number = 5000): Promise<{ ok: boolean; reason?: string }> {
    try {
      // Fast check: Skip asset URLs by extension before making network request
      if (isAssetUrl(url)) {
        return { ok: false, reason: 'asset-url' };
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
      const response = await fetch(url, { method: 'GET' as any, redirect: 'follow' as any, signal: controller?.signal as any });
      if (timeoutId) {
        clearTimeout(timeoutId as any);
      }
      const status = response.status;
      if (!(status >= 200 && status < 400)) {
        return { ok: false, reason: `http-${status}` };
      }

      // Check content-type to filter non-HTML responses (images, PDFs, etc.)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return { ok: false, reason: `non-html:${contentType.split(';')[0].trim()}` };
      }

      // Detect soft-404 pages that return 200 but render "Page not found"
      const body = await this.readBodySample(response, 12_000);
      const isSoft404 = this.containsSoft404Signature(body);
      if (isSoft404) {
        return { ok: false, reason: 'soft-404' };
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = /timeout/i.test(message) ? 'timeout' : 'unreachable';
      return { ok: false, reason };
    }
  }

  private containsSoft404Signature(body: string): boolean {
    if (!body) return false;
    const normalized = body.toLowerCase();
    const HARD_INDICATORS = [
      'page not found',
      'error: 404',
      'resource you are looking for could have been removed'
    ];

    return HARD_INDICATORS.some((marker) => normalized.includes(marker));
  }

  private async readBodySample(response: Response, maxBytes: number): Promise<string> {
    try {
      const reader = response.body?.getReader();
      if (!reader) {
        return await response.text();
      }
      let received = 0;
      const chunks: Uint8Array[] = [];
      while (received < maxBytes) {
        const result = await reader.read();
        if (result.done) break;
        received += result.value.length;
        chunks.push(result.value);
        if (received >= maxBytes) {
          break;
        }
      }
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(Buffer.concat(chunks));
    } catch {
      return '';
    }
  }

  private selectHomeUrl(entries: Array<{ url: string; priority?: number; lastmod?: string; changefreq?: string }>, origin: string): string {
    const originRoot = `${origin}/`;
    const rootEntry = entries.find((entry) => {
      try {
        const parsed = new URL(entry.url);
        return parsed.origin === origin && (parsed.pathname === '/' || parsed.pathname === '');
      } catch {
        return false;
      }
    });
    const priorityHome = entries.find((entry) => (entry.priority ?? 0) >= 1 && entry.url.startsWith(originRoot));
    // Always prefer the origin root to ensure homepage capture.
    return originRoot || priorityHome?.url || rootEntry?.url || `${origin}/`;
  }

  private async detectPlatform(origin: string): Promise<string> {
    try {
      const response = await fetch(origin, { method: 'GET' as any });
      const headers = response.headers;
      const html = await response.text();
      const getHeader = (name: string) => (headers.get(name) || '').toLowerCase();
      const includes = (value: string) => html.toLowerCase().includes(value);

      if (includes('/wp-content/') || includes('wp-json') || includes('generator" content="wordpress') || getHeader('x-powered-by').includes('wordpress')) {
        return 'wordpress';
      }
      if (getHeader('x-shopify-stage') || includes('cdn.shopify.com') || includes('shopify.theme')) {
        return 'shopify';
      }
      if (getHeader('x-wix-request-id') || includes('wix.com') || includes('wix-')) {
        return 'wix';
      }
      if (includes('squarespace.com') || includes('generator" content="squarespace')) {
        return 'squarespace';
      }
      return 'generic';
    } catch {
      return 'generic';
    }
  }

  private async safeFetchSitemap(url: string, timeoutMs: number = 10000): Promise<string | null> {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
      const response = await fetch(url, { signal: controller?.signal as any });
      if (timeoutId) {
        clearTimeout(timeoutId as any);
      }
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get('content-type') || '';
      if (url.endsWith('.gz') || contentType.includes('application/x-gzip') || contentType.includes('gzip')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const gunzipped = zlib.gunzipSync(buffer);
        return gunzipped.toString('utf-8');
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  private async safeFetchText(url: string, timeoutMs: number = 8000): Promise<string | null> {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
      const response = await fetch(url, { signal: controller?.signal as any });
      if (timeoutId) {
        clearTimeout(timeoutId as any);
      }
      if (!response.ok) {
        return null;
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  private extractSitemapsFromRobots(robotsTxt: string): string[] {
    const sitemaps: string[] = [];
    robotsTxt.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
      if (match) {
        sitemaps.push(match[1].trim());
      }
    });
    return sitemaps;
  }

  private extractUrlsFromSitemap(xml: string): string[] {
    const urls: string[] = [];
    const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  }

  private parseSitemap(
    xml: string,
  ): { type: 'index'; sitemaps: string[] } | { type: 'urlset'; entries: Array<{ url: string; priority?: number; changefreq?: string; lastmod?: string; images?: string[] }> } {
    try {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const obj = parser.parse(xml);
      if (obj.sitemapindex || obj['sitemapindex']) {
        const idx = obj.sitemapindex || obj['sitemapindex'];
        const sitemapsRaw = idx.sitemap || idx['sitemap'] || [];
        const arr = Array.isArray(sitemapsRaw) ? sitemapsRaw : [sitemapsRaw];
        const links: string[] = [];
        for (const s of arr) {
          const loc = s.loc || s['loc'];
          if (typeof loc === 'string') {
            links.push(loc.trim());
          }
        }
        return { type: 'index', sitemaps: links };
      }
      const urlset = obj.urlset || obj['urlset'] || null;
      if (urlset) {
        const urlsRaw = urlset.url || urlset['url'] || [];
        const arr = Array.isArray(urlsRaw) ? urlsRaw : [urlsRaw];
        const entries = arr
          .map((u: any) => {
            const loc = (u.loc || u['loc'] || '').trim();
            const pr = parseFloat(u.priority || u['priority'] || '');
            const priority = Number.isFinite(pr) ? pr : undefined;
            const changefreq = (u.changefreq || u['changefreq']) as string | undefined;
            const lastmod = (u.lastmod || u['lastmod']) as string | undefined;
            const images: string[] = [];
            const imgdata = u['image:image'] || u['image'] || [];
            const imgArr = Array.isArray(imgdata) ? imgdata : [imgdata];
            for (const im of imgArr) {
              const locValue = im && (im['image:loc'] || im['loc']);
              if (typeof locValue === 'string') {
                images.push(locValue.trim());
              }
            }
            return { url: loc, priority, changefreq, lastmod, images };
          })
          .filter((entry: any) => !!entry.url);
        return { type: 'urlset', entries };
      }
      const locs = this.extractUrlsFromSitemap(xml);
      return { type: 'urlset', entries: locs.map((loc) => ({ url: loc })) };
    } catch {
      const locs = this.extractUrlsFromSitemap(xml);
      return { type: 'urlset', entries: locs.map((loc) => ({ url: loc })) };
    }
  }

  /**
   * Expand URLs from a subsection page by crawling links within the same section.
   * This enables importing entire site sections (e.g., /advancecareplanning/) without
   * requiring a full sitemap or starting from the root URL.
   */
  private async expandUrlsFromSubsection(inputUrl: string, maxUrls: number): Promise<ExpandedImportUrls> {
    const metadataByUrl = new Map<string, SitemapMetadata>();
    const skipped: Array<{ url: string; reason: string }> = [];

    try {
      const baseUrl = new URL(inputUrl);
      const origin = `${baseUrl.protocol}//${baseUrl.host}`;
      const basePath = baseUrl.pathname.replace(/\/$/, ''); // Remove trailing slash

      if (LoggingConfig.observe) {
        console.log(JSON.stringify({ event: 'subsection.crawl.start', inputUrl, basePath }));
      }

      // Fetch the starting page and extract links
      const html = await this.safeFetchText(inputUrl);
      if (!html) {
        return { urls: [inputUrl], sitemapMetaByUrl: metadataByUrl, detectedPlatform: null, skipped };
      }

      // Extract all links from the page
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      const discovered = new Set<string>([inputUrl]);
      const queue: string[] = [inputUrl];
      const visited = new Set<string>([inputUrl]);

      // First pass: collect links from starting page
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        try {
          const linkUrl = new URL(href, origin);
          // Only include links that:
          // 1. Are on the same host
          // 2. Start with the same base path (stay within the section)
          // 3. Are not anchors or query-only links
          if (
            linkUrl.host === baseUrl.host &&
            linkUrl.pathname.startsWith(basePath) &&
            !linkUrl.hash &&
            linkUrl.pathname !== basePath &&
            linkUrl.pathname !== basePath + '/'
          ) {
            const normalizedUrl = `${linkUrl.protocol}//${linkUrl.host}${linkUrl.pathname}`;
            // Skip asset URLs (images, PDFs, etc.)
            if (isAssetUrl(normalizedUrl)) {
              continue;
            }
            if (!discovered.has(normalizedUrl)) {
              discovered.add(normalizedUrl);
              queue.push(normalizedUrl);
            }
          }
        } catch {
          // Ignore invalid URLs
        }
      }

      // Also check for links in "In this section" navigation (common pattern)
      // These are often in <nav> or <aside> elements with class containing "section"
      const sectionNavRegex = /<(?:nav|aside|div)[^>]*(?:class|id)=["'][^"']*(?:section|sidebar|subnav|submenu)[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|aside|div)>/gi;
      let navMatch: RegExpExecArray | null;
      while ((navMatch = sectionNavRegex.exec(html)) !== null) {
        const navContent = navMatch[1];
        const navLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
        let navLinkMatch: RegExpExecArray | null;
        while ((navLinkMatch = navLinkRegex.exec(navContent)) !== null) {
          const href = navLinkMatch[1];
          try {
            const linkUrl = new URL(href, origin);
            if (linkUrl.host === baseUrl.host) {
              const normalizedUrl = `${linkUrl.protocol}//${linkUrl.host}${linkUrl.pathname}`;
              // Skip asset URLs (images, PDFs, etc.)
              if (isAssetUrl(normalizedUrl)) {
                continue;
              }
              if (!discovered.has(normalizedUrl)) {
                discovered.add(normalizedUrl);
                queue.push(normalizedUrl);
              }
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      }

      // BFS crawl up to maxUrls pages within the section
      while (queue.length > 0 && discovered.size < maxUrls * 2) {
        const currentUrl = queue.shift()!;
        if (visited.has(currentUrl) && currentUrl !== inputUrl) {
          continue;
        }
        visited.add(currentUrl);

        // Don't fetch more pages if we have enough URLs
        if (discovered.size >= maxUrls * 2) {
          break;
        }

        // Fetch and parse additional pages (skip the first one, already done)
        if (currentUrl !== inputUrl) {
          const pageHtml = await this.safeFetchText(currentUrl);
          if (pageHtml) {
            const pageLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
            let pageMatch: RegExpExecArray | null;
            while ((pageMatch = pageLinkRegex.exec(pageHtml)) !== null) {
              const href = pageMatch[1];
              try {
                const linkUrl = new URL(href, origin);
                // Be more permissive on subsequent pages - include links that share
                // the same origin and appear to be related content
                const linkPath = linkUrl.pathname;
                const isRelated =
                  linkUrl.host === baseUrl.host &&
                  (linkPath.startsWith(basePath) ||
                   // Also include paths that share a common parent
                   this.shareCommonParent(basePath, linkPath));

                if (isRelated && !linkUrl.hash) {
                  const normalizedUrl = `${linkUrl.protocol}//${linkUrl.host}${linkUrl.pathname}`;
                  // Skip asset URLs (images, PDFs, etc.)
                  if (isAssetUrl(normalizedUrl)) {
                    continue;
                  }
                  if (!discovered.has(normalizedUrl) && !visited.has(normalizedUrl)) {
                    discovered.add(normalizedUrl);
                    queue.push(normalizedUrl);
                  }
                }
              } catch {
                // Ignore invalid URLs
              }
            }
          }
        }
      }

      // Convert to array and filter reachable URLs
      const urlList = Array.from(discovered);
      const { reachable, skipped: skippedUrls } = await this.filterReachableUrls(urlList, maxUrls);
      skipped.push(...skippedUrls);

      // Sort with input URL first, then by path depth
      const sorted = reachable.sort((a, b) => {
        if (a === inputUrl) return -1;
        if (b === inputUrl) return 1;
        return this.compareEntries(a, b, inputUrl);
      });

      const urls = sorted.slice(0, maxUrls);

      if (LoggingConfig.observe) {
        console.log(JSON.stringify({
          event: 'subsection.crawl.complete',
          inputUrl,
          discovered: discovered.size,
          reachable: reachable.length,
          returned: urls.length
        }));
      }

      return { urls, sitemapMetaByUrl: metadataByUrl, detectedPlatform: null, skipped };
    } catch (error) {
      if (LoggingConfig.observe) {
        console.log(JSON.stringify({ event: 'subsection.crawl.error', inputUrl, error: String(error) }));
      }
      return { urls: [inputUrl], sitemapMetaByUrl: metadataByUrl, detectedPlatform: null, skipped };
    }
  }

  /**
   * Check if two paths share a common parent (e.g., /advance-care-planning/policy/
   * shares parent with /advance-care-planning/framework/)
   */
  private shareCommonParent(path1: string, path2: string): boolean {
    const segments1 = path1.split('/').filter(Boolean);
    const segments2 = path2.split('/').filter(Boolean);

    if (segments1.length === 0 || segments2.length === 0) {
      return false;
    }

    // Check if they share the first segment (e.g., both under /advancecareplanning/)
    // Also check for hyphenated/underscore variants (advancecareplanning vs advance-care-planning)
    const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, '');
    return normalize(segments1[0]) === normalize(segments2[0]);
  }

  // =============================================================================
  // New: Multi-URL Crawl Methods (Import Planner Support)
  // =============================================================================

  /**
   * Expand URLs by crawling from multiple starting points.
   * Uses BFS with configurable link scope and early termination.
   *
   * @param startUrls - Starting URLs for the crawl
   * @param options - Crawl configuration options
   * @returns Discovered URLs and metadata
   */
  async expandUrlsFromCrawl(
    startUrls: string[],
    options: CrawlOptions
  ): Promise<ExpandedImportUrls> {
    const { maxUrls, followLinks, linkScope } = options;
    const visited = options.visited ?? new Set<string>();
    const discovered = new Map<string, string>(); // normalized → original
    const queue: string[] = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    // Normalize and dedupe start URLs
    for (const url of startUrls) {
      const normalized = this.normalizeUrlForDedup(url);
      if (!visited.has(normalized) && !discovered.has(normalized)) {
        // Skip asset URLs early
        if (isAssetUrl(url)) {
          skipped.push({ url, reason: 'asset-url' });
          continue;
        }
        discovered.set(normalized, url);
        queue.push(url);
      }
    }

    if (LoggingConfig.observe) {
      console.log(JSON.stringify({
        event: 'crawl.start',
        startUrls: startUrls.length,
        followLinks,
        linkScope,
        maxUrls
      }));
    }

    // BFS crawl
    while (queue.length > 0 && discovered.size < maxUrls) {
      const currentUrl = queue.shift()!;
      const currentNormalized = this.normalizeUrlForDedup(currentUrl);

      // Mark as visited
      visited.add(currentNormalized);

      // Skip link extraction if not following links
      if (!followLinks || linkScope === 'none') {
        continue;
      }

      // Don't fetch more pages if we have enough URLs
      if (discovered.size >= maxUrls) {
        break;
      }

      // Fetch page and extract links
      try {
        const html = await this.safeFetchText(currentUrl);
        if (!html) continue;

        const links = this.extractLinksFromHtml(html, currentUrl);

        for (const linkUrl of links) {
          // Check if we've hit the limit
          if (discovered.size >= maxUrls) break;

          const linkNormalized = this.normalizeUrlForDedup(linkUrl);

          // Skip if already discovered or visited
          if (discovered.has(linkNormalized) || visited.has(linkNormalized)) {
            continue;
          }

          // Skip asset URLs
          if (isAssetUrl(linkUrl)) {
            continue;
          }

          // Check scope
          if (!this.linkMatchesScope(linkUrl, currentUrl, linkScope)) {
            continue;
          }

          // Add to discovered and queue
          discovered.set(linkNormalized, linkUrl);
          queue.push(linkUrl);
        }
      } catch (error) {
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({
            event: 'crawl.page.error',
            url: currentUrl,
            error: String(error)
          }));
        }
      }
    }

    // Convert discovered map to URL array
    const urls = Array.from(discovered.values()).slice(0, maxUrls);

    // Filter reachability
    const { reachable, skipped: reachabilitySkipped } = await this.filterReachableUrls(urls, maxUrls);
    skipped.push(...reachabilitySkipped);

    if (LoggingConfig.observe) {
      console.log(JSON.stringify({
        event: 'crawl.complete',
        discovered: discovered.size,
        reachable: reachable.length,
        skipped: skipped.length
      }));
    }

    return {
      urls: reachable,
      sitemapMetaByUrl: new Map(),
      detectedPlatform: null,
      skipped
    };
  }

  /**
   * Extract all same-domain links from HTML content.
   */
  private extractLinksFromHtml(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const hrefRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;

    try {
      const base = new URL(baseUrl);
      let match: RegExpExecArray | null;

      while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1].trim();

        // Skip empty, javascript:, mailto:, tel: links
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }

        try {
          const linkUrl = new URL(href, baseUrl);

          // Only include same-host links
          if (linkUrl.host === base.host) {
            links.push(linkUrl.href);
          }
        } catch {
          // Skip invalid URLs
        }
      }
    } catch {
      // Base URL invalid
    }

    return [...new Set(links)]; // Dedupe
  }

  /**
   * Check if a link matches the specified scope relative to the current URL.
   */
  private linkMatchesScope(
    linkUrl: string,
    currentUrl: string,
    scope: 'same_path' | 'same_domain' | 'none'
  ): boolean {
    if (scope === 'none') return false;

    try {
      const link = new URL(linkUrl);
      const current = new URL(currentUrl);

      // Must be same host for any scope
      if (link.host !== current.host) return false;

      if (scope === 'same_domain') {
        // Any path on same domain is valid
        return true;
      }

      if (scope === 'same_path') {
        // Link must start with current path (excluding trailing slash)
        const basePath = current.pathname.replace(/\/$/, '');
        const linkPath = link.pathname.replace(/\/$/, '');

        // Handle root path case
        if (basePath === '' || basePath === '/') {
          return true; // All paths match root
        }

        return linkPath.startsWith(basePath);
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Normalize a URL for deduplication purposes.
   * - Removes trailing slashes
   * - Lowercases host
   * - Removes fragments
   * - Preserves query strings (they may be significant)
   */
  private normalizeUrlForDedup(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove fragment
      parsed.hash = '';
      // Normalize path (remove trailing slash except for root)
      if (parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.replace(/\/$/, '');
      }
      // Lowercase host
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}`;
    } catch {
      // If URL is invalid, return as-is
      return url.toLowerCase().replace(/\/$/, '');
    }
  }
}
