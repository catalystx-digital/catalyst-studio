/**
 * Umbraco Compose GraphQL Client
 *
 * Client for reading content from Umbraco Compose's GraphQL API.
 * Uses Personal Access Token (PAT) authentication.
 */

import type {
  ContentFilter,
  IntrospectionResult,
  SchemaField,
  SchemaType,
  TypeRef,
  UmbracoComposeGraphQLConfig,
  UmbracoContentItem,
  UmbracoGraphQLResponse
} from './types'

/**
 * GraphQL client for Umbraco Compose content queries.
 *
 * Endpoint pattern: https://graphql.{region}.umbracocompose.com/{project}/{env}
 */
export class UmbracoComposeGraphQLClient {
  private readonly endpoint: string
  private readonly token: string
  private readonly debug: boolean
  private schemaCache: IntrospectionResult | null = null

  constructor(private readonly config: UmbracoComposeGraphQLConfig) {
    const env = config.environment ?? 'production'
    this.endpoint = `https://graphql.${config.region}.umbracocompose.com/${config.projectAlias}/${env}`
    this.token = config.personalAccessToken
    this.debug = config.debug ?? false
  }

  /**
   * Execute a raw GraphQL query.
   */
  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (this.debug) {
      console.log(`[UmbracoClient] Query:`, query.substring(0, 200))
      if (variables) {
        console.log(`[UmbracoClient] Variables:`, JSON.stringify(variables))
      }
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(
        `Umbraco Compose GraphQL request failed: ${response.status} ${text.substring(0, 500)}`
      )
    }

    let result: { data?: T; errors?: Array<{ message: string }> }
    try {
      result = JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> }
    } catch {
      throw new Error(`Invalid JSON response from Umbraco Compose: ${text.substring(0, 200)}`)
    }

    if (result.errors && result.errors.length > 0) {
      const messages = result.errors.map(e => e.message).join(', ')
      throw new Error(`Umbraco Compose GraphQL errors: ${messages}`)
    }

    if (!result.data) {
      throw new Error('No data returned from Umbraco Compose GraphQL')
    }

    return result.data
  }

  /**
   * Introspect the GraphQL schema to discover available queries and fields.
   */
  async introspectSchema(): Promise<IntrospectionResult> {
    if (this.schemaCache) {
      return this.schemaCache
    }

    if (this.debug) {
      console.log('[UmbracoClient] Introspecting schema...')
    }

    // Get available queries
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType {
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
          types {
            name
            kind
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `

    type IntrospectionResponse = {
      __schema: {
        queryType: {
          fields: SchemaField[]
        }
        types: SchemaType[]
      }
    }

    const data = await this.query<IntrospectionResponse>(introspectionQuery)

    // Extract query names (collection names like 'pages', 'components')
    const queries = data.__schema.queryType.fields
      .map(f => f.name)
      .filter(name => !name.startsWith('__'))

    // Build type map
    const types: Record<string, SchemaType> = {}
    for (const type of data.__schema.types) {
      if (!type.name.startsWith('__')) {
        types[type.name] = type
      }
    }

    this.schemaCache = { queries, types }

    if (this.debug) {
      console.log(`[UmbracoClient] Found ${queries.length} queries:`, queries)
    }

    return this.schemaCache
  }

  /**
   * Get all content items from a collection.
   */
  async getAllContent(collection?: string): Promise<UmbracoContentItem[]> {
    const collectionName = collection ?? this.config.collection ?? 'pages'

    if (this.debug) {
      console.log(`[UmbracoClient] Fetching all content from "${collectionName}"`)
    }

    // First introspect to understand the schema
    const schema = await this.introspectSchema()

    // Check if the collection query exists
    if (!schema.queries.includes(collectionName)) {
      const available = schema.queries.filter(q => !q.startsWith('_')).join(', ')
      throw new Error(
        `Collection "${collectionName}" not found. Available: ${available}`
      )
    }

    // Build dynamic query based on schema
    // We need to discover what fields are available on the Node type
    const nodeFields = await this.discoverNodeFields(collectionName)

    const allItems: UmbracoContentItem[] = []
    let hasNextPage = true
    let cursor: string | undefined = undefined

    while (hasNextPage) {
      const afterClause = cursor ? `, after: "${cursor}"` : ''
      const query = `
        query GetAllContent {
          ${collectionName}(first: 100${afterClause}) {
            edges {
              node {
                ${nodeFields}
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      type QueryResponse = {
        [key: string]: UmbracoGraphQLResponse<UmbracoContentItem>
      }

      const data = await this.query<QueryResponse>(query)
      const response = data[collectionName]

      if (!response || !response.edges) {
        break
      }

      for (const edge of response.edges) {
        allItems.push(edge.node)
      }

      hasNextPage = response.pageInfo?.hasNextPage ?? false
      cursor = response.pageInfo?.endCursor ?? undefined

      if (this.debug) {
        console.log(`[UmbracoClient] Fetched ${response.edges.length} items, hasNextPage: ${hasNextPage}`)
      }
    }

    if (this.debug) {
      console.log(`[UmbracoClient] Total items fetched: ${allItems.length}`)
    }

    return allItems
  }

  /**
   * Get a single content item by ID.
   */
  async getContentById(id: string, collection?: string): Promise<UmbracoContentItem | null> {
    const collectionName = collection ?? this.config.collection ?? 'pages'

    if (this.debug) {
      console.log(`[UmbracoClient] Fetching content by ID: ${id} from "${collectionName}"`)
    }

    // Umbraco Compose uses relay-style nodes, we can query by id
    const nodeFields = await this.discoverNodeFields(collectionName)

    const query = `
      query GetContentById($id: ID!) {
        node(id: $id) {
          ... on Node {
            ${nodeFields}
          }
        }
      }
    `

    type QueryResponse = {
      node: UmbracoContentItem | null
    }

    try {
      const data = await this.query<QueryResponse>(query, { id })
      return data.node
    } catch (error) {
      if (this.debug) {
        console.log(`[UmbracoClient] Failed to fetch by ID, trying filter approach`)
      }

      // Fallback: fetch all and filter
      const allContent = await this.getAllContent(collectionName)
      return allContent.find(item => item.id === id) ?? null
    }
  }

  /**
   * Query content with filtering.
   */
  async queryContent(filter: ContentFilter, collection?: string): Promise<UmbracoContentItem[]> {
    const collectionName = collection ?? this.config.collection ?? 'pages'

    if (this.debug) {
      console.log(`[UmbracoClient] Querying content with filter:`, filter)
    }

    // Fetch all content and apply filters client-side
    // This is a simplification; Umbraco Compose may support server-side filtering
    const allContent = await this.getAllContent(collectionName)

    let filtered = allContent

    if (filter.type) {
      filtered = filtered.filter(item =>
        item.__typename === filter.type ||
        item.type === filter.type ||
        (item.id && item.id.startsWith(`${filter.type}-`))
      )
    }

    if (filter.idPattern) {
      const pattern = new RegExp(filter.idPattern)
      filtered = filtered.filter(item => pattern.test(item.id))
    }

    if (filter.limit && filter.limit > 0) {
      filtered = filtered.slice(0, filter.limit)
    }

    return filtered
  }

  /**
   * Discover available fields on nodes in a collection.
   * Uses deep introspection to build query with type-specific inline fragments.
   *
   * Umbraco Compose GraphQL API spreads content data fields at the node root level,
   * so we need to discover all content type fields via introspection.
   *
   * NOTE: Query complexity is limited (default 15000). We use depth 2 and skip
   * nested object types to stay within limits. For complex nested data, a two-pass
   * approach may be needed (fetch IDs first, then fetch full content per item).
   */
  private async discoverNodeFields(collectionName: string): Promise<string> {
    const schema = await this.introspectSchema()

    // Base fields always present
    const baseFieldsQuery = `
      id
      __typename
    `

    // Find all content types (types that have fields and aren't system types)
    const contentTypes = this.findContentTypes(schema)

    if (this.debug) {
      console.log(`[UmbracoClient] Found ${contentTypes.length} content types:`, contentTypes.map(t => t.name))
    }

    if (contentTypes.length === 0) {
      // Fallback: just return base fields
      return baseFieldsQuery
    }

    // Build inline fragments for each content type
    // Use depth 2 to stay within query complexity limits
    const fragments = contentTypes.map(type => {
      const fieldsQuery = this.buildFieldsQuerySimple(type, schema)
      return `... on ${type.name} {
        ${fieldsQuery}
      }`
    }).join('\n      ')

    return `
      ${baseFieldsQuery}
      ${fragments}
    `
  }

  /**
   * Build a simpler fields query that only includes scalar fields and shallow objects.
   * This keeps query complexity low to stay within Umbraco Compose limits.
   */
  private buildFieldsQuerySimple(type: SchemaType, schema: IntrospectionResult): string {
    if (!type.fields) return 'id'

    // Fields to skip - these come from interfaces but may not be defined in content
    const skipFields = new Set(['variant', 'kind', 'typename', 'cursor', 'edges', 'pageInfo', 'node'])

    const fields: string[] = []

    for (const field of type.fields) {
      // Skip connection/edge fields and internal fields
      if (field.name.startsWith('_')) continue
      if (field.name.endsWith('Connection')) continue
      if (skipFields.has(field.name)) continue

      const fieldTypeName = this.getBaseTypeName(field.type)

      // For scalar fields, just add the field name
      if (this.isScalarType(field.type)) {
        fields.push(field.name)
      }
      // For array of scalars, just add the field name
      else if (this.isListOfScalars(field.type)) {
        fields.push(field.name)
      }
      // For known object types, include only their scalar fields (shallow)
      else if (fieldTypeName && schema.types[fieldTypeName]?.kind === 'OBJECT') {
        const nestedType = schema.types[fieldTypeName]
        if (nestedType.fields) {
          const nestedScalars = nestedType.fields
            .filter(f => !f.name.startsWith('_') && !skipFields.has(f.name) && this.isScalarType(f.type))
            .map(f => f.name)
          if (nestedScalars.length > 0) {
            fields.push(`${field.name} { ${nestedScalars.join(' ')} }`)
          }
        }
      }
      // For list of objects, include only their scalar fields (shallow)
      else if (field.type.kind === 'LIST' || field.type.ofType?.kind === 'LIST') {
        const itemTypeName = this.getListItemTypeName(field.type)
        if (itemTypeName && schema.types[itemTypeName]?.kind === 'OBJECT') {
          const itemType = schema.types[itemTypeName]
          if (itemType.fields) {
            const nestedScalars = itemType.fields
              .filter(f => !f.name.startsWith('_') && !skipFields.has(f.name) && this.isScalarType(f.type))
              .map(f => f.name)
            if (nestedScalars.length > 0) {
              fields.push(`${field.name} { ${nestedScalars.join(' ')} }`)
            }
          }
        }
      }
    }

    return fields.join('\n        ')
  }

  /**
   * Check if a type is a list of scalar values.
   */
  private isListOfScalars(type: TypeRef): boolean {
    // LIST(Scalar)
    if (type.kind === 'LIST') {
      return this.isScalarTypeName(type.ofType?.name || null)
    }
    // NON_NULL(LIST(Scalar))
    if (type.ofType?.kind === 'LIST') {
      return this.isScalarTypeName(type.ofType.ofType?.name || null)
    }
    return false
  }

  /**
   * Find content types (non-system types that implement Node or have content fields).
   */
  private findContentTypes(schema: IntrospectionResult): SchemaType[] {
    const systemPrefixes = ['__', 'Query', 'Mutation', 'Subscription', 'PageInfo', 'Edge', 'Connection']
    const systemSuffixes = ['Connection', 'Edge', 'Input', 'Filter', 'OrderBy', 'Payload']

    return Object.values(schema.types).filter(type => {
      // Skip system types
      if (systemPrefixes.some(prefix => type.name.startsWith(prefix))) return false
      if (systemSuffixes.some(suffix => type.name.endsWith(suffix))) return false

      // Must be an OBJECT type with fields
      if (type.kind !== 'OBJECT' || !type.fields?.length) return false

      // Must have an 'id' field (indicates it's a node type)
      const hasIdField = type.fields.some(f => f.name === 'id')
      if (!hasIdField) return false

      // Skip generic Node interface itself
      if (type.name === 'Node') return false

      // Skip standard GraphQL types
      if (['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type.name)) return false

      return true
    })
  }

  /**
   * Build GraphQL fields query for a type, recursively handling nested objects.
   */
  private buildFieldsQuery(type: SchemaType, schema: IntrospectionResult, maxDepth: number): string {
    if (maxDepth <= 0 || !type.fields) return 'id'

    const fields: string[] = []

    for (const field of type.fields) {
      // Skip connection/edge fields and internal fields
      if (field.name.startsWith('_')) continue
      if (field.name.endsWith('Connection')) continue

      const fieldTypeName = this.getBaseTypeName(field.type)
      const fieldType = fieldTypeName ? schema.types[fieldTypeName] : null

      // For scalar fields, just add the field name
      if (this.isScalarType(field.type)) {
        fields.push(field.name)
      }
      // For object fields, recurse with nested selection
      else if (fieldType?.kind === 'OBJECT' && fieldType.fields) {
        const nestedFields = this.buildFieldsQuery(fieldType, schema, maxDepth - 1)
        fields.push(`${field.name} {
          ${nestedFields}
        }`)
      }
      // For list types with object items, recurse
      else if (field.type.kind === 'LIST' || field.type.ofType?.kind === 'LIST') {
        const itemTypeName = this.getListItemTypeName(field.type)
        const itemType = itemTypeName ? schema.types[itemTypeName] : null

        if (this.isScalarTypeName(itemTypeName)) {
          fields.push(field.name)
        } else if (itemType?.kind === 'OBJECT' && itemType.fields) {
          const nestedFields = this.buildFieldsQuery(itemType, schema, maxDepth - 1)
          fields.push(`${field.name} {
            ${nestedFields}
          }`)
        } else {
          // Unknown list item type, try to fetch as scalar
          fields.push(field.name)
        }
      }
      // Unknown field type, try to include anyway
      else {
        fields.push(field.name)
      }
    }

    return fields.join('\n        ')
  }

  /**
   * Get the base type name, unwrapping NON_NULL and LIST wrappers.
   */
  private getBaseTypeName(type: TypeRef): string | null {
    if (type.name) return type.name
    if (type.ofType?.name) return type.ofType.name
    // Handle deeper nesting (e.g., NON_NULL(LIST(NON_NULL(Type))))
    if (type.ofType?.ofType) {
      return this.getBaseTypeName(type.ofType)
    }
    return null
  }

  /**
   * Get the item type name for list types.
   */
  private getListItemTypeName(type: TypeRef): string | null {
    // LIST directly
    if (type.kind === 'LIST') {
      return this.getBaseTypeName(type.ofType || { name: null, kind: 'SCALAR' })
    }
    // NON_NULL(LIST(...))
    if (type.ofType?.kind === 'LIST') {
      return this.getBaseTypeName(type.ofType.ofType || { name: null, kind: 'SCALAR' })
    }
    return null
  }

  /**
   * Check if a type is a scalar type.
   */
  private isScalarType(type: TypeRef): boolean {
    const typeName = this.getBaseTypeName(type)
    return this.isScalarTypeName(typeName)
  }

  /**
   * Check if a type name represents a scalar.
   */
  private isScalarTypeName(typeName: string | null): boolean {
    if (!typeName) return true // Assume scalar if unknown
    const scalars = ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'JSON', 'URL']
    return scalars.includes(typeName)
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Test connection to the GraphQL API.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.introspectSchema()
      return true
    } catch (error) {
      if (this.debug) {
        console.error('[UmbracoClient] Connection test failed:', error)
      }
      return false
    }
  }

  /**
   * Get the GraphQL endpoint URL.
   */
  getEndpoint(): string {
    return this.endpoint
  }
}
