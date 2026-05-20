import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';

export interface SyncConflict {
  id: string;
  contentTypeId: string;
  baseVersion: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceChanges: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetChanges: any;
  conflictType: 'field_type_mismatch' | 'field_deletion' | 'schema_incompatible' | 'validation_failure';
  severity: 'high' | 'medium' | 'low';
  resolutionStrategy?: 'manual' | 'auto-merge' | 'prefer-source' | 'prefer-target';
  resolvedAt?: string;
  resolvedBy?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolution?: any;
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
    const status = searchParams.get('status');
    
    // Query deployments that contain conflicts
    const conflictDeployments = await prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // Extract conflicts from deployment logs
    const conflicts: SyncConflict[] = [];
    
    for (const deployment of conflictDeployments) {
      const deploymentData = deployment.deploymentData as Record<string, unknown> || {};
      const logs = Array.isArray(deploymentData.logs) ? deploymentData.logs as Array<Record<string, unknown>> : [];
      
      // Find conflict entries in logs
      const conflictLogs = logs.filter((log) => 
        log.level === 'conflict' || 
        (typeof log.message === 'string' && log.message.toLowerCase().includes('conflict')) ||
        log.type === 'conflict'
      );
      
      for (const conflictLog of conflictLogs) {
        // Determine conflict type based on log message
        let conflictType: SyncConflict['conflictType'] = 'validation_failure';
        let severity: SyncConflict['severity'] = 'medium';
        
        if (typeof conflictLog.message === 'string' && conflictLog.message.includes('field type')) {
          conflictType = 'field_type_mismatch';
          severity = 'high';
        } else if (typeof conflictLog.message === 'string' && (conflictLog.message.includes('field deletion') || conflictLog.message.includes('removed field'))) {
          conflictType = 'field_deletion';
          severity = 'high';
        } else if (typeof conflictLog.message === 'string' && conflictLog.message.includes('schema')) {
          conflictType = 'schema_incompatible';
          severity = 'high';
        }
        
        const conflict: SyncConflict = {
          id: `${deployment.id}-${conflicts.length}`,
          contentTypeId: deployment.websiteId || 'unknown',
          baseVersion: (typeof deploymentData.version === 'string' ? deploymentData.version : '') || '1.0.0',
          sourceChanges: conflictLog.sourceChanges || {},
          targetChanges: conflictLog.targetChanges || {},
          conflictType,
          severity,
          resolutionStrategy: conflictLog.resolved ? 'auto-merge' : undefined,
          resolvedAt: conflictLog.resolved ? (typeof conflictLog.timestamp === 'string' ? conflictLog.timestamp : undefined) : undefined,
          resolvedBy: conflictLog.resolved ? 'system' : undefined,
          resolution: conflictLog.resolution
        };
        
        conflicts.push(conflict);
      }
    }
    
    // Group conflicts by type and severity
    const conflictsByType = new Map<string, number>();
    const conflictsBySeverity = new Map<string, number>();
    
    conflicts.forEach(c => {
      conflictsByType.set(c.conflictType, (conflictsByType.get(c.conflictType) || 0) + 1);
      conflictsBySeverity.set(c.severity, (conflictsBySeverity.get(c.severity) || 0) + 1);
    });
    
    // Generate resolution suggestions based on conflict type
    conflicts.forEach(c => {
      if (!c.resolutionStrategy) {
        switch (c.conflictType) {
          case 'field_type_mismatch':
            c.resolutionStrategy = 'manual';
            break;
          case 'field_deletion':
            c.resolutionStrategy = 'prefer-source';
            break;
          case 'schema_incompatible':
            c.resolutionStrategy = 'manual';
            break;
          case 'validation_failure':
            c.resolutionStrategy = 'auto-merge';
            break;
        }
      }
    });
    
    // Filter by status if requested
    let filtered = conflicts;
    if (status === 'unresolved') {
      filtered = conflicts.filter(c => !c.resolvedAt);
    } else if (status === 'resolved') {
      filtered = conflicts.filter(c => c.resolvedAt);
    }
    
    return NextResponse.json({
      conflicts: filtered,
      total: filtered.length,
      unresolved: filtered.filter(c => !c.resolvedAt).length,
      resolved: filtered.filter(c => c.resolvedAt).length
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve conflicts', details: error instanceof Error ? error.message : 'Unknown error' },
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

    if (!body.contentTypeId || !body.conflictType) {
      return NextResponse.json(
        { error: 'Invalid conflict data' },
        { status: 400 }
      );
    }

    // Create or update deployment with conflict in logs
    const deployment = await prisma.deployment.create({
      data: {
        websiteId: body.contentTypeId,
        provider: 'conflict-reporter',
        status: 'failed',
        deploymentData: {
          version: body.baseVersion || '1.0.0',
          progress: 0,
          currentStep: 'Conflict detected',
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'conflict',
            type: 'conflict',
            message: `${body.conflictType}: Conflict detected`,
            sourceChanges: body.sourceChanges,
            targetChanges: body.targetChanges,
            severity: body.severity || 'medium'
          }]
        },
        errorMessage: `Conflict: ${body.conflictType}`
      }
    });

    const newConflict: SyncConflict = {
      id: deployment.id,
      contentTypeId: body.contentTypeId,
      baseVersion: body.baseVersion || '1.0.0',
      sourceChanges: body.sourceChanges,
      targetChanges: body.targetChanges,
      conflictType: body.conflictType,
      severity: body.severity || 'medium',
      resolutionStrategy: body.resolutionStrategy
    };
    
    return NextResponse.json(newConflict, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync conflict detected, manual resolution required', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 409 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const conflictId = searchParams.get('id');
    const body = await request.json();
    
    if (!conflictId) {
      return NextResponse.json(
        { error: 'Conflict ID required' },
        { status: 400 }
      );
    }

    // Extract deployment ID from conflict ID
    const deploymentId = conflictId.split('-')[0];
    
    // Update deployment with resolution
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId }
    });
    
    if (!deployment) {
      return NextResponse.json(
        { error: 'Sync record not found' },
        { status: 404 }
      );
    }

    const deploymentData = deployment.deploymentData as Record<string, unknown> || {};
    const logs = Array.isArray(deploymentData.logs) ? deploymentData.logs : [];
    
    // Mark conflict as resolved in logs
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Conflict resolved',
      resolutionStrategy: body.resolutionStrategy,
      resolution: body.resolution,
      resolvedBy: body.resolvedBy || 'user'
    });

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        deploymentData: {
          ...deploymentData,
          logs
        }
      }
    });

    const resolvedConflict: SyncConflict = {
      id: conflictId,
      contentTypeId: deployment.websiteId || 'unknown',
      baseVersion: (typeof deploymentData.version === 'string' ? deploymentData.version : '') || '1.0.0',
      sourceChanges: body.sourceChanges || {},
      targetChanges: body.targetChanges || {},
      conflictType: body.conflictType || 'validation_failure',
      severity: body.severity || 'medium',
      resolutionStrategy: body.resolutionStrategy,
      resolution: body.resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy: body.resolvedBy || 'user'
    };

    return NextResponse.json(resolvedConflict, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to resolve conflict', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}