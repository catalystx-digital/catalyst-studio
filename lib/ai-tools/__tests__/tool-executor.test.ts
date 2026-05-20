/**
 * Tool Executor Unit Tests
 */

import { z } from 'zod';
import { 
  ToolExecutor, 
  ToolDefinition, 
  ToolValidationError, 
  ToolExecutionError 
} from '../executor/tool-executor';

// Mock Prisma client
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(() => Promise.resolve({
    $transaction: jest.fn((callback) => callback({
      // Mock transaction client
    }))
  }))
}));

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let mockTool: ToolDefinition;

  beforeEach(() => {
    executor = new ToolExecutor();
    
    // Create a mock tool
    mockTool = {
      name: 'testTool',
      description: 'A test tool',
      parameters: z.object({
        input: z.string(),
        count: z.number().optional()
      }),
      execute: jest.fn(async ({ input, count }) => ({
        success: true,
        data: { input, count: count || 1 }
      }))
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      executor.registerTool(mockTool);
      expect(executor.getTool('testTool')).toBe(mockTool);
    });

    it('should throw error when registering duplicate tool', () => {
      executor.registerTool(mockTool);
      expect(() => executor.registerTool(mockTool))
        .toThrow('Tool "testTool" is already registered');
    });

    it('should register multiple tools', () => {
      const tool2 = { ...mockTool, name: 'testTool2' };
      executor.registerTools([mockTool, tool2]);
      
      expect(executor.getTool('testTool')).toBe(mockTool);
      expect(executor.getTool('testTool2')).toBe(tool2);
    });
  });

  describe('executeTool', () => {
    beforeEach(() => {
      executor.registerTool(mockTool);
    });

    it('should execute tool with valid parameters', async () => {
      const result = await executor.executeTool('testTool', {
        input: 'test',
        count: 5
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ input: 'test', count: 5 });
      expect(mockTool.execute).toHaveBeenCalledWith(
        { input: 'test', count: 5 },
        undefined
      );
    });

    it('should execute tool with optional parameters', async () => {
      const result = await executor.executeTool('testTool', {
        input: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ input: 'test', count: 1 });
    });

    it('should return error for non-existent tool', async () => {
      const result = await executor.executeTool('nonExistent', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool "nonExistent" not found');
    });

    it('should throw validation error for invalid parameters', async () => {
      await expect(executor.executeTool('testTool', {
        input: 123, // Should be string
        count: 'five' // Should be number
      })).rejects.toThrow(ToolValidationError);
    });

    it('should validate only when validateOnly is true', async () => {
      const result = await executor.executeTool('testTool', {
        input: 'test'
      }, { validateOnly: true });

      expect(result.success).toBe(true);
      expect(result.metadata?.validated).toBe(true);
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should include execution metadata', async () => {
      const result = await executor.executeTool('testTool', {
        input: 'test'
      });

      expect(result.metadata).toHaveProperty('executionTime');
      expect(result.metadata?.toolName).toBe('testTool');
      expect(typeof result.metadata?.executionTime).toBe('number');
    });

    it('should handle tool execution errors', async () => {
      const errorTool: ToolDefinition = {
        name: 'errorTool',
        description: 'A tool that throws error',
        parameters: z.object({}),
        execute: jest.fn(async () => {
          throw new Error('Execution failed');
        })
      };

      executor.registerTool(errorTool);

      await expect(executor.executeTool('errorTool', {}))
        .rejects.toThrow(ToolExecutionError);
    });

    it('should respect timeout option', async () => {
      const slowTool: ToolDefinition = {
        name: 'slowTool',
        description: 'A slow tool',
        parameters: z.object({}),
        execute: jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { success: true };
        })
      };

      executor.registerTool(slowTool);

      await expect(executor.executeTool('slowTool', {}, { timeout: 100 }))
        .rejects.toThrow('Tool execution timeout');
    });
  });

  describe('executeMultipleTools', () => {
    let tool1: ToolDefinition;
    let tool2: ToolDefinition;

    beforeEach(() => {
      tool1 = {
        name: 'tool1',
        description: 'First tool',
        parameters: z.object({ value: z.number() }),
        execute: jest.fn(async ({ value }) => ({
          success: true,
          data: { result: value * 2 }
        }))
      };

      tool2 = {
        name: 'tool2',
        description: 'Second tool',
        parameters: z.object({ value: z.number() }),
        execute: jest.fn(async ({ value }) => ({
          success: true,
          data: { result: value + 10 }
        }))
      };

      executor.registerTools([tool1, tool2]);
    });

    it('should execute multiple tools in sequence', async () => {
      const results = await executor.executeMultipleTools([
        { name: 'tool1', params: { value: 5 } },
        { name: 'tool2', params: { value: 3 } }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].data).toEqual({ result: 10 });
      expect(results[1].success).toBe(true);
      expect(results[1].data).toEqual({ result: 13 });
    });

    it('should stop execution on first failure', async () => {
      const failingTool: ToolDefinition = {
        name: 'failingTool',
        description: 'A failing tool',
        parameters: z.object({}),
        execute: jest.fn(async () => ({
          success: false,
          error: 'Tool failed'
        }))
      };

      executor.registerTool(failingTool);

      const results = await executor.executeMultipleTools([
        { name: 'tool1', params: { value: 5 } },
        { name: 'failingTool', params: {} },
        { name: 'tool2', params: { value: 3 } }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(tool2.execute).not.toHaveBeenCalled();
    });

    it('should execute transactional tools in transaction', async () => {
      const transactionalTool: ToolDefinition = {
        name: 'transactionalTool',
        description: 'A transactional tool',
        parameters: z.object({}),
        execute: jest.fn(async (_, context) => ({
          success: true,
          data: { hasTransaction: !!context?.transaction }
        })),
        requiresTransaction: true
      };

      executor.registerTool(transactionalTool);

      const results = await executor.executeMultipleTools([
        { name: 'transactionalTool', params: {} }
      ]);

      expect(results[0].success).toBe(true);
      expect(results[0].data.hasTransaction).toBe(true);
    });
  });

  describe('getToolNames', () => {
    it('should return all registered tool names', () => {
      const tool1 = { ...mockTool, name: 'tool1' };
      const tool2 = { ...mockTool, name: 'tool2' };
      
      executor.registerTools([tool1, tool2]);
      
      const names = executor.getToolNames();
      expect(names).toEqual(['tool1', 'tool2']);
    });

    it('should return empty array when no tools registered', () => {
      expect(executor.getToolNames()).toEqual([]);
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tools', () => {
      const tool1 = { ...mockTool, name: 'tool1' };
      const tool2 = { ...mockTool, name: 'tool2' };
      
      executor.registerTools([tool1, tool2]);
      
      const tools = executor.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools).toContain(tool1);
      expect(tools).toContain(tool2);
    });
  });
});