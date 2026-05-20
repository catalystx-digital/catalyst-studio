/**
 * DeploymentExecutor - Reusable CMS export/deployment executor
 *
 * This class extracts the core deployment logic from the API route
 * into a reusable form that works with any progress/cancellation mechanism.
 *
 * Used by:
 * - API route (app/api/sync/start-deployment/route.ts) - with DB callbacks
 * - CLI script (scripts/standalone-export.ts) - with console callbacks
 */

import { ProviderRegistry } from '@/lib/cms-export/registry';
import { ProviderFactory } from '@/lib/cms-export/factory';
import { BundleExporter } from './bundle-exporter';
import type {
  DeploymentExecutorConfig,
  DeploymentCallbacks,
  DeploymentResult,
  DeploymentProgress,
  DeploymentStatistics,
} from './deployment-executor.types';

export class DeploymentExecutor {
  /**
   * Execute a deployment/export to a CMS provider
   *
   * @param config - Deployment configuration
   * @param callbacks - Optional callbacks for progress and cancellation
   * @returns Deployment result with statistics
   */
  async execute(
    config: DeploymentExecutorConfig,
    callbacks?: DeploymentCallbacks
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const { websiteId, providerId, providerConfig, options = {} } = config;

    // Initialize statistics
    const statistics: DeploymentStatistics = {
      extracted: 0,
      transformed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      contentTypes: 0,
      contentItems: 0,
      components: 0,
      folders: 0,
    };

    const errorDetails: Array<{ id: string; message: string; payload?: unknown }> = [];

    try {
      // Step 1: Initializing
      await this.emitProgress(callbacks, {
        progress: 5,
        message: 'Starting deployment process...',
        level: 'info',
        currentStep: 'Initializing',
        totalSteps: 7,
      });

      if (await this.isCancelled(callbacks)) {
        return this.buildCancelledResult(config, statistics, startTime);
      }

      // Step 2: Configure provider
      await this.emitProgress(callbacks, {
        progress: 10,
        message: 'Using Enhanced Export Service for complete data extraction...',
        level: 'info',
        currentStep: 'Extracting data',
        totalSteps: 7,
      });

      // Create or get provider
      const registryKey = `${providerId}:standalone`;
      const registry = ProviderRegistry.getInstance();
      let cmsProvider = registry.getProvider(registryKey);

      if (!cmsProvider) {
        try {
          console.log(`[DeploymentExecutor] Creating ${providerId} provider`);
          cmsProvider = ProviderFactory.createProvider(providerId, providerConfig);
          registry.register(registryKey, cmsProvider);
          registry.setActiveProvider(registryKey);

          await this.emitProgress(callbacks, {
            progress: 15,
            message: `${providerId} provider configured successfully`,
            level: 'info',
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Provider creation failed';
          await this.emitProgress(callbacks, {
            progress: 15,
            message: `Error: ${errorMessage}`,
            level: 'error',
          });
          return {
            success: false,
            statistics,
            error: `Failed to create ${providerId} provider: ${errorMessage}`,
            durationMs: Date.now() - startTime,
            providerId,
            websiteId,
          };
        }
      }

      if (await this.isCancelled(callbacks)) {
        return this.buildCancelledResult(config, statistics, startTime);
      }

      // Step 3: Extract and export data
      await this.emitProgress(callbacks, {
        progress: 20,
        message: 'Extracting data from database...',
        level: 'info',
        currentStep: 'Validating',
        totalSteps: 7,
      });

      const exportService = new BundleExporter(cmsProvider);

      let result;
      try {
        result = await exportService.export(websiteId, {
          includeComponents: options.includeComponents !== false,
          includeFolders: options.includeFolders !== false,
          includeContentItems: options.includeContentItems !== false,
          publish: options.publish === true,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Export failed';
        await this.emitProgress(callbacks, {
          progress: 25,
          message: `Export failed: ${errorMessage}`,
          level: 'error',
        });
        return {
          success: false,
          statistics,
          error: `Export failed: ${errorMessage}`,
          durationMs: Date.now() - startTime,
          providerId,
          websiteId,
        };
      }

      const { exportData, syncResults } = result;

      // Update statistics from export
      statistics.contentTypes = exportData.contentTypes.length;
      statistics.contentItems = exportData.contentItems.length;
      statistics.components = exportData.components?.length || 0;
      statistics.folders = exportData.folders?.totalFolders || 0;
      statistics.extracted =
        statistics.contentTypes +
        statistics.contentItems +
        statistics.components +
        statistics.folders;

      await this.emitProgress(callbacks, {
        progress: 30,
        message: `Extracted: ${statistics.contentTypes} types, ${statistics.contentItems} items, ${statistics.components} components, ${statistics.folders} folders`,
        level: 'info',
        currentStep: 'Transforming',
        totalSteps: 7,
        totalItems: statistics.extracted,
      });

      if (await this.isCancelled(callbacks)) {
        return this.buildCancelledResult(config, statistics, startTime);
      }

      // Step 4: Process sync results
      if (syncResults?.unifiedContent) {
        const ucSync = syncResults.unifiedContent;
        const countDetails = (action: string) =>
          ucSync.details.filter((detail) => detail.action === action).length;

        statistics.created = countDetails('created');
        statistics.updated = countDetails('updated');
        statistics.skipped = countDetails('skipped') + countDetails('deleted');
        statistics.errors = countDetails('error');
        statistics.transformed = ucSync.successCount + ucSync.failureCount;

        // Collect error details
        const syncErrors = ucSync.details.filter((detail) => detail.action === 'error');
        for (const detail of syncErrors) {
          errorDetails.push({
            id: detail.id,
            message: detail.message || 'Sync error',
            payload: detail.payload,
          });
        }

        await this.emitProgress(callbacks, {
          progress: 40,
          message: `Preparing ${statistics.contentTypes} content types for provider`,
          level: 'info',
          currentStep: 'Syncing types',
          totalSteps: 7,
          itemsProcessed: statistics.contentTypes,
          totalItems: statistics.contentTypes,
        });

        await this.emitProgress(callbacks, {
          progress: 50,
          message: `Processing ${statistics.contentItems} content items...`,
          level: 'info',
          currentStep: 'Syncing items',
          totalSteps: 7,
        });

        if (await this.isCancelled(callbacks)) {
          return this.buildCancelledResult(config, statistics, startTime);
        }

        await this.emitProgress(callbacks, {
          progress: 70,
          message: `Unified content: ${statistics.created} created, ${statistics.updated} updated`,
          level: 'info',
          currentStep: 'Syncing items',
          totalSteps: 7,
          itemsProcessed: statistics.created + statistics.updated,
          totalItems: statistics.contentItems,
        });

        // Report individual errors
        if (errorDetails.length > 0) {
          for (const detail of errorDetails) {
            const payloadSnippet = detail.payload
              ? ` => ${JSON.stringify(detail.payload).slice(0, 300)}`
              : '';

            await this.emitProgress(callbacks, {
              progress: 95,
              message: `[${detail.id}] ${detail.message}${payloadSnippet}`,
              level: 'error',
            });
          }
        }
      }

      if (await this.isCancelled(callbacks)) {
        return this.buildCancelledResult(config, statistics, startTime);
      }

      // Step 5: Report final statistics
      if (statistics.created > 0) {
        await this.emitProgress(callbacks, {
          progress: 80,
          message: `Created ${statistics.created} content entries in ${providerId}`,
          level: 'info',
          currentStep: 'Finalizing',
          totalSteps: 7,
          itemsProcessed: statistics.created + statistics.updated,
          totalItems: statistics.extracted,
        });
      }

      if (statistics.updated > 0) {
        await this.emitProgress(callbacks, {
          progress: 85,
          message: `Updated ${statistics.updated} content entries in ${providerId}`,
          level: 'info',
          currentStep: 'Finalizing',
          totalSteps: 7,
        });
      }

      if (statistics.skipped > 0) {
        await this.emitProgress(callbacks, {
          progress: 90,
          message: `Skipped ${statistics.skipped} unchanged entries`,
          level: 'info',
          currentStep: 'Finalizing',
          totalSteps: 7,
        });
      }

      if (statistics.errors > 0) {
        await this.emitProgress(callbacks, {
          progress: 95,
          message: `Encountered ${statistics.errors} errors during sync`,
          level: 'warning',
          currentStep: 'Finalizing',
          totalSteps: 7,
        });
      }

      // Step 6: Complete
      const success = statistics.errors === 0;
      await this.emitProgress(callbacks, {
        progress: 100,
        message: success ? 'Deployment completed successfully!' : `Deployment completed with ${statistics.errors} errors`,
        level: success ? 'info' : 'warning',
        currentStep: 'Completed',
        totalSteps: 7,
        itemsProcessed: statistics.created + statistics.updated,
        totalItems: statistics.extracted,
      });

      return {
        success,
        statistics,
        error: statistics.errors > 0 ? `Encountered ${statistics.errors} errors during sync` : undefined,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        durationMs: Date.now() - startTime,
        providerId,
        websiteId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';

      await this.emitProgress(callbacks, {
        progress: 0,
        message: errorMessage,
        level: 'error',
      });

      return {
        success: false,
        statistics,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        providerId,
        websiteId,
      };
    }
  }

  /**
   * Helper to emit progress updates
   */
  private async emitProgress(
    callbacks: DeploymentCallbacks | undefined,
    progress: Omit<DeploymentProgress, 'timestamp'>
  ): Promise<void> {
    if (callbacks?.onProgress) {
      await callbacks.onProgress({
        ...progress,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Helper to check cancellation
   */
  private async isCancelled(callbacks: DeploymentCallbacks | undefined): Promise<boolean> {
    if (callbacks?.checkCancelled) {
      return callbacks.checkCancelled();
    }
    return false;
  }

  /**
   * Helper to build cancelled result
   */
  private buildCancelledResult(
    config: DeploymentExecutorConfig,
    statistics: DeploymentStatistics,
    startTime: number
  ): DeploymentResult {
    return {
      success: false,
      statistics,
      error: 'Deployment cancelled by user',
      durationMs: Date.now() - startTime,
      providerId: config.providerId,
      websiteId: config.websiteId,
    };
  }
}
