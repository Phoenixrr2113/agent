/**
 * @fileoverview Plan tool module.
 * Provides task decomposition and progress tracking.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { DurabilityConfig } from '../../types/lifecycle';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface PlanStep {
  name: string;
  status: PlanStepStatus;
  notes?: string;
}

export interface Plan {
  title: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}

export interface PlanToolConfig {
  disableDelegation?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const MAX_PLAN_STEPS = 25;
export const DELEGATION_THRESHOLD = 8;

export const planDurability: DurabilityConfig = {
  enabled: true,
  independent: false,
  retryCount: 0,
  timeout: '1m',
};

const planInputSchema = z.object({
  action: z.enum(['create', 'decide', 'update_status', 'add_note', 'add_step', 'view']),
  title: z.string().optional(),
  steps: z.array(z.string()).optional(),
  decision: z.enum(['delegate', 'proceed']).optional(),
  stepName: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  note: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function success<T>(data: T): string {
  return JSON.stringify({ success: true, ...data });
}

function error(message: string): string {
  return JSON.stringify({ success: false, error: message });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createPlanTool(config: PlanToolConfig = {}) {
  let currentPlan: Plan | null = null;
  let pendingDecision = false;

  return tool({
    description: `Task planning and tracking. Actions: create, view, update_status, add_note, add_step, decide.
For plans with ${DELEGATION_THRESHOLD}+ steps, delegation is recommended.`,
    inputSchema: planInputSchema,
    execute: ({ action, title, steps, decision, stepName, status, note }) => {
      switch (action) {
        case 'create': {
          if (!title || !steps) return error('Title and steps required');
          if (steps.length > MAX_PLAN_STEPS) return error(`Max ${MAX_PLAN_STEPS} steps`);
          currentPlan = { title, steps: steps.map(name => ({ name, status: 'pending' })), createdAt: Date.now(), updatedAt: Date.now() };
          const isLarge = steps.length >= DELEGATION_THRESHOLD && !config.disableDelegation;
          if (isLarge) pendingDecision = true;
          return success({
            message: `Plan "${title}" created with ${steps.length} steps`,
            plan: currentPlan,
            delegationRecommended: isLarge,
          });
        }
        case 'view':
          if (!currentPlan) return success({ message: 'No active plan' });
          const completed = currentPlan.steps.filter(s => s.status === 'completed').length;
          return success({ plan: currentPlan, progress: `${completed}/${currentPlan.steps.length}` });
        case 'update_status':
          if (!currentPlan || !stepName || !status) return error('Plan, stepName, status required');
          const step = currentPlan.steps.find(s => s.name === stepName);
          if (!step) return error(`Step not found: ${stepName}`);
          step.status = status;
          currentPlan.updatedAt = Date.now();
          return success({ message: `Updated ${stepName} to ${status}` });
        case 'add_note':
          if (!currentPlan || !stepName || !note) return error('Plan, stepName, note required');
          const noteStep = currentPlan.steps.find(s => s.name === stepName);
          if (!noteStep) return error(`Step not found: ${stepName}`);
          noteStep.notes = note;
          return success({ message: `Note added to ${stepName}` });
        case 'add_step':
          if (!currentPlan || !stepName) return error('Plan and stepName required');
          currentPlan.steps.push({ name: stepName, status: 'pending' });
          return success({ message: `Added step: ${stepName}`, total: currentPlan.steps.length });
        case 'decide':
          if (!pendingDecision) return error('No pending decision');
          if (decision === 'delegate') {
            pendingDecision = false;
            return success({ message: 'Delegating. Use spawn_agent to hand off.' });
          }
          return error('Large plans must be delegated');
        default:
          return error('Invalid action');
      }
    },
  });
}
