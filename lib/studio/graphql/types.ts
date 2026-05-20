import type DataLoader from 'dataloader';

import type { GraphqlAuthContext } from '@/lib/ucs/auth/graphql-api-key-auth';
import type {
  PrismaClient,
  WebsitePage,
  WebsiteSharedComponent,
  WebsiteStructure,
} from '@/lib/generated/prisma';
import type {
  ResolverDiagnostic,
  ResolverStructurePayload,
} from '@/lib/studio/headless/ucs/page-resolver';
import type {
  SnapshotPage,
  SnapshotSharedComponent,
} from '@/lib/studio/headless/site-snapshot/types';
import type { ResolvedInstance } from '@/lib/services/unified-content-repository';
import type { WebsiteConnectionPayload } from '@/lib/services/website-service';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { PageService } from '@/lib/services/page-service';
import { StructureService } from '@/lib/services/structure-service';
import { WebsiteService } from '@/lib/services/website-service';
import { DesignSystemRepository } from '@/lib/studio/import/repositories/design-system.repository';

export interface GraphqlLoaders {
  pageById: DataLoader<string, WebsitePage | null>;
  structureByPageId: DataLoader<string, WebsiteStructure | null>;
  sharedComponentById: DataLoader<string, WebsiteSharedComponent | null>;
}

export interface GraphqlServices {
  website: WebsiteService;
  page: PageService;
  structure: StructureService;
}

export interface GraphqlRepositories {
  unifiedContent: typeof ContentRepository;
  designSystem: DesignSystemRepository;
}

export interface GraphqlContext {
  auth: GraphqlAuthContext;
  prisma: PrismaClient;
  loaders: GraphqlLoaders;
  services: GraphqlServices;
  repositories: GraphqlRepositories;
  sharedComponentCache: Map<string, SnapshotSharedComponent>;
  requestId: string;
}

export const RESOLVED_COMPONENTS_SYMBOL = Symbol('ucs.graphql.resolvedComponents');

export type ComponentResolutionMap = Map<string, ResolvedInstance>;

export interface GraphqlWebsiteConnection extends WebsiteConnectionPayload {}

export interface GraphqlPageNode extends SnapshotPage {
  websiteId: string;
  structure?: ResolverStructurePayload;
  sharedComponents: SnapshotSharedComponent[];
  diagnostics: ResolverDiagnostic[];
  [RESOLVED_COMPONENTS_SYMBOL]: ComponentResolutionMap;
}
