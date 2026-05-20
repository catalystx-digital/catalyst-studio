import { NextRequest } from 'next/server';
import { getClient } from '@/lib/db/client';
import { checkAndRecordUsage } from '@/lib/usage/limits';
import { CreateWebsiteSchema } from '@/lib/api/validation/website';
import { handleApiError, ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getAuthContext, requireFreshAuthContext } from '@/lib/auth/context';

/**
 * GET /api/websites
 * Retrieve all websites the user has access to across all their account memberships
 */
export async function GET(request: NextRequest) {
  try {
    const prisma = getClient();
    const auth = await getAuthContext(request);

    if (!auth.userId) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Get all memberships for this user
    const memberships = await prisma.accountMembership.findMany({
      where: { userId: auth.userId },
      select: {
        accountId: true,
        role: true,
        websiteAccess: true,
        websiteIds: true,
      },
    });

    if (memberships.length === 0) {
      return Response.json({ data: [] });
    }

    // Build website query based on memberships
    // For each membership, check if they have "all" access or specific website IDs
    const websiteFilters: Array<{ accountId: string; id?: { in: string[] } }> = [];

    for (const membership of memberships) {
      if (membership.websiteAccess === 'all' || membership.role === 'admin' || membership.role === 'owner') {
        // Full access to all websites in this account
        websiteFilters.push({ accountId: membership.accountId });
      } else if (membership.websiteIds && membership.websiteIds.length > 0) {
        // Specific website access
        websiteFilters.push({
          accountId: membership.accountId,
          id: { in: membership.websiteIds },
        });
      }
      // If websiteAccess is 'specific' but no websiteIds, they have no access
    }

    if (websiteFilters.length === 0) {
      return Response.json({ data: [] });
    }

    const websites = await prisma.website.findMany({
      where: {
        isActive: true,
        OR: websiteFilters,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        account: {
          select: { id: true, name: true },
        },
      },
    });

    // JSON fields are already parsed by Prisma
    const formattedWebsites = websites.map(website => ({
      ...website,
      metadata: website.metadata || null,
      settings: website.settings || null,
      // Include account info so UI can show which account the website belongs to
      accountName: website.account?.name ?? null,
    }));

    return Response.json({ data: formattedWebsites });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/websites
 * Create a new website
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateWebsiteSchema.parse(body);

    const prisma = getClient();
    const auth = await requireFreshAuthContext(request);

    // Prisma handles JSON fields automatically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataToStore: any = {
      ...validated,
      metadata: validated.metadata,
      settings: validated.settings,
    };
    dataToStore.accountId = auth.accountId;

    await checkAndRecordUsage(prisma, auth.accountId, 'website_create', 1, {
      metadata: {
        category: validated.category ?? null,
      },
      userId: auth.userId,
    });

    const website = await prisma.website.create({
      data: dataToStore
    });

    // JSON fields are already parsed by Prisma
    const formattedWebsite = {
      ...website,
      metadata: website.metadata || null,
      settings: website.settings || null
    };

    return Response.json({ data: formattedWebsite }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', error.errors));
    }
    return handleApiError(error);
  }
}


