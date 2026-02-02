/**
 * @agent/sdk - Memory Tools
 * 
 * AI SDK tools for memory operations (remember, recall, forget).
 */

import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { MemoryStore } from './vectra-store';

// ============================================================================
// Types
// ============================================================================

export interface MemoryToolsOptions {
  /** Memory store instance */
  store: MemoryStore;
  
  /** Default number of results to return */
  defaultTopK?: number;
  
  /** Default similarity threshold */
  defaultThreshold?: number;
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Create memory tools for an agent.
 * 
 * @example
 * ```typescript
 * const memoryStore = await createMemoryStore({ path: './.memory' });
 * const memoryTools = createMemoryTools({ store: memoryStore });
 * 
 * const agent = createAgent({
 *   tools: memoryTools,
 * });
 * ```
 */
export function createMemoryTools(options: MemoryToolsOptions) {
  const { store, defaultTopK = 5, defaultThreshold = 0.7 } = options;

  const remember = tool({
    description: `Store information in long-term memory for later recall.`,
    inputSchema: z.object({
      text: z.string().min(1).max(10000).describe('Information to remember'),
      tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
      importance: z.enum(['low', 'medium', 'high']).optional().describe('Importance level'),
    }),
    execute: async ({ text, tags, importance }) => {
      try {
        const id = await store.remember(text, { tags, importance });
        return JSON.stringify({ success: true, id, message: 'Memory stored' });
      } catch (error) {
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  const recall = tool({
    description: `Search long-term memory for relevant information.`,
    inputSchema: z.object({
      query: z.string().min(1).max(1000).describe('What to search for'),
      limit: z.number().min(1).max(20).optional().describe('Max results (default 5)'),
      threshold: z.number().min(0).max(1).optional().describe('Min similarity (default 0.7)'),
    }),
    execute: async ({ query, limit, threshold }) => {
      try {
        const results = await store.recall(query, {
          topK: limit ?? defaultTopK,
          threshold: threshold ?? defaultThreshold,
        });
        return JSON.stringify({
          success: true,
          memories: results.map(r => ({
            id: r.item.id,
            text: r.item.text,
            score: Math.round(r.score * 100) / 100,
            tags: r.item.metadata?.tags,
            timestamp: r.item.timestamp,
          })),
          count: results.length,
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  const forget = tool({
    description: `Remove a specific memory from long-term storage.`,
    inputSchema: z.object({
      id: z.string().describe('Memory ID to delete'),
    }),
    execute: async ({ id }) => {
      try {
        const success = await store.forget(id);
        return JSON.stringify({ success, message: success ? 'Memory deleted' : 'Not found' });
      } catch (error) {
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  return { remember, recall, forget };
}

// ============================================================================
// Convenience Export
// ============================================================================

export { createMemoryStore, type MemoryStore, type MemoryItem, type MemorySearchResult } from './vectra-store';
