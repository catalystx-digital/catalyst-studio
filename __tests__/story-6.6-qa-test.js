/**
 * QA Test Suite for Story 6.6: Conflict Detection System
 * Tests the core conflict detection functionality
 */

const ConflictDetector = require('../proof-of-concept/conflict-detector');
const ThreeWayDiff = require('../proof-of-concept/three-way-diff');
const ConflictManager = require('../proof-of-concept/conflict-manager');
const { 
  LocalWinsStrategy, 
  RemoteWinsStrategy, 
  AutoMergeStrategy, 
  ManualMergeStrategy 
} = require('../proof-of-concept/resolution-strategies');

describe('Story 6.6 - Conflict Detection System QA Tests', () => {
  let conflictDetector;
  let threeWayDiff;
  let conflictManager;

  beforeEach(() => {
    // Mock dependencies
    const mockChangeDetector = {
      detectChanges: jest.fn().mockResolvedValue({
        added: [],
        updated: ['content-type-1'],
        deleted: []
      })
    };

    const mockVersionHistory = {
      getLatestVersion: jest.fn(),
      getVersionByHash: jest.fn(),
      getInitialVersion: jest.fn().mockResolvedValue({
        hash: 'initial',
        data: {},
        typeKey: 'content-type-1'
      })
    };

    conflictDetector = new ConflictDetector(mockChangeDetector, mockVersionHistory);
    conflictDetector.versionHistory = mockVersionHistory;
    threeWayDiff = new ThreeWayDiff();
    conflictManager = new ConflictManager();
  });

  describe('Conflict Detection (AC1)', () => {
    test('should detect when same type is modified in both systems', async () => {
      const localVersion = {
        hash: 'local123',
        typeKey: 'content-type-1',
        data: { title: 'Local Title', content: 'Local content' },
        parentHash: 'ancestor123'
      };

      const remoteVersion = {
        hash: 'remote456',
        typeKey: 'content-type-1',
        data: { title: 'Remote Title', content: 'Remote content' },
        parentHash: 'ancestor123'
      };

      const ancestorVersion = {
        hash: 'ancestor123',
        typeKey: 'content-type-1',
        data: { title: 'Original Title', content: 'Original content' },
        parentHash: null
      };

      conflictDetector.versionHistory.getLatestVersion
        .mockImplementation((typeKey, source) => {
          if (source === 'local') return Promise.resolve(localVersion);
          if (source === 'remote') return Promise.resolve(remoteVersion);
        });

      conflictDetector.versionHistory.getVersionByHash
        .mockResolvedValue(ancestorVersion);

      const result = await conflictDetector.detectConflicts('content-type-1');

      expect(result.hasConflict).toBe(true);
      expect(result.type).toBeDefined();
      expect(result.localVersion).toEqual(localVersion);
      expect(result.remoteVersion).toEqual(remoteVersion);
    });

    test('should not detect conflict when only one system modified', async () => {
      const localVersion = {
        hash: 'local123',
        typeKey: 'content-type-1',
        data: { title: 'Local Title' },
        parentHash: 'ancestor123'
      };

      const remoteVersion = {
        hash: 'ancestor123', // Same as ancestor - no change
        typeKey: 'content-type-1',
        data: { title: 'Original Title' },
        parentHash: null
      };

      conflictDetector.versionHistory.getLatestVersion
        .mockImplementation((typeKey, source) => {
          if (source === 'local') return Promise.resolve(localVersion);
          if (source === 'remote') return Promise.resolve(remoteVersion);
        });

      const result = await conflictDetector.detectConflicts('content-type-1');
      expect(result.hasConflict).toBe(false);
    });
  });

  describe('Three-Way Diff (AC2)', () => {
    test('should generate three-way diff showing local, remote, and ancestor', () => {
      const local = { title: 'Local', content: 'Local content', author: 'Alice' };
      const remote = { title: 'Remote', content: 'Remote content', tags: ['new'] };
      const ancestor = { title: 'Original', content: 'Original content' };

      const diff = threeWayDiff.compareVersions(local, remote, ancestor);

      expect(diff.local).toEqual(local);
      expect(diff.remote).toEqual(remote);
      expect(diff.ancestor).toEqual(ancestor);
      expect(diff.localChanges).toBeDefined();
      expect(diff.remoteChanges).toBeDefined();
      expect(diff.conflicts).toBeInstanceOf(Array);
    });

    test('should identify conflicting fields in three-way diff', () => {
      const local = { title: 'Local Title', shared: 'Local value' };
      const remote = { title: 'Remote Title', shared: 'Remote value' };
      const ancestor = { title: 'Original', shared: 'Original value' };

      const diff = threeWayDiff.compareVersions(local, remote, ancestor);
      
      const conflictingFields = diff.conflicts.map(c => c.field);
      expect(conflictingFields).toContain('title');
      expect(conflictingFields).toContain('shared');
    });

    test('should identify mergeable non-conflicting changes', () => {
      const local = { title: 'Local Title', localField: 'Local only' };
      const remote = { title: 'Original', remoteField: 'Remote only' };
      const ancestor = { title: 'Original' };

      const diff = threeWayDiff.compareVersions(local, remote, ancestor);
      
      expect(diff.mergeableChanges.length).toBeGreaterThan(0);
      const mergeableFields = diff.mergeableChanges.map(m => m.field);
      expect(mergeableFields).toContain('localField');
      expect(mergeableFields).toContain('remoteField');
    });
  });

  describe('Conflict Flagging (AC3)', () => {
    test('should flag conflicts for manual review', async () => {
      const conflict = {
        hasConflict: true,
        typeKey: 'content-type-1',
        type: 'field',
        details: {
          conflictingFields: [
            { field: 'title', localValue: 'Local', remoteValue: 'Remote' }
          ]
        }
      };

      await conflictManager.flagForReview('content-type-1', conflict);
      const queue = await conflictManager.getConflictQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].typeKey).toBe('content-type-1');
      expect(queue[0].status).toBe('pending');
      expect(queue[0].requiresManualReview).toBe(true);
    });

    test('should persist conflict metadata', async () => {
      const conflict = {
        hasConflict: true,
        typeKey: 'test-type',
        details: { test: 'data' }
      };

      await conflictManager.flagForReview('test-type', conflict);
      const persisted = await conflictManager.getConflict('test-type');

      expect(persisted).toBeDefined();
      expect(persisted.details).toEqual(conflict.details);
      expect(persisted.timestamp).toBeDefined();
    });
  });

  describe('Resolution Strategies (AC4)', () => {
    describe('LocalWins Strategy', () => {
      test('should prefer local changes', () => {
        const strategy = new LocalWinsStrategy();
        const conflict = {
          type: 'field',
          local: { title: 'Local Title' },
          remote: { title: 'Remote Title' },
          ancestor: { title: 'Original' }
        };

        const result = strategy.resolve(conflict);
        expect(result.success).toBe(true);
        expect(result.resolution.winner).toBe('local');
        expect(result.resolution.merged).toEqual({ title: 'Local Title' });
      });

      test('should not auto-resolve structural conflicts', () => {
        const strategy = new LocalWinsStrategy();
        const conflict = { type: 'structural' };

        expect(strategy.canAutoResolve(conflict)).toBe(false);
      });
    });

    describe('RemoteWins Strategy', () => {
      test('should prefer remote changes', () => {
        const strategy = new RemoteWinsStrategy();
        const conflict = {
          type: 'field',
          local: { title: 'Local Title' },
          remote: { title: 'Remote Title' },
          ancestor: { title: 'Original' }
        };

        const result = strategy.resolve(conflict);
        expect(result.success).toBe(true);
        expect(result.resolution.winner).toBe('remote');
        expect(result.resolution.merged).toEqual({ title: 'Remote Title' });
      });
    });

    describe('AutoMerge Strategy', () => {
      test('should merge non-conflicting field changes', () => {
        const strategy = new AutoMergeStrategy();
        const conflict = {
          type: 'field',
          local: { title: 'Local Title', localField: 'Local' },
          remote: { title: 'Original', remoteField: 'Remote' },
          ancestor: { title: 'Original' },
          details: {
            localChanges: {
              modified: ['title'],
              added: ['localField']
            },
            remoteChanges: {
              added: ['remoteField'],
              modified: []
            }
          }
        };

        const result = strategy.resolve(conflict);
        expect(result.success).toBe(true);
        expect(result.resolution.winner).toBe('merged');
        expect(result.resolution.merged).toEqual({
          title: 'Local Title',
          localField: 'Local',
          remoteField: 'Remote'
        });
      });

      test('should not auto-merge overlapping changes', () => {
        const strategy = new AutoMergeStrategy();
        const conflict = {
          details: {
            localChanges: { modified: ['title'] },
            remoteChanges: { modified: ['title'] }
          }
        };

        expect(strategy.canAutoResolve(conflict)).toBe(false);
      });
    });

    describe('ManualMerge Strategy', () => {
      test('should always require manual intervention', () => {
        const strategy = new ManualMergeStrategy();
        const conflict = { type: 'any' };

        expect(strategy.canAutoResolve(conflict)).toBe(false);
        
        const result = strategy.resolve(conflict);
        expect(result.success).toBe(false);
        expect(result.requiresManual).toBe(true);
        expect(result.manualResolutionData).toBeDefined();
      });
    });
  });

  describe('Integration Tests', () => {
    test('should detect and resolve conflicts end-to-end', async () => {
      // Setup conflicting versions
      const localVersion = {
        hash: 'local123',
        typeKey: 'content-type-1',
        data: { 
          title: 'Local Title',
          content: 'Modified locally',
          localOnly: 'Local field'
        },
        parentHash: 'ancestor123'
      };

      const remoteVersion = {
        hash: 'remote456',
        typeKey: 'content-type-1',
        data: { 
          title: 'Remote Title',
          content: 'Modified remotely',
          remoteOnly: 'Remote field'
        },
        parentHash: 'ancestor123'
      };

      const ancestorVersion = {
        hash: 'ancestor123',
        typeKey: 'content-type-1',
        data: { 
          title: 'Original Title',
          content: 'Original content'
        },
        parentHash: null
      };

      conflictDetector.versionHistory.getLatestVersion
        .mockImplementation((typeKey, source) => {
          if (source === 'local') return Promise.resolve(localVersion);
          if (source === 'remote') return Promise.resolve(remoteVersion);
        });

      conflictDetector.versionHistory.getVersionByHash
        .mockResolvedValue(ancestorVersion);

      // Detect conflict
      const conflict = await conflictDetector.detectConflicts('content-type-1');
      expect(conflict.hasConflict).toBe(true);

      // Generate three-way diff
      const diff = conflictDetector.generateThreeWayDiff(
        localVersion,
        remoteVersion,
        ancestorVersion
      );
      expect(diff).toBeDefined();
      expect(diff.conflicts.length).toBeGreaterThan(0);

      // Flag for review
      await conflictManager.flagForReview('content-type-1', conflict);
      const queue = await conflictManager.getConflictQueue();
      expect(queue).toHaveLength(1);

      // Attempt auto-merge for non-conflicting fields
      const autoMerge = new AutoMergeStrategy();
      const mergeableConflict = {
        ...conflict,
        local: localVersion.data,
        remote: remoteVersion.data,
        ancestor: ancestorVersion.data,
        details: {
          localChanges: {
            modified: ['title', 'content'],
            added: ['localOnly']
          },
          remoteChanges: {
            modified: ['title', 'content'],
            added: ['remoteOnly']
          }
        }
      };

      // Since title and content conflict, auto-merge should fail
      expect(autoMerge.canAutoResolve(mergeableConflict)).toBe(false);

      // Use LocalWins strategy instead
      const localWins = new LocalWinsStrategy();
      const resolution = localWins.resolve(mergeableConflict);
      expect(resolution.success).toBe(true);
      expect(resolution.resolution.winner).toBe('local');

      // Resolve the conflict
      await conflictManager.resolveConflict('content-type-1', resolution.resolution);
      const resolved = await conflictManager.getConflict('content-type-1');
      expect(resolved.status).toBe('resolved');
    });
  });
});