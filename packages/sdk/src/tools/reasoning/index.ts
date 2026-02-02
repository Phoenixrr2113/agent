/**
 * @fileoverview Reasoning tool module.
 * Provides deep reasoning with streaming for complex problem-solving.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { DurabilityConfig, StreamWriter } from '../../types/lifecycle';
import type { ReasoningStepData } from '../../streaming/data-parts';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
}

export interface ReasoningResult {
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  branches: string[];
  historyLength: number;
}

export interface ReasoningConfig {
  enabled: boolean;
  maxHistorySize?: number;
}

export interface ReasoningToolOptions {
  writer?: StreamWriter;
  maxHistory?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants & Durability
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_MAX_HISTORY = 50;

export const reasoningDurability: DurabilityConfig = {
  enabled: false, // Thoughts are transient
  independent: true,
  retryCount: 0,
};

const reasoningInputSchema = z.object({
  thought: z.string().describe('Current reasoning step'),
  nextThoughtNeeded: z.boolean().describe('More reasoning needed?'),
  thoughtNumber: z.number().int().min(1),
  totalThoughts: z.number().int().min(1),
  isRevision: z.boolean().optional(),
  revisesThought: z.number().int().min(1).optional(),
  branchFromThought: z.number().int().min(1).optional(),
  branchId: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════════

export class ReasoningEngine {
  private history: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};
  private maxHistory: number;
  private writer?: StreamWriter;

  constructor(options: { maxHistory?: number; writer?: StreamWriter } = {}) {
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
    this.writer = options.writer;
  }

  processThought(input: ThoughtData): ReasoningResult {
    if (input.thoughtNumber > input.totalThoughts) {
      input.totalThoughts = input.thoughtNumber;
    }

    this.history.push(input);
    if (this.history.length > this.maxHistory) this.history.shift();

    if (input.branchId) {
      if (!this.branches[input.branchId]) this.branches[input.branchId] = [];
      this.branches[input.branchId].push(input);
    }

    // Stream transiently
    if (this.writer) {
      this.writer.write({
        type: 'data-reasoning-step',
        data: {
          stepNumber: input.thoughtNumber,
          totalSteps: input.totalThoughts,
          thought: input.thought,
          isRevision: input.isRevision,
          branchId: input.branchId,
        } satisfies ReasoningStepData,
      });
    }

    return {
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      branches: Object.keys(this.branches),
      historyLength: this.history.length,
    };
  }

  getHistory(): ThoughtData[] {
    return [...this.history];
  }

  getBranches(): Record<string, ThoughtData[]> {
    return { ...this.branches };
  }

  reset(): void {
    this.history = [];
    this.branches = {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Factory
// ═══════════════════════════════════════════════════════════════════════════════

export function createReasoningTool(options: ReasoningToolOptions = {}) {
  const engine = new ReasoningEngine(options);

  return tool({
    description: `Deep reasoning for complex problems. Thoughts are streamed transiently.
Use for multi-step analysis, debugging, or architecture decisions.`,
    inputSchema: reasoningInputSchema,
    execute: async (input) => {
      const result = engine.processThought(input as ThoughtData);
      return JSON.stringify(result);
    },
  });
}

export { createReasoningTool as createDeepReasoningTool };
