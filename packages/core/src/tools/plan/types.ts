import { z } from 'zod';

export interface PlanStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
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

export interface ScopeAssessment {
  isLarge: boolean;
  stepCount: number;
  recommendation: string;
  availableAgents?: Array<{ role: string; specialization: string }>;
  handoffExample?: string;
}

export interface PendingDecision {
  required: boolean;
  stepCount: number;
}

export const planInputSchema = z.object({
  action: z.enum(['create', 'decide', 'update_status', 'add_note', 'add_step', 'view']).describe('What to do'),
  title: z.string().optional().describe('Plan title (when creating)'),
  steps: z.array(z.string()).optional().describe('List of step names (when creating)'),
  decision: z.enum(['delegate', 'proceed']).optional().describe('For large plans: delegate to sub-agent or proceed yourself'),
  stepName: z.string().optional().describe('Which step to update'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().describe('New status for the step'),
  note: z.string().optional().describe('Note to attach to a step'),
});

export type PlanInput = z.infer<typeof planInputSchema>;

export const validationInputSchema = z.object({
  checkTypes: z.boolean().optional().describe('Run TypeScript type checking (default: true)'),
  runTests: z.boolean().optional().describe('Run test suite (default: false)'),
  filesChanged: z.array(z.string()).optional().describe('Files that were modified'),
});

export type ValidationInput = z.infer<typeof validationInputSchema>;

export interface ValidationResult {
  check: string;
  passed: boolean;
  details?: string;
}
