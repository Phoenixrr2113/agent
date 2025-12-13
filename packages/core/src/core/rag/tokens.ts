/**
 * Token counting utilities for context window management.
 * Uses gpt-tokenizer for accurate token counting across different models.
 */

import { encode } from 'gpt-tokenizer';

export interface TokenBudget {
  maxTokens: number;
  systemPromptTokens: number;
  toolDefinitionsTokens: number;
  userMessageTokens: number;
  safetyBuffer: number;
  availableForRAG: number;
}

/**
 * Count tokens accurately using gpt-tokenizer.
 * Uses GPT-4o tokenizer which is a good approximation for most modern LLMs.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  const tokens = encode(text);
  return tokens.length;
}

/**
 * Calculate available token budget for RAG chunks.
 */
export function calculateRAGBudget(
  maxContextTokens: number,
  systemPrompt: string,
  toolCount: number,
  userMessageLength = 500,
  safetyBuffer = 500
): TokenBudget {
  const systemPromptTokens = countTokens(systemPrompt);

  // Rough estimate: ~100 tokens per tool definition (description + schema)
  const toolDefinitionsTokens = toolCount * 100;

  const userMessageTokens = countTokens(' '.repeat(userMessageLength));

  const usedTokens = systemPromptTokens + toolDefinitionsTokens + userMessageTokens + safetyBuffer;
  const availableForRAG = Math.max(0, maxContextTokens - usedTokens);

  return {
    maxTokens: maxContextTokens,
    systemPromptTokens,
    toolDefinitionsTokens,
    userMessageTokens,
    safetyBuffer,
    availableForRAG,
  };
}

/**
 * Filter chunks to fit within token budget.
 * Returns as many chunks as possible without exceeding the budget.
 */
export function filterChunksToFitBudget<T extends { contextualContent: string }>(
  chunks: T[],
  tokenBudget: number
): T[] {
  const result: T[] = [];
  let usedTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = countTokens(chunk.contextualContent);

    if (usedTokens + chunkTokens <= tokenBudget) {
      result.push(chunk);
      usedTokens += chunkTokens;
    } else {
      // Can't fit any more chunks
      break;
    }
  }

  return result;
}
