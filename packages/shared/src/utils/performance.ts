import { logger } from './logger.js';

export interface TimingMetric {
  operation: string;
  component: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  children?: TimingMetric[];
}

export interface PerformanceSummary {
  totalDuration: number;
  operations: Record<string, {
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  }>;
}

export class PerformanceTimer {
  private metrics: TimingMetric[] = [];
  private readonly activeMetrics = new Map<string, TimingMetric>();
  private metricStack: TimingMetric[] = [];

  start(operation: string, component: string, metadata?: Record<string, unknown>): void {
    const metric: TimingMetric = {
      operation,
      component,
      startTime: performance.now(),
      children: [],
      ...(metadata && { metadata }),
    };

    const metricId = `${component}:${operation}`;
    this.activeMetrics.set(metricId, metric);

    if (this.metricStack.length > 0) {
      const parent = this.metricStack.at(-1);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(metric);
      }
    } else {
      this.metrics.push(metric);
    }

    this.metricStack.push(metric);

    logger.debug(`⏱️  START [${component}] ${operation}`, {
      startTime: metric.startTime.toFixed(3),
      metadata,
    });
  }

  end(operation: string, component: string, metadata?: Record<string, unknown>): number | undefined {
    const metricId = `${component}:${operation}`;
    const metric = this.activeMetrics.get(metricId);

    if (!metric) {
      logger.warn(`⚠️  No active metric found for ${metricId}`);
      return undefined;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata };
    }

    this.activeMetrics.delete(metricId);

    const stackIndex = this.metricStack.indexOf(metric);
    if (stackIndex !== -1) {
      this.metricStack.splice(stackIndex, 1);
    }

    const durationMs = metric.duration;
    const durationSec = (durationMs / 1000).toFixed(3);

    logger.info(`⏱️  END [${component}] ${operation}`, {
      durationMs: durationMs.toFixed(3),
      durationSec,
      metadata: metric.metadata,
    });

    return durationMs;
  }

  measure<T>(
    operation: string,
    component: string,
    function_: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.start(operation, component, metadata);
    try {
      const result = function_();
      this.end(operation, component);
      return result;
    } catch (error) {
      this.end(operation, component, { error: String(error) });
      throw error;
    }
  }

  async measureAsync<T>(
    operation: string,
    component: string,
    function_: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(operation, component, metadata);
    try {
      const result = await function_();
      this.end(operation, component);
      return result;
    } catch (error) {
      this.end(operation, component, { error: String(error) });
      throw error;
    }
  }

  getMetrics(): TimingMetric[] {
    return this.metrics;
  }

  getSummary(): PerformanceSummary {
    const summary: PerformanceSummary = {
      totalDuration: 0,
      operations: {},
    };

    const processMetric = (metric: TimingMetric): void => {
        if (metric.duration !== undefined) {
        const key = `[${metric.component}] ${metric.operation}`;

        // eslint-disable-next-line security/detect-object-injection
        summary.operations[key] ??= {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
        };

        // eslint-disable-next-line security/detect-object-injection
        const op = summary.operations[key];
        op.count++;
        op.totalDuration += metric.duration;
        op.minDuration = Math.min(op.minDuration, metric.duration);
        op.maxDuration = Math.max(op.maxDuration, metric.duration);
        op.avgDuration = op.totalDuration / op.count;
      }

      if (metric.children) {
        for (const child of metric.children) {
          processMetric(child);
        }
      }
    };

    for (const metric of this.metrics) {
      if (metric.duration !== undefined) {
        summary.totalDuration += metric.duration;
      }
      processMetric(metric);
    }

    return summary;
  }

  logSummary(): void {
    const summary = this.getSummary();

    logger.info('📊 PERFORMANCE SUMMARY', {
      totalDurationMs: summary.totalDuration.toFixed(3),
      totalDurationSec: (summary.totalDuration / 1000).toFixed(3),
    });

    const sortedOps = Object.entries(summary.operations).sort(
      (a, b) => b[1].totalDuration - a[1].totalDuration
    );

    for (const [operation, stats] of sortedOps) {
      logger.info(`  ${operation}`, {
        count: stats.count,
        totalMs: stats.totalDuration.toFixed(3),
        avgMs: stats.avgDuration.toFixed(3),
        minMs: stats.minDuration.toFixed(3),
        maxMs: stats.maxDuration.toFixed(3),
      });
    }
  }

  reset(): void {
    this.metrics = [];
    this.activeMetrics.clear();
    this.metricStack = [];
  }
}

export function createPerformanceTimer(): PerformanceTimer {
  return new PerformanceTimer();
}
