/**
 * Plan tool constants
 */

export const MAX_PLAN_STEPS = 100;
export const DELEGATION_THRESHOLD = 5;

export const PLAN_DESCRIPTION = `Create and track a task checklist. Actions: create (title + steps), decide (for large plans: delegate or proceed), update_status, add_step, add_note, view. For plans with ${DELEGATION_THRESHOLD}+ steps, you MUST call decide before continuing. LIMIT: Max ${MAX_PLAN_STEPS} steps.`;

export const VALIDATION_DESCRIPTION = 'Validate code after making changes. Checks TypeScript types, runs tests, and verifies quality.';

export const AVAILABLE_AGENTS = [
  { role: 'coder', specialization: 'Production-quality code, reading codebases, testing, debugging, git operations' },
  { role: 'researcher', specialization: 'Web search, documentation retrieval, fact verification, synthesizing information' },
  { role: 'analyst', specialization: 'Data analysis, pattern recognition, statistical reasoning, presenting findings' },
] as const;
