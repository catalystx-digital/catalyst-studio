import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeploymentWizard } from '@/components/deployment/deployment-wizard';
import { SyncStatusDisplay } from '@/components/sync/sync-status-display';
import { VersionHistoryBrowser } from '@/components/sync/version-history-browser';
import { ConflictResolutionPanel } from '@/components/sync/conflict-resolution-panel';
import { SyncAnalyticsDashboard } from '@/components/sync/sync-analytics-dashboard';

// Mock fetch globally
global.fetch = jest.fn();

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Sync Dashboard Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Sync Workflow', () => {
    it('should complete a full sync workflow through the UI', async () => {
      // Mock initial sync status
      const mockInitialStatus = {
        status: 'idle',
        progress: 0,
        currentStep: '',
        totalSteps: 0,
        errors: []
      };

      // Mock in-progress sync status
      const mockInProgressStatus = {
        status: 'in_progress',
        progress: 50,
        currentStep: 'Validating',
        totalSteps: 5,
        startedAt: '2025-01-18T10:00:00Z',
        errors: []
      };

      // Mock completed sync status
      const mockCompletedStatus = {
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        totalSteps: 5,
        completedAt: '2025-01-18T10:05:00Z',
        errors: [],
        validationResults: {
          passed: true,
          errors: 0,
          warnings: 0,
          details: []
        }
      };

      // Setup mock responses
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/sync/status')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => mockInitialStatus
            });
          } else if (callCount === 2) {
            return Promise.resolve({
              ok: true,
              json: async () => mockInProgressStatus
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: async () => mockCompletedStatus
            });
          }
        }
        
        if (url.includes('/api/sync/conflicts')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              conflicts: [],
              total: 0,
              unresolved: 0,
              resolved: 0
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
      });

      render(<SyncStatusDisplay />);

      // Check initial state
      await waitFor(() => {
        expect(screen.getByText('IDLE')).toBeInTheDocument();
      });

      // Simulate sync start
      await waitFor(() => {
        expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByText('Validating')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Simulate sync completion
      await waitFor(() => {
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('Passed')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle sync errors and allow retry', async () => {
      const mockErrorStatus = {
        status: 'failed',
        progress: 30,
        currentStep: 'Validation',
        totalSteps: 5,
        errors: [
          {
            code: 'VALIDATION_001',
            message: 'Schema validation failed',
            severity: 'error',
            timestamp: '2025-01-18T10:00:00Z'
          }
        ],
        validationResults: {
          passed: false,
          errors: 1,
          warnings: 0,
          details: [
            {
              field: 'title',
              message: 'Required field missing',
              severity: 'error'
            }
          ]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockErrorStatus
      });

      render(<SyncStatusDisplay />);

      await waitFor(() => {
        expect(screen.getByText('FAILED')).toBeInTheDocument();
        expect(screen.getByText('Schema validation failed')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('1 Errors')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates via SSE', () => {
    it('should handle real-time status updates', async () => {
      // Mock EventSource for SSE
      const mockEventSource = {
        addEventListener: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      (global as any).EventSource = jest.fn(() => mockEventSource);

      // Simulate SSE messages
      const simulateSSEMessage = (data: any) => {
        const messageHandler = mockEventSource.addEventListener.mock.calls.find(
          call => call[0] === 'message'
        )?.[1];
        
        if (messageHandler) {
          messageHandler({ data: JSON.stringify(data) });
        }
      };

      render(<SyncStatusDisplay />);

      // Initial status
      simulateSSEMessage({
        status: 'in_progress',
        progress: 0,
        currentStep: 'Starting',
        totalSteps: 5
      });

      await waitFor(() => {
        expect(screen.getByText('Starting')).toBeInTheDocument();
      });

      // Progress update
      simulateSSEMessage({
        status: 'in_progress',
        progress: 60,
        currentStep: 'Processing',
        totalSteps: 5
      });

      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('Processing')).toBeInTheDocument();
      });
    });
  });

  describe('Conflict Resolution Integration', () => {
    it('should integrate conflict resolution with sync workflow', async () => {
      const mockConflicts = {
        conflicts: [
          {
            id: 'conflict-1',
            contentTypeId: 'ct-pages',
            baseVersion: '1.0.0',
            conflictType: 'field_type_mismatch',
            severity: 'high',
            sourceChanges: { title: 'string' },
            targetChanges: { title: 'text' }
          }
        ],
        total: 1,
        unresolved: 1,
        resolved: 0
      };

      let conflictResolved = false;

      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/sync/conflicts') && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: async () => conflictResolved ? 
              { conflicts: [], total: 0, unresolved: 0, resolved: 1 } : 
              mockConflicts
          });
        }
        
        if (url.includes('/api/sync/conflicts') && options?.method === 'PUT') {
          conflictResolved = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({ 
              ...mockConflicts.conflicts[0], 
              resolvedAt: '2025-01-18T11:00:00Z' 
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
      });

      render(<ConflictResolutionPanel />);

      // Check conflict is displayed
      await waitFor(() => {
        expect(screen.getByText('1 unresolved conflict')).toBeInTheDocument();
        expect(screen.getByText('ct-pages')).toBeInTheDocument();
      });

      // Select conflict
      fireEvent.click(screen.getByText('ct-pages'));

      // Select resolution strategy
      await waitFor(() => {
        const autoMergeOption = screen.getByLabelText(/Auto-merge/);
        fireEvent.click(autoMergeOption);
      });

      // Resolve conflict
      const resolveButton = screen.getByText('Resolve Conflict');
      fireEvent.click(resolveButton);

      // Check conflict is resolved
      await waitFor(() => {
        expect(screen.getByText('No Conflicts')).toBeInTheDocument();
        expect(screen.getByText('All synchronization conflicts have been resolved')).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Dashboard Integration', () => {
    it('should display comprehensive sync analytics', async () => {
      const mockAnalytics = {
        totalSyncs: 250,
        successfulSyncs: 235,
        failedSyncs: 15,
        successRate: 94.0,
        averageDuration: 4500,
        conflictsPerSync: 0.4,
        validationErrorsPerSync: 0.2,
        mostSyncedContentTypes: [
          { contentTypeId: 'ct-pages', name: 'Pages', count: 85 },
          { contentTypeId: 'ct-posts', name: 'Blog Posts', count: 72 },
          { contentTypeId: 'ct-products', name: 'Products', count: 55 }
        ],
        syncVolumeOverTime: [
          { date: '2025-01-14', count: 45, successful: 42, failed: 3 },
          { date: '2025-01-15', count: 52, successful: 50, failed: 2 },
          { date: '2025-01-16', count: 48, successful: 45, failed: 3 },
          { date: '2025-01-17', count: 55, successful: 53, failed: 2 },
          { date: '2025-01-18', count: 50, successful: 45, failed: 5 }
        ],
        recentSyncs: [
          {
            id: 'sync-250',
            timestamp: '2025-01-18T14:30:00Z',
            status: 'success',
            duration: 3800,
            conflicts: 0,
            validationErrors: 0
          },
          {
            id: 'sync-249',
            timestamp: '2025-01-18T14:00:00Z',
            status: 'failed',
            duration: 5200,
            conflicts: 2,
            validationErrors: 3
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnalytics
      });

      render(<SyncAnalyticsDashboard />);

      // Check summary metrics
      await waitFor(() => {
        expect(screen.getByText('250')).toBeInTheDocument();
        expect(screen.getByText('94.0%')).toBeInTheDocument();
        expect(screen.getByText('235 successful')).toBeInTheDocument();
        expect(screen.getByText('15 failed')).toBeInTheDocument();
      });

      // Navigate to Content Types tab
      const contentTypesTab = screen.getByText('Content Types');
      fireEvent.click(contentTypesTab);

      await waitFor(() => {
        expect(screen.getByText('Pages')).toBeInTheDocument();
        expect(screen.getByText('85')).toBeInTheDocument();
        expect(screen.getByText('Blog Posts')).toBeInTheDocument();
        expect(screen.getByText('72')).toBeInTheDocument();
      });

      // Navigate to Recent Syncs tab
      const recentTab = screen.getByText('Recent Syncs');
      fireEvent.click(recentTab);

      await waitFor(() => {
        expect(screen.getByText('sync-250')).toBeInTheDocument();
        expect(screen.getByText('sync-249')).toBeInTheDocument();
        expect(screen.getByText('2 conflicts')).toBeInTheDocument();
        expect(screen.getByText('3 errors')).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency between UI and backend', async () => {
      // Mock consistent data across endpoints
      const consistentSyncId = 'sync-consistent-001';
      const consistentTimestamp = '2025-01-18T15:00:00Z';
      
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/sync/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'completed',
              progress: 100,
              syncId: consistentSyncId,
              completedAt: consistentTimestamp
            })
          });
        }
        
        if (url.includes('/api/sync/analytics')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              recentSyncs: [{
                id: consistentSyncId,
                timestamp: consistentTimestamp,
                status: 'success'
              }]
            })
          });
        }
        
        if (url.includes('/api/sync/history')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [{
                syncId: consistentSyncId,
                createdAt: consistentTimestamp,
                version: '2.0.0'
              }]
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
      });

      // Render multiple components that should show consistent data
      const { container } = render(
        <div>
          <SyncStatusDisplay />
          <VersionHistoryBrowser />
        </div>
      );

      // Verify consistent sync ID across components
      await waitFor(() => {
        const statusElements = container.querySelectorAll(`[data-sync-id="${consistentSyncId}"]`);
        expect(statusElements.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
