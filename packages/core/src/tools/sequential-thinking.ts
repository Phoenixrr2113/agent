import { logger } from '@agent/shared';
import { tool } from 'ai';
import { z } from 'zod';

export interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  nextThoughtNeeded: boolean;
}

const DEFAULT_MAX_HISTORY = 1000;
const DEFAULT_MAX_BRANCH_SIZE = 100;

export class SequentialThinkingEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};
  private maxHistorySize: number;
  private maxBranchSize: number;

  constructor(options: { maxHistorySize?: number; maxBranchSize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY;
    this.maxBranchSize = options.maxBranchSize ?? DEFAULT_MAX_BRANCH_SIZE;
  }

  processThought(input: ThoughtData): {
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    branches: string[];
    thoughtHistoryLength: number;
  } {
    if (input.thoughtNumber > input.totalThoughts) {
      input.totalThoughts = input.thoughtNumber;
    }

    this.thoughtHistory.push(input);

    if (this.thoughtHistory.length > this.maxHistorySize) {
      this.thoughtHistory.shift();
    }

    if (input.branchFromThought && input.branchId) {
      if (!this.branches[input.branchId]) {
        this.branches[input.branchId] = [];
      }
      
      const branch = this.branches[input.branchId];
      if (branch) {
        branch.push(input);
        if (branch.length > this.maxBranchSize) {
          branch.shift();
        }
      }
    }

    const prefix = input.isRevision
      ? `🔄 Revision (revising thought ${input.revisesThought})`
      : (input.branchFromThought
        ? `🌿 Branch (from thought ${input.branchFromThought}, ID: ${input.branchId})`
        : '💭 Thought');

    logger.info(`${prefix} ${input.thoughtNumber}/${input.totalThoughts}`, {
      thought: input.thought.slice(0, 200) + (input.thought.length > 200 ? '...' : ''),
    });

    return {
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      branches: Object.keys(this.branches),
      thoughtHistoryLength: this.thoughtHistory.length,
    };
  }

  getHistory(): ThoughtData[] {
    return [...this.thoughtHistory];
  }

  getBranches(): Record<string, ThoughtData[]> {
    return { ...this.branches };
  }

  reset(): void {
    this.thoughtHistory = [];
    this.branches = {};
  }
}

const globalEngine = new SequentialThinkingEngine();

export const sequentialThinkingTool = tool({
  description: `Think through complex problems step-by-step. Use when you need to analyze, debug, or understand something before acting. Call repeatedly with: thought (your reasoning), thoughtNumber (1,2,3...), totalThoughts (estimate), nextThoughtNeeded (false when done). You can use other tools between thoughts to gather information. Supports revising earlier thoughts or branching into alternatives. NOT for task tracking—use plan for that. LIMITS: Keeps last ${DEFAULT_MAX_HISTORY} thoughts in main history, ${DEFAULT_MAX_BRANCH_SIZE} thoughts per branch (older thoughts auto-removed).`,
  inputSchema: z.object({
    thought: z.string().describe('Your current reasoning step - one clear idea or observation'),
    nextThoughtNeeded: z.boolean().describe('True if you need more reasoning steps, false when done'),
    thoughtNumber: z.number().int().min(1).describe('Current step number (1, 2, 3...)'),
    totalThoughts: z.number().int().min(1).describe('How many steps you expect to need'),
    isRevision: z.boolean().optional().describe('True if reconsidering a previous thought'),
    revisesThought: z.number().int().min(1).optional().describe('Which thought number to revise'),
    branchFromThought: z.number().int().min(1).optional().describe('Split reasoning from this thought'),
    branchId: z.string().optional().describe('Name for this reasoning branch'),
    needsMoreThoughts: z.boolean().optional().describe('True if need to extend thinking'),
  }),
  execute: async (input) => {
    const result = globalEngine.processThought(input as ThoughtData);
    return JSON.stringify(result);
  },
});

export function getSequentialThinkingEngine(): SequentialThinkingEngine {
  return globalEngine;
}

export function resetSequentialThinkingEngine(): void {
  globalEngine.reset();
}

