/**
 * Umbraco Compose Provider Types
 *
 * Type definitions for the Umbraco Compose HeadDataProvider.
 */

/**
 * Configuration for Umbraco Compose GraphQL client.
 */
export interface UmbracoComposeGraphQLConfig {
  /** Project alias (e.g., 'royal-childrens-hospital') */
  projectAlias: string
  /** Region (e.g., 'germanywestcentral') */
  region: string
  /** Environment (default: 'production') */
  environment?: string
  /** Personal Access Token for GraphQL authentication */
  personalAccessToken: string
  /** Collection to query (default: 'pages') */
  collection?: string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Provider options extending GraphQL config with mapping options.
 */
export interface UmbracoComposeProviderOptions extends UmbracoComposeGraphQLConfig {
  /** Map Umbraco type schema aliases to component types */
  componentTypeMap?: Record<string, string>
  /** Map Umbraco page types to template keys */
  templateMap?: Record<string, string>
}

/**
 * Raw content item from Umbraco Compose GraphQL API.
 */
export interface UmbracoContentItem {
  /** Unique content ID (e.g., 'page-home-abc123') */
  id: string
  /** GraphQL typename */
  __typename?: string
  /** Type schema alias (e.g., 'page', 'navbar') */
  type?: string
  /** Content data fields */
  data?: Record<string, unknown>
  /** Direct properties (when data is spread at root) */
  [key: string]: unknown
}

/**
 * GraphQL response with relay-style pagination.
 */
export interface UmbracoGraphQLResponse<T> {
  edges: Array<{
    node: T
    cursor?: string
  }>
  pageInfo?: {
    hasNextPage: boolean
    hasPreviousPage?: boolean
    startCursor?: string
    endCursor?: string
  }
}

/**
 * Type reference structure from GraphQL introspection.
 * Supports recursive unwrapping of NON_NULL, LIST, etc.
 */
export interface TypeRef {
  name: string | null
  kind: string
  ofType?: TypeRef | null
}

/**
 * Schema field information from introspection.
 */
export interface SchemaField {
  name: string
  type: TypeRef
}

/**
 * Schema type information from introspection.
 */
export interface SchemaType {
  name: string
  kind: string
  fields?: SchemaField[]
}

/**
 * Introspection result containing available queries and types.
 */
export interface IntrospectionResult {
  /** Available query fields (collection names) */
  queries: string[]
  /** Available types with their fields */
  types: Record<string, SchemaType>
}

/**
 * Filter options for content queries.
 */
export interface ContentFilter {
  /** Filter by type schema alias */
  type?: string
  /** Filter by ID pattern */
  idPattern?: string
  /** Maximum results to return */
  limit?: number
  /** Cursor for pagination */
  after?: string
}

/**
 * Mapper options for transforming Umbraco content.
 */
export interface MapperOptions {
  /** Map Umbraco type aliases to component types */
  componentTypeMap?: Record<string, string>
  /** Map Umbraco page types to template keys */
  templateMap?: Record<string, string>
  /** Enable debug logging */
  debug?: boolean
}
