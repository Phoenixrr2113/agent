import { logger } from '@agent/shared';
import { DEFAULT_MAX_HISTORY, DEFAULT_MAX_BRANCH_SIZE } from './constants.js';
import type { ThoughtData, ReasoningResult, DeepReasoningConfig } from './types.js';

export class DeepReasoningEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};
  private maxHistorySize: number;
  private maxBranchSize: number;

  constructor(options: { maxHistorySize?: number; maxBranchSize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY;
    this.maxBranchSize = options.maxBranchSize ?? DEFAULT_MAX_BRANCH_SIZE;
  }

  processThought(input: ThoughtData): ReasoningResult {
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

// Global configuration state
let isEnabled = false;
let globalEngine: DeepReasoningEngine | null = null;

export function configureDeepReasoning(config: DeepReasoningConfig): void {
  isEnabled = config.enabled;
  
  if (config.enabled) {
    globalEngine = new DeepReasoningEngine({
      maxHistorySize: config.maxHistorySize,
      maxBranchSize: config.maxBranchSize,
    });
    logger.info('Deep reasoning enabled with unrestricted mode');
  } else {
    globalEngine = null;
    logger.info('Deep reasoning disabled');
  }
}

export function isDeepReasoningEnabled(): boolean {
  return isEnabled;
}

export function getDeepReasoningEngine(): DeepReasoningEngine {
  if (!globalEngine) {
    globalEngine = new DeepReasoningEngine();
  }
  return globalEngine;
}

export function resetDeepReasoningEngine(): void {
  globalEngine?.reset();
}
