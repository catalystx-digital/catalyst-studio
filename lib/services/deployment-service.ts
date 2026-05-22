import { PrismaClient } from '@/lib/generated/prisma';

export interface DeploymentConfig {
  deploymentId: string;
  websiteId: string;
  provider: string;
  selectedTypes: string[];
}

export interface ContentType {
  key: string;
  versionHash?: string;
  data: Record<string, unknown>;
}

export interface ChangeSummary {
  summary: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
    unchanged: number;
  };
  details?: {
    created: Array<Record<string, unknown>>;
    updated: Array<Record<string, unknown>>;
    deleted: Array<Record<string, unknown>>;
  };
  timestamp: string;
}

export class DeploymentService {
  constructor(
    private prisma: PrismaClient,
    private provider: string = 'optimizely'
  ) {
    // Simplified constructor - old sync system removed
  }
  
  /**
   * Check for interrupted syncs (deployments stuck in running state)
   */
  async checkInterruptedSyncs(): Promise<{
    interrupted: string[];
    resumed: string[];
    failed: string[];
  }> {
    // Query deployments where status = 'running' AND updatedAt > 1 hour ago
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const stuckDeployments = await this.prisma.deployment.findMany({
      where: {
        status: 'running',
        updatedAt: { lt: oneHourAgo }
      },
      select: { id: true }
    });
    
    const interrupted = stuckDeployments.map(d => d.id);
    
    // Mark stuck deployments as failed
    if (interrupted.length > 0) {
      await this.prisma.deployment.updateMany({
        where: {
          id: { in: interrupted }
        },
        data: {
          status: 'failed',
          errorMessage: 'Deployment timed out after 1 hour'
        }
      });
    }
    
    return {
      interrupted,
      resumed: [],
      failed: interrupted
    };
  }
  
  /**
   * Detect changes between current deployment state and previous
   */
  async detectChanges(websiteId?: string): Promise<ChangeSummary> {
    // Query current deployment state
    const latestDeployment = await this.prisma.deployment.findFirst({
      where: websiteId ? { websiteId } : {},
      orderBy: { createdAt: 'desc' }
    });
    
    if (!latestDeployment) {
      return {
        summary: {
          total: 0,
          created: 0,
          updated: 0,
          deleted: 0,
          unchanged: 0
        },
        timestamp: new Date().toISOString()
      };
    }
    
    const deploymentData = latestDeployment.deploymentData as any || {};
    
    return {
      summary: {
        total: (deploymentData.itemsAdded || 0) + (deploymentData.itemsModified || 0) + (deploymentData.itemsRemoved || 0),
        created: deploymentData.itemsAdded || 0,
        updated: deploymentData.itemsModified || 0,
        deleted: deploymentData.itemsRemoved || 0,
        unchanged: deploymentData.itemsUnchanged || 0
      },
      timestamp: latestDeployment.createdAt.toISOString()
    };
  }
  
  /**
   * Get change summary by comparing last 2 deployments
   */
  async getChangeSummary(websiteId: string): Promise<ChangeSummary> {
    // Query last 2 deployments for the website
    const deployments = await this.prisma.deployment.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    
    if (deployments.length < 2) {
      // Not enough deployments to compare
      return this.detectChanges(websiteId);
    }
    
    const [current, previous] = deployments;
    const currentData = current.deploymentData as any || {};
    const previousData = previous.deploymentData as any || {};
    
    // Calculate changes between deployments
    const changes = {
      created: Math.max(0, (currentData.itemsAdded || 0) - (previousData.itemsAdded || 0)),
      updated: Math.max(0, (currentData.itemsModified || 0) - (previousData.itemsModified || 0)),
      deleted: Math.max(0, (currentData.itemsRemoved || 0) - (previousData.itemsRemoved || 0))
    };
    
    return {
      summary: {
        total: changes.created + changes.updated + changes.deleted,
        created: changes.created,
        updated: changes.updated,
        deleted: changes.deleted,
        unchanged: 0
      },
      timestamp: current.createdAt.toISOString()
    };
  }
  
  /**
   * Detect conflicts for a deployment
   * @deprecated Conflict detection removed with old sync system
   */
  async detectConflicts(deploymentConfig: DeploymentConfig): Promise<any> {
    return {
      hasConflicts: false,
      conflicts: [],
      summary: {
        total: 0,
        byType: {},
        bySeverity: {}
      }
    };
  }
  
  /**
   * Apply resolution strategies to conflicts
   * @deprecated Conflict resolution removed with old sync system
   */
  async resolveConflicts(conflicts: any[], strategy: string = 'AUTO'): Promise<any> {
    return {
      resolved: [],
      failed: [],
      summary: {
        totalResolved: 0,
        totalFailed: 0
      }
    };
  }
  
  /**
   * Get deployment statistics for a website
   */
  async getDeploymentStats(websiteId: string): Promise<{
    totalCount: number;
    countByStatus: Record<string, number>;
    lastDeploymentDate: Date | null;
    successRate: number;
  }> {
    const deployments = await this.prisma.deployment.findMany({
      where: { websiteId },
      select: { status: true, createdAt: true }
    });
    
    const countByStatus: Record<string, number> = {};
    deployments.forEach(d => {
      countByStatus[d.status] = (countByStatus[d.status] || 0) + 1;
    });
    
    const totalCount = deployments.length;
    const successCount = countByStatus['completed'] || 0;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    
    const lastDeploymentDate = deployments.length > 0 
      ? deployments[0].createdAt 
      : null;
    
    return {
      totalCount,
      countByStatus,
      lastDeploymentDate,
      successRate
    };
  }
}
