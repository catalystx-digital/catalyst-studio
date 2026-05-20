import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

export interface SyncStatus {
  status: 'in_progress' | 'completed' | 'failed' | 'pending' | 'idle';
  progress: number;
  currentStep: string;
  totalSteps: number;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  errors: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    timestamp: string;
  }>;
  validationResults?: {
    passed: boolean;
    errors: number;
    warnings: number;
    details: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  };
}


export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    const websiteId = searchParams.get('websiteId') || undefined;

    // If websiteId provided, verify ownership
    if (websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    }

    let deployment;
    
    if (deploymentId) {
      // Query specific deployment by ID
      deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId }
      });
    } else {
      // Only return ACTIVE deployments when no deploymentId is provided.
      // If websiteId is provided, scope to that website; otherwise return idle.
      const activeStatuses = ['pending', 'queued', 'processing', 'running'] as const;

      if (websiteId) {
        deployment = await prisma.deployment.findFirst({
          where: {
            websiteId,
            status: { in: activeStatuses as unknown as string[] },
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        deployment = null;
      }
    }
    
    if (!deployment) {
      // No deployments exist, return idle status
      const idleStatus: SyncStatus = {
        status: 'idle',
        progress: 0,
        currentStep: '',
        totalSteps: 0,
        errors: []
      };
      return NextResponse.json(idleStatus, { status: 200, headers });
    }
    
    // Extract from deploymentData JSON
    const deploymentData = deployment.deploymentData as Record<string, unknown> || {};
    const logs = Array.isArray(deploymentData.logs) ? deploymentData.logs as Array<Record<string, unknown>> : [];
    
    // Map deployment status to SyncStatus
    let status: SyncStatus['status'] = 'idle';
    if (deployment.status === 'running') status = 'in_progress';
    else if (deployment.status === 'completed') status = 'completed';
    else if (deployment.status === 'failed') status = 'failed';
    else if (deployment.status === 'pending') status = 'pending';
    
    // Extract errors from logs
    const errors = logs
      .filter((log) => log.level === 'error' || log.level === 'warning')
      .map((log) => ({
        code: (typeof log.code === 'string' ? log.code : '') || 'UNKNOWN',
        message: (typeof log.message === 'string' ? log.message : '') || 'Unknown error',
        severity: log.level === 'error' ? 'error' as const : 'warning' as const,
        timestamp: (typeof log.timestamp === 'string' ? log.timestamp : '') || new Date().toISOString()
      }));
    
    const currentSyncStatus: SyncStatus = {
      status,
      progress: typeof deploymentData.progress === 'number' ? deploymentData.progress : 0,
      currentStep: (typeof deploymentData.currentStep === 'string' ? deploymentData.currentStep : '') || '',
      totalSteps: typeof deploymentData.totalSteps === 'number' ? deploymentData.totalSteps : 0,
      startedAt: deployment.createdAt.toISOString(),
      completedAt: deployment.status === 'completed' || deployment.status === 'failed' 
        ? deployment.updatedAt.toISOString() 
        : undefined,
      errors,
      validationResults: deploymentData.validationResults as SyncStatus['validationResults']
    };
    
    return NextResponse.json(currentSyncStatus, { 
      status: 200,
      headers 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve sync status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { error: 'Invalid sync configuration' },
        { status: 400 }
      );
    }

    // If websiteId provided, verify ownership
    if (body.websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, body.websiteId);
    }

    // Create or update deployment record
    let deployment;
    if (body.deploymentId) {
      // Update existing deployment
      deployment = await prisma.deployment.update({
        where: { id: body.deploymentId },
        data: {
          status: body.status === 'in_progress' ? 'running' : body.status,
          deploymentData: {
            ...(body.deploymentData || {}),
            progress: body.progress || 0,
            currentStep: body.currentStep || '',
            totalSteps: body.totalSteps || 0,
            logs: body.errors || [],
            validationResults: body.validationResults
          }
        }
      });
    } else {
      // Create new deployment
      deployment = await prisma.deployment.create({
        data: {
          websiteId: body.websiteId || 'default',
          provider: body.provider || 'manual',
          status: body.status === 'in_progress' ? 'running' : body.status,
          deploymentData: {
            version: body.version || '1.0.0',
            progress: body.progress || 0,
            currentStep: body.currentStep || '',
            totalSteps: body.totalSteps || 0,
            logs: body.errors || [],
            validationResults: body.validationResults
          }
        }
      });
    }

    const updatedStatus: SyncStatus = {
      status: body.status,
      progress: body.progress || 0,
      currentStep: body.currentStep || '',
      totalSteps: body.totalSteps || 0,
      startedAt: deployment.createdAt.toISOString(),
      completedAt: body.status === 'completed' || body.status === 'failed' 
        ? deployment.updatedAt.toISOString() 
        : undefined,
      errors: body.errors || [],
      validationResults: body.validationResults
    };

    return NextResponse.json(updatedStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync engine error, check logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
