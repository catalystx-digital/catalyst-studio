/**
 * Standalone Provider
 *
 * This provider generates a HEAD project that is completely database-independent at BUILD time.
 * It returns a minimal stub snapshot with:
 * - A placeholder site info
 * - Empty pages array (pages are fetched at runtime)
 * - Empty structure (structure is fetched at runtime)
 * - Empty shared components (fetched at runtime)
 * - Default design system (can be overridden at runtime)
 *
 * The generated HEAD works with BOTH UCS (Prisma) and GraphQL providers at RUNTIME.
 * All actual website data is fetched when users visit pages, not during generation.
 *
 * Usage:
 *   pnpm tsx scripts/generate-head/index.ts \
 *     --provider standalone \
 *     --website-id <your-website-id> \
 *     --output ./tmp/head \
 *     --force
 *
 * The websiteId is baked into config.ts and used by runtime providers.
 */

import type { HeadDataProvider, ProviderFactory } from '../core/provider'
import type {
  GeneratorDiagnostic,
  ProviderContextSnapshot,
  SiteSnapshot
} from '../core/types'
import { SHADCN_DEFAULTS } from '@/lib/studio/design-system/shadcn-defaults'

/**
 * Creates a minimal site snapshot that doesn't require any database access.
 * All website-specific data is fetched at runtime by the UCS or GraphQL provider.
 */
function createMinimalSnapshot(websiteId: string): SiteSnapshot {
  return {
    site: {
      id: websiteId,
      name: 'Standalone Site',
      description: 'Generated HEAD - data loaded at runtime',
      origin: undefined
    },
    pages: [],
    structure: [],
    sharedComponents: [],
    redirects: [],
    capturedAt: new Date().toISOString(),
    designSystem: {
      tokens: {
        variables: { ...SHADCN_DEFAULTS },
        extraction: {
          detectedCount: Object.keys(SHADCN_DEFAULTS).length,
          confidence: 1,
          source: 'standalone-provider-defaults'
        }
      },
      conceptId: undefined,
      conceptName: 'Default Design System'
    }
  }
}

class StandaloneHeadDataProvider implements HeadDataProvider {
  readonly name = 'standalone'
  readonly supportsLiveData = true
  private readonly websiteId: string
  private readonly diagnostics: GeneratorDiagnostic[] = []

  constructor(websiteId: string) {
    this.websiteId = websiteId
  }

  async loadSnapshot(): Promise<ProviderContextSnapshot> {
    const snapshot = createMinimalSnapshot(this.websiteId)

    this.diagnostics.push({
      level: 'info',
      code: 'STANDALONE_PROVIDER_ACTIVE',
      message: 'Using standalone provider - all website data will be fetched at runtime',
      context: { websiteId: this.websiteId }
    })

    return {
      ...snapshot,
      diagnostics: [...this.diagnostics]
    }
  }

  async getDiagnostics(): Promise<GeneratorDiagnostic[]> {
    return [...this.diagnostics]
  }
}

export const createStandaloneProvider: ProviderFactory = context => {
  const websiteId = context.websiteId
  if (!websiteId) {
    throw new Error('The --website-id flag is required when using the standalone provider')
  }

  return new StandaloneHeadDataProvider(websiteId)
}
