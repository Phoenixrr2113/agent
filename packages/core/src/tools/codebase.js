import { tool } from 'ai';
import { z } from 'zod';
export function createCodebaseTools(codebaseRAG, grepWorkspace, workspaceRoot) {
    return {
        search_codebase: tool({
            description: 'Search the indexed codebase for relevant code snippets using semantic search. Use this to find implementations, patterns, or understand how the codebase works.',
            inputSchema: z.object({
                query: z.string().describe('The search query to find relevant code'),
                topK: z.number().optional().default(5).describe('Number of results to return (default: 5)'),
            }),
            execute: async ({ query, topK = 5 }) => {
                const results = await codebaseRAG.searchCodebase(query, topK);
                return JSON.stringify(results.map((r) => ({
                    file: r.filePath,
                    lines: `${r.startLine}-${r.endLine}`,
                    content: r.content,
                })));
            },
        }),
        grep_codebase: tool({
            description: 'Search for exact text patterns in the codebase using regex. Use this for finding specific strings, function names, or patterns.',
            inputSchema: z.object({
                pattern: z.string().describe('The regex pattern to search for'),
                filePattern: z.string().optional().describe('Optional file pattern to filter (e.g., "*.ts")'),
                ignoreCase: z.boolean().optional().describe('Whether to ignore case (default: false)'),
                maxResults: z.number().optional().describe('Maximum number of results (default: 100)'),
            }),
            execute: async ({ pattern, filePattern, ignoreCase, maxResults }) => {
                const results = await grepWorkspace(pattern, workspaceRoot, { filePattern, ignoreCase, maxResults });
                return JSON.stringify(results);
            },
        }),
    };
}
