import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';

export interface VersionHistoryItem {
  id: string;
  contentTypeId: string;
  version: string;
  hash: string;
  parentHash?: string;
  createdAt: string;
  changeSource: 'UI' | 'API' | 'SYNC';
  author: string;
  changes: {
    added: number;
    modified: number;
    removed: number;
  };
  description?: string;
}

export async function GET(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    // Remove unused variable contentTypeId
    // const contentTypeId = searchParams.get('contentTypeId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query deployments from database
    const deployments = await prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Transform deployments to VersionHistoryItem format
    const items: VersionHistoryItem[] = deployments.map(deployment => {
      const deploymentData = deployment.deploymentData as Record<string, unknown> || {};
      
      // Extract change counts from deployment data
      const changes = {
        added: (typeof deploymentData.itemsAdded === 'number' ? deploymentData.itemsAdded : 0) || 0,
        modified: (typeof deploymentData.itemsModified === 'number' ? deploymentData.itemsModified : 0) || 0,
        removed: (typeof deploymentData.itemsRemoved === 'number' ? deploymentData.itemsRemoved : 0) || 0
      };

      return {
        id: deployment.id,
        contentTypeId: deployment.websiteId || 'unknown',
        version: (typeof deploymentData.version === 'string' ? deploymentData.version : '') || '1.0.0',
        hash: deployment.id, // Using ID as hash for now
        parentHash: undefined,
        createdAt: deployment.createdAt.toISOString(),
        changeSource: 'SYNC' as const,
        author: deployment.provider || 'system',
        changes,
        description: `Deployment ${deployment.status} - ${(typeof deploymentData.currentStep === 'string' ? deploymentData.currentStep : '') || 'No details'}`
      };
    });

    // Get total count for pagination
    const total = await prisma.deployment.count();
    
    return NextResponse.json({
      items,
      total,
      limit,
      offset
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve version history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.contentTypeId || !body.version || !body.hash) {
      return NextResponse.json(
        { error: 'Invalid version history data' },
        { status: 400 }
      );
    }

    // Create a new deployment record to track version history
    const deployment = await prisma.deployment.create({
      data: {
        websiteId: body.contentTypeId,
        provider: body.author || 'system',
        status: 'completed',
        deploymentData: {
          version: body.version,
          progress: 100,
          currentStep: body.description || 'Version created',
          logs: [],
          itemsAdded: body.changes?.added || 0,
          itemsModified: body.changes?.modified || 0,
          itemsRemoved: body.changes?.removed || 0
        }
      }
    });

    const newVersion: VersionHistoryItem = {
      id: deployment.id,
      contentTypeId: body.contentTypeId,
      version: body.version,
      hash: body.hash,
      parentHash: body.parentHash,
      createdAt: deployment.createdAt.toISOString(),
      changeSource: body.changeSource || 'SYNC',
      author: body.author || 'system',
      changes: body.changes || { added: 0, modified: 0, removed: 0 },
      description: body.description
    };
    
    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create version history entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}