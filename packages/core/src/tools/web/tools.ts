import { tool } from 'ai';

import { success, error } from '../utils/tool-result.js';
import { ToolError, ToolErrorType } from '../middleware/index.js';

import { WEB_DESCRIPTION, DEFAULT_MAX_LENGTH, DEFAULT_MAX_RESULTS } from './constants.js';
import { webInputSchema, type BraveSearchResult, type TavilySearchResult } from './types.js';
import { braveSearch, tavilySearch, fetchAndParsePage } from './utils.js';

export function createWebTool() {
  return tool({
    description: WEB_DESCRIPTION,
    inputSchema: webInputSchema,
    execute: async (input) => {
      const { action } = input;

      switch (action) {
        case 'search': {
          const { query, engine = 'tavily', maxResults = DEFAULT_MAX_RESULTS, deep = false } = input;
          
          if (!query) {
            throw new ToolError('query is required for search action', ToolErrorType.INVALID_INPUT);
          }

          const results: {
            brave?: BraveSearchResult[];
            tavily?: TavilySearchResult[];
            answer?: string;
            braveError?: string;
            tavilyError?: string;
          } = {};

          if (engine === 'brave' || engine === 'both') {
            try {
              results.brave = await braveSearch(query, maxResults);
            } catch (err) {
              results.braveError = err instanceof Error ? err.message : String(err);
            }
          }

          if (engine === 'tavily' || engine === 'both') {
            try {
              const tavily = await tavilySearch(query, {
                maxResults,
                searchDepth: deep ? 'advanced' : 'basic',
              });
              results.tavily = tavily.results;
              if (tavily.answer) {
                results.answer = tavily.answer;
              }
            } catch (err) {
              results.tavilyError = err instanceof Error ? err.message : String(err);
            }
          }

          if (!results.brave && !results.tavily) {
            return error('No search results available', {
              braveError: results.braveError,
              tavilyError: results.tavilyError,
            });
          }

          return success({
            query,
            engine,
            ...results,
          });
        }

        case 'fetch': {
          const { url, maxLength = DEFAULT_MAX_LENGTH } = input;
          
          if (!url) {
            throw new ToolError('url is required for fetch action', ToolErrorType.INVALID_INPUT);
          }

          try {
            const page = await fetchAndParsePage(url, maxLength);
            return success({ ...page });
          } catch (err) {
            return error(err instanceof Error ? err.message : 'Failed to fetch page', { url });
          }
        }

        default:
          throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
      }
    },
  });
}

export const webTool = createWebTool();

// Direct export for testing
export const executeWeb = webTool.execute!;
