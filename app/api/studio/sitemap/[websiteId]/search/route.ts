import { NextRequest, NextResponse } from 'next/server';
import { pageSearchService } from '@/lib/studio/services/search/page-search-service';
import { unifiedLayoutService } from '@/lib/studio/services/layout/unified-layout-service';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/studio/sitemap/[websiteId]/search
 *
 * Search pages within a website. Returns results with positions
 * for "jump to node" functionality.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { websiteId } = await params;
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'search';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Validate websiteId
  if (!websiteId || websiteId.length > 100 || websiteId.length < 1) {
    return NextResponse.json({ error: 'Invalid website ID' }, { status: 400 });
  }

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Require minimum query length
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Ensure positions exist before searching
    await unifiedLayoutService.ensurePositionsExist(websiteId);

    if (type === 'autocomplete') {
      const suggestions = await pageSearchService.autocomplete(websiteId, query, limit);
      return NextResponse.json({ suggestions });
    }

    const results = await pageSearchService.searchPages(websiteId, query, { limit });
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[SearchAPI] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * GET /api/studio/sitemap/[websiteId]/search/home
 *
 * Find the home page position for a website.
 * Used for "Jump to Home" functionality.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { websiteId } = await params;

  // Validate websiteId
  if (!websiteId || websiteId.length > 100 || websiteId.length < 1) {
    return NextResponse.json({ error: 'Invalid website ID' }, { status: 400 });
  }

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Ensure positions exist
    await unifiedLayoutService.ensurePositionsExist(websiteId);

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'findHome') {
      const result = await pageSearchService.findHomePosition(websiteId);
      if (result) {
        return NextResponse.json(result);
      }
      return NextResponse.json({ error: 'Home page not found' }, { status: 404 });
    }

    if (action === 'getPosition' && body.structureId) {
      const position = await pageSearchService.getNodePosition(websiteId, body.structureId);
      if (position) {
        return NextResponse.json({ structureId: body.structureId, position });
      }
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[SearchAPI] POST error:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
