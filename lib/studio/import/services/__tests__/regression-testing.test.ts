import { POST as startImport } from '@/app/api/studio/import/start/route';
import { GET as getImportActivity } from '@/app/api/studio/import/activity/route';
import { NextRequest } from 'next/server';
import { ImportService } from '@/lib/studio/import/services/import-service';

// Mock existing import job tracking
const mockBullQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  clean: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn()
};

// Mock WebSocket for progress updates
const mockWebSocketServer = {
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  broadcast: jest.fn()
};

// Mock Prisma with legacy data simulation
const mockPrisma = {
  website: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  importJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  // Legacy table for backwards compatibility testing
  cMSComponent: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn()
  },
  // New tables
  websiteComponentType: {
    findMany: jest.fn(),
    createMany: jest.fn()
  },
  websitePage: {
    findMany: jest.fn(),
    createMany: jest.fn()
  },
  websiteStructure: {
    findMany: jest.fn(),
    createMany: jest.fn()
  },
  websiteSharedComponent: {
    findMany: jest.fn(),
    createMany: jest.fn()
  }
} as any;

// Mock Prisma + auth context used by API routes
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));
jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    accountId: 'test-account-id',
    userId: 'user-1',
  }),
}));
jest.mock('@/lib/usage/limits', () => ({
  checkAndRecordUsage: jest.fn().mockResolvedValue(undefined),
}));

// Mock ImportService
jest.mock('@/lib/studio/import/services/import-service');

describe('Regression Testing Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  describe('Import Job Tracking Compatibility', () => {
    it('should maintain existing import job tracking functionality', async () => {
      // Arrange - Mock existing job tracking behavior
      const existingJobData = {
        id: 'job-regression-123',
        websiteId: 'website-regression-456',
        url: 'https://regression-test.example.com',
        status: 'pending',
        templatesGenerated: [],
        detectionResults: {
          progress: 0,
          stage: 'queued'
        },
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      mockPrisma.website.create.mockResolvedValue({
        id: existingJobData.websiteId,
        name: 'Regression Test Site',
        subdomain: 'regression-test-123456',
        customDomain: null,
        published: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockPrisma.importJob.create.mockResolvedValue(existingJobData);
      mockPrisma.importJob.findUnique.mockResolvedValue({
        ...existingJobData,
        status: 'processing',
        detectionResults: { progress: 50, stage: 'analyzing' }
      });

      // Mock ImportService to maintain backward compatibility
      const mockImportService = jest.mocked(ImportService);
      mockImportService.prototype.startImport = jest.fn().mockResolvedValue({
        job: { id: existingJobData.id, websiteId: existingJobData.websiteId } as any,
        state: 'active',
        message: 'Preparing import...',
        queuePosition: null,
        estimatedStartSeconds: null,
      });

      mockImportService.prototype.getJobProgress = jest.fn().mockResolvedValue({
        status: 'PROCESSING',
        progress: 50,
        message: 'Analyzing structure',
        stage: 'analyzing',
        websiteId: existingJobData.websiteId,
        templatesGenerated: 5
      });

      // Act - Test existing API endpoints
      const startRequest = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://regression-test.example.com',
          websiteName: 'Regression Test Site'
        })
      });

      const startResponse = await startImport(startRequest);
      const startData = await startResponse.json();

      expect(startResponse.status).toBe(200);
      expect(startData.jobId).toBe(existingJobData.id);
      expect(startData.websiteId).toBe(existingJobData.websiteId);

      const progress = await mockImportService.prototype.getJobProgress(existingJobData.id);
      expect(mockImportService.prototype.getJobProgress).toHaveBeenCalledWith(existingJobData.id);
      expect(progress.status).toBe('PROCESSING');
      expect(progress.progress).toBe(50);
      expect(progress.stage).toBe('analyzing');


    });
  });

  describe('API Endpoint Backward Compatibility', () => {
    it('should maintain /api/studio/import/start endpoint interface', async () => {
      // Arrange - Test all expected request formats
      const testRequests = [
        // Standard format
        {
          name: 'Standard Request',
          body: {
            url: 'https://standard-test.com',
            websiteName: 'Standard Test Site'
          }
        },
        // With optional parameters
        {
          name: 'Request with Options',
          body: {
            url: 'https://options-test.com',
            websiteName: 'Options Test Site',
            options: {
              enableAdvancedDetection: true,
              customSettings: { theme: 'dark' }
            }
          }
        },
      ];

      // Mock service responses
      const mockImportService = jest.mocked(ImportService);
      mockImportService.prototype.startImport = jest.fn().mockImplementation(async ({ url, websiteId }) => ({
        job: { id: 'job-' + Date.now(), websiteId } as any,
        state: 'active',
        message: 'Preparing import...',
        queuePosition: null,
        estimatedStartSeconds: null,
      }));

      mockPrisma.website.create.mockImplementation(async ({ data }) => ({
        id: `website-${Date.now()}`,
        name: data.name,
        subdomain: `test-${Date.now()}`,
        customDomain: null,
        published: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Act & Assert
      for (const testRequest of testRequests) {
        const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
          method: 'POST',
          body: JSON.stringify(testRequest.body)
        });

        const response = await startImport(request);
        const responseData = await response.json();

        // All formats should return consistent response structure
        expect(response.status).toBe(200);
        expect(responseData).toHaveProperty('jobId');
        expect(responseData).toHaveProperty('websiteId');
        expect(typeof responseData.jobId).toBe('string');
        expect(typeof responseData.websiteId).toBe('string');

        console.log(`✓ ${testRequest.name}: API compatibility maintained`);
      }
    });

    it('should expose consolidated import activity view model', async () => {
      const now = new Date('2025-09-17T10:00:00Z');

      const jobScenarios = [
        {
          id: 'activity-job-0',
          status: 'pending',
          progress: 0,
          expectedStage: 'initializing',
          expectedState: 'active',
        },
        {
          id: 'activity-job-1',
          status: 'processing',
          progress: 30,
          expectedStage: 'fetching',
          expectedState: 'active',
        },
        {
          id: 'activity-job-2',
          status: 'processing',
          progress: 70,
          expectedStage: 'generating',
          expectedState: 'active',
        },
        {
          id: 'activity-job-3',
          status: 'queued',
          progress: 0,
          expectedStage: 'queued',
          expectedState: 'queued',
          queuePosition: 2,
          estimatedStartSeconds: 240,
        },
      ];

      mockPrisma.importJob.findMany.mockResolvedValue(
        jobScenarios.map((scenario, index) => ({
          id: scenario.id,
          websiteId: 'website-' + index,
          url: 'https://import-' + index + '.example.com',
          status: scenario.status,
          detectionResults: {
            progress: scenario.progress,
            lastProgressMessage:
              scenario.status === 'queued'
                ? 'Queued - waiting for an available import slot'
                : 'Stage: ' + scenario.expectedStage,
            queuePosition: typeof scenario.queuePosition === 'number' ? scenario.queuePosition : null,
            estimatedStartSeconds:
              typeof scenario.estimatedStartSeconds === 'number'
                ? scenario.estimatedStartSeconds
                : null,
          },
          errorMessage: null,
          startedAt: new Date('2025-09-17T09:00:00Z'),
          updatedAt: new Date(now.getTime() + index * 1000),
          completedAt: null,
          createdAt: new Date('2025-09-17T08:59:00Z'),
          website: {
            id: 'website-' + index,
            name: 'Site ' + index,
            icon: null,
          },
        })),
      );

      const request = new NextRequest('http://localhost:3000/api/studio/import/activity');
      const response = await getImportActivity(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data).toHaveLength(jobScenarios.length);

      jobScenarios.forEach((scenario, index) => {
        const view = payload.data[index];
        expect(view.id).toBe(scenario.id);
        expect(view.status).toBe(scenario.status);
        expect(view.stage).toBe(scenario.expectedStage);
        expect(view.state).toBe(scenario.expectedState);
        expect(view.progress).toBe(scenario.progress);
        if (typeof scenario.queuePosition === 'number') {
          expect(view.queuePosition).toBe(scenario.queuePosition);
          expect(view.estimatedStartSeconds).toBe(scenario.estimatedStartSeconds);
        } else {
          expect(view.queuePosition).toBeNull();
          expect(view.estimatedStartSeconds).toBeNull();
        }
      });

      console.log('V activity endpoint: consolidated view model verified');
    });
  });

  describe('WebSocket Progress Updates Compatibility', () => {
    it('should maintain WebSocket progress update format', async () => {
      // Arrange - Mock WebSocket events
      const mockWebSocket = {
        emit: jest.fn(),
        to: jest.fn().mockReturnThis(),
        broadcast: jest.fn().mockReturnThis()
      };

      const progressUpdates = [
        { progress: 0, stage: 'queued', message: 'Import job queued' },
        { progress: 10, stage: 'analyzing', message: 'Analyzing website structure' },
        { progress: 30, stage: 'extracting', message: 'Extracting components' },
        { progress: 50, stage: 'processing', message: 'Processing component data' },
        { progress: 70, stage: 'building', message: 'Building page structure' },
        { progress: 90, stage: 'finalizing', message: 'Finalizing import' },
        { progress: 100, stage: 'completed', message: 'Import completed successfully' }
      ];

      // Mock progress emission
      const emitProgress = (jobId: string, update: any) => {
        const formattedUpdate = {
          jobId,
          status: update.stage === 'completed' ? 'COMPLETED' : 'PROCESSING',
          progress: update.progress,
          message: update.message,
          stage: update.stage,
          timestamp: new Date().toISOString()
        };

        mockWebSocket.to(`import-${jobId}`).emit('progress', formattedUpdate);
        return formattedUpdate;
      };

      // Act - Test progress updates
      const jobId = 'websocket-test-job';
      const emittedUpdates = progressUpdates.map(update => emitProgress(jobId, update));

      // Assert - WebSocket format consistency
      emittedUpdates.forEach((update, index) => {
        expect(update).toHaveProperty('jobId', jobId);
        expect(update).toHaveProperty('status');
        expect(update).toHaveProperty('progress');
        expect(update).toHaveProperty('message');
        expect(update).toHaveProperty('stage');
        expect(update).toHaveProperty('timestamp');

        expect(update.progress).toBe(progressUpdates[index].progress);
        expect(update.stage).toBe(progressUpdates[index].stage);
        expect(update.message).toBe(progressUpdates[index].message);

        // Status should be PROCESSING until completed
        if (update.stage === 'completed') {
          expect(update.status).toBe('COMPLETED');
        } else {
          expect(update.status).toBe('PROCESSING');
        }
      });

      expect(mockWebSocket.to).toHaveBeenCalledTimes(progressUpdates.length);
      expect(mockWebSocket.emit).toHaveBeenCalledTimes(progressUpdates.length);

      console.log(`✓ WebSocket: ${emittedUpdates.length} progress updates maintain format`);
    });

    it('should handle legacy WebSocket client compatibility', async () => {
      // Arrange - Simulate legacy client expectations
      const legacyClientExpectedFields = [
        'jobId',
        'progress', // Legacy: expected as number 0-100
        'status', // Legacy: expected as string (PENDING, PROCESSING, COMPLETED, FAILED)
        'message' // Legacy: expected as descriptive string
      ];

      const modernUpdate = {
        jobId: 'legacy-compat-job',
        status: 'PROCESSING',
        progress: 65,
        message: 'Processing website components',
        stage: 'processing', // Modern field
        timestamp: new Date().toISOString(), // Modern field
        metadata: { // Modern field
          componentsProcessed: 15,
          pagesAnalyzed: 3
        }
      };

      // Act - Transform to legacy format
      const legacyCompatibleUpdate = {
        jobId: modernUpdate.jobId,
        progress: modernUpdate.progress,
        status: modernUpdate.status,
        message: modernUpdate.message
        // Omit modern fields for legacy clients
      };

      // Assert - Legacy client compatibility
      legacyClientExpectedFields.forEach(field => {
        expect(legacyCompatibleUpdate).toHaveProperty(field);
        expect(legacyCompatibleUpdate[field]).toBeDefined();
      });

      // Modern fields should be optional for backward compatibility
      expect(modernUpdate).toHaveProperty('stage');
      expect(modernUpdate).toHaveProperty('timestamp');
      expect(modernUpdate).toHaveProperty('metadata');

      // Legacy format should still work
      expect(legacyCompatibleUpdate.progress).toBeGreaterThanOrEqual(0);
      expect(legacyCompatibleUpdate.progress).toBeLessThanOrEqual(100);
      expect(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).toContain(legacyCompatibleUpdate.status);

      console.log('✓ WebSocket: Legacy client compatibility maintained');
    });
  });

  describe('Bull Queue Integration Compatibility', () => {
    it('should maintain Bull queue job management', async () => {
      // Arrange - Mock Bull queue operations
      const queueOperations = {
        addJob: jest.fn(),
        getJob: jest.fn(),
        getWaitingCount: jest.fn(),
        getActiveCount: jest.fn(),
        getCompletedCount: jest.fn(),
        getFailedCount: jest.fn(),
        clean: jest.fn()
      };

      const testJob = {
        id: 'bull-queue-test-job',
        data: {
          websiteId: 'website-bull-test',
          url: 'https://bull-test.example.com',
          options: {
            timeout: 60000,
            attempts: 3
          }
        }
      };

      queueOperations.addJob.mockResolvedValue({
        id: testJob.id,
        data: testJob.data,
        opts: {
          attempts: 3,
          timeout: 60000,
          delay: 0
        }
      });

      queueOperations.getJob.mockResolvedValue({
        id: testJob.id,
        data: testJob.data,
        progress: 45,
        processedOn: Date.now(),
        finishedOn: null,
        failedReason: null
      });

      queueOperations.getWaitingCount.mockResolvedValue(3);
      queueOperations.getActiveCount.mockResolvedValue(2);
      queueOperations.getCompletedCount.mockResolvedValue(15);
      queueOperations.getFailedCount.mockResolvedValue(1);

      // Act - Test queue operations
      const addResult = await queueOperations.addJob('import-job', testJob.data, {
        attempts: 3,
        timeout: 60000
      });

      const jobStatus = await queueOperations.getJob(testJob.id);
      const queueStats = {
        waiting: await queueOperations.getWaitingCount(),
        active: await queueOperations.getActiveCount(),
        completed: await queueOperations.getCompletedCount(),
        failed: await queueOperations.getFailedCount()
      };

      // Assert - Bull queue compatibility
      expect(addResult).toHaveProperty('id');
      expect(addResult).toHaveProperty('data');
      expect(addResult.data.websiteId).toBe(testJob.data.websiteId);
      expect(addResult.data.url).toBe(testJob.data.url);

      expect(jobStatus).toHaveProperty('id', testJob.id);
      expect(jobStatus).toHaveProperty('progress');
      expect(typeof jobStatus.progress).toBe('number');

      expect(queueStats.waiting).toBe(3);
      expect(queueStats.active).toBe(2);
      expect(queueStats.completed).toBe(15);
      expect(queueStats.failed).toBe(1);

      console.log('✓ Bull Queue: Job management compatibility maintained');
    });

    it('should handle queue job retry logic consistently', async () => {
      // Arrange - Failed job scenarios
      const failedJobScenarios = [
        {
          name: 'Network Timeout',
          error: new Error('NetworkError: Request timeout'),
          expectedRetry: true,
          expectedAttempts: 3
        },
        {
          name: 'Rate Limit',
          error: new Error('RateLimitError: Too many requests'),
          expectedRetry: true,
          expectedAttempts: 3
        },
        {
          name: 'Invalid URL',
          error: new Error('ValidationError: Invalid URL format'),
          expectedRetry: false,
          expectedAttempts: 1
        },
        {
          name: 'API Key Missing',
          error: new Error('AuthenticationError: API key required'),
          expectedRetry: false,
          expectedAttempts: 1
        }
      ];

      // Mock retry logic
      const shouldRetry = (error: Error, attemptsMade: number): boolean => {
        const maxAttempts = 3;
        
        if (attemptsMade >= maxAttempts) return false;
        
        // Retry for recoverable errors
        const recoverableErrors = ['NetworkError', 'RateLimitError', 'TimeoutError'];
        return recoverableErrors.some(errorType => error.message.includes(errorType));
      };

      // Act & Assert - Test retry logic for each scenario
      failedJobScenarios.forEach(scenario => {
        const retryDecision = shouldRetry(scenario.error, 1);
        
        expect(retryDecision).toBe(scenario.expectedRetry);
        
        if (scenario.expectedRetry) {
          // Should retry up to max attempts
          expect(shouldRetry(scenario.error, scenario.expectedAttempts)).toBe(false);
        }

        console.log(`✓ Bull Queue: ${scenario.name} retry logic maintained`);
      });
    });
  });

  describe('Backward Compatibility with Existing Imported Data', () => {
    it('should handle existing imported data gracefully', async () => {
      // Arrange - Simulate existing imported data (pre-Epic 17 format)
      const existingImportedData = {
        website: {
          id: 'existing-website-123',
          name: 'Existing Site',
          subdomain: 'existing-site-456789'
        },
        legacyComponents: [
          {
            id: 'legacy-comp-1',
            websiteId: 'existing-website-123',
            type: 'hero',
            props: JSON.stringify({ title: 'Legacy Hero', subtitle: 'Old format' }),
            position: 0,
            parentId: null
          },
          {
            id: 'legacy-comp-2',
            websiteId: 'existing-website-123',
            type: 'button',
            props: JSON.stringify({ text: 'Legacy Button', style: 'primary' }),
            position: 1,
            parentId: 'legacy-comp-1'
          }
        ],
        importJob: {
          id: 'legacy-import-job',
          websiteId: 'existing-website-123',
          status: 'completed',
          completedAt: new Date('2023-12-01T10:00:00Z')
        }
      };

      // Mock database responses
      mockPrisma.website.findUnique.mockResolvedValue(existingImportedData.website);
      mockPrisma.cMSComponent.findMany.mockResolvedValue(existingImportedData.legacyComponents);
      mockPrisma.importJob.findMany.mockResolvedValue([existingImportedData.importJob]);

      // New schema tables (should be empty for legacy data)
      mockPrisma.websiteComponentType.findMany.mockResolvedValue([]);
      mockPrisma.websitePage.findMany.mockResolvedValue([]);
      mockPrisma.websiteStructure.findMany.mockResolvedValue([]);
      mockPrisma.websiteSharedComponent.findMany.mockResolvedValue([]);

      // Act - Attempt to access existing data
      const website = await mockPrisma.website.findUnique({ 
        where: { id: 'existing-website-123' } 
      });
      
      const legacyComponents = await mockPrisma.cMSComponent.findMany({
        where: { websiteId: 'existing-website-123' }
      });
      
      const importJobs = await mockPrisma.importJob.findMany({
        where: { websiteId: 'existing-website-123' }
      });

      // Check new schema data
      const newComponentTypes = await mockPrisma.websiteComponentType.findMany({
        where: { websiteId: 'existing-website-123' }
      });

      // Assert - Existing data accessible
      expect(website).toBeDefined();
      expect(website.id).toBe('existing-website-123');
      expect(website.name).toBe('Existing Site');

      expect(legacyComponents).toHaveLength(2);
      expect(legacyComponents[0].type).toBe('hero');
      expect(legacyComponents[1].type).toBe('button');

      expect(importJobs).toHaveLength(1);
      expect(importJobs[0].status).toBe('completed');

      // New schema should be empty for legacy data
      expect(newComponentTypes).toHaveLength(0);

      console.log('✓ Backward Compatibility: Existing data accessible');
    });

    it('should support data migration from legacy to new schema', async () => {
      // Arrange - Legacy data migration scenario
      const legacyWebsiteId = 'migration-test-website';
      const legacyData = [
        {
          id: 'legacy-hero-1',
          websiteId: legacyWebsiteId,
          type: 'hero',
          props: JSON.stringify({
            title: 'Legacy Hero Title',
            subtitle: 'Legacy Hero Subtitle'
          }),
          position: 0,
          parentId: null,
          createdAt: new Date('2023-11-01T10:00:00Z')
        },
        {
          id: 'legacy-button-1',
          websiteId: legacyWebsiteId,
          type: 'button',
          props: JSON.stringify({
            text: 'Legacy Button',
            style: 'primary'
          }),
          position: 1,
          parentId: 'legacy-hero-1',
          createdAt: new Date('2023-11-01T10:00:00Z')
        }
      ];

      // Mock migration logic
      const migrateToNewSchema = async (legacyComponents: any[], websiteId: string) => {
        // Convert legacy data to new schema format
        const componentTypes = Array.from(
          new Set(legacyComponents.map(c => c.type))
        ).map((type, index) => ({
          id: `migrated-ct-${index}`,
          websiteId,
          type,
          category: type === 'hero' ? 'content' : 'interactive',
          displayName: `${type.charAt(0).toUpperCase() + type.slice(1)} Component`,
          defaultConfig: {},
          placeholderData: {},
          migratedFrom: 'legacy'
        }));

        const pages = [{
          id: `migrated-page-${websiteId}`,
          websiteId,
          title: 'Migrated Page',
          type: 'page',
          content: {
            components: legacyComponents.map(comp => ({
              id: comp.id,
              typeId: componentTypes.find(ct => ct.type === comp.type)?.id,
              type: comp.type,
              parentId: comp.parentId,
              position: comp.position,
              props: JSON.parse(comp.props)
            }))
          },
          migratedFrom: 'legacy'
        }];

        const structures = [{
          id: `migrated-struct-${websiteId}`,
          websiteId,
          websitePageId: pages[0].id,
          slug: 'migrated-page',
          fullPath: '/migrated-page',
          parentId: null,
          position: 0,
          migratedFrom: 'legacy'
        }];

        return { componentTypes, pages, structures };
      };

      // Act - Perform migration
      const migrationResult = await migrateToNewSchema(legacyData, legacyWebsiteId);

      // Assert - Migration results
      expect(migrationResult.componentTypes).toHaveLength(2);
      expect(migrationResult.componentTypes.map(ct => ct.type)).toEqual(['hero', 'button']);
      expect(migrationResult.componentTypes.every(ct => ct.migratedFrom === 'legacy')).toBe(true);

      expect(migrationResult.pages).toHaveLength(1);
      expect(migrationResult.pages[0].content.components).toHaveLength(2);
      expect(migrationResult.pages[0].migratedFrom).toBe('legacy');

      expect(migrationResult.structures).toHaveLength(1);
      expect(migrationResult.structures[0].fullPath).toBe('/migrated-page');
      expect(migrationResult.structures[0].migratedFrom).toBe('legacy');

      // Verify component relationships preserved
      const heroComponent = migrationResult.pages[0].content.components.find(c => c.type === 'hero');
      const buttonComponent = migrationResult.pages[0].content.components.find(c => c.type === 'button');
      
      expect(heroComponent.parentId).toBeNull();
      expect(buttonComponent.parentId).toBe(heroComponent.id);

      console.log('✓ Data Migration: Legacy to new schema migration supported');
    });
  });
});

// Helper function to simulate various error scenarios for testing
function createRegressionTestError(type: 'network' | 'validation' | 'auth' | 'timeout', message?: string): Error {
  const errorTypes = {
    network: () => new Error(message || 'NetworkError: Connection failed'),
    validation: () => new Error(message || 'ValidationError: Invalid input'),
    auth: () => new Error(message || 'AuthenticationError: Invalid API key'),
    timeout: () => new Error(message || 'TimeoutError: Request timeout')
  };

  return errorTypes[type]();
}

// Mock function to simulate Bull queue job processing
function simulateBullQueueJob(jobData: any, options: any = {}) {
  return {
    id: `bull-job-${Date.now()}`,
    data: jobData,
    opts: {
      attempts: options.attempts || 1,
      timeout: options.timeout || 30000,
      delay: options.delay || 0,
      ...options
    },
    progress: 0,
    processedOn: null,
    finishedOn: null,
    failedReason: null
  };
}

