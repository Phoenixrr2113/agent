import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StepResult } from 'ai';

describe('dynamicStopWhen', () => {
  function createDynamicStopWhen(maxSteps: number = 50) {
    return function ({ steps }: { steps: StepResult<any>[] }): boolean {
      const hasTaskComplete = steps.some(step =>
        step.toolCalls?.some(call => call.toolName === 'task_complete')
      );

      const maxStepsReached = steps.length >= maxSteps;

      return hasTaskComplete || maxStepsReached;
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('task completion detection', () => {
    it('should stop when task_complete tool is called', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        {
          toolCalls: [{ toolName: 'search_codebase', args: {} }],
        } as any,
        {
          toolCalls: [{ toolName: 'task_complete', args: {} }],
        } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });

    it('should not stop when task_complete is not called', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        {
          toolCalls: [{ toolName: 'search_codebase', args: {} }],
        } as any,
        {
          toolCalls: [{ toolName: 'grep_codebase', args: {} }],
        } as any,
      ];

      expect(stopFn({ steps })).toBe(false);
    });

    it('should stop on first task_complete call even with multiple steps', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        {
          toolCalls: [{ toolName: 'search_codebase', args: {} }],
        } as any,
        {
          toolCalls: [{ toolName: 'task_complete', args: {} }],
        } as any,
        {
          toolCalls: [{ toolName: 'grep_codebase', args: {} }],
        } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });
  });

  describe('max steps detection', () => {
    it('should stop when max steps is reached', () => {
      const stopFn = createDynamicStopWhen(3);
      const steps: StepResult<any>[] = [
        { toolCalls: [] } as any,
        { toolCalls: [] } as any,
        { toolCalls: [] } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });

    it('should not stop when below max steps', () => {
      const stopFn = createDynamicStopWhen(5);
      const steps: StepResult<any>[] = [
        { toolCalls: [] } as any,
        { toolCalls: [] } as any,
      ];

      expect(stopFn({ steps })).toBe(false);
    });

    it('should stop exactly at max steps', () => {
      const stopFn = createDynamicStopWhen(2);
      const steps: StepResult<any>[] = [
        { toolCalls: [] } as any,
        { toolCalls: [] } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should not stop with empty steps array', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [];

      expect(stopFn({ steps })).toBe(false);
    });

    it('should handle steps with no toolCalls', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        {} as any,
        {} as any,
      ];

      expect(stopFn({ steps })).toBe(false);
    });

    it('should handle steps with empty toolCalls array', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        { toolCalls: [] } as any,
        { toolCalls: [] } as any,
      ];

      expect(stopFn({ steps })).toBe(false);
    });

    it('should handle multiple tool calls in a single step', () => {
      const stopFn = createDynamicStopWhen();
      const steps: StepResult<any>[] = [
        {
          toolCalls: [
            { toolName: 'search_codebase', args: {} },
            { toolName: 'task_complete', args: {} },
            { toolName: 'grep_codebase', args: {} },
          ],
        } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });
  });

  describe('combined conditions', () => {
    it('should stop when both task_complete and max steps are true', () => {
      const stopFn = createDynamicStopWhen(2);
      const steps: StepResult<any>[] = [
        { toolCalls: [{ toolName: 'search_codebase', args: {} }] } as any,
        { toolCalls: [{ toolName: 'task_complete', args: {} }] } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });

    it('should stop when task_complete is true even below max steps', () => {
      const stopFn = createDynamicStopWhen(100);
      const steps: StepResult<any>[] = [
        { toolCalls: [{ toolName: 'task_complete', args: {} }] } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });

    it('should stop when max steps is reached even without task_complete', () => {
      const stopFn = createDynamicStopWhen(2);
      const steps: StepResult<any>[] = [
        { toolCalls: [{ toolName: 'search_codebase', args: {} }] } as any,
        { toolCalls: [{ toolName: 'grep_codebase', args: {} }] } as any,
      ];

      expect(stopFn({ steps })).toBe(true);
    });
  });
});
