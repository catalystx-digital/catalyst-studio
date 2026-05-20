import { logger } from '../../utils/logger'

interface GraphqlRequestInit<TVariables extends Record<string, unknown>> {
  query: string
  variables?: TVariables
  operationName?: string
  apiKey: string
}

interface GraphqlResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

export interface GraphqlClientOptions {
  endpoint: string
  timeoutMs?: number
  maxRetries?: number
}

const DEFAULT_TIMEOUT_MS = Number(process.env.UCS_GRAPHQL_TIMEOUT_MS ?? 5000)
const DEFAULT_MAX_RETRIES = 3

export class GraphqlRequestError extends Error {
  constructor(
    message: string,
    public readonly options: {
      status?: number
      operationName?: string
      rateLimited?: boolean
      attempt: number
      retryAfterMs?: number
      timeoutMs?: number
      cause?: unknown
    }
  ) {
    super(message)
    this.name = 'GraphqlRequestError'
  }
}

export class GraphqlClient {
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(options: GraphqlClientOptions) {
    if (!options.endpoint) {
      throw new Error('GraphQL client requires an endpoint')
    }
    this.endpoint = options.endpoint
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  async request<TResponse, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    init: GraphqlRequestInit<TVariables>
  ): Promise<TResponse> {
    const operationName = resolveOperationName(init.query, init.operationName)

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const start = Date.now()
      logger.info('graphQLRequest', {
        endpoint: this.endpoint,
        operationName,
        attempt
      })

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-ucs-api-key': init.apiKey
          },
          body: JSON.stringify({
            query: init.query,
            variables: init.variables ?? {},
            operationName: init.operationName
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
          const delayMs = retryAfter ?? computeBackoff(attempt)
          logger.warn('graphQLRateLimited', {
            endpoint: this.endpoint,
            operationName,
            retryAfterSeconds: retryAfter ? retryAfter / 1000 : undefined,
            attempt
          })
          if (attempt < this.maxRetries) {
            await wait(delayMs)
            continue
          }
          throw new GraphqlRequestError('GraphQL request was rate limited', {
            status: response.status,
            operationName,
            rateLimited: true,
            attempt,
            retryAfterMs: retryAfter
          })
        }

        if (!response.ok) {
          const bodyText = await response.text()
          throw new GraphqlRequestError(`GraphQL request failed (${response.status}): ${bodyText}`, {
            status: response.status,
            operationName,
            attempt
          })
        }

        const payload = (await response.json()) as GraphqlResponse<TResponse>
        if (payload.errors?.length) {
          throw new GraphqlRequestError(payload.errors.map(error => error.message).join('; '), {
            status: response.status,
            operationName,
            attempt
          })
        }

        if (!payload.data) {
          throw new GraphqlRequestError('GraphQL response did not include data', {
            status: response.status,
            operationName,
            attempt
          })
        }

        logger.info('graphQLRequestSucceeded', {
          endpoint: this.endpoint,
          operationName,
          attempt,
          durationMs: Date.now() - start
        })
        return payload.data
      } catch (error) {
        const isAbortError = error instanceof Error && error.name === 'AbortError'
        if (isAbortError) {
          if (attempt >= this.maxRetries) {
            throw new GraphqlRequestError(`GraphQL request timed out after ${this.timeoutMs}ms`, {
              operationName,
              attempt,
              timeoutMs: this.timeoutMs,
              cause: error
            })
          }
          const delayMs = computeBackoff(attempt)
          logger.warn('graphQLRetry', {
            endpoint: this.endpoint,
            attempt,
            operationName,
            timeoutMs: this.timeoutMs,
            reason: 'timeout',
            nextDelayMs: delayMs
          })
          await wait(delayMs)
          continue
        }

        if (attempt >= this.maxRetries) {
          if (error instanceof GraphqlRequestError) {
            throw error
          }
          throw new GraphqlRequestError(error instanceof Error ? error.message : String(error), {
            operationName,
            attempt,
            cause: error
          })
        }

        const delayMs = computeBackoff(attempt)
        logger.warn('graphQLRetry', {
          endpoint: this.endpoint,
          attempt,
          operationName,
          message: error instanceof Error ? error.message : String(error),
          nextDelayMs: delayMs
        })
        await wait(delayMs)
      }
    }
    throw new Error('GraphQL request failed after maximum retries')
  }
}

function computeBackoff(attempt: number): number {
  const base = 250
  return Math.min(base * 2 ** attempt, 2000)
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined
  }
  const numeric = Number(headerValue)
  if (!Number.isNaN(numeric) && numeric >= 0) {
    return numeric * 1000
  }
  const dateMs = Date.parse(headerValue)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }
  return undefined
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function resolveOperationName(query: string, provided?: string): string {
  if (provided) {
    return provided
  }
  const match = /(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(query)
  return match?.[1] ?? 'anonymous'
}
