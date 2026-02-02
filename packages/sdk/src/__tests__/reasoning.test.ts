/**
 * @fileoverview Tests for reasoning tool.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createReasoningTool,
  ReasoningEngine,
  DEFAULT_MAX_HISTORY,
  reasoningDurability,
} from '../tools/reasoning';

describe('Reasoning Tool', () => {
  describe('Constants', () => {
    it('should have correct max history', () => {
      expect(DEFAULT_MAX_HISTORY).toBe(50);
    });

    it('should have durability disabled (transient)', () => {
      expect(reasoningDurability.enabled).toBe(false);
      expect(reasoningDurability.independent).toBe(true);
    });
  });

  describe('ReasoningEngine', () => {
    let engine: ReasoningEngine;

    beforeEach(() => {
      engine = new ReasoningEngine();
    });

    it('should process thoughts', () => {
      const result = engine.processThought({
        thought: 'First thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      });

      expect(result.thoughtNumber).toBe(1);
      expect(result.totalThoughts).toBe(3);
      expect(result.nextThoughtNeeded).toBe(true);
      expect(result.historyLength).toBe(1);
    });

    it('should auto-adjust totalThoughts', () => {
      const result = engine.processThought({
        thought: 'Extended thought',
        thoughtNumber: 5,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      });

      expect(result.totalThoughts).toBe(5);
    });

    it('should track branches', () => {
      engine.processThought({
        thought: 'Main thought',
        thoughtNumber: 1,
        totalThoughts: 2,
        nextThoughtNeeded: true,
      });

      engine.processThought({
        thought: 'Branch thought',
        thoughtNumber: 2,
        totalThoughts: 2,
        nextThoughtNeeded: false,
        branchFromThought: 1,
        branchId: 'alternative',
      });

      const result = engine.processThought({
        thought: 'Another branch',
        thoughtNumber: 3,
        totalThoughts: 3,
        nextThoughtNeeded: false,
        branchId: 'alternative',
      });

      expect(result.branches).toContain('alternative');
    });

    it('should limit history size', () => {
      const smallEngine = new ReasoningEngine({ maxHistory: 3 });

      for (let i = 1; i <= 5; i++) {
        smallEngine.processThought({
          thought: `Thought ${i}`,
          thoughtNumber: i,
          totalThoughts: 5,
          nextThoughtNeeded: i < 5,
        });
      }

      const history = smallEngine.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should reset engine', () => {
      engine.processThought({
        thought: 'Thought',
        thoughtNumber: 1,
        totalThoughts: 1,
        nextThoughtNeeded: false,
      });

      engine.reset();

      const history = engine.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('createReasoningTool', () => {
    it('should create tool with execute function', () => {
      const tool = createReasoningTool();
      expect(tool.execute).toBeDefined();
    });

    it('should process thought input', async () => {
      const tool = createReasoningTool();
      
      const result = await tool.execute(
        {
          thought: 'Analyzing the problem',
          thoughtNumber: 1,
          totalThoughts: 2,
          nextThoughtNeeded: true,
        },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.thoughtNumber).toBe(1);
      expect(parsed.nextThoughtNeeded).toBe(true);
    });

    it('should handle revisions', async () => {
      const tool = createReasoningTool();
      
      await tool.execute(
        { thought: 'Initial', thoughtNumber: 1, totalThoughts: 2, nextThoughtNeeded: true },
        { toolCallId: 'test', messages: [] }
      );

      const result = await tool.execute(
        {
          thought: 'Revised thinking',
          thoughtNumber: 2,
          totalThoughts: 2,
          nextThoughtNeeded: false,
          isRevision: true,
          revisesThought: 1,
        },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.thoughtNumber).toBe(2);
    });
  });
});
