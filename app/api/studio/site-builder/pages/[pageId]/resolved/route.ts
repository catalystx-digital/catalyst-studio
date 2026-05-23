import { NextRequest, NextResponse } from 'next/server';
import { performance } from 'node:perf_hooks';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { contentReferenceSyncService } from '@/lib/services/content-reference/sync-service';

type UpdateOperation =
  | {
      type: 'shared';
      sharedId: string;
      content: Record<string, unknown>;
      ifUnchangedSince?: string;
    }
  | {
      type: 'override';
      instanceId: string;
      overrides: Record<string, unknown> | null;
    }
  | {
      type: 'addSharedInstance';
      sharedId: string;
      position: number;
      overrides?: Record<string, unknown>;
    }
  | {
      type: 'removeInstance';
      instanceId: string;
    }
  | {
      type: 'convertFullPropsToOverrides';
      instanceId: string;
      sharedId: string;
    };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const websiteId = request.nextUrl.searchParams.get('websiteId');

    if (!pageId || !websiteId) {
      return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
    }

    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, websiteId);

    const page = await getScopedPage(pageId, websiteId);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const start = performance.now();
    const resolved = await ContentRepository.getPageWithResolvedComponents(websiteId, pageId);

    if (process.env.NODE_ENV !== 'production') {
      try {
        const approxBytes = Buffer.byteLength(JSON.stringify(resolved));
        const durationMs = performance.now() - start;
        console.info('[ResolvedPageAPI] GET', {
          websiteId,
          pageId,
          componentCount: resolved.components?.length ?? 0,
          sizeKB: Number((approxBytes / 1024).toFixed(1)),
          durationMs: Number(durationMs.toFixed(1)),
        });
      } catch (instrumentationError) {
        console.warn('[ResolvedPageAPI] GET instrumentation failed', instrumentationError);
      }
    }

    return NextResponse.json(resolved, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error('Resolved page GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve page';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const websiteId = request.nextUrl.searchParams.get('websiteId');
    if (!pageId || !websiteId) {
      return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
    }

    let body: { updates?: UpdateOperation[] } & Partial<UpdateOperation>;
    try {
      body = (await request.json()) as { updates?: UpdateOperation[] } & Partial<UpdateOperation>;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
    }

    const updates: UpdateOperation[] = Array.isArray(body.updates)
      ? body.updates
      : normalizeSingleOperation(body);

    if (!updates.length) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, websiteId);

    const page = await getScopedPage(pageId, websiteId);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const start = performance.now();

    // Apply updates atomically when multiple provided
    await prisma.$transaction(async () => {
      for (const op of updates) {
        switch (op.type) {
          case 'shared': {
            await ContentRepository.saveSharedComponentContent(op.sharedId, op.content, {
              websiteId,
              ifUnchangedSince: op.ifUnchangedSince ? new Date(op.ifUnchangedSince) : undefined,
            });
            break;
          }
          case 'override': {
            await ContentRepository.savePageOverrides(pageId, op.instanceId, op.overrides);
            break;
          }
          case 'addSharedInstance': {
            await ContentRepository.addSharedInstanceToPage(
              pageId,
              op.sharedId,
              Math.max(0, Math.floor(op.position)),
              op.overrides
            );
            break;
          }
          case 'removeInstance': {
            await ContentRepository.removeSharedInstanceFromPage(pageId, op.instanceId);
            break;
          }
          case 'convertFullPropsToOverrides': {
            await ContentRepository.convertFullPropsToOverrides(pageId, op.instanceId, op.sharedId);
            break;
          }
          default: {
            // @ts-expect-never safeguard for unhandled cases
            throw new Error(`Unsupported update type: ${(op as any)?.type}`);
          }
        }
      }
    });

    const resolved = await ContentRepository.getPageWithResolvedComponents(websiteId, pageId);
    await contentReferenceSyncService.syncPageReferences(pageId, resolved, websiteId);

    if (process.env.NODE_ENV !== 'production') {
      try {
        const durationMs = performance.now() - start;
        console.info('[ResolvedPageAPI] PUT', {
          websiteId,
          pageId,
          updateCount: updates.length,
          componentCount: resolved.components?.length ?? 0,
          durationMs: Number(durationMs.toFixed(1)),
        });
      } catch (instrumentationError) {
        console.warn('[ResolvedPageAPI] PUT instrumentation failed', instrumentationError);
      }
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Resolved page PUT error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save updates';
    const status = message.startsWith('Conflict') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function getScopedPage(pageId: string, websiteId: string) {
  const page = await prisma.websitePage.findUnique({
    where: { id: pageId },
    select: { id: true, websiteId: true },
  });

  if (!page || page.websiteId !== websiteId) {
    return null;
  }

  return page;
}

function normalizeSingleOperation(body: Partial<UpdateOperation> & { updates?: UpdateOperation[] }): UpdateOperation[] {
  if (!body || typeof body !== 'object') return [];
  if ('type' in body && body.type) {
    const t = body.type;
    if (t === 'shared' && 'sharedId' in body && 'content' in body) {
      return [
        {
          type: 'shared',
          sharedId: (body as any).sharedId,
          content: (body as any).content,
          ifUnchangedSince: (body as any).ifUnchangedSince,
        },
      ];
    }
    if (t === 'override' && 'instanceId' in body && 'overrides' in body) {
      return [
        {
          type: 'override',
          instanceId: (body as any).instanceId,
          overrides: (body as any).overrides,
        },
      ];
    }
    if (t === 'addSharedInstance' && 'sharedId' in body && 'position' in body) {
      return [
        {
          type: 'addSharedInstance',
          sharedId: (body as any).sharedId,
          position: Number((body as any).position) ?? 0,
          overrides: (body as any).overrides,
        },
      ];
    }
    if (t === 'removeInstance' && 'instanceId' in body) {
      return [
        {
          type: 'removeInstance',
          instanceId: (body as any).instanceId,
        },
      ];
    }
    if (t === 'convertFullPropsToOverrides' && 'instanceId' in body && 'sharedId' in body) {
      return [
        {
          type: 'convertFullPropsToOverrides',
          instanceId: (body as any).instanceId,
          sharedId: (body as any).sharedId,
        },
      ];
    }
  }
  return [];
}
