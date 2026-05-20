import type { HeadDataProvider, ProviderFactory } from '../core/provider'
import type { ProviderKind } from '../core/types'
import { createStubProvider } from './stub-provider'
import { createUcsProvider } from './ucs-provider'
import { createOptimizelyProvider } from './optimizely-provider'
import { createStandaloneProvider } from './standalone-provider'
import { createUmbracoComposeProvider } from './umbraco-compose-provider'

const factories: Partial<Record<ProviderKind, ProviderFactory>> = {
  stub: createStubProvider,
  ucs: createUcsProvider,
  optimizely: createOptimizelyProvider,
  standalone: createStandaloneProvider,
  'umbraco-compose': createUmbracoComposeProvider
  // static: createStaticProvider - Reserved for future implementation
}

export function resolveProvider(kind: ProviderKind, context: Parameters<ProviderFactory>[0]): HeadDataProvider {
  const factory = factories[kind]
  if (!factory) {
    if (kind === 'static') {
      throw new Error('The "static" provider is reserved for future implementation. Use "stub" for demo data or "ucs" for database/GraphQL.')
    }
    throw new Error(`Unknown provider: ${kind}`)
  }

  return factory(context)
}

export const supportedProviders = Object.freeze(Object.keys(factories)) as readonly ProviderKind[]
