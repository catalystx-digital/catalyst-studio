import { NextRequest, NextResponse } from 'next/server';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { MAX_JSON_DEPTH, MAX_OVERRIDES_SIZE_BYTES, checkJSONDepth, checkJSONSizeBytes } from '@/lib/studio/utils/json-constraints';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isLegacyWrappedOverrides(value: Record<string, unknown>): boolean {
  if (!isPlainObject(value.props)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value.props, 'text')
    || Object.prototype.hasOwnProperty.call(value.props, 'content');
}

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
    }
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
    }

    const pageId = typeof body.pageId === 'string' ? body.pageId : undefined;
    if (!Object.prototype.hasOwnProperty.call(body, 'overrides')) {
      return NextResponse.json({ error: 'Missing overrides' }, { status: 400 });
    }
    const overrides = body.overrides as unknown;
    const ifUnmodifiedSinceHeader = request.headers.get('If-Unmodified-Since') || request.headers.get('if-unmodified-since');
    const ifBody = typeof body.ifUnchangedSince === 'string' ? body.ifUnchangedSince : undefined;
    const ifUnchangedSince = ifUnmodifiedSinceHeader ? new Date(ifUnmodifiedSinceHeader) : (ifBody ? new Date(ifBody) : undefined);

    if (!pageId || !instanceId) {
      return NextResponse.json({ error: 'Missing pageId or instanceId' }, { status: 400 });
    }

    if (ifUnchangedSince && Number.isNaN(ifUnchangedSince.getTime())) {
      return NextResponse.json({ error: 'Invalid ifUnchangedSince value' }, { status: 400 });
    }

    if (overrides !== null && !isPlainObject(overrides)) {
      return NextResponse.json({ error: 'Overrides must be an object or null' }, { status: 400 });
    }

    if (overrides !== null && isLegacyWrappedOverrides(overrides)) {
      return NextResponse.json({ error: 'Legacy wrapped overrides are not accepted' }, { status: 400 });
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

    if (overrides !== null) {
      if (!checkJSONSizeBytes(overrides, MAX_OVERRIDES_SIZE_BYTES) || !checkJSONDepth(overrides, 0, MAX_JSON_DEPTH)) {
        return NextResponse.json(
          { error: `Overrides exceed size (${MAX_OVERRIDES_SIZE_BYTES} bytes) or depth (${MAX_JSON_DEPTH}) limits` },
          { status: 413 }
        );
      }
    }

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
