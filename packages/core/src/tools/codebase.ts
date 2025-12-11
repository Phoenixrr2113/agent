import { tool } from 'ai';
import { z } from 'zod';

export function createCodebaseTools(codebaseRAG: any) {
  return {
    search_codebase: tool({
      description: 'Search the indexed codebase for relevant code snippets using semantic search. Use this to find implementations, patterns, or understand how the codebase works.',
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant code'),
        topK: z.number().optional().default(5).describe('Number of results to return (default: 5)'),
      }),
      execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
        const results = await codebaseRAG.searchCodebase(query, { topK });
        return JSON.stringify(results.map((r: any) => ({
          file: r.filePath,
          lines: `${r.startLine}-${r.endLine}`,
          content: r.content,
        })));
      },
    }),
  };
}

