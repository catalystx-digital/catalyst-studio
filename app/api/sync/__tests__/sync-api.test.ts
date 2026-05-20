import { NextRequest } from 'next/server';
import { GET as getStatus, POST as postStatus } from '../status/route';
import { GET as getHistory, POST as postHistory } from '../history/route';
import { GET as getConflicts, POST as postConflicts, PUT as putConflict } from '../conflicts/route';
import { GET as getAnalytics, POST as postAnalytics } from '../analytics/route';
import fs from 'fs';
import path from 'path';

// Clean up test files after tests
afterAll(() => {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('Sync Status API', () => {
  describe('GET /api/sync/status', () => {
    it('should return current sync status', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/status');
      const response = await getStatus(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('progress');
      expect(data).toHaveProperty('currentStep');
      expect(data).toHaveProperty('totalSteps');
      expect(data).toHaveProperty('errors');
    });
  });

  describe('POST /api/sync/status', () => {
    it('should update sync status', async () => {
      const statusUpdate = {
        status: 'in_progress',
        progress: 50,
        currentStep: 'Validating',
        totalSteps: 5
      };
      
      const request = new NextRequest('http://localhost:3000/api/sync/status', {
        method: 'POST',
        body: JSON.stringify(statusUpdate)
      });
      
      const response = await postStatus(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('in_progress');
      expect(data.progress).toBe(50);
    });

    it('should return 400 for invalid status', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/status', {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      const response = await postStatus(request);
      
      expect(response.status).toBe(400);
    });
  });
});

describe('Version History API', () => {
  describe('GET /api/sync/history', () => {
    it('should return version history with pagination', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/history?limit=10&offset=0');
      const response = await getHistory(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);
    });

    it('should filter by contentTypeId', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/history?contentTypeId=ct-456');
      const response = await getHistory(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.items.every((item: Record<string, unknown>) => item.contentTypeId === 'ct-456')).toBeTruthy();
    });
  });

  describe('POST /api/sync/history', () => {
    it('should create new version history entry', async () => {
      const versionData = {
        contentTypeId: 'ct-123',
        version: '2.2.0',
        hash: 'abc123',
        parentHash: 'xyz789',
        author: 'test@example.com',
        changes: { added: 1, modified: 2, removed: 0 }
      };
      
      const request = new NextRequest('http://localhost:3000/api/sync/history', {
        method: 'POST',
        body: JSON.stringify(versionData)
      });
      
      const response = await postHistory(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.contentTypeId).toBe('ct-123');
      expect(data.version).toBe('2.2.0');
    });

    it('should return 400 for invalid data', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/history', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' })
      });
      
      const response = await postHistory(request);
      
      expect(response.status).toBe(400);
    });
  });
});

describe('Conflicts API', () => {
  describe('GET /api/sync/conflicts', () => {
    it('should return conflicts with status filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/conflicts?status=unresolved');
      const response = await getConflicts(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('conflicts');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('unresolved');
      expect(data).toHaveProperty('resolved');
    });
  });

  describe('POST /api/sync/conflicts', () => {
    it('should create new conflict', async () => {
      const conflictData = {
        contentTypeId: 'ct-456',
        conflictType: 'field_type_mismatch',
        severity: 'high',
        sourceChanges: { field: 'title', type: 'string' },
        targetChanges: { field: 'title', type: 'number' }
      };
      
      const request = new NextRequest('http://localhost:3000/api/sync/conflicts', {
        method: 'POST',
        body: JSON.stringify(conflictData)
      });
      
      const response = await postConflicts(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.contentTypeId).toBe('ct-456');
      expect(data.conflictType).toBe('field_type_mismatch');
    });
  });

  describe('PUT /api/sync/conflicts', () => {
    it('should resolve conflict', async () => {
      // First create a conflict
      const createRequest = new NextRequest('http://localhost:3000/api/sync/conflicts', {
        method: 'POST',
        body: JSON.stringify({
          contentTypeId: 'ct-789',
          conflictType: 'field_deletion'
        })
      });
      
      const createResponse = await postConflicts(createRequest);
      const conflict = await createResponse.json();
      
      // Then resolve it
      const resolveRequest = new NextRequest(`http://localhost:3000/api/sync/conflicts?id=${conflict.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          resolutionStrategy: 'manual',
          resolution: { resolved: true },
          resolvedBy: 'test-user'
        })
      });
      
      const response = await putConflict(resolveRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.resolvedAt).toBeDefined();
      expect(data.resolvedBy).toBe('test-user');
    });

    it('should return 404 for non-existent conflict', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/conflicts?id=non-existent', {
        method: 'PUT',
        body: JSON.stringify({ resolutionStrategy: 'manual' })
      });
      
      const response = await putConflict(request);
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Analytics API', () => {
  describe('GET /api/sync/analytics', () => {
    it('should return sync analytics', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/analytics?period=7d');
      const response = await getAnalytics(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalSyncs');
      expect(data).toHaveProperty('successfulSyncs');
      expect(data).toHaveProperty('failedSyncs');
      expect(data).toHaveProperty('successRate');
      expect(data).toHaveProperty('averageDuration');
      expect(data).toHaveProperty('conflictsPerSync');
      expect(data).toHaveProperty('validationErrorsPerSync');
      expect(data).toHaveProperty('mostSyncedContentTypes');
      expect(data).toHaveProperty('syncVolumeOverTime');
      expect(data).toHaveProperty('recentSyncs');
    });

    it('should filter analytics by period', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/analytics?period=24h');
      const response = await getAnalytics(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.syncVolumeOverTime.length).toBe(1);
    });
  });

  describe('POST /api/sync/analytics', () => {
    it('should record new sync analytics', async () => {
      const syncData = {
        syncId: 'sync-test-001',
        status: 'success',
        duration: 3500,
        conflicts: 1,
        validationErrors: 0
      };
      
      const request = new NextRequest('http://localhost:3000/api/sync/analytics', {
        method: 'POST',
        body: JSON.stringify(syncData)
      });
      
      const response = await postAnalytics(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('sync');
      expect(data.sync.id).toBe('sync-test-001');
    });

    it('should return 400 for invalid analytics data', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/analytics', {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      const response = await postAnalytics(request);
      
      expect(response.status).toBe(400);
    });
  });
});