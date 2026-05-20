/**
 * Tool Executor
 * 
 * Core execution engine for AI tools with Zod validation,
 * error handling, and transaction support.
 */

import { z } from 'zod';
import { getClient } from '@/lib/db/client';
import type { Prisma } from '@/lib/generated/prisma';

/**
 * Tool execution result
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  execute: (params: any, context?: ToolContext) => Promise<ToolResult>;
  requiresTransaction?: boolean;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  websiteId?: string;
  userId?: string;
  transaction?: Prisma.TransactionClient;
  metadata?: Record<string, any>;
}

/**
 * Tool execution options
 */
export interface ExecutionOptions {
  context?: ToolContext;
  validateOnly?: boolean;
  timeout?: number;
}

/**
 * Error types for tool execution
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class ToolValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: z.ZodError
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

/**
 * Tool executor class
 */
export class ToolExecutor {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool with the executor
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a single tool
   */
  async executeTool(
    name: string,
    params: any,
    options: ExecutionOptions = {}
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`
      };
    }

    try {
      // Validate parameters
      const validatedParams = await this.validateParams(tool, params);
      
      if (options.validateOnly) {
        return {
          success: true,
          data: validatedParams,
          metadata: { validated: true }
        };
      }

      // Execute with or without transaction based on tool requirements
      if (tool.requiresTransaction && !options.context?.transaction) {
        return await this.executeWithTransaction(tool, validatedParams, options);
      }

      // Execute tool
      const startTime = Date.now();
      const result = await this.executeWithTimeout(
        tool.execute(validatedParams, options.context),
        options.timeout || 30000
      );
      
      const executionTime = Date.now() - startTime;
      
      // Add execution metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          toolName: name
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ToolValidationError(
          `Validation failed for tool "${name}"`,
          error
        );
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      throw new ToolExecutionError(
        `Failed to execute tool "${name}"`,
        'EXECUTION_ERROR',
        error
      );
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeMultipleTools(
    tools: Array<{ name: string; params: any }>,
    options: ExecutionOptions = {}
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const requiresTransaction = tools.some(t => {
      const tool = this.tools.get(t.name);
      return tool?.requiresTransaction;
    });

    if (requiresTransaction && !options.context?.transaction) {
      // Execute all tools within a single transaction
      const prisma = await getClient();
      return await prisma.$transaction(async (tx) => {
        const contextWithTx = {
          ...options.context,
          transaction: tx as any
        };

        for (const { name, params } of tools) {
          const result = await this.executeTool(name, params, {
            ...options,
            context: contextWithTx
          });
          
          results.push(result);
          
          // Stop execution if a tool fails
          if (!result.success) {
            throw new ToolExecutionError(
              `Tool "${name}" failed: ${result.error}`,
              'CHAIN_EXECUTION_FAILED',
              { results }
            );
          }
        }
        
        return results;
      });
    }

    // Execute tools sequentially without transaction
    for (const { name, params } of tools) {
      const result = await this.executeTool(name, params, options);
      results.push(result);
      
      // Stop execution if a tool fails
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Validate tool parameters
   */
  private async validateParams(
    tool: ToolDefinition,
    params: any
  ): Promise<any> {
    try {
      return await tool.parameters.parseAsync(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error;
      }
      throw new ToolValidationError(
        'Parameter validation failed',
        error as z.ZodError
      );
    }
  }

  /**
   * Execute tool within a transaction
   */
  private async executeWithTransaction(
    tool: ToolDefinition,
    params: any,
    options: ExecutionOptions
  ): Promise<ToolResult> {
    const prisma = await getClient();
    
    return await prisma.$transaction(async (tx) => {
      const contextWithTx = {
        ...options.context,
        transaction: tx as any
      };
      
      const startTime = Date.now();
      const result = await this.executeWithTimeout(
        tool.execute(params, contextWithTx),
        options.timeout || 30000
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          toolName: tool.name,
          transactional: true
        }
      };
    });
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ToolExecutionError(
          'Tool execution timeout',
          'TIMEOUT',
          { timeout }
        ));
      }, timeout);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

// Create and export a default executor instance
export const toolExecutor = new ToolExecutor();