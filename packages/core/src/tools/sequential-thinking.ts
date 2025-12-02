import { tool } from 'ai';
import { z } from 'zod';
import { logger } from '@agent/shared';

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

export class SequentialThinkingEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

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

    if (input.branchFromThought && input.branchId) {
      if (!this.branches[input.branchId]) {
        this.branches[input.branchId] = [];
      }
      this.branches[input.branchId].push(input);
    }

    const prefix = input.isRevision
      ? `🔄 Revision (revising thought ${input.revisesThought})`
      : input.branchFromThought
        ? `🌿 Branch (from thought ${input.branchFromThought}, ID: ${input.branchId})`
        : '💭 Thought';

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
  description: `Record a reasoning step. Use for complex problems where you need to think through multiple steps. You can pause between thoughts to gather information, use other tools, or take actions, then continue reasoning. Set nextThoughtNeeded to false when you've reached your conclusion.`,
  inputSchema: z.object({
    thought: z.string().describe('Your current thinking step'),
    nextThoughtNeeded: z.boolean().describe('Whether another thought step is needed'),
    thoughtNumber: z.number().int().min(1).describe('Current thought number'),
    totalThoughts: z.number().int().min(1).describe('Estimated total thoughts needed'),
    isRevision: z.boolean().optional().describe('Whether this revises previous thinking'),
    revisesThought: z.number().int().min(1).optional().describe('Which thought is being reconsidered'),
    branchFromThought: z.number().int().min(1).optional().describe('Branching point thought number'),
    branchId: z.string().optional().describe('Branch identifier'),
    needsMoreThoughts: z.boolean().optional().describe('If more thoughts are needed'),
  }),
  execute: async (input) => {
    const result = globalEngine.processThought(input as ThoughtData);
    return JSON.stringify(result);
  },
});

export function getSequentialThinkingEngine(): SequentialThinkingEngine {
  return globalEngine;
}

