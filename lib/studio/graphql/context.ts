import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@/lib/generated/prisma';
import type { GraphqlAuthContext } from '@/lib/ucs/auth/graphql-api-key-auth';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { PageService } from '@/lib/services/page-service';
import { StructureService } from '@/lib/services/structure-service';
import { WebsiteService } from '@/lib/services/website-service';
import { DesignSystemRepository } from '@/lib/studio/import/repositories/design-system.repository';
import { createGraphqlLoaders } from '@/lib/studio/graphql/loaders';
import type { GraphqlContext } from '@/lib/studio/graphql/types';

export function createGraphqlContext(
  auth: GraphqlAuthContext,
  prisma: PrismaClient = defaultPrisma,
): GraphqlContext {
  const sharedComponentCache = new Map();
  const services = {
    website: new WebsiteService(prisma),
    page: new PageService(prisma),
    structure: new StructureService(prisma),
  };

  const repositories = {
    unifiedContent: ContentRepository,
    designSystem: new DesignSystemRepository(prisma),
  };

  return {
    auth,
    prisma,
    loaders: createGraphqlLoaders(prisma),
    services,
    repositories,
    sharedComponentCache,
    requestId: randomUUID(),
  };
}
