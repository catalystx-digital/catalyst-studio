import { NextRequest } from 'next/server';
import {
  DocumentNode,
  GraphQLError,
  NoSchemaIntrospectionCustomRule,
  execute,
  parse,
  specifiedRules,
  validate,
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';

import {
  authenticateGraphqlRequest,
  GraphqlAuthError,
  type GraphqlAuthContext,
} from '@/lib/ucs/auth/graphql-api-key-auth';
import { ucsGraphqlSchema } from '@/lib/studio/graphql/schema';
import { createGraphqlContext } from '@/lib/studio/graphql/context';
import { sanitizeGraphqlError } from '@/lib/studio/graphql/utils';
import { recordGraphqlMetric } from '@/lib/studio/graphql/metrics';

const MAX_COMPLEXITY = 500;
const MAX_DEPTH = 6;
const DEFAULT_TIMEOUT_MS = 5000;
const allowIntrospection =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_GRAPHQL_INTROSPECTION === 'true';
const timeoutMs = Number(process.env.UCS_GRAPHQL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

interface GraphqlRequestPayload {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string | null;
}

function buildGraphqlErrorPayload(message: string) {
  return {
    errors: [
      {
        message,
      },
    ],
  };
}

function applyRateHeaders(
  headers: Headers,
  resource: 'key' | 'ip',
  limit: number,
  remaining: number,
) {
  headers.set('X-RateLimit-Resource', resource);
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', Math.max(0, remaining).toString());
}

function respondWithLimits(
  payload: unknown,
  status: number,
  authContext: GraphqlAuthContext,
): Response {
  const response = Response.json(payload, { status });
  applyRateHeaders(
    response.headers,
    'key',
    authContext.rateLimits.key.limit,
    authContext.rateLimits.key.remaining,
  );
  return response;
}

function normalizeVariables(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function parseDocument(source: string): DocumentNode | GraphQLError {
  try {
    return parse(source);
  } catch (error) {
    return error instanceof GraphQLError
      ? error
      : new GraphQLError('Failed to parse query', { originalError: error as Error });
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ timedOut: boolean; result?: T }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('TIMED_OUT')), ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return { timedOut: false, result: result as T };
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMED_OUT') {
      return { timedOut: true };
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function logRequest(payload: Record<string, unknown>) {
  console.info('[ucs.graphql.request]', {
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

export async function POST(request: NextRequest) {
  let body: GraphqlRequestPayload | null = null;
  try {
    body = await request.json();
  } catch {
    // Body optional; schema validation will handle null bodies.
  }

  const startTime = Date.now();

  try {
    const authContext = await authenticateGraphqlRequest(request, {
      variables: body?.variables ?? null,
    });

    if (!body || typeof body.query !== 'string') {
      const durationMs = Date.now() - startTime;
      recordGraphqlMetric({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: null,
        complexity: 0,
        durationMs,
        result: 'error',
      });
      logRequest({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: null,
        complexity: 0,
        durationMs,
        result: 'bad_request',
      });
      return respondWithLimits(buildGraphqlErrorPayload('QUERY_REQUIRED'), 400, authContext);
    }

    const documentOrError = parseDocument(body.query);
    if (documentOrError instanceof GraphQLError) {
      const durationMs = Date.now() - startTime;
      recordGraphqlMetric({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: 0,
        durationMs,
        result: 'error',
      });
      logRequest({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: 0,
        durationMs,
        result: 'syntax_error',
      });
      return respondWithLimits(
        { errors: [sanitizeGraphqlError(documentOrError)] },
        400,
        authContext,
      );
    }

    const document = documentOrError;
    const variables = normalizeVariables(body.variables);
    let measuredComplexity = 0;

    const complexityRule = createComplexityLimitRule({
      maximumComplexity: MAX_COMPLEXITY,
      variables,
      onComplete: (complexity: number) => {
        measuredComplexity = complexity;
      },
      createError: (max: number, actual: number) =>
        new GraphQLError(
          `Query is too complex: ${actual}. Maximum allowed complexity: ${max}`,
          { extensions: { code: 'BAD_REQUEST' } },
        ),
    });

    const validationRules = [...specifiedRules, depthLimit(MAX_DEPTH), complexityRule];
    if (!allowIntrospection) {
      validationRules.push(NoSchemaIntrospectionCustomRule);
    }

    const validationErrors = validate(ucsGraphqlSchema, document, validationRules);
    if (validationErrors.length > 0) {
      const durationMs = Date.now() - startTime;
      const sanitized = validationErrors.map(error => sanitizeGraphqlError(error));
      recordGraphqlMetric({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: measuredComplexity,
        durationMs,
        result: 'error',
      });
      logRequest({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: measuredComplexity,
        durationMs,
        result: 'validation_error',
      });
      return respondWithLimits({ errors: sanitized }, 400, authContext);
    }

    const contextValue = createGraphqlContext(authContext);
    const execution = Promise.resolve(execute({
      schema: ucsGraphqlSchema,
      document,
      contextValue,
      variableValues: variables,
      operationName: body.operationName ?? undefined,
    }));

    const executionResult = await withTimeout(execution, timeoutMs);
    const durationMs = Date.now() - startTime;

    if (executionResult.timedOut) {
      recordGraphqlMetric({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: measuredComplexity,
        durationMs,
        result: 'timeout',
      });
      logRequest({
        keyId: authContext.keyId,
        accountId: authContext.accountId,
        websiteId: authContext.websiteId,
        operationName: body.operationName ?? null,
        complexity: measuredComplexity,
        durationMs,
        result: 'timeout',
      });
      return respondWithLimits(buildGraphqlErrorPayload('QUERY_TIMEOUT'), 504, authContext);
    }

    const finalResult = executionResult.result ?? {};
    if (Array.isArray(finalResult.errors) && finalResult.errors.length > 0) {
      finalResult.errors = finalResult.errors.map(error => sanitizeGraphqlError(error));
    }
    const hasErrors = Array.isArray(finalResult.errors) && finalResult.errors.length > 0;

    recordGraphqlMetric({
      keyId: authContext.keyId,
      accountId: authContext.accountId,
      websiteId: authContext.websiteId,
      operationName: body.operationName ?? null,
      complexity: measuredComplexity,
      durationMs,
      result: hasErrors ? 'error' : 'ok',
    });
    logRequest({
      keyId: authContext.keyId,
      accountId: authContext.accountId,
      websiteId: authContext.websiteId,
      operationName: body.operationName ?? null,
      complexity: measuredComplexity,
      durationMs,
      result: hasErrors ? 'error' : 'ok',
    });

    return respondWithLimits(finalResult, hasErrors ? 200 : 200, authContext);
  } catch (error) {
    if (error instanceof GraphqlAuthError) {
      const response = Response.json(buildGraphqlErrorPayload(error.code), {
        status: error.status,
        headers: error.headers,
      });
      if (!error.headers?.['X-RateLimit-Limit']) {
        response.headers.set('X-RateLimit-Resource', 'key');
      }
      return response;
    }

    console.error('[ucs.graphql]', error);
    return Response.json(buildGraphqlErrorPayload('INTERNAL_ERROR'), { status: 500 });
  }
}
