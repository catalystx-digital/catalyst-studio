import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';

interface DeploymentDataWithLogs {
  logs?: Array<{
    level: string;
    message?: string;
    timestamp?: string;
  }>;
  [key: string]: unknown;
}

export interface SyncAnalytics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  averageDuration: number;
  conflictsPerSync: number;
  validationErrorsPerSync: number;
  mostSyncedContentTypes: Array<{
    contentTypeId: string;
    name: string;
    count: number;
  }>;
  syncVolumeOverTime: Array<{
    date: string;
    count: number;
    successful: number;
    failed: number;
  }>;
  recentSyncs: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'failed';
    duration: number;
    conflicts: number;
    validationErrors: number;
  }>;
}


export async function GET(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Remove unused searchParams destructuring
    // const { searchParams } = new URL(request.url);
    // const period = searchParams.get('period') || '7d';
    // const contentTypeId = searchParams.get('contentTypeId');
    
    // Query all deployments
    const allDeployments = await prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate real metrics
    const totalSyncs = allDeployments.length;
    const successfulSyncs = allDeployments.filter(d => d.status === 'completed').length;
    const failedSyncs = allDeployments.filter(d => d.status === 'failed').length;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    // Calculate average duration using difference between createdAt and updatedAt
    const durationsMs = allDeployments
      .filter(d => d.status === 'completed')
      .map(d => d.updatedAt.getTime() - d.createdAt.getTime());
    const averageDuration = durationsMs.length > 0 
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 1000)
      : 0;
    
    // Group deployments by provider for statistics
    const providerStats = new Map<string, number>();
    allDeployments.forEach(d => {
      const provider = d.provider || 'unknown';
      providerStats.set(provider, (providerStats.get(provider) || 0) + 1);
    });
    
    const mostSyncedContentTypes = Array.from(providerStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([provider, count]) => ({
        contentTypeId: provider,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        count
      }));
    
    // Build syncVolumeOverTime array for last 7 days
    const now = new Date();
    const syncVolumeOverTime = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayDeployments = allDeployments.filter(d => {
        const deployDate = d.createdAt.toISOString().split('T')[0];
        return deployDate === dateStr;
      });
      
      syncVolumeOverTime.push({
        date: dateStr,
        count: dayDeployments.length,
        successful: dayDeployments.filter(d => d.status === 'completed').length,
        failed: dayDeployments.filter(d => d.status === 'failed').length
      });
    }
    
    // Get recent deployments
    const recentSyncs = allDeployments.slice(0, 10).map(d => {
      const deploymentData = d.deploymentData as DeploymentDataWithLogs || {};
      const logs = Array.isArray(deploymentData.logs) ? deploymentData.logs : [];
      const conflicts = logs.filter((l) => l.level === 'conflict').length;
      const validationErrors = logs.filter((l) => l.level === 'error').length;
      
      return {
        id: d.id,
        timestamp: d.createdAt.toISOString(),
        status: d.status === 'completed' ? 'success' as const : 'failed' as const,
        duration: Math.round((d.updatedAt.getTime() - d.createdAt.getTime()) / 1000),
        conflicts,
        validationErrors
      };
    });
    
    // Calculate conflicts and validation errors per sync
    const conflictsPerSync = recentSyncs.length > 0
      ? recentSyncs.reduce((sum, s) => sum + s.conflicts, 0) / recentSyncs.length
      : 0;
    const validationErrorsPerSync = recentSyncs.length > 0
      ? recentSyncs.reduce((sum, s) => sum + s.validationErrors, 0) / recentSyncs.length
      : 0;
    
    const analytics: SyncAnalytics = {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate,
      averageDuration,
      conflictsPerSync,
      validationErrorsPerSync,
      mostSyncedContentTypes,
      syncVolumeOverTime,
      recentSyncs
    };
    
    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve sync analytics', details: error instanceof Error ? error.message : 'Unknown error' },
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

    if (!body.syncId || !body.status) {
      return NextResponse.json(
        { error: 'Invalid analytics data' },
        { status: 400 }
      );
    }

    // Update deployment with analytics data
    const deployment = await prisma.deployment.update({
      where: { id: body.syncId },
      data: {
        status: body.status === 'success' ? 'completed' : 'failed',
        deploymentData: {
          ...(body.deploymentData || {}),
          conflicts: body.conflicts || 0,
          validationErrors: body.validationErrors || 0,
          duration: body.duration || 0
        }
      }
    });

    const newSync = {
      id: deployment.id,
      timestamp: deployment.createdAt.toISOString(),
      status: body.status as 'success' | 'failed',
      duration: body.duration || 0,
      conflicts: body.conflicts || 0,
      validationErrors: body.validationErrors || 0
    };
    
    return NextResponse.json({ message: 'Analytics recorded', sync: newSync }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to record analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}