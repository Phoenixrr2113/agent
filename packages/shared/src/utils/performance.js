import { logger } from './logger.js';
export class PerformanceTimer {
    metrics = [];
    activeMetrics = new Map();
    metricStack = [];
    start(operation, component, metadata) {
        const metric = {
            operation,
            component,
            startTime: performance.now(),
            metadata,
            children: [],
        };
        const metricId = `${component}:${operation}`;
        this.activeMetrics.set(metricId, metric);
        if (this.metricStack.length > 0) {
            const parent = this.metricStack[this.metricStack.length - 1];
            parent.children = parent.children || [];
            parent.children.push(metric);
        }
        else {
            this.metrics.push(metric);
        }
        this.metricStack.push(metric);
        logger.debug(`⏱️  START [${component}] ${operation}`, {
            startTime: metric.startTime.toFixed(3),
            metadata,
        });
    }
    end(operation, component, metadata) {
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
    measure(operation, component, fn, metadata) {
        this.start(operation, component, metadata);
        try {
            const result = fn();
            this.end(operation, component);
            return result;
        }
        catch (error) {
            this.end(operation, component, { error: String(error) });
            throw error;
        }
    }
    async measureAsync(operation, component, fn, metadata) {
        this.start(operation, component, metadata);
        try {
            const result = await fn();
            this.end(operation, component);
            return result;
        }
        catch (error) {
            this.end(operation, component, { error: String(error) });
            throw error;
        }
    }
    getMetrics() {
        return this.metrics;
    }
    getSummary() {
        const summary = {
            totalDuration: 0,
            operations: {},
        };
        const processMetric = (metric) => {
            if (metric.duration !== undefined) {
                const key = `[${metric.component}] ${metric.operation}`;
                if (!summary.operations[key]) {
                    summary.operations[key] = {
                        count: 0,
                        totalDuration: 0,
                        avgDuration: 0,
                        minDuration: Infinity,
                        maxDuration: 0,
                    };
                }
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
    logSummary() {
        const summary = this.getSummary();
        logger.info('📊 PERFORMANCE SUMMARY', {
            totalDurationMs: summary.totalDuration.toFixed(3),
            totalDurationSec: (summary.totalDuration / 1000).toFixed(3),
        });
        const sortedOps = Object.entries(summary.operations).sort((a, b) => b[1].totalDuration - a[1].totalDuration);
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
    reset() {
        this.metrics = [];
        this.activeMetrics.clear();
        this.metricStack = [];
    }
}
export function createPerformanceTimer() {
    return new PerformanceTimer();
}
