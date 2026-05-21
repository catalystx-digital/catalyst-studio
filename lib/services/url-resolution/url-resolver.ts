import { prisma } from '@/lib/prisma';
import { WebsiteStructure as SiteStructure, WebsitePage as ContentItem } from '@/lib/generated/prisma';
import { ErrorCode, StandardResponse } from '@/lib/services/types';

export interface ResolvedPage {
  siteStructure: SiteStructure;
  contentItem: ContentItem | null;
}

export interface UrlResolverOptions {
  caseInsensitive?: boolean;
  websiteId: string;
}

class UrlResolverCache {
  private cache: Map<string, ResolvedPage | null>;
  private maxSize: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): ResolvedPage | null | undefined {
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return result;
  }

  set(key: string, value: ResolvedPage | null): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }
}

export class UrlResolver {
  private cache: UrlResolverCache;
  private pathValidationRegex = /^[a-zA-Z0-9\-\/]*$/;
  private maxPathLength = 2000;

  constructor() {
    this.cache = new UrlResolverCache();
  }

  private normalizePath(path: string): string {
    // Remove query params and hash
    let normalizedPath = path.split('?')[0].split('#')[0];
    
    // Handle root path
    if (normalizedPath === '' || normalizedPath === '/') {
      return '/';
    }

    // Remove duplicate slashes
    normalizedPath = normalizedPath.replace(/\/+/g, '/');
    
    // Remove trailing slash for non-root paths
    if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Ensure path starts with /
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    
    return normalizedPath;
  }

  private validatePath(path: string): { valid: boolean; error?: string } {
    // Check for path traversal attempts
    if (path.includes('..') || path.includes('./') || path.includes('/.')) {
      return { valid: false, error: 'Path traversal detected' };
    }

    // Check for encoded path traversal
    const decodedPath = decodeURIComponent(path);
    if (decodedPath !== path && (decodedPath.includes('..') || decodedPath.includes('./'))) {
      return { valid: false, error: 'Encoded path traversal detected' };
    }

    // Check path length
    if (path.length > this.maxPathLength) {
      return { valid: false, error: `Path exceeds maximum length of ${this.maxPathLength}` };
    }

    // Check for valid characters
    if (!this.pathValidationRegex.test(path)) {
      return { valid: false, error: 'Path contains invalid characters' };
    }

    // Check for null bytes
    if (path.includes('\0')) {
      return { valid: false, error: 'Path contains null bytes' };
    }

    return { valid: true };
  }

  async resolveUrl(
    path: string, 
    options: UrlResolverOptions
  ): Promise<StandardResponse<ResolvedPage | null>> {
    const startTime = Date.now();

    try {
      // Validate path
      const validation = this.validatePath(path);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: validation.error || 'Invalid path',
            details: { path }
          }
        };
      }

      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Check cache
      const cacheKey = `${options.websiteId}:${normalizedPath}:${options.caseInsensitive}`;
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        const duration = Date.now() - startTime;
        console.log(`URL resolved from cache in ${duration}ms: ${normalizedPath}`);
        return { success: true, data: cached };
      }

      // Query database with case sensitivity option
      let siteStructure: (SiteStructure & { websitePage: ContentItem | null }) | null = null;

      if (options.caseInsensitive) {
        siteStructure = await prisma.websiteStructure.findFirst({
          where: {
            websiteId: options.websiteId,
            fullPath: {
              equals: normalizedPath,
              mode: 'insensitive'
            }
          },
          include: {
            websitePage: true
          }
        });
      } else {
        siteStructure = await prisma.websiteStructure.findFirst({
          where: {
            websiteId: options.websiteId,
            fullPath: normalizedPath
          },
          include: {
            websitePage: true
          }
        });
      }

      // Cache the result (including null for 404s)
      const metadata = siteStructure?.websitePage?.metadata;
      const isImportDraft =
        metadata &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata) &&
        (metadata as Record<string, unknown>).isImportDraft === true;
      const result = siteStructure && !isImportDraft ? {
        siteStructure: siteStructure,
        contentItem: siteStructure.websitePage
      } : null;

      this.cache.set(cacheKey, result);

      const duration = Date.now() - startTime;
      console.log(`URL resolved in ${duration}ms: ${normalizedPath} - Found: ${!!result}`);

      return { success: true, data: result };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`URL resolution failed in ${duration}ms:`, error);
      
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to resolve URL',
          details: { path, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}

// Singleton instance
export const urlResolver = new UrlResolver();
