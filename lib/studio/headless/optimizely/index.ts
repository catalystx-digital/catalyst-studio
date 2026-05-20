/**
 * Optimizely headless integration exports
 */

export { OptimizelyGraphqlClient, type OptimizelyGraphqlClientOptions } from './graphql-client'
export { DISCOVER_PAGES_QUERY, PAGE_BY_ID_QUERY, PAGE_BY_PATH_QUERY, PAGE_WITH_CONTENT_QUERY } from './queries'
export {
  OptimizelySnapshotBuilder,
  buildOptimelySiteSnapshot,
  type BuildOptimizelySnapshotOptions,
  type OptimizelySnapshotOptions
} from './snapshot-builder'
export {
  OptimizelyPageResolver,
  resolveOptimizelyPageBySlug,
  type OptimizelyPageResolverOptions,
  type ResolvedPage
} from './page-resolver'
