import { GraphQLError } from 'graphql';

import { AccountApiKeyScope } from '@/lib/generated/prisma';
import type { Website } from '@/types/api';
import type { GraphqlContext } from '@/lib/studio/graphql/types';

function isAccountScopeGranted(scopes: AccountApiKeyScope[]): boolean {
  return scopes.includes(AccountApiKeyScope.ACCOUNT_READ);
}

function isWebsiteScopeGranted(scopes: AccountApiKeyScope[]): boolean {
  return scopes.includes(AccountApiKeyScope.WEBSITE_READ);
}

function unauthorized(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'UNAUTHORIZED' },
  });
}

export async function loadWebsiteIfAccessible(
  context: GraphqlContext,
  websiteId: string,
): Promise<Website | null> {
  try {
    const website = await context.services.website.getWebsite(websiteId);
    if (!website) {
      return null;
    }
    enforceWebsiteOwnership(context, website);
    return website;
  } catch {
    return null;
  }
}

export function enforceWebsiteOwnership(context: GraphqlContext, website: Website): void {
  const { auth } = context;
  if (auth.websiteId && auth.websiteId !== website.id) {
    throw unauthorized('API key is scoped to a different website');
  }
  if (website.accountId && website.accountId !== auth.accountId) {
    throw unauthorized('Website does not belong to the authenticated account');
  }
}

export function enforceWebsiteScope(context: GraphqlContext, websiteId: string): void {
  const { auth } = context;
  if (auth.websiteId && auth.websiteId !== websiteId) {
    throw unauthorized('API key is scoped to a different website');
  }
  if (isWebsiteScopeGranted(auth.scopes)) {
    if (!auth.websiteId) {
      throw unauthorized('Website scoped keys must include websiteId');
    }
    return;
  }
  if (isAccountScopeGranted(auth.scopes)) {
    return;
  }
  throw unauthorized('API key does not grant read access');
}

export function parseSlugInput(slug?: string | null): string[] | null {
  if (!slug) {
    return null;
  }
  const normalized = slug
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);
  return normalized.length ? normalized : [];
}

export function requirePageSelector(args: { id?: string | null; slug?: string | null }): void {
  if (!args.id && !args.slug) {
    throw new GraphQLError('Either id or slug must be provided', {
      extensions: { code: 'BAD_REQUEST' },
    });
  }
}

export function sanitizeGraphqlError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) {
    return error;
  }
  return new GraphQLError('Internal server error', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
