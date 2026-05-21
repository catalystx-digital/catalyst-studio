import { NextRequest, NextResponse } from 'next/server';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { MAX_JSON_DEPTH, MAX_OVERRIDES_SIZE_BYTES, checkJSONDepth, checkJSONSizeBytes } from '@/lib/studio/utils/json-constraints';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/studio/site-builder/page-components/[instanceId]
 * Thin wrapper to write minimal props.overrides for a specific instance on a page.
 * Body: { pageId: string, overrides: Record<string, unknown> | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;
    const body = await request.json();
    const pageId: string | undefined = body?.pageId;
    const overrides = (body?.overrides ?? null) as Record<string, unknown> | null;
    const ifUnmodifiedSinceHeader = request.headers.get('If-Unmodified-Since') || request.headers.get('if-unmodified-since');
    const ifBody = (body?.ifUnchangedSince as string | undefined) ?? undefined;
    const ifUnchangedSince = ifUnmodifiedSinceHeader ? new Date(ifUnmodifiedSinceHeader) : (ifBody ? new Date(ifBody) : undefined);

    if (!pageId || !instanceId) {
      return NextResponse.json({ error: 'Missing pageId or instanceId' }, { status: 400 });
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get page to find website
    const db = prisma as any;
    const page = await db.websitePage.findUnique({
      where: { id: pageId },
      select: { websiteId: true }
    });
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(db, auth.accountId, page.websiteId);

    // TKT-040 FIX: Unwrap overrides BEFORE validation
    // Client sends { props: { text: JSON, content: JSON } } wrapper
    // We need to extract the actual content before size/depth validation
    let actualOverrides: Record<string, unknown> | null = overrides;
    if (overrides !== null && overrides.props && typeof overrides.props === 'object') {
      const propsWrapper = overrides.props as Record<string, unknown>;
      // Extract canonical content from props.content first; props.text is a legacy mirror.
      if (typeof propsWrapper.content === 'string') {
        try {
          actualOverrides = JSON.parse(propsWrapper.content);
        } catch {
          actualOverrides = {};
        }
      } else if (typeof propsWrapper.text === 'string') {
        try {
          actualOverrides = JSON.parse(propsWrapper.text);
        } catch {
          actualOverrides = {};
        }
      } else if (typeof propsWrapper.content === 'object' && propsWrapper.content !== null) {
        actualOverrides = propsWrapper.content as Record<string, unknown>;
      } else if (typeof propsWrapper.text === 'object' && propsWrapper.text !== null) {
        actualOverrides = propsWrapper.text as Record<string, unknown>;
      }
    }

    // Validate UNWRAPPED overrides payload
    if (actualOverrides !== null) {
      if (!checkJSONSizeBytes(actualOverrides, MAX_OVERRIDES_SIZE_BYTES) || !checkJSONDepth(actualOverrides, 0, MAX_JSON_DEPTH)) {
        return NextResponse.json(
          { error: `Overrides exceed size (${MAX_OVERRIDES_SIZE_BYTES} bytes) or depth (${MAX_JSON_DEPTH}) limits` },
          { status: 413 }
        );
      }
    }

    // Pass ORIGINAL overrides to savePageOverrides - it has its own unwrapping logic
    await ContentRepository.savePageOverrides(pageId, instanceId, overrides, { ifUnchangedSince });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Override PATCH error:', error);
    // Surface conflict if optimistic concurrency failed
    const msg = (error instanceof Error ? error.message : '').toLowerCase();
    if (msg.includes('conflict')) {
      return NextResponse.json({ error: 'Conflict: page modified since' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to save overrides' }, { status: 500 });
  }
}
