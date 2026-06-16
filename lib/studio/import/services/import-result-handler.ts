import { readFile } from 'node:fs/promises';

import { PrismaClient, Prisma } from '@/lib/generated/prisma';

import type { ImportDetectionResult } from '../web-detection';
import type {
  DetectionComponentSummary,
  DetectionPageSummary,
  DetectionSummaryMetadata,
} from '../types/detection-summary.types';
import { traceMemory } from '../utils/memory-trace';
import { ImportJobStatus } from '../types/import-job.types';
import type { WebsiteMediaReference } from '@/types/api';
import type { ImportJob } from '@/lib/generated/prisma';
import { ImportJobRepository } from '../repositories/import-job.repository';
import { ImportProgressManager } from './import-progress-manager';
import { ImportOrchestrator } from './import-orchestrator';
import { DesignSystemService } from './design-system-service';
import type { DesignSystemProcessingResult } from './design-system-service';
import { ImportRunService, isTerminalImportRunStatus } from './import-run-service';
import type { ImportResult } from './interfaces/import-orchestrator.interface';
import { getWebFetchTools } from './web-tools';
import type { SitemapMetadata } from './sitemap-discovery.service';
import { MediaRepository } from '@/lib/studio/media/media-repository';
import { getMediaStorageProvider } from '@/lib/studio/media/storage/media-storage-factory';
import { MediaIngestService, type MediaIngestResult } from './media-ingest-service';
import {
  consumeNormalizationWarnings,
  isFatalNormalizationWarning,
  recordNormalizationWarning,
  type NormalizationWarning as ContentNormalizationWarning
} from './page-builder/normalization-telemetry';
import type { CaptureDesignSystemResult } from '@/lib/studio/design-system/dom-probe/service';
import { adjustDetectedComponents } from './detection-post-processor';
import { buildImportDesignProfile } from './design-profile-service';
import { selectPresentationSkeleton } from './page-builder/presentation-skeleton';
import type { DesignFitPageAudit, ImportDesignProfile, PresentationSkeletonSelection } from '../types/design-profile.types';
import { normalizeComponentContent } from './page-builder/component-helpers';
import { canonicalizeComponentType } from './page-builder/component-helpers';
import { PageBuilderService } from './page-builder-service';
import { redirectService } from '@/lib/services/redirect-service';

export const IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.7;

export function isImportComponentAutoApproved(component: { confidence?: unknown }): boolean {
  return typeof component.confidence === 'number'
    ? component.confidence >= IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD
    : !component.confidence;
}

interface PersistOptions {
  sitemapMetaByUrl: Map<string, SitemapMetadata>;
  orchestratorTimeoutMs?: number;
  domProbeCapture?: CaptureDesignSystemResult | null;
  skipDesignSystemProcessing?: boolean;
  skipMediaIngestion?: boolean;
}

interface HandlerDependencies {
  repository: ImportJobRepository;
  progressManager: ImportProgressManager;
  orchestrator: ImportOrchestrator;
  prisma: PrismaClient;
}

function formatFatalNormalizationError(warnings: ContentNormalizationWarning[]): string {
  const grouped = new Map<string, {
    pageUrl: string;
    parentType: string;
    field: string;
    issue: string;
    count: number;
  }>();

  for (const warning of warnings) {
    const pageUrl = warning.pageUrl ?? 'unknown';
    const parentType = warning.parentType || 'unknown';
    const field = warning.field ?? warning.childType ?? 'unknown';
    const issue = warning.issue;
    const key = `${pageUrl}\u0000${parentType}\u0000${field}\u0000${issue}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, { pageUrl, parentType, field, issue, count: 1 });
    }
  }

  const entries = Array.from(grouped.values());
  const rendered = entries.slice(0, 10).map(entry =>
    `pageUrl=${entry.pageUrl} parentType=${entry.parentType} field=${entry.field} issue=${entry.issue} count=${entry.count}`
  );
  const remainder = entries.length > rendered.length ? `; ... ${entries.length - rendered.length} more` : '';
  return `Fatal content normalization warnings recorded: ${rendered.join('; ')}${remainder}`;
}

function collectPreflightNormalizationWarnings(
  groups: Map<string, { pageUrl: string; pageTitle: string; components: any[] }>
): ContentNormalizationWarning[] {
  const warnings: ContentNormalizationWarning[] = [];

  for (const group of groups.values()) {
    for (const component of group.components) {
      const parentType =
        typeof component.type === 'string' && component.type.trim().length > 0
          ? component.type
          : typeof component.component === 'string'
            ? component.component
            : '';
      const content = component.content;
      if (!parentType || !content || typeof content !== 'object' || Array.isArray(content)) {
        continue;
      }

      const normalized = normalizeComponentContent(content as Record<string, unknown>, {
        parentCanonicalType: parentType,
        pageUrl: group.pageUrl,
      });

      for (const warning of normalized.warnings) {
        warnings.push({
          pageUrl: group.pageUrl,
          parentType,
          field: warning.field,
          childType: warning.childType,
          issue: warning.issue,
          message: warning.message,
          details: warning.details,
        });
      }
    }
  }

  return warnings;
}

function inferPreflightCategory(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('nav') || lower.includes('menu')) return 'navigation';
  if (lower.includes('footer')) return 'footer';
  if (lower.includes('hero') || lower.includes('banner')) return 'hero';
  if (lower.includes('form') || lower.includes('input')) return 'form';
  if (lower.includes('image') || lower.includes('gallery') || lower.includes('video')) return 'media';
  if (lower.includes('card') || lower.includes('blog') || lower.includes('article') || lower.includes('list')) return 'content';
  return 'layout';
}

function collectPreflightComponentTypes(detectionPayload: any[]): any[] {
  const types = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const rawType = typeof node.type === 'string' ? node.type : '';
    if (rawType && !/^page(?:-v\d+)?$/i.test(rawType)) {
      types.add(canonicalizeComponentType(rawType) ?? rawType);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };
  detectionPayload.forEach(walk);

  return Array.from(types).map(type => ({
    id: `preflight-type-${type}`,
    type,
    key: type,
    category: inferPreflightCategory(type),
    source: 'preflight',
    metadata: {},
    defaultConfig: { props: {} },
    placeholderData: {},
    styles: {},
    aiMetadata: {},
    version: '1.0.0',
    isGlobal: false,
    patterns: [],
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function collectDesignFitAudit(
  components: any[],
  designProfile: ImportDesignProfile,
  skeleton: PresentationSkeletonSelection,
): DesignFitPageAudit {
  const componentAudits = components
    .map((component) => ({
      component: String(component.type ?? component.component ?? 'unknown'),
      mutations: Array.isArray(component.metadata?.designFit?.mutations)
        ? component.metadata.designFit.mutations
        : [],
    }))
    .filter((audit) => audit.mutations.length > 0);

  const diagnostics: DesignFitPageAudit['diagnostics'] = [
    ...designProfile.diagnostics,
    ...skeleton.diagnostics,
  ];

  if (skeleton.key === 'unknown') {
    diagnostics.push({
      code: 'DESIGN_PROFILE_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'No confident presentation skeleton was selected; design-fit mutations were skipped.',
    });
  }

  return {
    skeleton,
    profileConfidence: designProfile.confidence,
    diagnostics,
    components: componentAudits,
  };
}

async function validateDetectionPayloadWithPageBuilder(
  prisma: PrismaClient,
  detectionPayload: any[],
): Promise<void> {
  if (detectionPayload.length === 0) {
    return;
  }
  const pageBuilder = new PageBuilderService(prisma);
  pageBuilder.configureContentTypes({
    defaultContentTypeId: 'preflight-content-type',
    templateContentTypes: new Map(),
  });
  const componentTypes = collectPreflightComponentTypes(detectionPayload);
  consumeNormalizationWarnings();
  await pageBuilder.validatePagesInBatch(detectionPayload.map(detection => ({
    pageData: {
      url: detection.pageUrl || '/',
      title: detection.pageTitle || 'Untitled',
      detectedComponents: [detection],
      pageTemplate: detection.metadata?.pageTemplate,
    },
    componentTypes,
  })));
  const normalizationWarnings = consumeNormalizationWarnings();
  const fatalNormalizationWarnings = normalizationWarnings.filter(isFatalNormalizationWarning);
  if (fatalNormalizationWarnings.length > 0) {
    throw new Error(formatFatalNormalizationError(fatalNormalizationWarnings));
  }
}

export class ImportResultHandler {
  private readonly repository: ImportJobRepository;
  private readonly progressManager: ImportProgressManager;
  private readonly orchestrator: ImportOrchestrator;
  private readonly prisma: PrismaClient;
  private readonly mediaIngestService: MediaIngestService;
  private readonly designSystemService: DesignSystemService;
  private readonly runService: ImportRunService;

  constructor(dependencies: HandlerDependencies) {
    this.repository = dependencies.repository;
    this.progressManager = dependencies.progressManager;
    this.orchestrator = dependencies.orchestrator;
    this.prisma = dependencies.prisma;

    const { backend, provider } = getMediaStorageProvider();
    const mediaRepository = new MediaRepository(this.prisma);
    this.mediaIngestService = new MediaIngestService({
      repository: mediaRepository,
      storageProvider: provider,
      backend,
    });

    this.designSystemService = new DesignSystemService({
      prisma: this.prisma
    });
    this.runService = new ImportRunService();
  }

  async persist(jobId: string, result: any, options: PersistOptions): Promise<void> {
    const job = await this.repository.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const detectedCount = Array.isArray(result.data?.detectedComponents) ? result.data.detectedComponents.length : 0;
    traceMemory('import-service:saveResults:start', {
      jobId,
      detectedPages: detectedCount,
    });

    const selectPageTitle = (pageUrl?: string, pageMetadata?: any, components?: any[]): string => {
      try {
        const metaTitle = pageMetadata?.title;
        if (typeof metaTitle === 'string' && metaTitle.trim().length > 0) {
          return metaTitle.trim();
        }
        if (pageUrl) {
          const u = new URL(pageUrl);
          const parts = u.pathname.split('/').filter(Boolean);
          if (parts.length === 0) {
            return 'Home';
          }
          const last = parts[parts.length - 1];
          return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
        }
      } catch {
        // Ignore errors deriving a title from the URL.
      }
      return 'Untitled Page';
    };

    const domSnapshotPath = options.domProbeCapture?.capture?.rawDomSnapshotPath;
    let domSnapshotHtml: string | null = null;
    if (typeof domSnapshotPath === 'string' && domSnapshotPath.trim().length > 0) {
      try {
        domSnapshotHtml = await readFile(domSnapshotPath, 'utf-8');
      } catch (error) {
        console.warn('[ImportResultHandler] Unable to read DOM snapshot for post-processing', {
          path: domSnapshotPath,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    const createTextPreview = (content: unknown): string | undefined => {
      if (!content) {
        return undefined;
      }
      let raw: string;
      if (typeof content === 'string') {
        raw = content;
      } else {
        try {
          raw = JSON.stringify(content);
        } catch {
          return undefined;
        }
      }
      const trimmed = raw.replace(/\s+/g, ' ').trim();
      if (!trimmed) {
        return undefined;
      }
      return trimmed.length > 160 ? trimmed.slice(0, 157) + '...' : trimmed;
    };

    let detectionPages = Array.isArray(result.data?.detectedComponents)
      ? (result.data.detectedComponents as ImportDetectionResult[])
      : [];
    const navigation = result.data?.navigation || null;
    let designTokens = result.data?.designTokens || null;
    let mediaAssets: MediaIngestResult['mediaAssets'] = [];
    let mediaWarnings: MediaIngestResult['warnings'] = [];
    let originalScreenshots: Array<{ url: string; pageUrl: string; key: string }> = [];
    let designSystemResult: DesignSystemProcessingResult | null = null;

    // --- Handle redirect pages: Store as Redirects instead of empty pages ---
    const redirectPages = detectionPages.filter((d) => d.isRedirectPage && d.redirectInfo?.isExternal);
    const contentPages = detectionPages.filter((d) => !d.isRedirectPage);
    let redirectsCreated = 0;
    const redirectSummary: Array<{
      sourcePath: string;
      targetUrl: string;
      type: string;
      pageTitle: string;
    }> = [];

    if (redirectPages.length > 0) {
      console.log(`[ImportResultHandler] Processing ${redirectPages.length} redirect pages`);
      for (const redirectPage of redirectPages) {
        if (!redirectPage.redirectInfo) continue;

        try {
          // Extract source path from URL
          const sourceUrl = new URL(redirectPage.pageUrl);
          const sourcePath = sourceUrl.pathname;
          const targetUrl = redirectPage.redirectInfo.targetUrl;
          const pageTitle = redirectPage.pageMetadata?.title || 'Redirect';

          // Create redirect using redirect service
          const redirectResult = await redirectService.createExternalRedirect({
            websiteId: job.websiteId,
            sourcePath,
            targetUrl,
            source: 'import',
            description: redirectPage.redirectInfo.description || `Imported from ${job.url}`,
            showInNav: false,
            navLabel: pageTitle,
          });

          if (redirectResult.success) {
            redirectsCreated++;
            await this.runService.upsertPageStageForJob(job.id, {
              pageUrl: redirectPage.pageUrl,
              title: pageTitle,
              status: 'redirect_created',
              phase: 'commit_page',
              structureCandidate: {
                sourcePath,
                targetUrl,
                redirectType: redirectPage.redirectInfo.type,
              } as Prisma.InputJsonValue,
            });
            redirectSummary.push({
              sourcePath,
              targetUrl,
              type: redirectPage.redirectInfo.type,
              pageTitle,
            });
            console.log(`[ImportResultHandler] Created redirect: ${sourcePath} → ${targetUrl}`);
          } else {
            console.warn(`[ImportResultHandler] Failed to create redirect for ${sourcePath}:`, redirectResult.error);
          }
        } catch (error) {
          console.warn(`[ImportResultHandler] Error creating redirect for ${redirectPage.pageUrl}:`, error);
        }
      }
      console.log(`[ImportResultHandler] Created ${redirectsCreated} redirects from ${redirectPages.length} redirect pages`);
    }

    // Use only content pages for further processing
    detectionPages = contentPages;

    if (detectionPages.length > 0 && !options.skipMediaIngestion) {
      try {
        const mediaResult = await this.mediaIngestService.ingest({
          websiteId: job.websiteId,
          detectionResults: detectionPages,
          designTokens,
        });
        detectionPages = mediaResult.detections;
        designTokens = mediaResult.designTokens;
        mediaAssets = mediaResult.mediaAssets;
        mediaWarnings = mediaResult.warnings;
      } catch (error) {
        console.warn('Media ingestion failed (non-fatal):', error);
      }
    }

    // Process design system from detection results
    if (detectionPages.length > 0 && !options.skipDesignSystemProcessing) {
      try {
        console.log(`[ImportResultHandler] Processing design system for website ${job.websiteId}`);

        designSystemResult = await this.designSystemService.processDesignSystem({
          websiteId: job.websiteId,
          detectionResults: detectionPages,
          sourceJobId: job.id,
          importUrl: job.url,
          probeCapture: options.domProbeCapture ?? undefined
        });

        if (designSystemResult.success) {
          const strategyLabel = 'DOM probe';
          console.log(
            `[ImportResultHandler] Successfully processed design system (${strategyLabel}): ${designSystemResult.persistedId} (${designSystemResult.metrics.tokensExtracted} tokens, ${designSystemResult.metrics.confidence.toFixed(2)} confidence)`
          );
          if (designSystemResult.probe?.evaluation) {
            const paletteAgreement = (designSystemResult.probe.evaluation.summary.palette.agreementRatio * 100).toFixed(1);
            console.log(
              `[ImportResultHandler] DOM probe evaluation → overall=${designSystemResult.probe.evaluation.summary.overall} palette=${paletteAgreement}% typographyMatched=${designSystemResult.probe.evaluation.summary.typography.matched} spacingPassed=${designSystemResult.probe.evaluation.summary.spacing.passed}`
            );
          }
          if (designSystemResult.probe?.evidence) {
            console.log('[ImportResultHandler] DOM probe evidence stored', {
              capture: designSystemResult.probe.evidence.captureJson?.key ?? null,
              manifest: designSystemResult.probe.evidence.manifestJson?.key ?? null,
              diff: designSystemResult.probe.evidence.diffReport?.key ?? null,
              screenshots: designSystemResult.probe.evidence.screenshots.length
            });
            // Extract screenshot URLs for proposal "Current Website" section
            originalScreenshots = designSystemResult.probe.evidence.screenshots
              .filter((s) => s.url)
              .map((s) => ({
                url: s.url!,
                pageUrl: job.url, // Homepage screenshot
                key: s.key
              }));
          }
        } else {
          console.warn(`[ImportResultHandler] Design system processing failed: ${designSystemResult.errors.join(', ')}`);
        }

        // Log any warnings
        if (designSystemResult.warnings.length > 0) {
          console.warn(`[ImportResultHandler] Design system warnings: ${designSystemResult.warnings.join(', ')}`);
        }
      } catch (error) {
        console.error('[ImportResultHandler] Failed to process design system:', error);
        const message = error instanceof Error ? error.message : String(error);
        recordNormalizationWarning({
          pageUrl: job.url,
          parentType: 'design-system',
          issue: 'suspicious-value',
          message: `Design system extraction failed: ${message}`,
          details: {
            code: 'DESIGN_SYSTEM_EXTRACTION_FAILED',
            retryable: true
          }
        });
      }
    }

    const pageSummaries: DetectionPageSummary[] = [];
    const pageSummaryByUrl = new Map<string, DetectionPageSummary>();
    const pageMetaByUrl = new Map<string, any>();
    const templateByUrl = new Map<string, ImportDetectionResult['pageTemplate']>();
    const designProfileByUrl = new Map<string, ImportDesignProfile>();
    const skeletonByUrl = new Map<string, PresentationSkeletonSelection>();
    const designFitAuditByUrl = new Map<string, DesignFitPageAudit>();
    const groups = new Map<string, { pageUrl: string; pageTitle: string; components: any[] }>();

    let totalComponentsDetected = 0;
    let autoApprovedComponents = 0;
    let readyPages = 0;
    let skippedPages = 0;

    type BrandingAsset = string | WebsiteMediaReference | null;

    let brandingSource:
      | {
          logo?: BrandingAsset;
          favicon?: BrandingAsset;
          primaryColors?: string[];
          fonts?: string[];
          visualStyle?: string | null;
        }
      | null = null;

    const importDesignProfile = buildImportDesignProfile({
      sourceUrl: job.url,
      designSystemResult,
      detections: detectionPages,
    });

    for (const rawDetection of detectionPages) {
      const detection = rawDetection as ImportDetectionResult;
      const pageUrl = detection.pageUrl || job.url;
      const pageTitle = selectPageTitle(detection.pageUrl, detection.pageMetadata, detection.components);
      const presentationSkeleton = selectPresentationSkeleton({
        pageUrl,
        detection,
        designProfile: importDesignProfile,
      });
      designProfileByUrl.set(pageUrl, importDesignProfile);
      skeletonByUrl.set(pageUrl, presentationSkeleton);

      if (Array.isArray(detection.components)) {
        detection.components = adjustDetectedComponents(detection.components, {
          domSnapshot: domSnapshotHtml,
          pageUrl,
          resourcesSummary: detection.resourcesSummary,
          pageMetadata: detection.pageMetadata,
          pageTemplate: detection.pageTemplate,
          designProfile: importDesignProfile,
          presentationSkeleton,
        });
        designFitAuditByUrl.set(
          pageUrl,
          collectDesignFitAudit(detection.components, importDesignProfile, presentationSkeleton)
        );
      }

      if (detection.pageMetadata) {
        pageMetaByUrl.set(pageUrl, detection.pageMetadata);
      }
      if (detection.pageTemplate) {
        templateByUrl.set(pageUrl, detection.pageTemplate);
      }

      const mappedComponents = Array.isArray(detection.components)
        ? detection.components.map((component: any) => ({
            ...component,
            type: typeof component.type === 'string' ? component.type : component.component || 'generic',
            pageTitle,
            pageUrl,
            metadata: {
              ...(component.metadata || {}),
              region:
                component.location || (component.metadata && (component.metadata.region || component.metadata.region_hint)) ||
                undefined,
            },
          }))
        : [];

      const approvedForPage = mappedComponents.filter(isImportComponentAutoApproved);
      totalComponentsDetected += mappedComponents.length;
      autoApprovedComponents += approvedForPage.length;

      if (approvedForPage.length > 0) {
        if (!groups.has(pageUrl)) {
          groups.set(pageUrl, { pageUrl, pageTitle, components: [] });
        }
        groups.get(pageUrl)!.components.push(...approvedForPage);
      }

      const highConfidenceCount = approvedForPage.filter((component) =>
        typeof component.confidence === 'number' ? component.confidence >= 0.85 : false,
      ).length;
      const summaryComponents: DetectionComponentSummary[] = approvedForPage.slice(0, 12).map((component) => ({
        component: component.component,
        type: component.type,
        confidence: component.confidence,
        location: component.metadata?.region || component.location,
        textPreview: createTextPreview(component.content),
      }));

      const metadata = detection.pageMetadata || {};
      const pageStatus: DetectionPageSummary['status'] = approvedForPage.length > 0 ? 'import-ready' : 'import-skipped';
      const summary: DetectionPageSummary = {
        pageUrl,
        title: pageTitle,
        componentCount: approvedForPage.length,
        highConfidenceCount,
        templateKey: detection.pageTemplate?.templateKey,
        accuracy: detection.accuracy,
        status: pageStatus,
        metadata: {
          pageType: metadata?.pageType,
          primaryColors: Array.isArray(metadata?.primaryColors) ? metadata.primaryColors.slice(0, 4) : undefined,
          fonts: Array.isArray(metadata?.fonts) ? metadata.fonts.slice(0, 4) : undefined,
          hasBranding: Boolean(metadata?.logo || metadata?.favicon),
          logo: metadata?.logo ?? null,
          favicon: metadata?.favicon ?? null,
          visualStyle: metadata?.visualStyle ?? null,
          designProfileConfidence: importDesignProfile.confidence,
          designProfileDiagnostics: importDesignProfile.diagnostics,
          presentationSkeleton,
          designFitAudit: designFitAuditByUrl.get(pageUrl),
        },
        components: summaryComponents,
      };

      if (summary.status === 'import-ready') {
        readyPages += 1;
      } else if (summary.status === 'import-skipped') {
        skippedPages += 1;
      }

      if (!brandingSource && summary.metadata?.hasBranding) {
        brandingSource = {
          logo: summary.metadata.logo,
          favicon: summary.metadata.favicon,
          primaryColors: summary.metadata.primaryColors,
          fonts: summary.metadata.fonts,
          visualStyle: summary.metadata.visualStyle,
        };
      }

      pageSummaries.push(summary);
      pageSummaryByUrl.set(pageUrl, summary);

      (rawDetection as any).components = undefined;
      if (rawDetection.pageMetadata) {
        (rawDetection as any).pageMetadata = {
          title: metadata?.title,
          pageType: metadata?.pageType,
          primaryColors: metadata?.primaryColors,
          fonts: metadata?.fonts,
        };
      }
    }

    const preflightNormalizationWarnings = collectPreflightNormalizationWarnings(groups);
    const fatalPreflightNormalizationWarnings = preflightNormalizationWarnings.filter(isFatalNormalizationWarning);
    if (fatalPreflightNormalizationWarnings.length > 0) {
      const fatalMessage = formatFatalNormalizationError(fatalPreflightNormalizationWarnings);
      await this.repository.update(jobId, {
        status: ImportJobStatus.FAILED,
        errorMessage: fatalMessage,
      });
      throw new Error(fatalMessage);
    }

    const detectionSummary: DetectionSummaryMetadata = {
      totalComponentsDetected,
      autoApprovedComponents,
      processingTime: result.performance?.totalTime || 0,
      detectionResults: detectionPages.length,
      failedPages: 0,
      pipelineSuccess: result.success,
      readyPages,
      skippedPages,
      totalPages: detectionPages.length,
      mediaAssets: mediaAssets.length,
      mediaWarnings: mediaWarnings.length,
      designProfileConfidence: importDesignProfile.confidence,
      designProfileDiagnostics: importDesignProfile.diagnostics.length,
    };

    const mediaDiagnostics: {
      assetsDetected: number
      ingestWarningCount: number
      missingSrcCount: number
      missingSrcByPage: Array<{ pageUrl: string; count: number }>
      missingSrcEntries: Array<{
        pageUrl?: string
        parentType: string
        field?: string
        childType?: string
        mediaId?: string
        message: string
      }>
    } = {
      assetsDetected: mediaAssets.length,
      ingestWarningCount: mediaWarnings.length,
      missingSrcCount: 0,
      missingSrcByPage: [],
      missingSrcEntries: []
    }

    // Store only summary data in ImportJob (pages are now in ImportPageDetection table)
    const detectionRecord: Record<string, unknown> = {
      // pages: pageSummaries,  // REMOVED - now stored in ImportPageDetection table
      navigation,
      designTokens,
      importDesignProfile,
      presentationSkeletons: Object.fromEntries(skeletonByUrl.entries()),
      designFitAudit: Object.fromEntries(designFitAuditByUrl.entries()),
      metadata: detectionSummary,
      failedPages: [],
      mediaDiagnostics
    };

    if (mediaAssets.length > 0) {
      detectionRecord.mediaAssets = mediaAssets;
    }
    if (mediaWarnings.length > 0) {
      detectionRecord.mediaWarnings = mediaWarnings;
    }
    if (originalScreenshots.length > 0) {
      detectionRecord.originalScreenshots = originalScreenshots;
    }

    traceMemory('import-service:saveResults:post-normalization', {
      pages: pageSummaries.length,
      approvedComponents: autoApprovedComponents,
    });

    const detectionPayload = Array.from(groups.values()).map((group, pageIdx) => {
      const children = group.components.map((component: any, index: number) => ({
        id: `${component.type || 'component'}-${pageIdx}-${index}`,
        type: component.type || 'generic',
        bounds: {
          x: 0,
          y: index * 200,
          width: 1200,
          height: 200,
        },
        content: JSON.stringify(component.content || {}),
        styles: component.styles || {},
        confidence: component.confidence || 0.8,
        metadata: component.metadata || {},
        pageUrl: group.pageUrl,
        pageTitle: group.pageTitle,
      }));

      const sitemap = options.sitemapMetaByUrl.get(group.pageUrl);
      const template = templateByUrl.get(group.pageUrl);

      return {
        id: `page-${pageIdx}`,
        type: 'page',
        bounds: {
          x: 0,
          y: 0,
          width: 1200,
          height: Math.max(800, children.length * 200),
        },
        content: JSON.stringify({
          title: group.pageTitle,
          url: group.pageUrl,
          componentsCount: children.length,
        }),
        children,
        pageUrl: group.pageUrl,
        pageTitle: group.pageTitle,
        metadata: {
          pageUrl: group.pageUrl,
          importedAt: new Date().toISOString(),
          totalComponents: children.length,
          componentTypes: [...new Set(children.map((child) => child.type))],
          pageMetadata: pageMetaByUrl.get(group.pageUrl),
          pageTemplate: template,
          importDesignProfile: designProfileByUrl.get(group.pageUrl),
          presentationSkeleton: skeletonByUrl.get(group.pageUrl),
          designFitAudit: designFitAuditByUrl.get(group.pageUrl),
          sitemap,
        },
      };
    });

    try {
      await validateDetectionPayloadWithPageBuilder(this.prisma, detectionPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.update(jobId, {
        status: ImportJobStatus.FAILED,
        errorMessage: `Import preflight failed: ${message}`,
      });
      throw error;
    }

    await this.repository.update(jobId, {
      detectionResults: detectionRecord as Prisma.JsonValue,
    });

    // Persist page detections only after page-builder preflight has accepted the payload.
    console.log(`[ImportResultHandler] Persisting ${pageSummaries.length} page detections to database...`);
    if (pageSummaries.length > 0) {
      const BATCH_SIZE = 100;
      const MILESTONE_PAGES = 500;
      let lastMilestone = 0;

      for (let i = 0; i < pageSummaries.length; i += BATCH_SIZE) {
        const batch = pageSummaries.slice(i, i + BATCH_SIZE);
        await this.prisma.importPageDetection.createMany({
          data: batch.map(summary => ({
            jobId: job.id,
            websiteId: job.websiteId,
            pageUrl: summary.pageUrl,
            pageTitle: summary.title ?? 'Untitled',
            componentCount: summary.componentCount,
            status: summary.status,
            confidence: summary.accuracy,
            errorMessage: summary.error,
            detectionData: {
              templateKey: summary.templateKey,
              highConfidenceCount: summary.highConfidenceCount,
              metadata: summary.metadata,
              components: summary.components,
            } as any
          })),
          skipDuplicates: true
        });

        const pagesPersisted = Math.min(i + BATCH_SIZE, pageSummaries.length);

        if (pagesPersisted - lastMilestone >= MILESTONE_PAGES || pagesPersisted === pageSummaries.length) {
          const percentage = (pagesPersisted / pageSummaries.length * 100).toFixed(1);
          console.log(`[ImportResultHandler] ▸ ${pagesPersisted}/${pageSummaries.length} (${percentage}%)`);
          lastMilestone = pagesPersisted;
        }
      }
      console.log(`[ImportResultHandler] ✓ Complete: ${pageSummaries.length} page detections persisted`);
    }

    traceMemory('import-service:saveResults:pre-orchestrator', { stagedPages: detectionPayload.length });

    if (detectionPayload.length > 0) {
      try {
        const importResult = await this.orchestrator.orchestrateImport(detectionPayload, job.websiteId, {
          enableTransactions: true,
          validateIntegrity: true,
          timeout: options.orchestratorTimeoutMs,
          maxRetries: 2,
          progressCallback: async (progress) => {
            await this.progressManager.updateProgress(jobId, ImportJobStatus.PROCESSING, progress.progress, progress.message);
          },
        });

        const normalizationWarnings = consumeNormalizationWarnings();
        const fatalNormalizationWarnings = normalizationWarnings.filter(isFatalNormalizationWarning);
        if (normalizationWarnings.length > 0) {
          console.log(`[ImportResultHandler] Processing ${normalizationWarnings.length} normalization warnings...`);
          const warningsByPage = new Map<string, ContentNormalizationWarning[]>();
          const mediaSrcMissingWarnings: ContentNormalizationWarning[] = [];

          // Process warnings with milestone progress (every 100 warnings or key milestones)
          const MILESTONE_INTERVAL = 100;
          for (let i = 0; i < normalizationWarnings.length; i++) {
            const warning = normalizationWarnings[i];

            // Show milestone progress
            if ((i + 1) % MILESTONE_INTERVAL === 0 || i === normalizationWarnings.length - 1) {
              const percentage = ((i + 1) / normalizationWarnings.length * 100).toFixed(1);
              console.log(`[ImportResultHandler] ▸ ${i + 1}/${normalizationWarnings.length} (${percentage}%)`);
            }

            if (warning.pageUrl) {
              const existing = warningsByPage.get(warning.pageUrl) ?? [];
              existing.push(warning);
              warningsByPage.set(warning.pageUrl, existing);
            }
            if (warning.issue === 'media-src-missing') {
              mediaSrcMissingWarnings.push(warning);
            }
          }
          console.log(`[ImportResultHandler] ✓ Warnings processed: ${normalizationWarnings.length} total, ${warningsByPage.size} pages affected`);

          for (const [pageUrl, warningsForPage] of warningsByPage.entries()) {
            const summary = pageSummaryByUrl.get(pageUrl);
            if (!summary) {
              continue;
            }
            const baseMetadata =
              summary.metadata && typeof summary.metadata === 'object'
                ? { ...(summary.metadata as Record<string, unknown>) }
                : {};
            const existingWarnings = Array.isArray((baseMetadata as any).normalizationWarnings)
              ? [...((baseMetadata as any).normalizationWarnings as any[])]
              : [];
            const serializedWarnings = warningsForPage.map(warning => ({
              issue: warning.issue,
              message: warning.message,
              field: warning.field,
              childType: warning.childType,
              parentType: warning.parentType,
              details: warning.details
            }));

            summary.metadata = {
              ...baseMetadata,
              normalizationWarnings: existingWarnings.concat(serializedWarnings)
            };
          }

          if (mediaSrcMissingWarnings.length > 0) {
            const missingByPage = new Map<string, number>();
            const missingEntries = mediaSrcMissingWarnings.map(warning => {
              const pageUrl = warning.pageUrl ?? undefined;
              if (pageUrl) {
                missingByPage.set(pageUrl, (missingByPage.get(pageUrl) ?? 0) + 1);
              }
              const mediaId =
                typeof warning.details?.mediaId === 'string'
                  ? (warning.details.mediaId as string)
                  : undefined;
              return {
                pageUrl,
                parentType: warning.parentType,
                field: warning.field,
                childType: warning.childType,
                mediaId,
                message: warning.message
              };
            });

            mediaDiagnostics.missingSrcCount = mediaSrcMissingWarnings.length;
            mediaDiagnostics.missingSrcByPage = Array.from(missingByPage.entries()).map(([pageUrl, count]) => ({
              pageUrl,
              count
            }));
            mediaDiagnostics.missingSrcEntries = missingEntries;

            detectionSummary.mediaMissingSrc = mediaSrcMissingWarnings.length;
            detectionSummary.mediaMissingSrcPages = mediaDiagnostics.missingSrcByPage.length;
          }

          if (fatalNormalizationWarnings.length > 0) {
            const fatalMessage = formatFatalNormalizationError(fatalNormalizationWarnings);
            await this.repository.update(jobId, {
              status: ImportJobStatus.FAILED,
              errorMessage: fatalMessage,
              detectionResults: detectionRecord as Prisma.JsonValue,
            });
            throw new Error(fatalMessage);
          }
        }

        detectionRecord.failedPages = importResult.failedPages;
        detectionSummary.failedPages = importResult.failedPages.length;

        if (importResult.failedPages.length > 0) {
          for (const failure of importResult.failedPages) {
            const isValidationFailure = failure.stage === 'validation';
            const failureStatus: DetectionPageSummary['status'] = isValidationFailure ? 'import-invalid' : 'import-error';
            const issues = (() => {
              const data = failure.metadata as Record<string, unknown> | undefined;
              return data && Array.isArray((data as any).importIssues) ? (data as any).importIssues : undefined;
            })();
            const summary = pageSummaryByUrl.get(failure.pageUrl);
            if (summary) {
              summary.status = failureStatus;
              summary.error = failure.error;
              if (isValidationFailure) {
                const existingMetadata = summary.metadata && typeof summary.metadata === 'object' ? summary.metadata : undefined;
                summary.metadata = {
                  ...(existingMetadata ?? {}),
                  importStatus: 'invalid',
                  ...(issues ? { importIssues: issues } : {}),
                };
              }
            } else {
              const failureSummary: DetectionPageSummary = {
                pageUrl: failure.pageUrl,
                title: failure.pageUrl,
                componentCount: 0,
                highConfidenceCount: 0,
                status: failureStatus,
                error: failure.error,
                metadata: isValidationFailure
                  ? {
                      importStatus: 'invalid',
                      ...(issues ? { importIssues: issues } : {}),
                    }
                  : undefined,
                components: [],
              };
              pageSummaries.push(failureSummary);
              pageSummaryByUrl.set(failure.pageUrl, failureSummary);
            }
          }

          // Update ImportPageDetection table for failed pages
          if (importResult.failedPages.length > 0) {
            console.log(`[ImportResultHandler] Updating ${importResult.failedPages.length} failed page statuses...`);
            for (const failure of importResult.failedPages) {
              const summary = pageSummaryByUrl.get(failure.pageUrl);
              if (summary) {
                await this.prisma.importPageDetection.updateMany({
                  where: {
                    jobId: job.id,
                    pageUrl: failure.pageUrl
                  },
                  data: {
                    status: summary.status,
                    errorMessage: summary.error
                  }
                });
              }
            }
          }
        }

        await this.syncRunStagesAfterCommit(job, importResult);

        detectionSummary.readyPages = pageSummaries.filter((page) => page.status === 'import-ready').length;
        detectionSummary.skippedPages = pageSummaries.filter((page) => page.status === 'import-skipped').length;
        detectionSummary.invalidPages = pageSummaries.filter((page) => page.status === 'import-invalid').length;

        const importInfo = {
          pagesCreated: importResult.statistics.totalPages,
          componentsCreated: importResult.statistics.totalComponents,
          componentTypesCreated: importResult.statistics.uniqueComponentTypes,
          sharedComponentsDetected: importResult.statistics.sharedComponentsDetected,
          failedPages: importResult.failedPages.length,
          validationIssues: detectionSummary.invalidPages ?? 0,
          processingTimeMs: importResult.statistics.processingTimeMs,
          importedAt: new Date().toISOString(),
          summary: this.orchestrator.generateImportSummary(importResult),
        };

        await this.repository.update(jobId, {
          detectionResults: {
            ...detectionRecord,
            importResults: importInfo,
          },
        });

        traceMemory('import-service:saveResults:post-orchestrator', {
          pagesCreated: importInfo.pagesCreated,
          failedPages: importResult.failedPages.length,
        });

        if (brandingSource && (brandingSource.logo || brandingSource.favicon)) {
          await this.persistBranding(job, brandingSource);
        }

        // Final import summary
        const processingTimeSec = (importResult.statistics.processingTimeMs / 1000).toFixed(1);
        console.log('\n' + '='.repeat(60));
        console.log('✓ Import Completed Successfully');
        console.log('='.repeat(60));
        console.log(`Pages Created:      ${importResult.statistics.totalPages}`);
        console.log(`Components:         ${importResult.statistics.totalComponents}`);
        console.log(`Component Types:    ${importResult.statistics.uniqueComponentTypes}`);
        console.log(`Shared Components:  ${importResult.statistics.sharedComponentsDetected}`);
        console.log(`Failed Pages:       ${importResult.failedPages.length}`);
        console.log(`Processing Time:    ${processingTimeSec}s`);
        console.log('='.repeat(60) + '\n');
      } catch (error) {
        consumeNormalizationWarnings();
        console.error('Failed to orchestrate import:', error);
        const message = error instanceof Error ? error.message : String(error);
        const isFatalNormalizationFailure = message.startsWith('Fatal content normalization warnings recorded:');
        await this.repository.update(jobId, {
          status: ImportJobStatus.FAILED,
          errorMessage: isFatalNormalizationFailure ? message : 'Import orchestration failed: ' + message,
        });
        throw error;
      }
    } else {
      traceMemory('import-service:saveResults:post-orchestrator', {
        pagesCreated: 0,
        failedPages: 0,
      });
    }

    if (result.data?.templates?.length > 0 && detectionPayload.length === 0) {
      await this.repository.updateTemplates(jobId, result.data.templates);
    }
  }

  private async syncRunStagesAfterCommit(job: ImportJob, importResult: ImportResult): Promise<void> {
    const extractImportSource = (page: ImportResult['pages'][number]): string | null => {
      const metadata = page.metadata;
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        const source = (metadata as Record<string, unknown>).importSource;
        if (typeof source === 'string' && source.trim().length > 0) {
          return source;
        }
      }
      return null;
    };

    const committedPages = importResult.pages
      .map((page) => ({
        page,
        pageUrl: extractImportSource(page),
      }))
      .filter((entry): entry is { page: ImportResult['pages'][number]; pageUrl: string } => Boolean(entry.pageUrl));

    if (committedPages.length === 0 && importResult.failedPages.length === 0) {
      return;
    }

    const run = await this.runService.findByJobId(job.id);
    if (!run) {
      return;
    }
    if (isTerminalImportRunStatus(run.status)) {
      console.warn('[ImportResultHandler] Skipping import run sync for terminal run', {
        jobId: job.id,
        runStatus: run.status,
      });
      return;
    }

    await this.runService.updateProgressForJob(job.id, {
      status: 'committing',
      phase: 'commit_page',
      progress: 95,
      message: 'Syncing committed import pages',
    });

    for (const { page, pageUrl } of committedPages) {
      await this.runService.upsertPageStageForJob(job.id, {
        pageUrl,
        title: page.title,
        status: 'committed',
        phase: 'commit_page',
        pageContent: page.content as Prisma.InputJsonValue,
        structureCandidate: {
          pageId: page.id,
          templateKey: page.templateKey,
          pageType: page.type,
        } as Prisma.InputJsonValue,
        committedPageId: page.id,
      });
    }

    for (const failure of importResult.failedPages) {
      await this.runService.upsertPageStageForJob(job.id, {
        pageUrl: failure.pageUrl,
        title: typeof failure.metadata?.pageTitle === 'string' ? failure.metadata.pageTitle : failure.pageUrl,
        status: failure.stage === 'validation' ? 'failed_retryable' : 'failed_terminal',
        phase: 'commit_page',
        error: {
          code: failure.stage === 'validation' ? 'PAGE_VALIDATION_FAILED' : 'PAGE_COMMIT_FAILED',
          message: failure.error,
          stage: failure.stage,
          metadata: failure.metadata ?? null,
        } as Prisma.InputJsonValue,
      });
    }

    const finalStatus = await this.runService.deriveFinalStatusForJob(job.id);

    await this.runService.updateProgressForJob(job.id, {
      status: finalStatus?.status ?? 'completed',
      phase: 'completed',
      progress: 100,
      message:
        finalStatus?.message ??
        (importResult.failedPages.length > 0
          ? `Import completed with ${importResult.failedPages.length} page warning${importResult.failedPages.length === 1 ? '' : 's'}`
          : 'Import completed'),
      ...(finalStatus
        ? {
            totalPages: finalStatus.totalPages,
            committedPages: finalStatus.committedPages,
            failedPages: finalStatus.failedPages,
          }
        : {}),
      completedAt: new Date(),
    });
  }

  private async persistBranding(job: ImportJob, brandingSource: {
    logo?: string | WebsiteMediaReference | null;
    favicon?: string | WebsiteMediaReference | null;
    primaryColors?: string[];
    fonts?: string[];
    visualStyle?: string | null;
  }): Promise<void> {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);

    const normalizeBrandingAsset = (
      asset: string | WebsiteMediaReference | null | undefined,
    ): string | WebsiteMediaReference | null => {
      if (!asset) {
        return null;
      }
      if (typeof asset === 'string') {
        return asset;
      }
      if (typeof asset === 'object' && typeof asset.mediaId === 'string') {
        const normalized: WebsiteMediaReference = { mediaId: asset.mediaId };
        if (typeof asset.originalUrl === 'string') {
          normalized.originalUrl = asset.originalUrl;
        }
        if (typeof asset.signedUrl === 'string') {
          normalized.signedUrl = asset.signedUrl;
        }
        if (typeof asset.publicUrl === 'string') {
          normalized.publicUrl = asset.publicUrl;
        }
        if (typeof asset.altText === 'string') {
          normalized.altText = asset.altText;
        }
        for (const [key, value] of Object.entries(asset)) {
          if (key === 'mediaId' || key === 'originalUrl' || key === 'signedUrl' || key === 'publicUrl' || key === 'altText') {
            continue;
          }
          (normalized as Record<string, unknown>)[key] = value as unknown;
        }
        return normalized;
      }
      return null;
    };

    const logoAsset = normalizeBrandingAsset(brandingSource.logo);
    const faviconAsset = normalizeBrandingAsset(brandingSource.favicon);
    const iconAsset = faviconAsset ?? logoAsset;

    const website = await this.prisma.website.findUnique({
      where: { id: job.websiteId },
      select: { settings: true },
    });

    try {
      const existingSettings = website && isRecord(website.settings)
        ? (website.settings as Record<string, unknown>)
        : {};

      const existingThemeValue = isRecord(existingSettings['theme'])
        ? (existingSettings['theme'] as Record<string, unknown>)
        : undefined;
      const existingBrandingValue = isRecord(existingSettings['branding'])
        ? (existingSettings['branding'] as Record<string, unknown>)
        : undefined;

      const existingPrimaryColors = existingThemeValue ? existingThemeValue['primaryColors'] : undefined;
      const existingFonts = existingThemeValue ? existingThemeValue['fonts'] : undefined;

      const primaryColors =
        Array.isArray(brandingSource.primaryColors) && brandingSource.primaryColors.length > 0
          ? brandingSource.primaryColors
          : Array.isArray(existingPrimaryColors)
            ? (existingPrimaryColors as string[])
            : ['#2563eb'];

      const fonts =
        Array.isArray(brandingSource.fonts) && brandingSource.fonts.length > 0
          ? brandingSource.fonts
          : Array.isArray(existingFonts)
            ? (existingFonts as string[])
            : ['Inter'];

      const theme: Record<string, unknown> = {
        ...(existingThemeValue ? { ...existingThemeValue } : {}),
        primaryColors,
        fonts,
      };

      const branding: Record<string, unknown> = {
        ...(existingBrandingValue ? { ...existingBrandingValue } : {}),
        logo: logoAsset,
        favicon: faviconAsset,
        visualStyle: brandingSource.visualStyle ?? null,
      };

      const mergedSettings: Record<string, unknown> = {
        ...existingSettings,
        theme,
        branding,
      };

      const iconData = iconAsset === null ? Prisma.JsonNull : (iconAsset as Prisma.InputJsonValue);

      await this.prisma.website.update({
        where: { id: job.websiteId },
        data: {
          icon: iconData,
          settings: mergedSettings as any,
        },
      });

      // Create design system from branding data as fallback ONLY if no design system exists
      try {
        // Check if a design system already exists from the pipeline
        const existingDesignSystem = await this.designSystemService.getLatestDesignSystemEntity(job.websiteId);

        if (!existingDesignSystem) {
          console.log(`[ImportResultHandler] No design system found, creating fallback from branding data`);
          await this.designSystemService.createFromBrandingData(
            job.websiteId,
            {
              primaryColors,
              fonts,
              visualStyle: brandingSource.visualStyle ?? undefined
            },
            job.id
          );
        } else {
          console.log(`[ImportResultHandler] Design system already exists (${existingDesignSystem.id}), skipping fallback creation`);
        }
      } catch (designSystemError) {
        console.warn('Failed to create design system from branding data (non-fatal):', designSystemError);
      }
    } catch (error) {
      console.warn('Failed to update website branding from metadata (non-fatal):', error);
    }
  }
}
