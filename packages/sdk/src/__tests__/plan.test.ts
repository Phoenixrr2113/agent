/**
 * @fileoverview Tests for plan tool.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlanTool,
  MAX_PLAN_STEPS,
  DELEGATION_THRESHOLD,
  planDurability,
} from '../tools/plan';

describe('Plan Tool', () => {
  let tool: ReturnType<typeof createPlanTool>;

  beforeEach(() => {
    tool = createPlanTool();
  });

  describe('Constants', () => {
    it('should have correct max steps', () => {
      expect(MAX_PLAN_STEPS).toBe(25);
    });

    it('should have correct delegation threshold', () => {
      expect(DELEGATION_THRESHOLD).toBe(8);
    });

    it('should have durability config', () => {
      expect(planDurability.enabled).toBe(true);
      expect(planDurability.independent).toBe(false);
    });
  });

  describe('create action', () => {
    it('should create a plan', async () => {
      const result = await tool.execute(
        { action: 'create', title: 'Test Plan', steps: ['Step 1', 'Step 2'] },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.plan.title).toBe('Test Plan');
      expect(parsed.plan.steps).toHaveLength(2);
    });

    it('should require title and steps', async () => {
      const result = await tool.execute(
        { action: 'create' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('required');
    });

    it('should enforce max steps', async () => {
      const steps = Array(30).fill(0).map((_, i) => `Step ${i}`);
      
      const result = await tool.execute(
        { action: 'create', title: 'Big Plan', steps },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Max');
    });

    it('should flag large plans for delegation', async () => {
      const steps = Array(10).fill(0).map((_, i) => `Step ${i}`);
      
      const result = await tool.execute(
        { action: 'create', title: 'Large Plan', steps },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.delegationRecommended).toBe(true);
    });
  });

  describe('view action', () => {
    it('should view current plan', async () => {
      await tool.execute(
        { action: 'create', title: 'Test', steps: ['A', 'B'] },
        { toolCallId: 'test', messages: [] }
      );

      const result = await tool.execute(
        { action: 'view' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.plan).toBeDefined();
      expect(parsed.progress).toBe('0/2');
    });

    it('should indicate no plan when empty', async () => {
      const result = await tool.execute(
        { action: 'view' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('No active plan');
    });
  });

  describe('update_status action', () => {
    it('should update step status', async () => {
      await tool.execute(
        { action: 'create', title: 'Test', steps: ['Step 1'] },
        { toolCallId: 'test', messages: [] }
      );

      const result = await tool.execute(
        { action: 'update_status', stepName: 'Step 1', status: 'completed' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('completed');
    });
  });

  describe('add_note action', () => {
    it('should add note to step', async () => {
      await tool.execute(
        { action: 'create', title: 'Test', steps: ['Step 1'] },
        { toolCallId: 'test', messages: [] }
      );

      const result = await tool.execute(
        { action: 'add_note', stepName: 'Step 1', note: 'Important note' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('add_step action', () => {
    it('should add new step', async () => {
      await tool.execute(
        { action: 'create', title: 'Test', steps: ['Step 1'] },
        { toolCallId: 'test', messages: [] }
      );

      const result = await tool.execute(
        { action: 'add_step', stepName: 'Step 2' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(2);
    });
  });

  describe('disableDelegation config', () => {
    it('should skip delegation for large plans when disabled', async () => {
      const disabledTool = createPlanTool({ disableDelegation: true });
      const steps = Array(10).fill(0).map((_, i) => `Step ${i}`);

      const result = await disabledTool.execute(
        { action: 'create', title: 'Large Plan', steps },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.delegationRecommended).toBeFalsy();
    });
  });
});
