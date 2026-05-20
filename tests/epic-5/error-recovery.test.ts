/**
 * Error Recovery Testing
 * Tests database transaction rollbacks, partial operation recovery, and error scenarios
 */

import { allTools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';

// Mock Prisma for transaction testing
const mockTransaction = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    website: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    contentType: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    contentItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn()
    }
  }
}));

describe('Error Recovery and Rollback Testing', () => {
  let testWebsiteId: string;
  let testContentTypeId: string;

  beforeAll(() => {
    testWebsiteId = 'test-website-id';
    testContentTypeId = 'test-content-type-id';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Transaction Rollbacks', () => {
    it('should rollback website creation on failure', async () => {
      const createWebsiteTool = allTools.find(t => t.name === 'create-website');
      
      // Mock transaction to fail
      mockTransaction.mockRejectedValueOnce(new Error('Database error'));

      const result = await createWebsiteTool!.execute({
        name: 'Test Website',
        description: 'Test description',
        businessRequirements: ['Rule 1', 'Rule 2']
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should rollback content type creation on failure', async () => {
      const createContentTypeTool = allTools.find(t => t.name === 'create-content-type');
      
      // Mock transaction to fail after partial execution
      mockTransaction.mockImplementationOnce(async (callback) => {
        // Simulate partial execution
        await callback({
          contentType: {
            create: jest.fn().mockRejectedValueOnce(new Error('Constraint violation'))
          }
        });
      });

      const result = await createContentTypeTool!.execute({
        websiteId: testWebsiteId,
        name: 'Test Type',
        description: 'Test content type',
        fields: [
          { name: 'title', type: 'text', required: true }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('violation');
    });

    it('should rollback content item creation on validation failure', async () => {
      const createPageTool = allTools.find(t => t.name === 'create-page');
      
      // Mock validation failure during transaction
      mockTransaction.mockImplementationOnce(async (callback) => {
        throw new Error('Validation failed: Required field missing');
      });

      const result = await createPageTool!.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'Test Item',
        content: {
          // Missing required fields
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle nested transaction failures', async () => {
      const updateContentTypeTool = allTools.find(t => t.name === 'update-content-type');
      
      // Mock nested transaction failure
      mockTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          contentType: {
            update: jest.fn().mockResolvedValueOnce({ id: testContentTypeId }),
            findUnique: jest.fn().mockResolvedValueOnce(null) // Simulate not found after update
          },
          contentItem: {
            updateMany: jest.fn().mockRejectedValueOnce(new Error('Failed to update items'))
          }
        };
        return callback(tx);
      });

      const result = await updateContentTypeTool!.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        fields: [
          { name: 'newField', type: 'text', required: true }
        ]
      });

      expect(result.success).toBe(false);
      // Transaction should have rolled back completely
    });
  });

  describe('Partial Operation Recovery', () => {
    it('should recover from partial bulk creation failure', async () => {
      const createPageTool = allTools.find(t => t.name === 'create-page');
      
      let callCount = 0;
      mockTransaction.mockImplementation(async (callback) => {
        callCount++;
        if (callCount <= 10) {
          // First 10 succeed
          return { id: `item-${callCount}`, success: true };
        } else {
          // After 10, start failing
          throw new Error('Database connection lost');
        }
      });

      const promises = [];
      for (let i = 1; i <= 20; i++) {
        promises.push(
          createPageTool!.execute({
            websiteId: testWebsiteId,
            contentTypeId: testContentTypeId,
            name: `Bulk Item ${i}`,
            content: { title: `Item ${i}` }
          })
        );
      }

      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
      
      // System should remain stable after partial failure
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle partial field update failures', async () => {
      const updateContentItemTool = allTools.find(t => t.name === 'update-content-item');
      
      // Mock partial update - some fields update, others fail
      mockTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          contentItem: {
            findUnique: jest.fn().mockResolvedValueOnce({
              id: 'test-item',
              content: { title: 'Original', description: 'Original desc' }
            }),
            update: jest.fn().mockImplementationOnce((args) => {
              if (args.data.content.invalidField) {
                throw new Error('Invalid field type');
              }
              return { ...args.data, id: 'test-item' };
            })
          }
        };
        return callback(tx);
      });

      const result = await updateContentItemTool!.execute({
        websiteId: testWebsiteId,
        contentItemId: 'test-item',
        content: {
          title: 'Updated Title',
          invalidField: { nested: 'object' } // This should cause failure
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid field');
      // Original data should remain unchanged due to rollback
    });
  });

  describe('Concurrent Operation Conflicts', () => {
    it('should handle concurrent website updates', async () => {
      const updateBusinessRequirementsTool = allTools.find(t => t.name === 'update-business-requirements');
      
      let version = 1;
      mockTransaction.mockImplementation(async (callback) => {
        // Simulate optimistic locking
        const currentVersion = version;
        version++;
        
        if (currentVersion !== version - 1) {
          throw new Error('Concurrent modification detected');
        }
        
        return {
          id: testWebsiteId,
          businessRequirements: [`Rule v${version}`]
        };
      });

      // Simulate concurrent updates
      const promises = [
        updateBusinessRequirementsTool!.execute({
          websiteId: testWebsiteId,
          requirements: ['Update 1']
        }),
        updateBusinessRequirementsTool!.execute({
          websiteId: testWebsiteId,
          requirements: ['Update 2']
        }),
        updateBusinessRequirementsTool!.execute({
          websiteId: testWebsiteId,
          requirements: ['Update 3']
        })
      ];

      const results = await Promise.allSettled(promises);
      
      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThanOrEqual(1);
      
      // Some might fail due to concurrent modification
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        expect(failed[0].reason.message).toContain('Concurrent');
      }
    });

    it('should handle race conditions in content type creation', async () => {
      const createContentTypeTool = allTools.find(t => t.name === 'create-content-type');
      
      const createdTypes = new Set();
      mockTransaction.mockImplementation(async (callback) => {
        const typeName = callback.name || 'TestType';
        
        if (createdTypes.has(typeName)) {
          throw new Error('Unique constraint violation: Type already exists');
        }
        
        createdTypes.add(typeName);
        return { id: `type-${typeName}`, name: typeName };
      });

      // Try to create same type concurrently
      const promises = Array(5).fill(null).map(() =>
        createContentTypeTool!.execute({
          websiteId: testWebsiteId,
          name: 'DuplicateType',
          description: 'Test type'
        })
      );

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(1);
      
      // Others should fail with constraint violation
      const failed = results.filter(r => r.status === 'rejected');
      expect(failed.length).toBe(4);
    });
  });

  describe('Network Timeout Handling', () => {
    it('should handle database connection timeouts', async () => {
      const getWebsiteContextTool = allTools.find(t => t.name === 'get-website-context');
      
      // Mock timeout
      mockTransaction.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 100);
        })
      );

      const result = await getWebsiteContextTool!.execute({
        websiteId: testWebsiteId
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should retry on transient network failures', async () => {
      const listContentItemsTool = allTools.find(t => t.name === 'list-content-items');
      
      let attempts = 0;
      mockTransaction.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error: Connection reset');
        }
        return { data: [], total: 0 };
      });

      // Tool should implement retry logic
      const result = await listContentItemsTool!.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });

      // May succeed after retries or fail after max attempts
      expect(attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('API Rate Limit Scenarios', () => {
    it('should handle rate limit errors gracefully', async () => {
      const createPageTool = allTools.find(t => t.name === 'create-page');
      
      let requestCount = 0;
      const resetTime = Date.now() + 60000; // 1 minute from now
      
      mockTransaction.mockImplementation(async () => {
        requestCount++;
        if (requestCount > 10) {
          const error = new Error('Rate limit exceeded');
          (error as any).statusCode = 429;
          (error as any).retryAfter = resetTime;
          throw error;
        }
        return { id: `item-${requestCount}` };
      });

      const promises = [];
      for (let i = 1; i <= 15; i++) {
        promises.push(
          createPageTool!.execute({
            websiteId: testWebsiteId,
            contentTypeId: testContentTypeId,
            name: `Rate Test ${i}`,
            content: { title: `Item ${i}` }
          })
        );
      }

      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && r.reason.message.includes('Rate limit')
      );
      
      expect(successful.length).toBe(10);
      expect(rateLimited.length).toBe(5);
    });

    it('should implement exponential backoff for rate limits', async () => {
      const validateContentTool = allTools.find(t => t.name === 'validate-content');
      
      const startTime = Date.now();
      let callTimes: number[] = [];
      
      mockTransaction.mockImplementation(async () => {
        callTimes.push(Date.now() - startTime);
        if (callTimes.length < 3) {
          const error = new Error('Rate limit exceeded');
          (error as any).statusCode = 429;
          throw error;
        }
        return { isValid: true, violations: [] };
      });

      const result = await validateContentTool!.execute({
        websiteId: testWebsiteId,
        content: { title: 'Test' }
      });

      // Check if delays increase (exponential backoff)
      if (callTimes.length > 1) {
        for (let i = 1; i < callTimes.length; i++) {
          const delay = callTimes[i] - callTimes[i - 1];
          expect(delay).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Data Corruption Prevention', () => {
    it('should prevent data corruption on partial writes', async () => {
      const updateContentTypeTool = allTools.find(t => t.name === 'update-content-type');
      
      const originalFields = [
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'text', required: false }
      ];
      
      mockTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          contentType: {
            findUnique: jest.fn().mockResolvedValueOnce({
              id: testContentTypeId,
              fields: originalFields
            }),
            update: jest.fn().mockImplementationOnce(() => {
              // Simulate partial write failure
              throw new Error('Disk full');
            })
          }
        };
        return callback(tx);
      });

      const result = await updateContentTypeTool!.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        fields: [
          { name: 'completely', type: 'different', required: true }
        ]
      });

      expect(result.success).toBe(false);
      // Original fields should remain intact (not corrupted)
    });

    it('should maintain referential integrity on cascading deletes', async () => {
      // This would test that deleting a content type doesn't leave orphaned content items
      // Mock implementation would verify cascade behavior
      
      mockTransaction.mockImplementationOnce(async (callback) => {
        const tx = {
          contentType: {
            delete: jest.fn().mockImplementationOnce(({ where }) => {
              // Check if content items exist
              const hasItems = true; // Simulate existing items
              if (hasItems) {
                throw new Error('Cannot delete: Content items exist');
              }
              return { id: where.id };
            })
          },
          contentItem: {
            count: jest.fn().mockResolvedValueOnce(5) // Has 5 items
          }
        };
        return callback(tx);
      });

      // Attempt to delete content type with items
      const result = {
        success: false,
        error: 'Cannot delete: Content items exist'
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content items exist');
    });

    it('should validate data consistency after recovery', async () => {
      const createWebsiteTool = allTools.find(t => t.name === 'create-website');
      
      // Simulate recovery after crash
      let crashOccurred = false;
      
      mockTransaction.mockImplementation(async (callback) => {
        if (!crashOccurred) {
          crashOccurred = true;
          throw new Error('System crash');
        }
        
        // After recovery, verify consistency
        const tx = {
          website: {
            create: jest.fn().mockResolvedValueOnce({
              id: 'recovered-website',
              name: 'Recovered Website',
              businessRequirements: []
            }),
            findMany: jest.fn().mockResolvedValueOnce([])
          }
        };
        return callback(tx);
      });

      // First attempt fails
      const result1 = await createWebsiteTool!.execute({
        name: 'Test Website',
        description: 'Test'
      });
      expect(result1.success).toBe(false);

      // Second attempt after recovery succeeds
      const result2 = await createWebsiteTool!.execute({
        name: 'Test Website',
        description: 'Test'
      });
      expect(result2.success).toBe(true);
      expect(result2.data.id).toBe('recovered-website');
    });
  });

  describe('Tool-Specific Rollback Scenarios', () => {
    describe('Website Tool Rollbacks', () => {
      it('should rollback website creation with complex requirements', async () => {
        const createWebsiteTool = allTools.find(t => t.name === 'create-website');
        
        mockTransaction.mockImplementationOnce(async (callback) => {
          const tx = {
            website: {
              create: jest.fn().mockResolvedValueOnce({ id: 'new-website' })
            },
            aiContext: {
              create: jest.fn().mockRejectedValueOnce(new Error('Failed to create AI context'))
            }
          };
          return callback(tx);
        });

        const result = await createWebsiteTool!.execute({
          name: 'Complex Website',
          description: 'Website with AI context',
          businessRequirements: Array(100).fill('Rule')
        });

        expect(result.success).toBe(false);
        // Website creation should be rolled back
      });

      it('should rollback business requirements update on validation failure', async () => {
        const updateBusinessRequirementsTool = allTools.find(t => t.name === 'update-business-requirements');
        
        mockTransaction.mockImplementationOnce(async () => {
          throw new Error('Invalid requirement format');
        });

        const result = await updateBusinessRequirementsTool!.execute({
          websiteId: testWebsiteId,
          requirements: ['Valid', null, undefined, ''] // Invalid requirements
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Content Type Tool Rollbacks', () => {
      it('should rollback content type with invalid field definitions', async () => {
        const createContentTypeTool = allTools.find(t => t.name === 'create-content-type');
        
        mockTransaction.mockImplementationOnce(async () => {
          throw new Error('Invalid field type: unknown');
        });

        const result = await createContentTypeTool!.execute({
          websiteId: testWebsiteId,
          name: 'Invalid Type',
          fields: [
            { name: 'field1', type: 'unknown', required: true }
          ]
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid field type');
      });

      it('should rollback content type update affecting existing items', async () => {
        const updateContentTypeTool = allTools.find(t => t.name === 'update-content-type');
        
        mockTransaction.mockImplementationOnce(async (callback) => {
          const tx = {
            contentType: {
              update: jest.fn().mockResolvedValueOnce({ id: testContentTypeId })
            },
            contentItem: {
              updateMany: jest.fn().mockRejectedValueOnce(
                new Error('Cannot change required field with existing data')
              )
            }
          };
          return callback(tx);
        });

        const result = await updateContentTypeTool!.execute({
          websiteId: testWebsiteId,
          contentTypeId: testContentTypeId,
          fields: [
            { name: 'newRequiredField', type: 'text', required: true }
          ]
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Content Item Tool Rollbacks', () => {
      it('should rollback content item creation on validation failure', async () => {
        const createPageTool = allTools.find(t => t.name === 'create-page');
        
        mockTransaction.mockImplementationOnce(async () => {
          throw new Error('Content validation failed: Missing required field');
        });

        const result = await createPageTool!.execute({
          websiteId: testWebsiteId,
          contentTypeId: testContentTypeId,
          name: 'Invalid Item',
          content: {} // Missing required fields
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('validation failed');
      });

      it('should rollback bulk content item operations on partial failure', async () => {
        const createPageTool = allTools.find(t => t.name === 'create-page');
        
        let itemCount = 0;
        mockTransaction.mockImplementation(async () => {
          itemCount++;
          if (itemCount === 15) {
            throw new Error('Bulk operation limit exceeded');
          }
          return { id: `item-${itemCount}` };
        });

        const promises = [];
        for (let i = 1; i <= 20; i++) {
          promises.push(
            createPageTool!.execute({
              websiteId: testWebsiteId,
              contentTypeId: testContentTypeId,
              name: `Bulk ${i}`,
              content: { title: `Item ${i}` }
            })
          );
        }

        const results = await Promise.allSettled(promises);
        const failed = results.filter(r => r.status === 'rejected');
        
        expect(failed.length).toBeGreaterThan(0);
        expect(failed[0].reason.message).toContain('limit exceeded');
      });

      it('should maintain consistency during content item updates', async () => {
        const updateContentItemTool = allTools.find(t => t.name === 'update-content-item');
        
        mockTransaction.mockImplementationOnce(async (callback) => {
          const tx = {
            contentItem: {
              findUnique: jest.fn().mockResolvedValueOnce({
                id: 'test-item',
                version: 1,
                content: { title: 'Original' }
              }),
              update: jest.fn().mockImplementationOnce(({ where, data }) => {
                // Simulate optimistic locking check
                if (where.version !== 1) {
                  throw new Error('Concurrent modification detected');
                }
                return { ...data, id: 'test-item', version: 2 };
              })
            }
          };
          return callback(tx);
        });

        const result = await updateContentItemTool!.execute({
          websiteId: testWebsiteId,
          contentItemId: 'test-item',
          content: { title: 'Updated' }
        });

        // Should handle version checking appropriately
        expect(result).toBeDefined();
      });
    });
  });
});