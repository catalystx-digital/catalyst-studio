interface MetricSnapshot {
  totalRequests: number;
  errorCount: number;
  timeoutCount: number;
  durationsMs: number[];
}

export interface GraphqlRequestMetric {
  keyId: string;
  accountId: string;
  websiteId: string | null;
  operationName?: string | null;
  complexity: number;
  durationMs: number;
  result: 'ok' | 'error' | 'timeout';
}

class GraphqlMetricsCollector {
  private totalRequests = 0;
  private errorCount = 0;
  private timeoutCount = 0;
  private durations: number[] = [];

  record(metric: GraphqlRequestMetric): void {
    this.totalRequests += 1;
    if (metric.result === 'error') {
      this.errorCount += 1;
    }
    if (metric.result === 'timeout') {
      this.timeoutCount += 1;
    }
    this.durations.push(metric.durationMs);
    if (this.durations.length > 500) {
      this.durations.shift();
    }
  }

  snapshot(): MetricSnapshot {
    return {
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      timeoutCount: this.timeoutCount,
      durationsMs: [...this.durations],
    };
  }
}

export const graphqlMetrics = new GraphqlMetricsCollector();

export function recordGraphqlMetric(metric: GraphqlRequestMetric): void {
  graphqlMetrics.record(metric);
}
