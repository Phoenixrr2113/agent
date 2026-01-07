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

export interface ReasoningResult {
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  branches: string[];
  thoughtHistoryLength: number;
}

export interface DeepReasoningConfig {
  /**
   * When true, enables deep reasoning with no step restrictions
   */
  enabled: boolean;
  
  /**
   * Maximum thoughts to keep in history (older ones are discarded)
   */
  maxHistorySize?: number;
  
  /**
   * Maximum thoughts per branch
   */
  maxBranchSize?: number;
}

export const deepReasoningInputSchema = z.object({
  thought: z.string().describe('Your current reasoning step - one clear idea or observation'),
  nextThoughtNeeded: z.boolean().describe('True if you need more reasoning steps, false when done'),
  thoughtNumber: z.number().int().min(1).describe('Current step number (1, 2, 3...)'),
  totalThoughts: z.number().int().min(1).describe('How many steps you expect to need'),
  isRevision: z.boolean().optional().describe('True if reconsidering a previous thought'),
  revisesThought: z.number().int().min(1).optional().describe('Which thought number to revise'),
  branchFromThought: z.number().int().min(1).optional().describe('Split reasoning from this thought'),
  branchId: z.string().optional().describe('Name for this reasoning branch'),
  needsMoreThoughts: z.boolean().optional().describe('True if need to extend thinking'),
});

export type DeepReasoningInput = z.infer<typeof deepReasoningInputSchema>;
