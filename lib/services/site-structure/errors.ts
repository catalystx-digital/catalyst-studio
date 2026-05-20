/**
 * Custom error classes for site structure slug management
 */

/**
 * Error thrown when a slug conflicts with an existing slug at the same parent level
 */
export class SlugConflictError extends Error {
  public readonly slug: string;
  public readonly parentId: string | null;
  public readonly websiteId: string;
  public readonly statusCode: number;

  constructor(slug: string, parentId: string | null, websiteId: string) {
    const parentDescription = parentId ? `parent ${parentId}` : 'root level';
    super(`Slug "${slug}" already exists under ${parentDescription}`);
    
    this.name = 'SlugConflictError';
    this.slug = slug;
    this.parentId = parentId;
    this.websiteId = websiteId;
    this.statusCode = 409; // HTTP Conflict
    
    // Maintains proper stack trace for where error was thrown
    Object.setPrototypeOf(this, SlugConflictError.prototype);
  }
}

/**
 * Error thrown when a slug fails validation rules
 */
export class InvalidSlugError extends Error {
  public readonly slug: string;
  public readonly validationErrors: string[];
  public readonly statusCode: number;

  constructor(slug: string, validationErrors: string[]) {
    const message = validationErrors.length > 0
      ? validationErrors[0]
      : `Invalid slug: "${slug}"`;
    
    super(message);
    
    this.name = 'InvalidSlugError';
    this.slug = slug;
    this.validationErrors = validationErrors;
    this.statusCode = 400; // HTTP Bad Request
    
    Object.setPrototypeOf(this, InvalidSlugError.prototype);
  }
}

/**
 * Error thrown when a reserved system slug is used
 */
export class ReservedSlugError extends Error {
  public readonly slug: string;
  public readonly statusCode: number;

  constructor(slug: string) {
    super(`Invalid slug: '${slug}' is a reserved system slug`);
    
    this.name = 'ReservedSlugError';
    this.slug = slug;
    this.statusCode = 400; // HTTP Bad Request
    
    Object.setPrototypeOf(this, ReservedSlugError.prototype);
  }
}

/**
 * Error thrown when slug generation fails after maximum attempts
 */
export class SlugGenerationError extends Error {
  public readonly baseSlug: string;
  public readonly attempts: number;
  public readonly statusCode: number;

  constructor(baseSlug: string, attempts: number) {
    super(`Unable to generate unique slug after ${attempts} attempts for base slug: "${baseSlug}"`);
    
    this.name = 'SlugGenerationError';
    this.baseSlug = baseSlug;
    this.attempts = attempts;
    this.statusCode = 500; // HTTP Internal Server Error
    
    Object.setPrototypeOf(this, SlugGenerationError.prototype);
  }
}

/**
 * Error thrown when slug length exceeds maximum allowed
 */
export class SlugLengthError extends Error {
  public readonly slug: string;
  public readonly maxLength: number;
  public readonly actualLength: number;
  public readonly statusCode: number;

  constructor(slug: string, maxLength: number = 255) {
    super(`Invalid slug: exceeds maximum length of ${maxLength} characters`);
    
    this.name = 'SlugLengthError';
    this.slug = slug;
    this.maxLength = maxLength;
    this.actualLength = slug.length;
    this.statusCode = 400; // HTTP Bad Request
    
    Object.setPrototypeOf(this, SlugLengthError.prototype);
  }
}

/**
 * Type guard to check if an error is a slug-related error
 */
export function isSlugError(error: unknown): error is SlugConflictError | InvalidSlugError | ReservedSlugError | SlugGenerationError | SlugLengthError {
  return error instanceof SlugConflictError ||
         error instanceof InvalidSlugError ||
         error instanceof ReservedSlugError ||
         error instanceof SlugGenerationError ||
         error instanceof SlugLengthError;
}

/**
 * Helper to get appropriate HTTP status code from slug errors
 */
export function getSlugErrorStatusCode(error: unknown): number {
  if (isSlugError(error)) {
    return error.statusCode;
  }
  return 500; // Default to Internal Server Error
}

/**
 * Error thrown when a duplicate slug is encountered
 */
export class DuplicateSlugError extends Error {
  public readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'DuplicateSlugError';
    this.statusCode = 409; // HTTP Conflict
    Object.setPrototypeOf(this, DuplicateSlugError.prototype);
  }
}

/**
 * Error thrown when attempting to create an orphaned node
 */
export class OrphanedNodeError extends Error {
  public readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'OrphanedNodeError';
    this.statusCode = 400; // HTTP Bad Request
    Object.setPrototypeOf(this, OrphanedNodeError.prototype);
  }
}

/**
 * Error thrown when a circular reference would be created
 */
export class CircularReferenceError extends Error {
  public readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'CircularReferenceError';
    this.statusCode = 400; // HTTP Bad Request
    Object.setPrototypeOf(this, CircularReferenceError.prototype);
  }
}

/**
 * Error thrown when a node is not found
 */
export class NodeNotFoundError extends Error {
  public readonly nodeId: string;
  public readonly statusCode: number;

  constructor(nodeId: string) {
    super(`Node with ID "${nodeId}" not found`);
    this.name = 'NodeNotFoundError';
    this.nodeId = nodeId;
    this.statusCode = 404; // HTTP Not Found
    Object.setPrototypeOf(this, NodeNotFoundError.prototype);
  }
}

/**
 * Error thrown when an invalid operation is attempted
 */
export class InvalidOperationError extends Error {
  public readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
    this.statusCode = 400; // HTTP Bad Request
    Object.setPrototypeOf(this, InvalidOperationError.prototype);
  }
}