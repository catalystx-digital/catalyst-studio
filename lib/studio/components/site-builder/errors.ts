/**
 * Custom error types for sitemap operations
 */

export class SitemapError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DuplicateSlugError extends SitemapError {
  constructor(slug: string, parentPath?: string) {
    const path = parentPath ? `${parentPath}/${slug}` : slug;
    super(`A page with the URL "${path}" already exists`, 'DUPLICATE_SLUG');
  }
}

export class NodeNotFoundError extends SitemapError {
  constructor(nodeId: string) {
    super(`The item was not found (${nodeId}) - it may have been deleted`, 'NODE_NOT_FOUND');
  }
}

export class InvalidSlugError extends SitemapError {
  constructor(slug: string) {
    super(
      `Invalid URL format "${slug}". Use only letters, numbers, and hyphens`,
      'INVALID_SLUG'
    );
  }
}

export class OrphanedNodeError extends SitemapError {
  constructor(message?: string) {
    super(
      message || 'Cannot perform this operation - would create orphaned nodes',
      'ORPHANED_NODE'
    );
  }
}

export class CircularReferenceError extends SitemapError {
  constructor(nodeId: string, targetId: string) {
    super(
      `This change would create a circular reference (${nodeId} -> ${targetId})`,
      'CIRCULAR_REFERENCE'
    );
  }
}

export class NetworkError extends SitemapError {
  constructor() {
    super('Connection lost. Your changes will be saved when reconnected.', 'NETWORK_ERROR');
  }
}

export class SaveError extends SitemapError {
  constructor(message?: string) {
    super(message || 'Failed to save changes. Click to retry.', 'SAVE_ERROR');
  }
}

export class TransactionConflictError extends SitemapError {
  constructor() {
    super('Another user is making changes. Please retry.', 'TRANSACTION_CONFLICT');
  }
}

/**
 * Map Prisma error codes to custom errors
 */
export function mapPrismaError(error: any): SitemapError {
  if (!error.code) {
    return new SitemapError(error.message || 'An unknown error occurred');
  }
  
  const errorMap: Record<string, () => SitemapError> = {
    'P2002': () => new DuplicateSlugError(''),
    'P2025': () => new NodeNotFoundError(''),
    'P2003': () => new OrphanedNodeError(),
    'P2034': () => new TransactionConflictError()
  };
  
  const errorFactory = errorMap[error.code];
  return errorFactory ? errorFactory() : new SitemapError(error.message);
}

/**
 * User-friendly error messages for display
 */
export const errorMessages: Record<string, string> = {
  DUPLICATE_SLUG: 'A page with this URL already exists',
  INVALID_SLUG: 'Invalid URL format. Use only letters, numbers, and hyphens',
  ORPHANED_NODE: 'Cannot perform this operation - would create orphaned nodes',
  CIRCULAR_REFERENCE: 'This change would create a circular reference',
  NODE_NOT_FOUND: 'The item was not found - it may have been deleted',
  NETWORK_ERROR: 'Connection lost. Your changes will be saved when reconnected.',
  SAVE_ERROR: 'Failed to save changes. Click to retry.',
  TRANSACTION_CONFLICT: 'Another user is making changes. Please retry.'
};

/**
 * Serialize error for API responses
 */
export function serializeError(error: Error): { 
  error: string; 
  code?: string; 
  retryable?: boolean 
} {
  if (error instanceof SitemapError) {
    const retryable = [
      'NETWORK_ERROR', 
      'SAVE_ERROR', 
      'TRANSACTION_CONFLICT'
    ].includes(error.code || '');
    
    return {
      error: error.message,
      code: error.code,
      retryable
    };
  }
  
  return { error: error.message || 'An error occurred' };
}