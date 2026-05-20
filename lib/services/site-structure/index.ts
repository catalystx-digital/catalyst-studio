// Main service exports
export { 
  SiteStructureService, 
  siteStructureService,
  type ISiteStructureService 
} from './site-structure-service';

export { 
  PathManager, 
  pathManager,
  type IPathManager 
} from './path-manager';

export { 
  WebsiteStructureRepository, 
  websiteStructureRepository,
  type IWebsiteStructureRepository 
} from './site-structure-repository';

// Re-export existing utilities
export * from './slug-manager';
export { PageOrchestrator } from './page-orchestrator';

// Re-export errors
export * from './errors';

// Re-export types
export * from '@/lib/types/site-structure.types';
export * from '@/lib/types/page-orchestrator.types';