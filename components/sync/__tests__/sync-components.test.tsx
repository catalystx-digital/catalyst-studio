import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SyncStatusDisplay } from '../sync-status-display';
import { VersionHistoryBrowser } from '../version-history-browser';
import { ConflictResolutionPanel } from '../conflict-resolution-panel';
import { SyncAnalyticsDashboard } from '../sync-analytics-dashboard';

// Mock fetch globally
global.fetch = jest.fn();

describe('SyncStatusDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display sync status when data is available', async () => {
    const mockStatus = {
      status: 'in_progress',
      progress: 50,
      currentStep: 'Validating',
      totalSteps: 5,
      startedAt: '2025-01-18T10:00:00Z',
      errors: []
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus
    });

    render(<SyncStatusDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Sync Status')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Validating')).toBeInTheDocument();
    });
  });

  it('should display errors when present', async () => {
    const mockStatus = {
      status: 'failed',
      progress: 0,
      currentStep: '',
      totalSteps: 0,
      errors: [
        {
          code: 'SYNC_001',
          message: 'Connection failed',
          severity: 'error',
          timestamp: '2025-01-18T10:00:00Z'
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus
    });

    render(<SyncStatusDisplay />);

    await waitFor(() => {
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('should display validation results when available', async () => {
    const mockStatus = {
      status: 'completed',
      progress: 100,
      currentStep: 'Complete',
      totalSteps: 5,
      errors: [],
      validationResults: {
        passed: false,
        errors: 2,
        warnings: 1,
        details: []
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus
    });

    render(<SyncStatusDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('2 Errors')).toBeInTheDocument();
      expect(screen.getByText('1 Warnings')).toBeInTheDocument();
    });
  });
});

describe('VersionHistoryBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display version history', async () => {
    const mockHistory = {
      items: [
        {
          id: 'v1',
          contentTypeId: 'ct-123',
          version: '2.1.0',
          hash: 'abc123',
          createdAt: '2025-01-18T10:00:00Z',
          changeSource: 'UI',
          author: 'user@example.com',
          changes: { added: 2, modified: 3, removed: 1 }
        }
      ],
      total: 1,
      limit: 20,
      offset: 0
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory
    });

    render(<VersionHistoryBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Version History')).toBeInTheDocument();
      expect(screen.getByText('v2.1.0')).toBeInTheDocument();
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
      expect(screen.getByText('+2 added')).toBeInTheDocument();
    });
  });

  it('should handle view diff action', async () => {
    const mockHistory = {
      items: [
        {
          id: 'v1',
          contentTypeId: 'ct-123',
          version: '2.1.0',
          hash: 'abc123',
          createdAt: '2025-01-18T10:00:00Z',
          changeSource: 'UI',
          author: 'user@example.com',
          changes: { added: 2, modified: 3, removed: 1 }
        }
      ],
      total: 1,
      limit: 20,
      offset: 0
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory
    });

    render(<VersionHistoryBrowser />);

    await waitFor(() => {
      const viewButton = screen.getByText('View');
      fireEvent.click(viewButton);
      expect(screen.getByText('Version Details')).toBeInTheDocument();
    });
  });
});

describe('ConflictResolutionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display no conflicts message when none exist', async () => {
    const mockConflicts = {
      conflicts: [],
      total: 0,
      unresolved: 0,
      resolved: 0
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConflicts
    });

    render(<ConflictResolutionPanel />);

    await waitFor(() => {
      expect(screen.getByText('No Conflicts')).toBeInTheDocument();
      expect(screen.getByText('All synchronization conflicts have been resolved')).toBeInTheDocument();
    });
  });

  it('should display conflicts when they exist', async () => {
    const mockConflicts = {
      conflicts: [
        {
          id: 'c1',
          contentTypeId: 'ct-456',
          baseVersion: '1.0.0',
          conflictType: 'field_type_mismatch',
          severity: 'high',
          sourceChanges: {},
          targetChanges: {}
        }
      ],
      total: 1,
      unresolved: 1,
      resolved: 0
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConflicts
    });

    render(<ConflictResolutionPanel />);

    await waitFor(() => {
      expect(screen.getByText('Conflicts')).toBeInTheDocument();
      expect(screen.getByText('1 unresolved conflict')).toBeInTheDocument();
      expect(screen.getByText('ct-456')).toBeInTheDocument();
      expect(screen.getByText('Field Type Mismatch')).toBeInTheDocument();
    });
  });

  it('should handle conflict resolution', async () => {
    const mockConflicts = {
      conflicts: [
        {
          id: 'c1',
          contentTypeId: 'ct-456',
          baseVersion: '1.0.0',
          conflictType: 'field_type_mismatch',
          severity: 'high',
          sourceChanges: {},
          targetChanges: {}
        }
      ],
      total: 1,
      unresolved: 1,
      resolved: 0
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConflicts
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockConflicts.conflicts[0], resolvedAt: '2025-01-18T11:00:00Z' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conflicts: [], total: 0, unresolved: 0, resolved: 1 })
      });

    render(<ConflictResolutionPanel />);

    await waitFor(() => {
      const conflictButton = screen.getByText('ct-456');
      fireEvent.click(conflictButton);
    });

    await waitFor(() => {
      const resolveButton = screen.getByText('Resolve Conflict');
      expect(resolveButton).toBeInTheDocument();
      
      const strategyRadio = screen.getByLabelText('Prefer Source Changes');
      fireEvent.click(strategyRadio);
      
      fireEvent.click(resolveButton);
    });

    await waitFor(() => {
      expect(screen.getByText('No Conflicts')).toBeInTheDocument();
    });
  });
});

describe('SyncAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display analytics data', async () => {
    const mockAnalytics = {
      totalSyncs: 150,
      successfulSyncs: 142,
      failedSyncs: 8,
      successRate: 94.7,
      averageDuration: 3200,
      conflictsPerSync: 0.3,
      validationErrorsPerSync: 0.5,
      mostSyncedContentTypes: [
        { contentTypeId: 'ct-pages', name: 'Pages', count: 45 }
      ],
      syncVolumeOverTime: [
        { date: '2025-01-18', count: 10, successful: 9, failed: 1 }
      ],
      recentSyncs: [
        {
          id: 'sync-001',
          timestamp: '2025-01-18T10:00:00Z',
          status: 'success',
          duration: 2800,
          conflicts: 0,
          validationErrors: 0
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalytics
    });

    render(<SyncAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('94.7%')).toBeInTheDocument();
      expect(screen.getByText('142 successful')).toBeInTheDocument();
      expect(screen.getByText('8 failed')).toBeInTheDocument();
    });
  });

  it('should switch between tabs', async () => {
    const mockAnalytics = {
      totalSyncs: 150,
      successfulSyncs: 142,
      failedSyncs: 8,
      successRate: 94.7,
      averageDuration: 3200,
      conflictsPerSync: 0.3,
      validationErrorsPerSync: 0.5,
      mostSyncedContentTypes: [
        { contentTypeId: 'ct-pages', name: 'Pages', count: 45 }
      ],
      syncVolumeOverTime: [],
      recentSyncs: []
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalytics
    });

    render(<SyncAnalyticsDashboard />);

    await waitFor(() => {
      const contentTypesTab = screen.getByText('Content Types');
      fireEvent.click(contentTypesTab);
      
      expect(screen.getByText('Most Synced Content Types')).toBeInTheDocument();
      expect(screen.getByText('Pages')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });
  });
});