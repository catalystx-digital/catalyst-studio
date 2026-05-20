/**
 * Audit Logger for AI Tool Operations
 * Captures comprehensive logging for all AI operations
 */

import { prisma } from '@/lib/prisma';

export interface ToolExecutionLog {
  toolName: string;
  parameters: Record<string, any>;
  result: Record<string, any>;
  timestamp: Date;
  status: 'success' | 'failure' | 'rollback';
  executionTime: number; // milliseconds
  userId?: string; // For future auth
  sessionId: string;
  websiteId?: string;
  errorDetails?: string;
  rollbackReason?: string;
}

export interface ToolExecutionMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  rollbackCount: number;
  averageExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
}

class AuditLogger {
  private logs: ToolExecutionLog[] = [];
  private sessionId: string;
  private maxLogsInMemory = 1000;
  private rotationStrategy: 'size' | 'time' = 'size';
  private rotationThreshold = 500; // Rotate after 500 logs

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Log tool execution start
   */
  async logExecutionStart(
    toolName: string,
    parameters: Record<string, any>,
    websiteId?: string
  ): Promise<{ startTime: number; logId: string }> {
    const logId = `${this.sessionId}_${toolName}_${Date.now()}`;
    const startTime = Date.now();

    // Store initial log entry
    const logEntry: Partial<ToolExecutionLog> = {
      toolName,
      parameters: this.sanitizeParameters(parameters),
      timestamp: new Date(),
      sessionId: this.sessionId,
      websiteId,
      status: 'success' // Will be updated on completion
    };

    // Store in memory for quick access
    this.logs.push(logEntry as ToolExecutionLog);

    return { startTime, logId };
  }

  /**
   * Log tool execution end
   */
  async logExecutionEnd(
    logId: string,
    startTime: number,
    result: any,
    status: 'success' | 'failure' | 'rollback',
    errorDetails?: string,
    rollbackReason?: string
  ): Promise<ToolExecutionLog> {
    const executionTime = Date.now() - startTime;
    
    // Find and update the log entry
    const logEntry = this.logs.find(log => 
      log.sessionId === this.sessionId && 
      log.timestamp.getTime() >= startTime - 1000
    );

    if (logEntry) {
      logEntry.result = this.sanitizeResult(result);
      logEntry.status = status;
      logEntry.executionTime = executionTime;
      logEntry.errorDetails = errorDetails;
      logEntry.rollbackReason = rollbackReason;
    }

    // Persist to database if we have a website context
    if (logEntry?.websiteId) {
      await this.persistToDatabase(logEntry);
    }

    // Check if rotation is needed
    await this.checkRotation();

    return logEntry as ToolExecutionLog;
  }

  /**
   * Sanitize parameters to remove sensitive data
   */
  private sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
    const sanitized = { ...parameters };
    
    // Remove potential sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Truncate very large fields
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '... [TRUNCATED]';
      } else if (Array.isArray(value) && value.length > 100) {
        sanitized[key] = [...value.slice(0, 100), '... [TRUNCATED]'];
      }
    }

    return sanitized;
  }

  /**
   * Sanitize result data
   */
  private sanitizeResult(result: any): Record<string, any> {
    if (!result) return {};
    
    if (typeof result === 'object') {
      return this.sanitizeParameters(result);
    }
    
    return { value: result };
  }

  /**
   * Persist log to database
   */
  private async persistToDatabase(log: ToolExecutionLog): Promise<void> {
    try {
      // Store in AIContext metadata
      const aiContext = await prisma.aIContext.findFirst({
        where: { websiteId: log.websiteId },
        orderBy: { createdAt: 'desc' }
      });

      if (aiContext) {
        const metadata = (aiContext.metadata as any) || {};
        const auditLogs = metadata.auditLogs || [];
        
        // Add new log
        auditLogs.push({
          ...log,
          timestamp: log.timestamp.toISOString()
        });

        // Keep only last 100 logs per context
        const trimmedLogs = auditLogs.slice(-100);

        await prisma.aIContext.update({
          where: { id: aiContext.id },
          data: {
            metadata: {
              ...metadata,
              auditLogs: trimmedLogs,
              lastUpdated: new Date().toISOString()
            }
          }
        });
      } else {
        // Create new AI context with audit log
        await prisma.aIContext.create({
          data: {
            websiteId: log.websiteId!,
            context: {},
            metadata: {
              auditLogs: [{
                ...log,
                timestamp: log.timestamp.toISOString()
              }],
              createdAt: new Date().toISOString()
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to persist audit log:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Check if log rotation is needed
   */
  private async checkRotation(): Promise<void> {
    if (this.rotationStrategy === 'size' && this.logs.length > this.rotationThreshold) {
      await this.rotateLogs();
    }
  }

  /**
   * Rotate logs to prevent memory overflow
   */
  private async rotateLogs(): Promise<void> {
    // Keep most recent logs
    const logsToKeep = Math.floor(this.rotationThreshold / 2);
    const archivedLogs = this.logs.slice(0, -logsToKeep);
    
    // Archive old logs (could write to file or database)
    if (archivedLogs.length > 0) {
      console.log(`Archiving ${archivedLogs.length} audit logs`);
      // In production, would persist these to long-term storage
    }

    // Keep only recent logs in memory
    this.logs = this.logs.slice(-logsToKeep);
  }

  /**
   * Get logs for a specific session
   */
  getSessionLogs(sessionId?: string): ToolExecutionLog[] {
    const targetSession = sessionId || this.sessionId;
    return this.logs.filter(log => log.sessionId === targetSession);
  }

  /**
   * Get logs for a specific website
   */
  async getWebsiteLogs(websiteId: string, limit = 100): Promise<ToolExecutionLog[]> {
    try {
      const aiContext = await prisma.aIContext.findFirst({
        where: { websiteId },
        orderBy: { createdAt: 'desc' }
      });

      if (aiContext && aiContext.metadata) {
        const metadata = aiContext.metadata as any;
        const logs = metadata.auditLogs || [];
        return logs.slice(-limit).map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to retrieve website logs:', error);
    }

    return [];
  }

  /**
   * Get execution metrics
   */
  getMetrics(toolName?: string): ToolExecutionMetrics {
    const relevantLogs = toolName
      ? this.logs.filter(log => log.toolName === toolName)
      : this.logs;

    if (relevantLogs.length === 0) {
      return {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        rollbackCount: 0,
        averageExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0
      };
    }

    const successLogs = relevantLogs.filter(log => log.status === 'success');
    const failureLogs = relevantLogs.filter(log => log.status === 'failure');
    const rollbackLogs = relevantLogs.filter(log => log.status === 'rollback');

    const executionTimes = relevantLogs
      .filter(log => log.executionTime !== undefined)
      .map(log => log.executionTime)
      .sort((a, b) => a - b);

    const averageTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;

    const p95Index = Math.floor(executionTimes.length * 0.95);
    const p99Index = Math.floor(executionTimes.length * 0.99);

    return {
      totalExecutions: relevantLogs.length,
      successCount: successLogs.length,
      failureCount: failureLogs.length,
      rollbackCount: rollbackLogs.length,
      averageExecutionTime: Math.round(averageTime),
      p95ExecutionTime: executionTimes[p95Index] || 0,
      p99ExecutionTime: executionTimes[p99Index] || 0
    };
  }

  /**
   * Get detailed metrics for all tools
   */
  getAllToolMetrics(): Map<string, ToolExecutionMetrics> {
    const toolNames = new Set(this.logs.map(log => log.toolName));
    const metrics = new Map<string, ToolExecutionMetrics>();

    for (const toolName of toolNames) {
      metrics.set(toolName, this.getMetrics(toolName));
    }

    return metrics;
  }

  /**
   * Clear old logs
   */
  async clearOldLogs(daysToKeep = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldLogs = this.logs.filter(log => log.timestamp < cutoffDate);
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);

    // Also clear from database
    try {
      const aiContexts = await prisma.aIContext.findMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      for (const context of aiContexts) {
        const metadata = (context.metadata as any) || {};
        const auditLogs = metadata.auditLogs || [];
        
        const filteredLogs = auditLogs.filter((log: any) => {
          const logDate = new Date(log.timestamp);
          return logDate >= cutoffDate;
        });

        if (filteredLogs.length !== auditLogs.length) {
          await prisma.aIContext.update({
            where: { id: context.id },
            data: {
              metadata: {
                ...metadata,
                auditLogs: filteredLogs
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to clear old logs from database:', error);
    }

    return oldLogs.length;
  }

  /**
   * Export logs for analysis
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = [
      'Timestamp',
      'Session ID',
      'Tool Name',
      'Status',
      'Execution Time (ms)',
      'Website ID',
      'Parameters',
      'Result',
      'Error Details'
    ];

    const rows = this.logs.map(log => [
      log.timestamp.toISOString(),
      log.sessionId,
      log.toolName,
      log.status,
      log.executionTime?.toString() || '',
      log.websiteId || '',
      JSON.stringify(log.parameters),
      JSON.stringify(log.result),
      log.errorDetails || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10): ToolExecutionLog[] {
    return this.logs
      .filter(log => log.status === 'failure' || log.status === 'rollback')
      .slice(-limit);
  }

  /**
   * Get slow operations
   */
  getSlowOperations(thresholdMs = 2000, limit = 10): ToolExecutionLog[] {
    return this.logs
      .filter(log => log.executionTime && log.executionTime > thresholdMs)
      .sort((a, b) => (b.executionTime || 0) - (a.executionTime || 0))
      .slice(0, limit);
  }

  /**
   * Reset session
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.logs = [];
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export utility functions
export async function withAuditLogging<T>(
  toolName: string,
  parameters: Record<string, any>,
  websiteId: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  const { startTime, logId } = await auditLogger.logExecutionStart(
    toolName,
    parameters,
    websiteId
  );

  try {
    const result = await operation();
    
    await auditLogger.logExecutionEnd(
      logId,
      startTime,
      result,
      'success'
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await auditLogger.logExecutionEnd(
      logId,
      startTime,
      { error: errorMessage },
      'failure',
      errorMessage
    );

    throw error;
  }
}

// Export metrics retrieval utilities
export function getToolMetrics(toolName?: string): ToolExecutionMetrics {
  return auditLogger.getMetrics(toolName);
}

export function getAllMetrics(): Map<string, ToolExecutionMetrics> {
  return auditLogger.getAllToolMetrics();
}

export function getRecentErrors(limit = 10): ToolExecutionLog[] {
  return auditLogger.getRecentErrors(limit);
}

export function getSlowOperations(thresholdMs = 2000, limit = 10): ToolExecutionLog[] {
  return auditLogger.getSlowOperations(thresholdMs, limit);
}