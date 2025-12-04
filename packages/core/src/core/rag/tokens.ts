/**
 * Token estimation utilities for context window management.
 * Uses character-based heuristic: ~4 characters per token for English text.
 * This is a reasonable approximation without requiring tiktoken dependency.
 */

export interface TokenBudget {
  maxTokens: number;
  systemPromptTokens: number;
  toolDefinitionsTokens: number;
  userMessageTokens: number;
  safetyBuffer: number;
  availableForRAG: number;
}

/**
 * Estimate tokens using character-based heuristic.
 * ~4 characters per token is a reasonable approximation.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate available token budget for RAG chunks.
 */
export function calculateRAGBudget(
  maxContextTokens: number,
  systemPrompt: string,
  toolCount: number,
  userMessageLength: number = 500,
  safetyBuffer: number = 500
): TokenBudget {
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Rough estimate: ~100 tokens per tool definition (description + schema)
  const toolDefinitionsTokens = toolCount * 100;

  const userMessageTokens = estimateTokens(' '.repeat(userMessageLength));

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
    const chunkTokens = estimateTokens(chunk.contextualContent);

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
