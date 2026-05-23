jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1' }),
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/unified-content-repository', () => ({
  ContentRepository: {
    getPageWithResolvedComponents: jest.fn(),
    saveSharedComponentContent: jest.fn(),
  },
}));

jest.mock('@/lib/services/content-reference/sync-service', () => ({
  contentReferenceSyncService: {
    syncPageReferences: jest.fn(),
  },
}));

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/studio/site-builder/pages/[pageId]/resolved/route';
import { prisma } from '@/lib/prisma';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { contentReferenceSyncService } from '@/lib/services/content-reference/sync-service';

describe('/api/studio/site-builder/pages/[pageId]/resolved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback());
  });

  it('requires websiteId before looking up the page', async () => {
    const request = new NextRequest('http://localhost/api/studio/site-builder/pages/page-1/resolved');

    const response = await GET(request, { params: Promise.resolve({ pageId: 'page-1' }) });

    expect(response.status).toBe(400);
    expect(prisma.websitePage.findUnique).not.toHaveBeenCalled();
    expect(assertWebsiteOwnership).not.toHaveBeenCalled();
  });

  it('authenticates the provided website before resolving a scoped page', async () => {
    (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-1', websiteId: 'website-1' });
    (ContentRepository.getPageWithResolvedComponents as jest.Mock).mockResolvedValue({
      id: 'page-1',
      components: [],
    });
    const request = new NextRequest(
      'http://localhost/api/studio/site-builder/pages/page-1/resolved?websiteId=website-1',
    );

    const response = await GET(request, { params: Promise.resolve({ pageId: 'page-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: 'page-1', components: [] });
    expect(assertWebsiteOwnership).toHaveBeenCalledWith(prisma, 'account-1', 'website-1');
    expect(ContentRepository.getPageWithResolvedComponents).toHaveBeenCalledWith('website-1', 'page-1');
  });

  it('returns 404 when the page belongs to a different website', async () => {
    (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-1', websiteId: 'website-2' });
    const request = new NextRequest(
      'http://localhost/api/studio/site-builder/pages/page-1/resolved?websiteId=website-1',
    );

    const response = await GET(request, { params: Promise.resolve({ pageId: 'page-1' }) });

    expect(response.status).toBe(404);
    expect(ContentRepository.getPageWithResolvedComponents).not.toHaveBeenCalled();
  });

  it('returns malformed JSON errors instead of normalizing to an empty update', async () => {
    const request = new NextRequest(
      'http://localhost/api/studio/site-builder/pages/page-1/resolved?websiteId=website-1',
      {
        method: 'PUT',
        body: '{"updates":',
      },
    );

    const response = await PUT(request, { params: Promise.resolve({ pageId: 'page-1' }) });

    expect(response.status).toBe(400);
    expect(prisma.websitePage.findUnique).not.toHaveBeenCalled();
  });

  it('surfaces content reference sync failures after saving updates', async () => {
    (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-1', websiteId: 'website-1' });
    (ContentRepository.getPageWithResolvedComponents as jest.Mock).mockResolvedValue({
      id: 'page-1',
      components: [],
    });
    (contentReferenceSyncService.syncPageReferences as jest.Mock).mockRejectedValue(new Error('sync failed'));
    const request = new NextRequest(
      'http://localhost/api/studio/site-builder/pages/page-1/resolved?websiteId=website-1',
      {
        method: 'PUT',
        body: JSON.stringify({
          updates: [{ type: 'shared', sharedId: 'shared-1', content: { title: 'Title' } }],
        }),
      },
    );

    const response = await PUT(request, { params: Promise.resolve({ pageId: 'page-1' }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('sync failed');
    expect(ContentRepository.saveSharedComponentContent).toHaveBeenCalledWith(
      'shared-1',
      { title: 'Title' },
      { websiteId: 'website-1', ifUnchangedSince: undefined },
    );
  });
});
