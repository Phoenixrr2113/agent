import { tool } from 'ai';
import { z } from 'zod';

import { runSg } from './cli.js';
import { CLI_LANGUAGES } from './constants.js';
import { formatSearchResult, formatReplaceResult } from './utils.js';
import { success, error } from '../utils/tool-result.js';
import type { CliLanguage } from './types.js';

const languageEnum = z.enum(CLI_LANGUAGES as unknown as [string, ...string[]]);

function getEmptyResultHint(pattern: string, lang: CliLanguage): string | null {
  const src = pattern.trim();

  if (lang === 'python') {
    if (src.startsWith('class ') && src.endsWith(':')) {
      const withoutColon = src.slice(0, -1);
      return `💡 Hint: Remove trailing colon. Try: "${withoutColon}"`;
    }
    if ((src.startsWith('def ') || src.startsWith('async def ')) && src.endsWith(':')) {
      const withoutColon = src.slice(0, -1);
      return `💡 Hint: Remove trailing colon. Try: "${withoutColon}"`;
    }
  }

  if (['javascript', 'typescript', 'tsx'].includes(lang)) {
    if (/^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/i.test(src)) {
      return '💡 Hint: Function patterns need params and body. Try "function $NAME($$$) { $$$ }"';
    }
  }

  return null;
}

const astGrepSearchInputSchema = z.object({
  pattern: z
    .string()
    .describe('AST pattern with meta-variables ($VAR, $$$). Must be complete AST node.'),
  lang: languageEnum.describe('Target language'),
  paths: z
    .array(z.string())
    .optional()
    .describe('Paths to search (default: ["."])'),
  globs: z
    .array(z.string())
    .optional()
    .describe('Include/exclude globs (prefix ! to exclude)'),
  context: z.number().optional().describe('Context lines around match'),
});

export const astGrepSearchTool = tool({
  description:
    'Search code patterns using AST-aware matching. Supports 25 languages. ' +
    'Use meta-variables: $VAR (single node), $$$ (multiple nodes). ' +
    'Patterns must be complete AST nodes (valid code). ' +
    'Examples: "console.log($MSG)", "def $FUNC($$$):", "async function $NAME($$$)"',
  inputSchema: astGrepSearchInputSchema,
  execute: async (args) => {
    try {
      const result = await runSg({
        pattern: args.pattern,
        lang: args.lang as CliLanguage,
        paths: args.paths,
        globs: args.globs,
        context: args.context,
      });

      if (result.error) {
        return error(result.error);
      }

      let output = formatSearchResult(result);

      if (result.matches.length === 0 && !result.error) {
        const hint = getEmptyResultHint(args.pattern, args.lang as CliLanguage);
        if (hint) {
          output += `\n\n${hint}`;
        }
      }

      return success({
        output,
        matches: result.matches.map((m) => ({
          file: m.file,
          line: m.range.start.line + 1,
          column: m.range.start.column + 1,
          text: m.text,
          lines: m.lines,
        })),
        totalMatches: result.totalMatches,
        truncated: result.truncated,
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
});

const astGrepReplaceInputSchema = z.object({
  pattern: z.string().describe('AST pattern to match'),
  rewrite: z.string().describe('Replacement pattern (can use $VAR from pattern)'),
  lang: languageEnum.describe('Target language'),
  paths: z.array(z.string()).optional().describe('Paths to search'),
  globs: z.array(z.string()).optional().describe('Include/exclude globs'),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe('Preview changes without applying (default: true)'),
});

export const astGrepReplaceTool = tool({
  description:
    'Replace code patterns using AST-aware rewriting. ' +
    'Dry-run by default. Use meta-variables in rewrite to preserve matched content. ' +
    'Example: pattern="console.log($MSG)" rewrite="logger.info($MSG)"',
  inputSchema: astGrepReplaceInputSchema,
  execute: async (args) => {
    try {
      const result = await runSg({
        pattern: args.pattern,
        rewrite: args.rewrite,
        lang: args.lang as CliLanguage,
        paths: args.paths,
        globs: args.globs,
        updateAll: args.dryRun === false,
      });

      if (result.error) {
        return error(result.error);
      }

      const output = formatReplaceResult(result, args.dryRun !== false);

      return success({
        output,
        matches: result.matches.map((m) => ({
          file: m.file,
          line: m.range.start.line + 1,
          column: m.range.start.column + 1,
          original: m.text,
          replacement: m.replacement,
        })),
        totalMatches: result.totalMatches,
        applied: args.dryRun === false,
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  },
});

export function createAstGrepTools() {
  return {
    ast_grep_search: astGrepSearchTool,
    ast_grep_replace: astGrepReplaceTool,
  };
}
