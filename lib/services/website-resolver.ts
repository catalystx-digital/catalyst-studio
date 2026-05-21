import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface WebsiteResolutionStrategy {
  type: 'domain' | 'subdomain' | 'path' | 'header' | 'test';
  resolve: (request: WebsiteResolverRequest) => Promise<string | null>;
}

export interface WebsiteResolverRequest {
  host?: string;
  path?: string;
  headers?: Headers;
}

function normalizeHost(host?: string): string | null {
  if (!host) return null;
  return host.split(':')[0]?.toLowerCase() ?? null;
}

function resolveFromJsonMap(value: string | null, envName: string): string | null {
  if (!value) return null;
  const raw = process.env[envName];
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[value] ?? null;
  } catch {
    console.error(`Invalid ${envName}; expected a JSON object mapping host/path keys to website IDs`);
    return null;
  }
}

async function activeWebsiteId(websiteId: string | null): Promise<string | null> {
  if (!websiteId) return null;

  const website = await (prisma as any).website.findFirst({
    where: { id: websiteId, isActive: true },
    select: { id: true },
  });

  return website?.id ?? null;
}

/**
 * Resolves website ID from various sources
 * Supports multiple strategies for multi-tenant resolution
 */
export class WebsiteResolver {
  private strategies: Map<string, WebsiteResolutionStrategy> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies() {
    // Domain-based resolution (production)
    this.strategies.set('domain', {
      type: 'domain',
      resolve: async (req) => {
        const host = normalizeHost(req.host);
        return activeWebsiteId(resolveFromJsonMap(host, 'WEBSITE_DOMAIN_MAP'));
      }
    });

    // Subdomain-based resolution
    this.strategies.set('subdomain', {
      type: 'subdomain',
      resolve: async (req) => {
        const host = normalizeHost(req.host);
        if (!host) return null;

        // Extract subdomain (e.g., 'client1' from 'client1.example.com')
        const subdomain = host.split('.')[0];
        if (!subdomain || subdomain === 'www') return null;

        return activeWebsiteId(resolveFromJsonMap(subdomain, 'WEBSITE_SUBDOMAIN_MAP'));
      }
    });

    // Path-based resolution (e.g., /site/website-slug/...)
    this.strategies.set('path', {
      type: 'path',
      resolve: async (req) => {
        if (!req.path) return null;
        
        const segments = req.path.split('/').filter(Boolean);
        if (segments[0] !== 'site' || !segments[1]) return null;
        
        const websiteId = segments[1];
        return activeWebsiteId(websiteId);
      }
    });

    // Header-based resolution (for APIs)
    this.strategies.set('header', {
      type: 'header',
      resolve: async (req) => {
        const websiteId = req.headers?.get('x-website-id');
        if (!websiteId) return null;
        
        // Verify website exists
        const website = await (prisma as any).website.findUnique({
          where: { id: websiteId }
        });
        
        return website?.id || null;
      }
    });

    // Test/development resolution
    this.strategies.set('test', {
      type: 'test',
      resolve: async () => {
        // For testing/development only
        return process.env.TEST_WEBSITE_ID || null;
      }
    });
  }

  /**
   * Resolves website ID using configured strategy
   */
  async resolve(request: WebsiteResolverRequest): Promise<string | null> {
    // Get resolution strategy from environment
    const strategyName = process.env.WEBSITE_RESOLUTION_STRATEGY || 'test';
    
    // In production, try multiple strategies in order
    if (strategyName === 'auto') {
      const strategies = ['domain', 'subdomain', 'path', 'header', 'test'];
      
      for (const name of strategies) {
        const strategy = this.strategies.get(name);
        if (strategy) {
          const result = await strategy.resolve(request);
          if (result) return result;
        }
      }
      
      return null;
    }
    
    // Use specific strategy
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      console.error(`Unknown website resolution strategy: ${strategyName}`);
      return null;
    }
    
    return strategy.resolve(request);
  }

  /**
   * Resolves website ID from Next.js request context
   */
  async resolveFromContext(): Promise<string | null> {
    const headersList = await headers();
    const host = headersList.get('host') || undefined;
    const referer = headersList.get('referer');
    
    // Extract path from referer if available
    let path: string | undefined;
    if (referer) {
      try {
        const url = new URL(referer);
        path = url.pathname;
      } catch {}
    }
    
    return this.resolve({
      host,
      path,
      headers: headersList
    });
  }
}

export const websiteResolver = new WebsiteResolver();
