import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Validation schemas
const MAX_PROPERTIES_SIZE = 10000;
const MAX_JSON_DEPTH = 5;

function checkJSONDepth(obj: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  
  for (const value of Object.values(obj)) {
    if (!checkJSONDepth(value, depth + 1)) return false;
  }
  return true;
}

const PropertiesSchema = z.record(z.unknown()).refine(
  (data) => {
    const jsonStr = JSON.stringify(data);
    return jsonStr.length <= MAX_PROPERTIES_SIZE && checkJSONDepth(data);
  },
  { message: `Properties exceed size limit or depth limit` }
);

const PropagateSchema = z.object({
  properties: PropertiesSchema,
  options: z.object({
    skipOverrides: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    convertToOverrides: z.boolean().optional(),
  }).optional()
});

/**
 * POST /api/studio/site-builder/global-components/[id]/propagate
 * Propagate changes to all instances of a global component
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const prismaClient = prisma as any;

    // Validate input
    const validation = PropagateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { properties, options = {} } = validation.data;
    const { skipOverrides = false, dryRun = false } = options;

    // Get shared component
    const sharedComponent = await prismaClient.websiteSharedComponent.findUnique({
      where: { id: id }
    });

    if (!sharedComponent) {
      return NextResponse.json(
        { error: 'Shared component not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prismaClient, auth.accountId, sharedComponent.websiteId);
    
    // Update canonical shared content via unified repository.
    await ContentRepository.saveSharedComponentContent(id, properties, {
      websiteId: sharedComponent.websiteId,
    });

    if (!options.convertToOverrides) {
      return NextResponse.json({ success: true, updated: 0, skipped: 0, errors: [], totalUsages: 0, partialSuccess: false, recoverableErrors: 0 });
    }

    // Convert canonical shared instances to explicit overrides.
    const pages = await prismaClient.websitePage.findMany({
      where: {
        websiteId: sharedComponent.websiteId,
        content: { string_contains: `"sharedComponentId":"${id}"` },
      },
      select: { id: true, title: true, content: true },
    });

    const candidates: Array<{ pageId: string; instanceId: string; hasOverrides: boolean; isUnified: boolean }> = [];
    for (const p of pages) {
      const comps = Array.isArray((p.content as any)?.components) ? (p.content as any).components : [];
      for (const c of comps) {
        const instId = (c?.id as string) || '';
        const props = (c?.props ?? {}) as Record<string, unknown>;
        const isSharedInstance = props?.sharedComponentId === id;
        if (isSharedInstance) {
          const overrides = (props?.overrides as Record<string, unknown>) || {};
          const hasOverrides = !!(props?.hasOverrides || (overrides && Object.keys(overrides).length > 0));
          candidates.push({ pageId: p.id, instanceId: instId, hasOverrides, isUnified: true });
        }
      }
    }

    const toConvert = candidates.filter((c) => !c.hasOverrides);
    const finalList = skipOverrides ? toConvert.filter((c) => !c.hasOverrides) : toConvert;

    if (dryRun) {
      return NextResponse.json({ dryRun: true, wouldConvert: finalList.length, affectedInstances: finalList });
    }

    const errors: Array<{ pageId: string; instanceId: string; error: string }> = [];
    let converted = 0;
    for (const item of finalList) {
      try {
        await ContentRepository.convertFullPropsToOverrides(item.pageId, item.instanceId, id);
        converted += 1;
      } catch (e) {
        errors.push({ pageId: item.pageId, instanceId: item.instanceId, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ success: errors.length === 0, converted, attempted: finalList.length, errors });
    
  } catch (error) {
    console.error('Error propagating component changes:', error);
    
    if (error instanceof Error && 'code' in error) {
      if ((error as any).code === 'P2034') {
        return NextResponse.json(
          { error: 'Transaction conflict - please retry' },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to propagate component changes' },
      { status: 500 }
    );
  }
}
