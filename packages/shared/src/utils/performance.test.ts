import { describe, it, expect, beforeEach } from 'vitest';

import { type PerformanceTimer, createPerformanceTimer } from './performance.js';

describe('PerformanceTimer', () => {
  let timer: PerformanceTimer;

  beforeEach(() => {
    timer = createPerformanceTimer();
  });

  it('should create a performance timer', () => {
    expect(timer).toBeDefined();
    expect(typeof timer.start).toBe('function');
    expect(typeof timer.end).toBe('function');
  });

  it('should measure operation duration', () => {
    timer.start('test-operation', 'test-component');
    const duration = timer.end('test-operation', 'test-component');

    expect(duration).toBeDefined();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should track nested operations', () => {
    timer.start('parent', 'component');
    timer.start('child1', 'component');
    timer.end('child1', 'component');
    timer.start('child2', 'component');
    timer.end('child2', 'component');
    timer.end('parent', 'component');

    const metrics = timer.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0]?.operation).toBe('parent');
    expect(metrics[0]?.children).toBeDefined();
    expect(metrics[0]?.children?.length).toBe(2);
  });

  it('should generate summary statistics', () => {
    timer.start('op1', 'comp1');
    timer.end('op1', 'comp1');
    timer.start('op1', 'comp1');
    timer.end('op1', 'comp1');
    timer.start('op2', 'comp2');
    timer.end('op2', 'comp2');

    const summary = timer.getSummary();
    const op1 = summary.operations['[comp1] op1'];
    const op2 = summary.operations['[comp2] op2'];

    expect(op1).toBeDefined();
    expect(op1?.count).toBe(2);
    expect(op2).toBeDefined();
    expect(op2?.count).toBe(1);
  });

  it('should measure sync function execution', () => {
    const result = timer.measure(
      'sync-op',
      'component',
      () => 42
    );

    expect(result).toBe(42);
    const metrics = timer.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0]?.operation).toBe('sync-op');
    expect(metrics[0]?.duration).toBeDefined();
  });

  it('should measure async function execution', async () => {
    const result = await timer.measureAsync(
      'async-op',
      'component',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      }
    );

    expect(result).toBe('done');
    const metrics = timer.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0]?.operation).toBe('async-op');
    expect(metrics[0]?.duration).toBeGreaterThanOrEqual(10);
  });

  it('should handle errors in measured functions', async () => {
    await expect(async () => {
      await timer.measureAsync(
        'error-op',
        'component',
        async () => {
          await Promise.resolve();
          throw new Error('test error');
        }
      );
    }).rejects.toThrow('test error');

    const metrics = timer.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0]?.metadata?.['error']).toBeDefined();
  });

  it('should reset metrics', () => {
    timer.start('op1', 'comp1');
    timer.end('op1', 'comp1');
    expect(timer.getMetrics().length).toBe(1);

    timer.reset();
    expect(timer.getMetrics().length).toBe(0);
  });

  it('should calculate correct summary statistics', () => {
    for (let i = 0; i < 5; i++) {
      timer.start('test', 'comp');
      timer.end('test', 'comp');
    }

    const summary = timer.getSummary();
    const op = summary.operations['[comp] test'];

    expect(op).toBeDefined();
    expect(op?.count).toBe(5);
    expect(op?.avgDuration).toBeDefined();
    expect(op?.minDuration).toBeDefined();
    expect(op?.maxDuration).toBeDefined();
    if (op) {
      expect(op.minDuration).toBeLessThanOrEqual(op.avgDuration);
      expect(op.avgDuration).toBeLessThanOrEqual(op.maxDuration);
    }
  });
});
