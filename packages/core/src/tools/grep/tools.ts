import { tool } from 'ai';
import { z } from 'zod';

import { runRg } from './cli.js';
import { formatGrepResult } from './utils.js';
import { success, error } from '../utils/tool-result.js';

const grepInputSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for in file contents'),
  include: z
    .string()
    .optional()
    .describe('File pattern to include (e.g., "*.ts", "*.{js,jsx}")'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in. Defaults to current working directory.'),
  context: z
    .number()
    .optional()
    .describe('Number of context lines to show around matches (max 10)'),
  caseSensitive: z
    .boolean()
    .optional()
    .describe('Enable case-sensitive matching (default: smart case)'),
  wholeWord: z
    .boolean()
    .optional()
    .describe('Match whole words only'),
});

export const grepTool = tool({
  description:
    'Fast content search (60s timeout, 10MB output limit). ' +
    'Uses ripgrep when available, falls back to grep. ' +
    'Supports regex patterns and file filtering. ' +
    'Returns file paths with line numbers and matching content.',
  inputSchema: grepInputSchema,
  execute: async (args) => {
    try {
      const result = await runRg({
        pattern: args.pattern,
        paths: args.path ? [args.path] : undefined,
        globs: args.include ? [args.include] : undefined,
        context: args.context,
        caseSensitive: args.caseSensitive,
        wholeWord: args.wholeWord,
      });

      if (result.error) {
        return error(result.error);
      }

      const output = formatGrepResult(result);

      return success({
        output,
        matches: result.matches,
        totalMatches: result.totalMatches,
        filesSearched: result.filesSearched,
        truncated: result.truncated,
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
});

export function createGrepTool() {
  return { grep: grepTool };
}
