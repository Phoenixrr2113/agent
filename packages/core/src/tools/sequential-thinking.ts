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
  description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust totalThoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set nextThoughtNeeded to false when truly done`,
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

