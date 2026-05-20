import DataLoader from 'dataloader';

import type {
  PrismaClient,
  WebsitePage,
  WebsiteSharedComponent,
  WebsiteStructure,
} from '@/lib/generated/prisma';
import type { GraphqlLoaders } from '@/lib/studio/graphql/types';

function mapById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return rows.reduce((acc, row) => acc.set(row.id, row), new Map<string, T>());
}

export function createGraphqlLoaders(prisma: PrismaClient): GraphqlLoaders {
  return {
    pageById: new DataLoader<string, WebsitePage | null>(async ids => {
      const rows = await prisma.websitePage.findMany({
        where: { id: { in: ids as string[] } },
      });
      const map = mapById(rows);
      return ids.map(id => map.get(id) ?? null);
    }),
    structureByPageId: new DataLoader<string, WebsiteStructure | null>(async pageIds => {
      const rows = await prisma.websiteStructure.findMany({
        where: { websitePageId: { in: pageIds as string[] } },
      });
      const map = rows.reduce(
        (acc, row) => {
          if (row.websitePageId) {
            acc.set(row.websitePageId, row);
          }
          return acc;
        },
        new Map<string, WebsiteStructure>(),
      );
      return pageIds.map(id => map.get(id) ?? null);
    }),
    sharedComponentById: new DataLoader<string, WebsiteSharedComponent | null>(async ids => {
      const rows = await prisma.websiteSharedComponent.findMany({
        where: { id: { in: ids as string[] } },
        include: {
          websiteComponentType: {
            select: { type: true },
          },
        },
      });
      const map = mapById(rows);
      return ids.map(id => map.get(id) ?? null);
    }),
  };
}
