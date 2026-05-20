/**
 * Umbraco Compose Provider
 *
 * Main provider implementation for Umbraco Compose CMS export.
 * Implements ICMSProvider interface for unified bundle sync.
 *
 * Sync Flow (5 Steps):
 * 0. Initialize - validate config, test connection, ensure collection
 * 1. Type Schemas - create value object, component, and page schemas
 * 2. Shared Components - create navbar, footer, and other shared components
 * 3. Pages & Content - create pages with inline components
 * 4. Media - upload media assets (if applicable)
 * 5. Finalize - verify and return results
 */

import type { ICMSProvider } from '../types';
import type {
  UnifiedExportBundle,
  UnifiedBundleSyncOptions,
  UnifiedBundleSyncResult,
} from '@/lib/services/export/types';
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import { formatUnifiedBundleSyncResult } from '../helpers/unified-bundle-result';
import { UmbracoComposeClient } from './client';
import { UmbracoAuthManager } from './auth';
import { UmbracoMediaUploader } from './media-uploader';
import {
  UMBRACO_COMPOSE_PROVIDER_ID,
  UMBRACO_COMPOSE_DISPLAY_NAME,
  ENV_VARS,
} from './constants';
import type {
  UmbracoComposeProviderConfig,
  UmbracoIngestionEntry,
  UmbracoMappedTypeSchema,
} from './types';
import { UmbracoComposeError } from './types';
import {
  generateTimestampSuffix,
} from './utils/id-generator';
import {
  mapContentTypeToSchema,
  createPageSchema,
  createComponentSchema,
} from './utils/schema-mapper';
import {
  transformPageToEntry,
  transformSharedComponentToEntry,
  extractSharedComponents,
  buildSharedRefMap,
} from './utils/content-transformer';

export class UmbracoComposeProvider implements ICMSProvider {
  readonly id = UMBRACO_COMPOSE_PROVIDER_ID;

  private client: UmbracoComposeClient;
  private authManager: UmbracoAuthManager;
  private mediaUploader: UmbracoMediaUploader;
  private configured = false;
  private debug = false;

  constructor(config?: UmbracoComposeProviderConfig) {
    this.client = new UmbracoComposeClient();
    this.authManager = new UmbracoAuthManager();
    this.mediaUploader = new UmbracoMediaUploader(this.client);

    if (config) {
      this.configure(config);
    } else {
      this.configureFromEnv();
    }
  }

  /**
   * Configure the provider
   */
  configure(config: UmbracoComposeProviderConfig): void {
    this.client.configure(config);
    this.authManager.configure(config);
    if (config.debug !== undefined) {
      this.debug = config.debug;
      this.client.setDebug(config.debug);
    }
    this.configured = true;
  }

  /**
   * Configure from environment variables
   */
  private configureFromEnv(): void {
    this.client.configureFromEnv();
    this.authManager.configureFromEnv();

    // Check if configured
    if (this.client.isConfigured()) {
      this.configured = true;
    }
  }

  /**
   * Ensure provider is configured
   */
  private ensureConfigured(): void {
    if (!this.configured) {
      this.configureFromEnv();
    }
    if (!this.configured) {
      throw new UmbracoComposeError(
        'Umbraco Compose provider not configured. Set required environment variables.',
        'INVALID_CONFIG'
      );
    }
    this.client.ensureConfigured();
  }

  /**
   * Test connection to Umbraco Compose
   */
  async testConnection(): Promise<boolean> {
    try {
      this.ensureConfigured();
      return await this.client.testConnection();
    } catch {
      return false;
    }
  }

  /**
   * Main entry point - sync unified bundle to Umbraco Compose
   */
  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult> {
    this.ensureConfigured();

    const timestamp = generateTimestampSuffix();
    const successful: UnifiedContent[] = [];
    const failed: { item: UnifiedContent; error: string }[] = [];

    try {
      // Step 0: Initialize
      this.log('Step 0: Initializing...');

      // Only manage collections/schemas if Management API credentials are available
      // Otherwise, operate in ingestion-only mode (assumes collection/schemas exist)
      if (this.authManager.hasManagementCredentials()) {
        await this.client.ensureCollection();

        // Step 1: Create type schemas
        this.log('Step 1: Creating type schemas...');
        await this.ensureTypeSchemas(bundle);
      } else {
        this.log('Step 0-1: Skipping collection/schema management (ingestion-only mode - PAT auth)');
      }

      // Step 2: Create shared components
      this.log('Step 2: Creating shared components...');
      const sharedRefs = await this.createSharedComponents(bundle.unifiedContent, timestamp);

      // Step 3: Create pages
      this.log('Step 3: Creating pages...');
      const pageEntries: UmbracoIngestionEntry[] = [];

      for (const page of bundle.unifiedContent) {
        if (page.type !== 'page') continue;

        try {
          const entry = transformPageToEntry(page, sharedRefs, timestamp);
          pageEntries.push(entry);
          successful.push(page);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ item: page, error: message });
        }
      }

      // Ingest pages in batch
      if (pageEntries.length > 0) {
        await this.client.ingestContent(pageEntries);
      }

      // Step 4: Media upload (skeleton - full implementation in Task 7)
      this.log('Step 4: Media upload (skipped - not yet implemented)');

      // Step 5: Finalize
      this.log('Step 5: Finalizing...');
      this.log(`Sync complete: ${successful.length} successful, ${failed.length} failed`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Add remaining items as failed if overall sync fails
      for (const page of bundle.unifiedContent) {
        if (!successful.includes(page) && !failed.some(f => f.item === page)) {
          failed.push({ item: page, error: `Sync failed: ${message}` });
        }
      }
    }

    // Format result
    return formatUnifiedBundleSyncResult(this.id, {
      successful: successful.map(page => ({
        id: page.id,
        contentTypeId: 'page',
        contentType: 'page',
        name: page.title || page.id,
        title: page.title,
        slug: page.url || page.id,
        content: page.content || {},
        fields: page.content || {},
        language: 'en',
        status: 'published' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1',
      })),
      failed: failed.map(f => ({
        item: f.item,
        error: f.error,
      })),
    });
  }

  /**
   * Ensure type schemas exist
   */
  private async ensureTypeSchemas(bundle: UnifiedExportBundle): Promise<void> {
    const schemas: UmbracoMappedTypeSchema[] = [];

    // Add base component schemas (navbar, footer, etc.)
    schemas.push(createComponentSchema('navbar', {
      logo: { type: 'string' },
      navItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
    }));

    schemas.push(createComponentSchema('footer', {
      copyright: { type: 'string' },
      links: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
    }));

    // Add page schema
    schemas.push(createPageSchema('page', {
      hero: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          subheadline: { type: 'string' },
          ctaText: { type: 'string' },
          ctaUrl: { type: 'string' },
        },
      },
      cardGrid: {
        type: 'object',
        properties: {
          gridTitle: { type: 'string' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cardTitle: { type: 'string' },
                cardDescription: { type: 'string' },
              },
            },
          },
        },
      },
      textBlock: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          bodyText: { type: 'string' },
        },
      },
    }));

    // Create schemas that don't exist
    for (const schema of schemas) {
      await this.client.ensureTypeSchema(schema);
    }
  }

  /**
   * Create shared components and return reference map
   */
  private async createSharedComponents(
    content: UnifiedContent[],
    timestamp: string
  ): Promise<Record<string, string>> {
    const sharedComponents = extractSharedComponents(content);
    const entries: UmbracoIngestionEntry[] = [];

    for (const [_, component] of sharedComponents) {
      const entry = transformSharedComponentToEntry(component, timestamp);
      entries.push(entry);
    }

    // Ingest shared components
    if (entries.length > 0) {
      await this.client.ingestContent(entries);
      this.log(`Created ${entries.length} shared components`);
    }

    // Build reference map
    return buildSharedRefMap(sharedComponents, timestamp);
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[UmbracoComposeProvider] ${message}`);
    }
  }
}
