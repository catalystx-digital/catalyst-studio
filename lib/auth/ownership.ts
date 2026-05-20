import { PrismaClient } from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';

export async function assertWebsiteOwnership(
  prisma: PrismaClient,
  accountId: string,
  websiteId: string
): Promise<void> {
  const site = await prisma.website.findUnique({ where: { id: websiteId }, select: { accountId: true } });
  if (!site) {
    throw new ApiError(404, 'Website not found', 'NOT_FOUND');
  }

  if (!site.accountId) {
    const claim = await prisma.website.updateMany({
      where: { id: websiteId, accountId: null },
      data: { accountId }
    });

    if (claim.count > 0) {
      return;
    }

    const refreshed = await prisma.website.findUnique({ where: { id: websiteId }, select: { accountId: true } });
    if (refreshed?.accountId === accountId) {
      return;
    }

    if (!refreshed?.accountId) {
      throw new ApiError(409, 'Unable to assign website to account', 'CONFLICT');
    }

    throw new ApiError(403, 'Forbidden: Website ownership mismatch', 'FORBIDDEN');
  }

  if (site.accountId !== accountId) {
    throw new ApiError(403, 'Forbidden: Website ownership mismatch', 'FORBIDDEN');
  }
}

export function whereByAccountForWebsite(accountId: string) {
  return { accountId } as const;
}

export function nestedWhereByAccount(accountId: string) {
  return { website: { accountId } } as const;
}
