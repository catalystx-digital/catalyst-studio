import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { startDeploymentSchema } from '@/lib/api/validation/deployment';
import { withTransaction } from '@/lib/utils/transaction-manager';
import { getAuthContext } from '@/lib/auth/context';
import { ErrorHandlers, handleApiError } from '@/lib/api/errors';
import { IntegrationUsageAction, Prisma } from '@/lib/generated/prisma';
import { IntegrationService } from '@/lib/studio/services/integration-service';
import { enumToSlug } from '@/lib/studio/integrations/definitions';
import { DeploymentExecutor } from '@/lib/services/export/deployment-executor';

interface DeploymentProviderContext {
  providerId: string;
  providerName: string;
  integrationKey: string;
  config?: Record<string, unknown>;
}

interface IntegrationUsageRuntimeContext {
  id: string;
  metadata: Record<string, unknown>;
}

interface DeploymentRuntimeContext extends DeploymentProviderContext {
  integrationUsage?: IntegrationUsageRuntimeContext;
  /** Publish content after export instead of leaving as draft */
  publish?: boolean;
}

function maskIdentifier(value: unknown, visibleChars = 4): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'unknown';
  }
  const trimmed = value.trim();
  if (trimmed.length <= visibleChars) {
    return "***";
  }
  return "***";
}

function getIntegrationService() {
  return new IntegrationService(prisma);
}


export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsedResult = startDeploymentSchema.safeParse(body);

    if (!parsedResult.success) {
      throw ErrorHandlers.badRequest('Invalid request data', parsedResult.error.flatten());
    }

    const { websiteId, integrationId, selectedTypes, publish } = parsedResult.data;
    const normalisedSelectedTypes = selectedTypes ?? [];
    const shouldPublish = publish ?? false;

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, accountId: true },
    });

    if (!website) {
      throw ErrorHandlers.notFound('Website');
    }

    if (!website.accountId || website.accountId !== auth.accountId) {
      throw ErrorHandlers.forbidden('Website does not belong to the authenticated account');
    }

    const integrationService = getIntegrationService();
    const resolvedIntegration = await integrationService.resolveForDeployment(auth.accountId, integrationId);

    const providerSlug = enumToSlug(resolvedIntegration.integration.provider);
    const providerDisplayName = resolvedIntegration.integration.displayName || providerSlug;

    const providerContext: DeploymentProviderContext = {
      providerId: providerSlug,
      providerName: providerDisplayName,
      integrationKey: `${auth.accountId}:${resolvedIntegration.integration.id}`,
      config: resolvedIntegration.providerConfig,
    };

    const usageMetadata: Record<string, unknown> = {
      status: 'queued',
      provider: providerSlug,
      integrationId: resolvedIntegration.integration.id,
      selectedTypes: normalisedSelectedTypes,
      queuedAt: new Date().toISOString(),
    };

    const deploymentId = uuidv4();
    const { deployment, usageRecord } = await withTransaction(async tx => {
      const activeDeployment = await tx.deployment.findFirst({
        where: {
          websiteId,
          status: {
            in: ['pending', 'queued', 'processing', 'running'],
          },
        },
      });

      if (activeDeployment) {
        throw ErrorHandlers.conflict('Another deployment is already in progress for this website');
      }

      const deploymentData: Record<string, unknown> = {
        providerName: providerContext.providerName,
        selectedTypes: normalisedSelectedTypes,
        progress: 0,
      };

      deploymentData.integrationId = resolvedIntegration.integration.id;
      deploymentData.integrationDisplayName = resolvedIntegration.integration.displayName;

      const createdDeployment = await tx.deployment.create({
        data: {
          id: deploymentId,
          websiteId,
          provider: providerContext.providerId,
          status: 'pending',
          deploymentData: deploymentData as unknown as Prisma.InputJsonValue,
          accountId: auth.accountId,
          accountIntegrationId: resolvedIntegration.integration.id,
        },
      });

      const usage = await tx.integrationUsage.create({
        data: {
          accountIntegrationId: resolvedIntegration.integration.id,
          accountId: auth.accountId,
          websiteId,
          deploymentId,
          action: IntegrationUsageAction.deploy,
          metadata: usageMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        deployment: createdDeployment,
        usageRecord: {
          id: usage.id,
          metadata: usageMetadata,
        },
      };
    });

    console.log('[START-DEPLOYMENT] Scheduling deployment', {
      deploymentId,
      websiteId,
      provider: providerContext.providerId,
    });

    const runtimeContext: DeploymentRuntimeContext = {
      ...providerContext,
      integrationUsage: usageRecord,
      publish: shouldPublish,
    };

    setImmediate(async () => {
      try {
        await processDeployment(deploymentId, runtimeContext);
      } catch (error) {
        console.error(`[START-DEPLOYMENT] Deployment ${deploymentId} failed:`, error);
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    const deploymentData = (deployment.deploymentData as Record<string, unknown> | null) ?? {};

    return NextResponse.json({
      success: true,
      deploymentId,
      deployment: {
        id: deployment.id,
        status: deployment.status,
        progress: (deploymentData.progress as number) || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function processDeployment(deploymentId: string, context: DeploymentRuntimeContext) {
  console.log('[PROCESS-DEPLOYMENT] Starting deployment processing for:', deploymentId);
  const usageContext = context.integrationUsage
    ? { id: context.integrationUsage.id, metadata: { ...context.integrationUsage.metadata } }
    : null;

  const updateUsage = async (patch: Record<string, unknown>) => {
    if (!usageContext) {
      return;
    }

    usageContext.metadata = { ...usageContext.metadata, ...patch };

    try {
      await prisma.integrationUsage.update({
        where: { id: usageContext.id },
        data: {
          metadata: usageContext.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (usageError) {
      console.error('[START-DEPLOYMENT] Failed to update integration usage', usageError);
    }
  };

  // Helper function to update deployment progress with more details
  const updateProgress = async (
    progress: number,
    message: string,
    level: 'info' | 'error' | 'warning' = 'info',
    additionalData?: {
      currentStep?: string;
      totalSteps?: number;
      itemsProcessed?: number;
      totalItems?: number;
    }
  ) => {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deploymentDataObj = (deployment?.deploymentData as any) || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs: any[] = deploymentDataObj.logs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });

    deploymentDataObj.logs = logs;
    deploymentDataObj.progress = progress;

    // Add additional progress tracking data
    if (additionalData) {
      if (additionalData.currentStep) deploymentDataObj.currentStep = additionalData.currentStep;
      if (additionalData.totalSteps) deploymentDataObj.totalSteps = additionalData.totalSteps;
      if (additionalData.itemsProcessed !== undefined) deploymentDataObj.itemsProcessed = additionalData.itemsProcessed;
      if (additionalData.totalItems !== undefined) deploymentDataObj.totalItems = additionalData.totalItems;
    }

    // Use transaction for atomic update
    await withTransaction(async (tx) => {
      await tx.deployment.update({
        where: { id: deploymentId },
        data: {
          deploymentData: deploymentDataObj,
        },
      });
    });
  };

  try {
    // Get deployment details with website ID
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: {
        websiteId: true,
        deploymentData: true,
      },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Update status to running
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentDeploymentData = (deployment.deploymentData as any) || {};
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'running',
        deploymentData: {
          ...currentDeploymentData,
          progress: 5
        },
      },
    });

    await updateUsage({ status: 'running', startedAt: new Date().toISOString() });

    // Execute deployment using DeploymentExecutor
    const executor = new DeploymentExecutor();

    const result = await executor.execute(
      {
        websiteId: deployment.websiteId,
        providerId: context.providerId,
        providerConfig: context.config,
        options: {
          includeComponents: true,
          includeFolders: true,
          includeContentItems: true,
          publish: context.publish === true,
        },
      },
      {
        onProgress: async (progress) => {
          await updateProgress(
            progress.progress,
            progress.message,
            progress.level,
            {
              currentStep: progress.currentStep,
              totalSteps: progress.totalSteps,
              itemsProcessed: progress.itemsProcessed,
              totalItems: progress.totalItems,
            }
          );
        },
        checkCancelled: async () => {
          const currentDeployment = await prisma.deployment.findUnique({
            where: { id: deploymentId },
            select: { status: true },
          });
          return currentDeployment?.status === 'cancelled';
        },
      }
    );

    // Update deployment status based on result
    if (result.success) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'completed',
          deployedAt: new Date(),
        },
      });

      await updateUsage({
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        statistics: result.statistics,
      });
    } else {
      throw new Error(result.error || 'Deployment failed');
    }
  } catch (error) {
    // Update deployment as failed
    const errorMessage = error instanceof Error ? error.message : 'Deployment failed';

    await updateProgress(
      0,
      errorMessage,
      'error'
    );

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'failed',
        errorMessage: errorMessage,
      },
    });

    await updateUsage({
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const deploymentId = searchParams.get('id');

  if (!deploymentId) {
    return NextResponse.json(
      { success: false, error: 'Deployment ID required' },
      { status: 400 }
    );
  }

  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { website: { select: { accountId: true } } },
    });

    if (!deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (!deployment.website?.accountId || deployment.website.accountId !== auth.accountId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deploymentDataObj = (deployment.deploymentData as any) || {};
    
    return NextResponse.json({ 
      success: true, 
      job: {
        id: deployment.id,
        websiteId: deployment.websiteId,
        provider: deployment.provider,
        status: deployment.status,
        progress: deploymentDataObj.progress || 0,
        logs: deploymentDataObj.logs || [],
        startedAt: deployment.createdAt,
        completedAt: deployment.updatedAt,
        error: deployment.errorMessage,
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to get deployment:', error);
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve deployment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const deploymentId = searchParams.get('id');

  if (!deploymentId) {
    return NextResponse.json(
      { success: false, error: 'Deployment ID required' },
      { status: 400 }
    );
  }

  try {
    // First check if the deployment exists
    const currentDeployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { website: { select: { accountId: true } } },
    });

    if (!currentDeployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (!currentDeployment.website?.accountId || currentDeployment.website.accountId !== auth.accountId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if deployment can be cancelled (only running/pending deployments)
    if (!['running', 'pending', 'queued', 'processing'].includes(currentDeployment.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot cancel deployment with status: ${currentDeployment.status}` },
        { status: 400 }
      );
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deploymentDataObj = (currentDeployment?.deploymentData as any) || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cancelLogs: any[] = deploymentDataObj.logs || [];
    cancelLogs.push({
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: 'Deployment cancelled by user',
    });
    
    deploymentDataObj.logs = cancelLogs;
    
    // Update the deployment with proper error handling
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { 
        status: 'cancelled',
        deploymentData: deploymentDataObj,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to cancel deployment:', error);
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to cancel deployment' },
      { status: 500 }
    );
  }
}



