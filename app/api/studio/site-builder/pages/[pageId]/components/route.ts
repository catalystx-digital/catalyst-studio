import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { PageContentNormalizationError, toCanonicalPageContent } from '@/lib/studio/page-content';
import { MAX_CONTENT_SIZE_BYTES, MAX_JSON_DEPTH, checkJSONDepth, checkJSONSizeBytes } from '@/lib/studio/utils/json-constraints';

const db = prisma as any;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * PATCH /api/studio/site-builder/pages/[pageId]/components
 * Writes the canonical WebsitePage.content.components array for structural edits.
 * Body: { pageId?: string, components: ComponentInstance[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
    }

    if (!pageId || !isPlainObject(body)) {
      return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
    }
    if (typeof body.pageId === 'string' && body.pageId !== pageId) {
      return NextResponse.json({ error: 'pageId does not match route' }, { status: 400 });
    }
    if (!Array.isArray(body.components)) {
      return NextResponse.json({ error: 'Missing components array' }, { status: 400 });
    }
    const ifUnmodifiedSinceHeader = request.headers.get('If-Unmodified-Since') || request.headers.get('if-unmodified-since');
    const ifBody = typeof body.ifUnchangedSince === 'string' ? body.ifUnchangedSince : undefined;
    const ifUnchangedSince = ifUnmodifiedSinceHeader ? new Date(ifUnmodifiedSinceHeader) : (ifBody ? new Date(ifBody) : undefined);
    if (ifUnchangedSince && Number.isNaN(ifUnchangedSince.getTime())) {
      return NextResponse.json({ error: 'Invalid ifUnchangedSince timestamp' }, { status: 400 });
    }

    if (!checkJSONSizeBytes(body.components, MAX_CONTENT_SIZE_BYTES) || !checkJSONDepth(body.components, 0, MAX_JSON_DEPTH)) {
      return NextResponse.json(
        { error: `Components exceed size (${MAX_CONTENT_SIZE_BYTES} bytes) or depth (${MAX_JSON_DEPTH}) limits` },
        { status: 413 }
      );
    }

    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const page = await db.websitePage.findUnique({
      where: { id: pageId },
      select: { id: true, websiteId: true, content: true, updatedAt: true },
    });
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(db, auth.accountId, page.websiteId);
    if (ifUnchangedSince && page.updatedAt > ifUnchangedSince) {
      return NextResponse.json({ error: 'Conflict: page modified since' }, { status: 409 });
    }

    const existingContent = isPlainObject(page.content) ? page.content : {};
    const content = toCanonicalPageContent(existingContent, body.components, { mode: 'strict-write' });

    const updatedPage = await db.websitePage.update({
      where: { id: pageId },
      data: { content: content as unknown as Prisma.InputJsonValue },
      select: { updatedAt: true },
    });

    const updatedAt = updatedPage.updatedAt instanceof Date
      ? updatedPage.updatedAt.toISOString()
      : updatedPage.updatedAt;

    return NextResponse.json({ success: true, updatedAt });
  } catch (error) {
    if (error instanceof PageContentNormalizationError) {
      return NextResponse.json(
        { error: 'Invalid page components', diagnostics: error.diagnostics },
        { status: 400 }
      );
    }
    console.error('Structural page components PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save page components' }, { status: 500 });
  }
}
