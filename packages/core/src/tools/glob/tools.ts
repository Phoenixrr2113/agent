import { tool } from 'ai';
import { z } from 'zod';

import { runRgFiles } from './cli.js';
import { formatGlobResult } from './utils.js';
import { success, error } from '../utils/tool-result.js';

const globInputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts", "*.json")'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in. Defaults to current working directory.'),
  maxDepth: z
    .number()
    .optional()
    .describe('Maximum directory depth to search (default: 20)'),
  hidden: z
    .boolean()
    .optional()
    .describe('Include hidden files and directories'),
});

export const globTool = tool({
  description:
    'Fast file pattern matching (60s timeout, 100 file limit). ' +
    'Uses ripgrep when available, falls back to find. ' +
    'Supports glob patterns like "**/*.js" or "src/**/*.ts". ' +
    'Returns matching file paths sorted by modification time.',
  inputSchema: globInputSchema,
  execute: async (args) => {
    try {
      const result = await runRgFiles({
        pattern: args.pattern,
        paths: args.path ? [args.path] : undefined,
        maxDepth: args.maxDepth,
        hidden: args.hidden,
      });

      if (result.error) {
        return error(result.error);
      }

      const output = formatGlobResult(result);

      return success({
        output,
        files: result.files.map((f) => f.path),
        count: result.totalFiles,
        truncated: result.truncated,
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
});

export function createGlobTool() {
  return { glob: globTool };
}
