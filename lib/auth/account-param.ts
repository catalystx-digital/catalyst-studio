import { ErrorHandlers } from '@/lib/api/errors';

export function resolveAccountParam(param: string, authAccountId: string): string {
  if (!param) {
    throw ErrorHandlers.badRequest('Account id is required');
  }

  if (param === 'current') {
    return authAccountId;
  }

  if (param !== authAccountId) {
    throw ErrorHandlers.forbidden('Cannot act on another account');
  }

  return param;
}
