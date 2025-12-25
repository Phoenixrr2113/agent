import { tool } from 'ai';
import { z } from 'zod';

import { logger } from '@agent/shared';
import { executeCommand } from './utils/shell.js';
import { success, error } from './utils/tool-result.js';

interface PlanStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  notes?: string;
}

interface Plan {
  title: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}

const MAX_PLAN_STEPS = 100;
const DELEGATION_THRESHOLD = 5;

export function createPlanTool(config: { disableDelegation?: boolean } = {}) {
  let currentPlan: Plan | null = null;
  let pendingDecision: { required: boolean; stepCount: number } | null = null;

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

    // If delegation is disabled, we skip the large task check entirely
    if (config.disableDelegation) {
       return success({
        message: `Plan created: "${title}" with ${String(steps.length)} steps`,
        plan: currentPlan,
        scopeAssessment: {
          isLarge: false, // Force false to avoid triggering decision logic in UI if any
          stepCount: steps.length,
          recommendation: 'Task created. Proceed with implementation (Delegation disabled for this agent).',
        }
      });
    }

    const isLargeTask = steps.length >= DELEGATION_THRESHOLD;

    let scopeAssessment: {
      isLarge: boolean;
      stepCount: number;
      recommendation: string;
      availableAgents?: Array<{ role: string; specialization: string }>;
      handoffExample?: string;
    };

    if (isLargeTask) {
      scopeAssessment = {
        isLarge: true,
        stepCount: steps.length,
        recommendation: `⚠️ This task has ${steps.length} steps. Consider delegating the ENTIRE task to a specialized sub-agent. Pass the original user request along with any context you've gathered. Choose the most appropriate role based on the task type.`,
        availableAgents: [
          { role: 'coder', specialization: 'Production-quality code, reading codebases, testing, debugging, git operations' },
          { role: 'researcher', specialization: 'Web search, documentation retrieval, fact verification, synthesizing information' },
          { role: 'analyst', specialization: 'Data analysis, pattern recognition, statistical reasoning, presenting findings' },
        ],
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
        availableAgents: [
          { role: 'coder', specialization: 'Production-quality code, testing, debugging' },
          { role: 'researcher', specialization: 'Web search, documentation, fact verification' },
          { role: 'analyst', specialization: 'Data analysis, pattern recognition' },
        ],
      });
    } else {
      // If delegation was disabled, we shouldn't actally reach here because pendingDecision wouldn't be set.
      // But purely for safety:
      if (config.disableDelegation) {
         pendingDecision = null;
         return success({ message: 'Proceeding with task.' });
      }

      // Reject proceed for large plans
      return error(`Cannot proceed on a ${stepCount}-step plan. Tasks with ${DELEGATION_THRESHOLD}+ steps MUST be delegated to a sub-agent. Call plan({ action: "decide", decision: "delegate" }) instead.`);
    }
  }

  return tool({
    description: `Create and track a task checklist. Actions: create (title + steps), decide (for large plans: delegate or proceed), update_status, add_step, add_note, view. For plans with ${DELEGATION_THRESHOLD}+ steps, you MUST call decide before continuing. LIMIT: Max ${String(MAX_PLAN_STEPS)} steps.`,
    inputSchema: z.object({
      action: z.enum(['create', 'decide', 'update_status', 'add_note', 'add_step', 'view']).describe('What to do'),
      title: z.string().optional().describe('Plan title (when creating)'),
      steps: z.array(z.string()).optional().describe('List of step names (when creating)'),
      decision: z.enum(['delegate', 'proceed']).optional().describe('For large plans: delegate to sub-agent or proceed yourself'),
      stepName: z.string().optional().describe('Which step to update'),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().describe('New status for the step'),
      note: z.string().optional().describe('Note to attach to a step'),
    }),
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

// Default instance for backward compatibility
export const planTool = createPlanTool();


async function runTypeCheck(): Promise<{ passed: boolean; details: string }> {
  const result = await executeCommand('pnpm exec tsc --noEmit', {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.exitCode === 0) {
    const output = result.stdout || result.stderr || '';
    return { passed: true, details: output ? output.substring(0, 500) : 'No type errors found' };
  }
  const errorOutput = result.stderr || result.stdout || result.error || '';
  return { passed: false, details: errorOutput.substring(0, 1000) };
}

async function runTestCommand(): Promise<{ passed: boolean; details: string }> {
  const result = await executeCommand('pnpm test', {
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.exitCode === 0) {
    const output = result.stdout || result.stderr || '';
    const testSummary = output.split('\n').slice(-10).join('\n');
    return { passed: true, details: testSummary || 'All tests passed' };
  }
  const errorOutput = result.stderr ?? result.stdout ?? result.error ?? '';
  return { passed: false, details: errorOutput.substring(0, 1000) };
}

export const validationTool = tool({
  description: 'Validate code after making changes. Checks TypeScript types, runs tests, and verifies quality.',
  inputSchema: z.object({
    checkTypes: z.boolean().optional().describe('Run TypeScript type checking (default: true)'),
    runTests: z.boolean().optional().describe('Run test suite (default: false)'),
    filesChanged: z.array(z.string()).optional().describe('Files that were modified'),
  }),
  execute: async ({ checkTypes = true, runTests = false, filesChanged = [] }) => {
    const results: Array<{ check: string; passed: boolean; details?: string }> = [];
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
