import type {
  AccountApiKeySummary,
  ApiResponse,
  CreateAccountApiKeyRequest,
  CreateAccountApiKeyResponse,
  RotateAccountApiKeyResponse
} from '@/types/api'

export interface ApiAccessClientOptions {
  baseUrl: string
  accountParam?: string
  authUserHeader?: string | null
  cookies?: string | null
  fetchImpl?: typeof fetch
}

interface RequestOptions {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | undefined>
  body?: Record<string, unknown>
}

export class ApiAccessClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'ApiAccessClientError'
  }
}

export class ApiAccessClient {
  private readonly accountParam: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: ApiAccessClientOptions) {
    if (!options.baseUrl) {
      throw new Error('ApiAccessClient requires a baseUrl')
    }
    this.accountParam = options.accountParam ?? 'current'
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async listKeys(params: { websiteId?: string }): Promise<AccountApiKeySummary[]> {
    const response = await this.request<ApiResponse<AccountApiKeySummary[]>>({
      method: 'GET',
      path: `/api/studio/accounts/${this.accountParam}/api-keys`,
      query: {
        websiteId: params.websiteId
      }
    })

    if ('error' in response) {
      throw new ApiAccessClientError(response.error.message, 400, response.error.code)
    }

    return response.data
  }

  async createKey(input: CreateAccountApiKeyRequest): Promise<CreateAccountApiKeyResponse> {
    const response = await this.request<ApiResponse<CreateAccountApiKeyResponse>>({
      method: 'POST',
      path: `/api/studio/accounts/${this.accountParam}/api-keys`,
      body: input
    })

    if ('error' in response) {
      throw new ApiAccessClientError(response.error.message, 400, response.error.code)
    }

    return response.data
  }

  async rotateKey(keyId: string, note?: string): Promise<RotateAccountApiKeyResponse> {
    const response = await this.request<ApiResponse<RotateAccountApiKeyResponse>>({
      method: 'POST',
      path: `/api/studio/accounts/${this.accountParam}/api-keys/${keyId}/rotate`,
      body: note ? { note } : {}
    })

    if ('error' in response) {
      throw new ApiAccessClientError(response.error.message, 400, response.error.code)
    }

    return response.data
  }

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = new URL(path, this.options.baseUrl)
    if (query) {
      Object.entries(query)
        .filter(([, value]) => typeof value === 'string' && value.length > 0)
        .forEach(([key, value]) => {
          url.searchParams.set(key, value as string)
        })
    }
    return url.toString()
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json'
    }
    if (this.options.authUserHeader) {
      headers['x-catalyst-user'] = this.options.authUserHeader
    }
    if (this.options.cookies) {
      headers.cookie = this.options.cookies
    }
    return headers
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query)
    const response = await this.fetchImpl(url, {
      method: options.method,
      headers: this.buildHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    const text = await response.text()
    let payload: T
    try {
      payload = text ? (JSON.parse(text) as T) : ({} as T)
    } catch (error) {
      throw new ApiAccessClientError(
        `Invalid response from API Access endpoint: ${(error as Error).message}`,
        response.status || 500
      )
    }

    if (!response.ok) {
      const message =
        typeof (payload as { error?: { message?: string } }).error?.message === 'string'
          ? (payload as { error: { message: string } }).error.message
          : `API Access request failed with status ${response.status}`
      const code =
        (payload as { error?: { code?: string } }).error?.code ??
        (response.status === 401 ? 'UNAUTHORIZED' : undefined)
      throw new ApiAccessClientError(message, response.status, code)
    }

    return payload
  }
}
