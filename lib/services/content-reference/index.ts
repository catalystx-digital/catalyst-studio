// DataLoader exports for batched reference resolution
export {
  createContentLoaders,
  type ContentLoaders,
  type PagePathLoader,
  type PagePathInfo,
  type MediaUrlLoader,
  type MediaUrlInfo
} from './loaders';

// Individual loader factories (typically use createContentLoaders instead)
export { createPagePathLoader } from './page-path-loader';
export { createMediaUrlLoader } from './media-url-loader';

// Reference extraction utility
export { extractReferences, type ExtractedReference } from './extract-references';

// Sync service
export { ContentReferenceSyncService } from './sync-service';

// Integrity service
export {
  ContentReferenceIntegrityService,
  integrityService,
  type WhereUsedResult,
  type DeletionCheck
} from './integrity-service';

// Validation service
export {
  ContentReferenceValidationService,
  validationService,
  type ReferenceStatus,
  type ValidationResult,
  type BrokenReference
} from './validation-service';
