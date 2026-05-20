/**
 * Optimizely Content Graph GraphQL client for build-time queries.
 * Uses epi-single authentication for published content.
 */

export interface OptimizelyGraphqlClientOptions {
  /** GraphQL endpoint (e.g., https://cg.optimizely.com/content/v2) */
  endpoint: string
  /** Single key for published content authentication */
  singleKey: string
  /** Default locale (default: 'en') */
  locale?: string
  /** Enable debug logging */
  debug?: boolean
}

interface GraphQLError {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: string[]
}

interface GraphQLResponse<T = unknown> {
  data?: T
  errors?: GraphQLError[]
}

export class OptimizelyGraphqlClient {
  private readonly endpoint: string
  private readonly singleKey: string
  private readonly locale: string
  private readonly debug: boolean

  constructor(options: OptimizelyGraphqlClientOptions) {
    this.endpoint = options.endpoint
    this.singleKey = options.singleKey
    this.locale = options.locale ?? 'en'
    this.debug = options.debug ?? false
  }

  async request<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    if (this.debug) {
      console.log('[Optimizely] GraphQL request:', { query: query.slice(0, 200), variables })
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `epi-single ${this.singleKey}`
      },
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok) {
      throw new Error(
        `Optimizely GraphQL request failed: ${response.status} ${response.statusText}`
      )
    }

    const result = (await response.json()) as GraphQLResponse<T>

    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map(e => e.message).join(', ')
      throw new Error(`Optimizely GraphQL errors: ${errorMessages}`)
    }

    if (!result.data) {
      throw new Error('Optimizely GraphQL response has no data')
    }

    if (this.debug) {
      console.log('[Optimizely] GraphQL response:', JSON.stringify(result.data).slice(0, 500))
    }

    return result.data
  }

  getLocale(): string {
    return this.locale
  }
}
