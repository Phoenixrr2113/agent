import { tool } from 'ai';

import { logger } from '@agent/shared';
import { success, error } from '../utils/tool-result.js';

import { 
  MAX_PLAN_STEPS, 
  DELEGATION_THRESHOLD, 
  PLAN_DESCRIPTION, 
  VALIDATION_DESCRIPTION,
  AVAILABLE_AGENTS,
} from './constants.js';
import { 
  planInputSchema, 
  validationInputSchema,
  type Plan, 
  type PlanToolConfig,
  type ScopeAssessment,
  type PendingDecision,
  type ValidationResult,
} from './types.js';
import { runTypeCheck, runTestCommand } from './utils.js';

export function createPlanTool(config: PlanToolConfig = {}) {
  let currentPlan: Plan | null = null;
  let pendingDecision: PendingDecision | null = null;

  function handleCreate(title?: string, steps?: string[]): string {
    if (!title || !steps) {
      return error('Title and steps required for create action');
    }
    if (steps.length > MAX_PLAN_STEPS) {
      return error(`Too many steps. Maximum allowed: ${String(MAX_PLAN_STEPS)}, provided: ${String(steps.length)}`);
    }
    currentPlan = {
      title,
      steps: steps.map(name => ({ name, status: 'pending' })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (config.disableDelegation) {
       return success({
        message: `Plan created: "${title}" with ${String(steps.length)} steps`,
        plan: currentPlan,
        scopeAssessment: {
          isLarge: false,
          stepCount: steps.length,
          recommendation: 'Task created. Proceed with implementation (Delegation disabled for this agent).',
        }
      });
    }

    const isLargeTask = steps.length >= DELEGATION_THRESHOLD;

    let scopeAssessment: ScopeAssessment;

    if (isLargeTask) {
      scopeAssessment = {
        isLarge: true,
        stepCount: steps.length,
        recommendation: `⚠️ This task has ${steps.length} steps. Consider delegating the ENTIRE task to a specialized sub-agent. Pass the original user request along with any context you've gathered. Choose the most appropriate role based on the task type.`,
        availableAgents: [...AVAILABLE_AGENTS],
        handoffExample: 'spawn_agent({ task: "<original user request + your context>", role: "<coder|researcher|analyst>" })',
      };
    } else {
      scopeAssessment = {
        isLarge: false,
        stepCount: steps.length,
        recommendation: 'Task size is manageable. Proceed with implementation.',
      };
    }

    if (scopeAssessment.isLarge) {
      pendingDecision = { required: true, stepCount: steps.length };
      logger.info('📊 Plan requires decision', { 
        stepCount: steps.length,
        recommendation: scopeAssessment.recommendation 
      });
      
      return success({
        message: `Plan created: "${title}" with ${String(steps.length)} steps`,
        plan: currentPlan,
        scopeAssessment,
        DECISION_REQUIRED: {
          message: `⚠️ This plan has ${steps.length} steps - substantial work ahead.`,
          recommended: 'delegate',
          reasoning: 'Delegation keeps your context window clean and lets specialized sub-agents focus on implementation while you coordinate.',
          nextStep: 'Call plan({ action: "decide", decision: "delegate" }) to hand off, or decision: "proceed" if you have a specific reason to do it yourself.',
        },
      });
    }

    return success({
      message: `Plan created: "${title}" with ${String(steps.length)} steps`,
      plan: currentPlan,
      scopeAssessment,
    });
  }

  function handleView(): string {
    if (!currentPlan) {
      return success({ message: 'No active plan' });
    }
    const completed = currentPlan.steps.filter(step => step.status === 'completed').length;
    const total = currentPlan.steps.length;
    const percentage = Math.round((completed / total) * 100);
    return success({
      plan: currentPlan,
      progress: `${String(completed)}/${String(total)} steps completed (${String(percentage)}%)`,
    });
  }

  function handleUpdateStatus(stepName?: string, status?: 'pending' | 'in_progress' | 'completed' | 'blocked'): string {
    if (!currentPlan || !stepName || !status) {
      return error('Active plan, stepName, and status required');
    }
    const step = currentPlan.steps.find(s => s.name === stepName);
    if (!step) {
      return error(`Step not found: ${stepName}`);
    }
    step.status = status;
    currentPlan.updatedAt = Date.now();
    const completedCount = currentPlan.steps.filter(s => s.status === 'completed').length;
    return success({
      message: `Updated "${stepName}" to ${status}`,
      progress: `${String(completedCount)}/${String(currentPlan.steps.length)} completed`,
    });
  }

  function handleAddNote(stepName?: string, note?: string): string {
    if (!currentPlan || !stepName || !note) {
      return error('Active plan, stepName, and note required');
    }
    const noteStep = currentPlan.steps.find(s => s.name === stepName);
    if (!noteStep) {
      return error(`Step not found: ${stepName}`);
    }
    noteStep.notes = note;
    currentPlan.updatedAt = Date.now();
    return success({ message: `Note added to "${stepName}"` });
  }

  function handleAddStep(stepName?: string): string {
    if (!currentPlan || !stepName) {
      return error('Active plan and stepName required');
    }
    if (currentPlan.steps.length >= MAX_PLAN_STEPS) {
      return error(`Cannot add more steps. Maximum allowed: ${String(MAX_PLAN_STEPS)}`);
    }
    currentPlan.steps.push({ name: stepName, status: 'pending' });
    currentPlan.updatedAt = Date.now();
    return success({
      message: `Added step: "${stepName}"`,
      totalSteps: currentPlan.steps.length,
    });
  }

  function handleDecide(decision?: 'delegate' | 'proceed'): string {
    if (!pendingDecision?.required) {
      return error('No pending decision. Create a plan first.');
    }
    if (!decision) {
      return error('Decision required: "delegate" or "proceed"');
    }
    
    const stepCount = pendingDecision.stepCount;
    
    if (decision === 'delegate') {
      pendingDecision = null;
      return success({
        message: 'You chose to DELEGATE. Now use spawn_agent to hand off the entire task.',
        nextAction: 'spawn_agent({ task: "<original user request + context>", role: "<coder|researcher|analyst>" })',
        availableAgents: [...AVAILABLE_AGENTS],
      });
    } else {
      if (config.disableDelegation) {
         pendingDecision = null;
         return success({ message: 'Proceeding with task.' });
      }

      return error(`Cannot proceed on a ${stepCount}-step plan. Tasks with ${DELEGATION_THRESHOLD}+ steps MUST be delegated to a sub-agent. Call plan({ action: "decide", decision: "delegate" }) instead.`);
    }
  }

  return tool({
    description: PLAN_DESCRIPTION,
    inputSchema: planInputSchema,
    execute: ({ action, title, steps, decision, stepName, status, note }) => {
      switch (action) {
        case 'create':
          return handleCreate(title, steps);
        case 'decide':
          return handleDecide(decision);
        case 'view':
          return handleView();
        case 'update_status':
          return handleUpdateStatus(stepName, status);
        case 'add_note':
          return handleAddNote(stepName, note);
        case 'add_step':
          return handleAddStep(stepName);
        default:
          return error('Invalid action');
      }
    },
  });
}

export const planTool = createPlanTool();

export const validationTool = tool({
  description: VALIDATION_DESCRIPTION,
  inputSchema: validationInputSchema,
  execute: async ({ checkTypes = true, runTests = false, filesChanged = [] }) => {
    const results: ValidationResult[] = [];
    let allPassed = true;

    if (checkTypes) {
      const typeCheck = await runTypeCheck();
      if (!typeCheck.passed) allPassed = false;
      results.push({ check: 'TypeScript type check', ...typeCheck });
    }

    if (runTests) {
      const testRun = await runTestCommand();
      if (!testRun.passed) allPassed = false;
      results.push({ check: 'Test suite', ...testRun });
    }

    return success({
      allPassed,
      results,
      filesChanged,
      recommendation: allPassed
        ? 'All checks passed. Safe to proceed.'
        : 'Some checks failed. Fix errors before continuing.',
    });
  },
});

// Direct exports for testing
export const executePlan = planTool.execute!;
export const executeValidation = validationTool.execute!;

export const toolGroups = {
  planning: {
    plan_tool: planTool,
  },

  implementation: {
    plan_tool: planTool,
    validation_tool: validationTool,
  },

  evaluation: {
    validation_tool: validationTool,
  },

  all: {
    plan_tool: planTool,
    validation_tool: validationTool,
  },
};
