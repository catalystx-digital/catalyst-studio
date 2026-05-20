interface FourOhFourLog {
  timestamp: Date;
  path: string;
  type: 'hard' | 'soft';
  pageId?: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}

class FourOhFourLogger {
  private logs: FourOhFourLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  log(entry: Omit<FourOhFourLog, 'timestamp'>) {
    const logEntry: FourOhFourLog = {
      ...entry,
      timestamp: new Date()
    };

    this.logs.push(logEntry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console for monitoring
    console.log(`[404-Logger] ${logEntry.type.toUpperCase()} 404: ${logEntry.path}`, {
      pageId: logEntry.pageId,
      referrer: logEntry.referrer,
      timestamp: logEntry.timestamp.toISOString()
    });

    // In production, this would send to a logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (e.g., Sentry, LogRocket, DataDog)
      this.sendToLoggingService(logEntry);
    }
  }

  private sendToLoggingService(entry: FourOhFourLog) {
    // Placeholder for external logging service integration
    // This would typically send to services like:
    // - Sentry for error tracking
    // - Google Analytics for 404 tracking
    // - Custom analytics backend
  }

  getRecentLogs(limit: number = 100): FourOhFourLog[] {
    return this.logs.slice(-limit);
  }

  getStats() {
    const total = this.logs.length;
    const hard = this.logs.filter(l => l.type === 'hard').length;
    const soft = this.logs.filter(l => l.type === 'soft').length;

    const pathCounts = this.logs.reduce((acc, log) => {
      acc[log.path] = (acc[log.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topPaths = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    return {
      total,
      hard,
      soft,
      topPaths
    };
  }

  clear() {
    this.logs = [];
  }
}

export const fourOhFourLogger = new FourOhFourLogger();